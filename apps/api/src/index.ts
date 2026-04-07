import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@insforge/sdk';
import { enforce } from '@transcribe/cvl-engine';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';

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
  provider?: 'openai' | 'iflytek' | 'whisperx';
  useDiarization?: boolean;
}

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'legal-transcribe-api', timestamp: new Date() });
});

// ─── Transcription Endpoint ───────────────────────────────────────────────────
app.post('/transcribe', async (req, res) => {
  const { audioFileId, provider = 'whisperx', useDiarization = true } = req.body as TranscribeRequest;

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

import crypto from 'crypto';
import WebSocket from 'ws';
import FormData from 'form-data';
import fetch from 'node-fetch'; // using node-fetch if global fetch is not available or just use global fetch if node > 18

interface StyleGuideRule {
  rule_type: string;
  rule_text: string;
}

const IFLYTEK_APP_ID = process.env.IFLYTEK_APP_ID || '';
const IFLYTEK_API_KEY = process.env.IFLYTEK_API_KEY || '';
const IFLYTEK_API_SECRET = process.env.IFLYTEK_API_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
});

function buildSignature(origin: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(origin);
  return hmac.digest('base64');
}

function createIFlyTekAuthUrl(): string {
  const host = 'iat-api-sg.xf-yun.com';
  const path = '/v2/iat';
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = buildSignature(signatureOrigin, IFLYTEK_API_SECRET);
  
  const authorizationOrigin = `api_key="${IFLYTEK_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  const params = new URLSearchParams({
    authorization,
    date,
    host,
  });

  return `wss://${host}${path}?${params}`;
}

const FRAME_SIZE = 1280;

async function transcribeWithIFLyTek(audioBuffer: ArrayBuffer, onProgress?: (text: string) => void): Promise<string> {
  const authUrl = createIFlyTekAuthUrl();
  const socket = new WebSocket(authUrl);
  const pcmData = Buffer.from(audioBuffer);

  return new Promise((resolve, reject) => {
    let resultText = '';
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Transcription timed out'));
    }, 120000); 

    socket.on('open', () => {
      const firstChunk = pcmData.subarray(0, FRAME_SIZE);
      const firstFrame = {
        common: { app_id: IFLYTEK_APP_ID },
        business: {
          language: 'en_us',
          domain: 'iat',
          accent: 'mandarin',
          vinfo: 1,
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: firstChunk.toString('base64'),
        },
      };
      socket.send(JSON.stringify(firstFrame));

      let offset = FRAME_SIZE;
      const sendNext = () => {
        let sent = 0;
        while (offset < pcmData.length && sent < 5) {
          const end = Math.min(offset + FRAME_SIZE, pcmData.length);
          const isLast = end >= pcmData.length;
          const chunk = pcmData.subarray(offset, end);

          const frame = {
            data: {
              status: isLast ? 2 : 1,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: chunk.toString('base64'),
            },
          };
          socket.send(JSON.stringify(frame));
          offset = end;
          sent++;

          if (isLast) return; 
        }

        if (offset < pcmData.length) {
          setTimeout(sendNext, 40); 
        }
      };

      setTimeout(sendNext, 40);
    });

    socket.on('message', (dataRaw: WebSocket.Data) => {
      const data = JSON.parse(dataRaw.toString());
      if (data.code !== 0) {
        clearTimeout(timeout);
        socket.close();
        reject(new Error(`iFlytek Error: ${data.message} (code ${data.code})`));
        return;
      }

      if (data.data && data.data.result) {
        const wsData = data.data.result.ws;
        let frameText = '';
        for (const item of wsData) {
          for (const cw of item.cw) {
            frameText += cw.w;
          }
        }
        resultText += frameText;
        onProgress?.(resultText);

        if (data.data.status === 2) {
          clearTimeout(timeout);
          socket.close();
          resolve(resultText);
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      resolve(resultText);
    });
  });
}

function buildStyleGuidePrompt(rules: StyleGuideRule[]): string {
  if (!rules || rules.length === 0) {
    return 'Apply standard legal transcription formatting.';
  }

  const rulesText = rules.map((r) => `- ${r.rule_type}: ${r.rule_text}`).join('\n');

  return `You are a legal transcription editor. Format the following transcript strictly according to these style guide rules:

${rulesText}

IMPORTANT:
1. Apply ALL rules consistently throughout the transcript
2. If the transcript contains speaker labels, ensure they follow the SpeakerFormatting rule
3. Remove filler words (um, uh, er, etc.) unless the FillerWordHandling rule says otherwise
4. Use proper punctuation according to PunctuationConvention
5. Maintain the original meaning while applying formatting rules
6. Return ONLY the formatted transcript, no explanations`;
}

