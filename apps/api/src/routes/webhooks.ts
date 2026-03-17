import { Router, IRouter, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { getIo } from '../sockets/index';
import { logger } from '../utils/logger';

const router: IRouter = Router();

const WordResultSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number(),
  speaker_id: z.string().default('SPEAKER_00'),
});

const AsrCompleteSchema = z.object({
  audio_id: z.string(),
  status: z.enum(['complete', 'error']),
  words: z.array(WordResultSchema).optional(),
  error: z.string().optional(),
});

router.post('/asr-complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AsrCompleteSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }

    const { audio_id, status, words, error } = parsed.data;

    if (status === 'error') {
      await prisma.audioFile.update({
        where: { id: audio_id },
        data: { status: 'ERROR' },
      });

      getIo()?.emit('transcript:status', { audioId: audio_id, status: 'ERROR', progress: 0 });

      res.json({ ok: true });
      return;
    }

    if (!words || words.length === 0) {
      res.status(400).json({ error: 'No words in payload' });
      return;
    }

    const audioFile = await prisma.audioFile.findUnique({ where: { id: audio_id } });
    if (!audioFile) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    const speakerGroups = groupWordsBySpeaker(words);

    const transcript = await prisma.transcript.create({
      data: {
        audioFileId: audio_id,
        version: 1,
        segments: {
          create: speakerGroups.map((group) => ({
            speaker: group.speakerId,
            text: group.words.map((w) => w.word).join(' '),
            startTime: group.words[0].start,
            endTime: group.words[group.words.length - 1].end,
            confidence: average(group.words.map((w) => w.confidence)),
            wordData: group.words.map((w) => ({
              word: w.word,
              start_time: w.start,
              end_time: w.end,
              confidence: w.confidence,
              speaker_id: w.speaker_id,
            })),
          })),
        },
      },
    });

    await prisma.audioFile.update({
      where: { id: audio_id },
      data: { status: 'COMPLETE' },
    });

    logger.info('ASR complete, transcript created', { audioId: audio_id, transcriptId: transcript.id });

    getIo()?.emit('transcript:status', { audioId: audio_id, status: 'COMPLETE', progress: 100 });
    getIo()?.emit('transcript:ready', { transcriptId: transcript.id });

    res.json({ ok: true, transcriptId: transcript.id });
  } catch (err) {
    next(err);
  }
});

interface WordResult {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker_id: string;
}

interface SpeakerGroup {
  speakerId: string;
  words: WordResult[];
}

function groupWordsBySpeaker(words: WordResult[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];

  for (const word of words) {
    const last = groups[groups.length - 1];
    if (last && last.speakerId === word.speaker_id) {
      last.words.push(word);
    } else {
      groups.push({ speakerId: word.speaker_id, words: [word] });
    }
  }

  return groups;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default router;
