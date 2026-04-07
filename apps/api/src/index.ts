import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@insforge/sdk';
import { enforce } from '@transcribe/cvl-engine';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Config from .env or default to known values found in the workspace
const INSFORGE_BASE_URL = process.env.INSFORGE_BASE_URL || 'https://yyjgv7tf.us-east.insforge.app';
const ANON_KEY = process.env.ANON_KEY || 'ik_a1e6a66611e981f737542adf05edd2bf';
const PORT = process.env.PORT || 3002;

const client = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: ANON_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

interface TranscribeRequest {
  audioFileId: string;
  provider?: 'openai' | 'iflytek';
  useDiarization?: boolean;
}

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'legal-transcribe-api', timestamp: new Date() });
});

// ─── Transcription Endpoint ───────────────────────────────────────────────────
app.post('/transcribe', async (req, res) => {
  const { audioFileId, provider = 'openai', useDiarization = true } = req.body as TranscribeRequest;

  if (!audioFileId) {
    return res.status(400).json({ error: 'Missing required field: audioFileId' });
  }

  try {
    // 1. Initial State Update via InsForge Realtime
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_STARTED', {
      audioFileId,
      provider,
    });

    await client.database
      .from('audio_files')
      .update({ transcription_status: 'processing' })
      .eq('id', audioFileId);

    // 2. Validate Audio File Presence
    const { data: audioFile, error: fetchError } = await client.database
      .from('audio_files')
      .select('*')
      .eq('id', audioFileId)
      .single();

    if (fetchError || !audioFile) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    if (!audioFile.storage_url) {
      return res.status(400).json({ error: 'Audio file has no storage URL' });
    }

    // 3. Fire-and-forget: background transcription
    // In Option A, this will eventually call WhisperX
    transcribeAsync(audioFileId, audioFile.storage_url, provider, useDiarization);

    // Respond immediately with 202 Accepted
    return res.status(202).json({
      status: 'started',
      audioFileId,
      message: 'Transcription background job initiated.',
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error while starting transcription' });
  }
});

/**
 * Background transcription worker.
 * Orchestrates: ASR (Whisper) -> LLM (Claude) -> CVL (Deterministic)
 */
async function transcribeAsync(
  audioFileId: string,
  storageUrl: string,
  provider: string,
  useDiarization: boolean,
) {
  try {
    // Stage 1: Download Audio
    const response = await fetch(storageUrl);
    if (!response.ok) throw new Error('Failed to fetch audio from storage');
    const audioBuffer = await response.arrayBuffer();

    // Stage 2: ASR Layer (Placeholder for WhisperX)
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_PROGRESS', { status: 'asr_active' });
    
    let rawText = "Initial transcription text placeholder.";
    // TODO: Implement actual WhisperX local call or containerization here
    // Currently using mock/API fallback until WhisperX worker is configured

    // Stage 3: LLM Layer (Claude Opus for Readability)
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_STYLING', { audioFileId });
    let llmCleanedText = rawText; // TODO: Port applyStyleGuide logic here

    // Stage 4: CVL Engine Layer (Deterministic Enforcement)
    await client.realtime.publish(`audio:${audioFileId}`, 'CVL_ENFORCEMENT', { audioFileId });
    const cvlResult = enforce(llmCleanedText);
    const formattedText = cvlResult.text;

    // Stage 5: Save & Notify
    const { data: transcript, error: insertError } = await client.database
      .from('transcripts')
      .insert([{
        audio_file_id: audioFileId,
        content: {
          raw: rawText,
          llm_cleaned: llmCleanedText,
          formatted: formattedText,
          cvl_score: cvlResult.score,
          cvl_violations_count: cvlResult.violations.length,
          cvl_stats: cvlResult.stats,
        },
        full_text: formattedText,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    await client.database
      .from('audio_files')
      .update({ 
        transcription_status: 'completed', 
        transcript_id: transcript.id 
      })
      .eq('id', audioFileId);

    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_FINISHED', {
      audioFileId,
      transcriptId: transcript.id,
      text: formattedText,
    });

  } catch (error) {
    console.error('Background job error:', error);
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_FAILED', {
      audioFileId,
      error: String(error),
    });
    await client.database
      .from('audio_files')
      .update({ transcription_status: 'failed' })
      .eq('id', audioFileId);
  }
}

app.listen(PORT, () => {
  console.log(`Legal Transcribe Node API running on http://localhost:${PORT}`);
});
