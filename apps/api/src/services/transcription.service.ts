import { replicate, anthropic } from '../lib/ai.js';
import { getSocket } from '../lib/socket.js';
import { db } from '../db.js';
import { enforce } from '@transcribe/cvl-engine';

class TranscriptionService {
  async transcribe(audioFileId: string, provider: string = 'whisperx') {
    const { data: audioFile } = await db.from('audio_files').select('*').eq('id', audioFileId).single() as any;
    if (!audioFile) throw new Error('File not found');

    const io = getSocket();
    io.emit(`audio:${audioFileId}:status`, { status: 'TRANSCRIPTION_STARTED' });
    await db.from('audio_files').update({ transcription_status: 'processing' }).eq('id', audioFileId).execute();

    // Start background processing
    this.processTranscription(audioFileId, audioFile.storage_url, provider);

    return { status: 'processing', audioFileId };
  }

  private async processTranscription(audioFileId: string, storageUrl: string, provider: string) {
    const io = getSocket();
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
          finalOutput = await this.applyStyleGuideDirect(rawText, rules);
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
      }]).select().single();

      await db.from('audio_files').update({ transcription_status: 'completed' }).eq('id', audioFileId).execute();
      io.emit(`audio:${audioFileId}:finished`, { text: cvlResult.text });

    } catch (err) {
      console.error('Transcription background task failed:', err);
      io.emit(`audio:${audioFileId}:error`, { error: String(err) });
    }
  }

  async applyStyleGuideDirect(text: string, rules: any[]): Promise<string> {
    const rulesText = rules.map((r: any) => `- ${r.rule_type}: ${r.rule_text}`).join('\n');
    const prompt = `You are a legal transcription formatter. Apply these rules strictly:\n${rulesText}\n\nReturn ONLY the formatted text.`;
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      messages: [{ role: "user", content: `${prompt}\n\nText:\n${text}` }]
    });
    return (msg.content[0] as any).text || text;
  }

  async getTranscript(audioFileId: string) {
    const { data: transcript } = await db.from('transcripts').select('*').eq('audio_file_id', audioFileId).single() as any;
    return transcript;
  }

  async updateTranscript(id: string, body: any) {
    const { data: transcript } = await db.from('transcripts').update(body).eq('id', id).execute() as any;
    return transcript;
  }
}

export const transcriptionService = new TranscriptionService();