async function applyStyleGuide(
  transcription: string,
  rules: StyleGuideRule[],
): Promise<string> {
  const prompt = buildStyleGuidePrompt(rules);

  const completion = await client.ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\nTranscript to format:\n\n${transcription}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 8000,
  });

  const formattedText = completion.choices[0]?.message?.content?.trim();
  return formattedText || transcription;
}

/**
 * Background transcription worker.
 * Orchestrates: ASR (Whisper/iFlytek) -> LLM (Claude) -> CVL (Deterministic)
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

    // Stage 2: ASR Layer (Whisper / iFlytek / WhisperX)
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_PROGRESS', { status: 'asr_active' });
    
    let rawText = '';
    let transcriptionData: Record<string, unknown> = {};

    if (provider === 'whisperx') {
      if (!REPLICATE_API_TOKEN) throw new Error('Replicate API key missing');

      const output = await replicate.run(
        "victor-upmeet/whisperx:84d2627e7d68a98f1f5035fcd7a31b67f1b74d47cbaf0effda9930fca56ec483",
        {
          input: {
            audio: storageUrl,
            batch_size: 64,
            align_output: true,
            debug: false
          }
        }
      );
      
      transcriptionData = output as Record<string, unknown>;
      rawText = "";
      // Handle the object structure from victor-upmeet/whisperx
      const segments = Array.isArray(transcriptionData) ? transcriptionData : transcriptionData.segments;
      if (Array.isArray(segments)) {
         rawText = segments.map((s: any) => s.text).join(' ');
      } else if (transcriptionData.text) {
         rawText = String(transcriptionData.text);
      }

    } else if (provider === 'iflytek') {
      if (!IFLYTEK_APP_ID || !IFLYTEK_API_KEY || !IFLYTEK_API_SECRET) {
        throw new Error('iFLYTEK credentials not configured');
      }

      rawText = await transcribeWithIFLyTek(audioBuffer, (text) => {
        client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_PROGRESS', {
          audioFileId,
          text,
        });
      });
      transcriptionData = { text: rawText, provider: 'iflytek' };
    } else {
      if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const formData = new FormData();
      const buffer = Buffer.from(audioBuffer);
      formData.append('file', buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
      formData.append('model', 'gpt-4o-transcribe-diarize');
      formData.append('response_format', useDiarization ? 'diarized_json' : 'verbose_json');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          // @ts-ignore
          ...formData.getHeaders()
        },
        body: formData as any, // type assertion needed for node-fetch compatibility
      });

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        throw new Error(`Whisper transcription failed: ${errorText}`);
      }

      transcriptionData = await whisperResponse.json() as Record<string, unknown>;
      rawText = (transcriptionData.text as string) || '';
    }

    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_RAW_COMPLETED', {
      audioFileId,
      text: rawText,
    });

    // Stage 3: LLM Layer (Claude Opus for Readability)
    const { data: activeGuide } = await client.database
      .from('style_guides')
      .select('id')
      .eq('is_active', true)
      .single();

    let llmCleanedText = rawText;
    if (activeGuide) {
      const { data: rules } = await client.database
        .from('style_guide_rules')
        .select('rule_type, rule_text')
        .eq('guide_id', activeGuide.id)
        .eq('is_active', true);

      if (rules && rules.length > 0) {
        await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_STYLING', { audioFileId });
        llmCleanedText = await applyStyleGuide(rawText, rules as StyleGuideRule[]);
      }
    }

    // Stage 4: CVL Engine Layer (Deterministic Enforcement)
    await client.realtime.publish(`audio:${audioFileId}`, 'CVL_ENFORCEMENT', { audioFileId });
    const cvlResult = enforce(llmCleanedText);
    const formattedText = cvlResult.text;

    // Stage 5: Save & Notify
    const { data: transcript, error: insertError } = await client.database
      .from('transcripts')
      .insert([{
        audio_file_id: audioFileId,
        style_guide_id: activeGuide?.id || null,
        raw_transcription: JSON.stringify(transcriptionData),
        content: {
          raw: rawText,
          llm_cleaned: llmCleanedText,
          formatted: formattedText,
          applied_style_guide: activeGuide?.id || null,
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
