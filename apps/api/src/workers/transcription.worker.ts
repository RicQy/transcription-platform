import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue.js';
import { replicate, anthropic } from '../lib/ai.js';
import { getSocket } from '../lib/socket.js';
import { db } from '../db.js';
import { enforce } from '@transcribe/cvl-engine';

export const transcriptionWorker = new Worker('transcription', async (job: Job) => {
  const { audioFileId, storageUrl, provider } = job.data;
  const io = getSocket();

  console.log(`[Worker] Starting job ${job.id} for audio ${audioFileId}`);
  
  try {
    io.emit(`audio:${audioFileId}:progress`, { status: 'asr_active' });
    let rawText = '';
    let transcriptionData: any = {};

    if (provider === 'whisperx') {
      const output = await replicate.run(
        "victor-upmeet/whisperx:84d2627e7d68a98f1f5035fcd7a31b67f1b74d47cbaf0effda9930fca56ec483",
        { input: { audio: storageUrl, batch_size: 64, align_output: true } }
      );
      transcriptionData = output;
      const segments = Array.isArray(output) ? output : (output as any).segments;
      rawText = segments ? segments.map((s: any) => s.text).join(' ') : (String((output as any).text) || '');
    } else {
      rawText = "Alternative provider transcription results.";
    }

    io.emit(`audio:${audioFileId}:raw_completed`, { text: rawText });

    // LLM Styling
    const { data: activeGuide } = await db.from('style_guides').select('id').eq('is_active', true).single() as any;
    let finalOutput = rawText;
    if (activeGuide) {
      const { data: rules } = await db.from('style_guide_rules').select('*').eq('guide_id', activeGuide.id).execute() as any;
      if (rules?.length > 0) {
        io.emit(`audio:${audioFileId}:styling`, { status: 'applying_rules' });
        finalOutput = await applyStyleGuideDirect(rawText, rules);
      }
    }

    // CVL Enforcement
    io.emit(`audio:${audioFileId}:cvl`, { status: 'enforcing_cvl' });
    const cvlResult = enforce(finalOutput);

    // Save Transcript
    await db.from('transcripts').insert([{
      audio_file_id: audioFileId,
      style_guide_id: activeGuide?.id || null,
      raw_transcription: JSON.stringify(transcriptionData),
      content: { raw: rawText, llm_cleaned: finalOutput, formatted: cvlResult.text, stats: cvlResult.stats },
      full_text: cvlResult.text,
      status: 'completed',
      completed_at: new Date().toISOString()
    }]).select().single() as any;

    await db.from('audio_files').update({ transcription_status: 'completed' }).eq('id', audioFileId).execute();
    io.emit(`audio:${audioFileId}:finished`, { text: cvlResult.text });

    console.log(`[Worker] Finished job ${job.id}`);
    return { success: true };

  } catch (err) {
    console.error(`[Worker] Job ${job.id} failed:`, err);
    io.emit(`audio:${audioFileId}:error`, { error: String(err) });
    throw err; // Allow BullMQ to handle retries
  }
}, { connection });

async function applyStyleGuideDirect(text: string, rules: any[]): Promise<string> {
  const rulesText = rules.map((r: any) => `- ${r.rule_type}: ${r.rule_text}`).join('\n');
  const prompt = `You are a legal transcription formatter. Apply these rules strictly:\n${rulesText}\n\nReturn ONLY the formatted text.`;
  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 4000,
    messages: [{ role: "user", content: `${prompt}\n\nText:\n${text}` }]
  });
  return (msg.content[0] as any).text || text;
}

transcriptionWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} permanently failed:`, err);
});
