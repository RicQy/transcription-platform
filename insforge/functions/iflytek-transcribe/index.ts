/// <reference path="./deno.d.ts" />
import { createClient } from 'npm:@insforge/sdk';
import { enforce } from './cvl-engine.ts';
import type { CVLResult } from './cvl-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface TranscribeRequest {
  audioFileId: string;
  useDiarization?: boolean;
  provider?: 'openai' | 'iflytek';
}

interface StyleGuideRule {
  rule_type: string;
  rule_text: string;
}

const IFLYTEK_APP_ID = Deno.env.get('IFLYTEK_APP_ID') || '';
const IFLYTEK_API_KEY = Deno.env.get('IFLYTEK_API_KEY') || '';
const IFLYTEK_API_SECRET = Deno.env.get('IFLYTEK_API_SECRET') || '';

async function buildSignature(origin: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const originData = encoder.encode(origin);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, originData);
  const sigBytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    binary += String.fromCharCode(sigBytes[i]);
  }
  return btoa(binary);
}

async function createIFlyTekAuthUrl(): Promise<string> {
  const host = 'iat-api-sg.xf-yun.com';
  const path = '/v2/iat';
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = await buildSignature(signatureOrigin, IFLYTEK_API_SECRET);
  
  const authorizationOrigin = `api_key="${IFLYTEK_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = btoa(authorizationOrigin);

  const params = new URLSearchParams({
    authorization,
    date,
    host,
  });

  return `wss://${host}${path}?${params}`;
}

/**
 * Encode a Uint8Array to base64 safely (handles large buffers without stack overflow).
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * iFlytek WebSocket v2 expects raw PCM frames.
 * The frontend already sends pure s16le PCM (no WAV/RIFF header).
 * We chunk into 1280-byte frames (~40ms at 16kHz/mono/16-bit).
 */
const FRAME_SIZE = 1280;

async function transcribeWithIFLyTek(audioBuffer: ArrayBuffer, onProgress?: (text: string) => void): Promise<string> {
  const authUrl = await createIFlyTekAuthUrl();
  const socket = new WebSocket(authUrl);
  const pcmData = new Uint8Array(audioBuffer);

  return new Promise((resolve, reject) => {
    let resultText = '';
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Transcription timed out'));
    }, 120000); // 2 min timeout for long audio

    socket.onopen = () => {
      // First frame: includes config + first audio chunk
      const firstChunk = pcmData.slice(0, FRAME_SIZE);
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
          audio: uint8ToBase64(firstChunk),
        },
      };
      socket.send(JSON.stringify(firstFrame));

      // Send remaining audio in FRAME_SIZE chunks
      let offset = FRAME_SIZE;
      const sendNext = () => {
        // Send up to 5 frames per tick to maintain flow without flooding
        let sent = 0;
        while (offset < pcmData.length && sent < 5) {
          const end = Math.min(offset + FRAME_SIZE, pcmData.length);
          const isLast = end >= pcmData.length;
          const chunk = pcmData.slice(offset, end);

          const frame = {
            data: {
              status: isLast ? 2 : 1,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: uint8ToBase64(chunk),
            },
          };
          socket.send(JSON.stringify(frame));
          offset = end;
          sent++;

          if (isLast) return; // Done sending
        }

        if (offset < pcmData.length) {
          setTimeout(sendNext, 40); // ~40ms interval matches real-time 16kHz audio rate
        }
      };

      // Start streaming after a brief delay to let the server process the first frame
      setTimeout(sendNext, 40);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.code !== 0) {
        clearTimeout(timeout);
        socket.close();
        reject(new Error(`iFlytek Error: ${data.message} (code ${data.code})`));
        return;
      }

      if (data.data && data.data.result) {
        const ws = data.data.result.ws;
        let frameText = '';
        for (const item of ws) {
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
    };

    socket.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };

    socket.onclose = () => {
      clearTimeout(timeout);
      resolve(resultText);
    };
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
  client: ReturnType<typeof createClient>,
  transcription: string,
  rules: StyleGuideRule[],
): Promise<string> {
  const prompt = buildStyleGuidePrompt(rules);

  const completion = await client.ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    messages: [
      {
        role: 'user',
        content: `${prompt}

Transcript to format:

${transcription}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 8000,
  });

  const formattedText = completion.choices[0]?.message?.content?.trim();
  return formattedText || transcription;
}

/**
 * Fire-and-forget background transcription.
 * Runs after the HTTP 202 response has already been sent.
 * Deno Deploy keeps the isolate alive while outstanding promises exist.
 */
async function transcribeAsync(
  audioFileId: string,
  audioBuffer: ArrayBuffer,
  provider: 'openai' | 'iflytek',
  useDiarization: boolean,
  client: ReturnType<typeof createClient>,
  openAiKey: string | undefined,
): Promise<void> {
  try {
    let rawText = '';
    let transcription: Record<string, unknown> = {};

    if (provider === 'iflytek') {
      if (!IFLYTEK_APP_ID || !IFLYTEK_API_KEY || !IFLYTEK_API_SECRET) {
        throw new Error('iFLYTEK credentials not configured');
      }

      const iflytekResult = await transcribeWithIFLyTek(audioBuffer, (text) => {
        // Fire-and-forget: do NOT await inside high-frequency streaming callback
        // Prevents backpressure from stalling the WebSocket pipeline
        client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_PROGRESS', {
          audioFileId,
          text,
        });
      });
      rawText = iflytekResult;
      transcription = { text: rawText, provider: 'iflytek' };
    } else {
      if (!openAiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      formData.append('file', blob, 'audio.mp3');
      formData.append('model', 'gpt-4o-transcribe-diarize');
      formData.append('response_format', useDiarization ? 'diarized_json' : 'verbose_json');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiKey}` },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        throw new Error(`Whisper transcription failed: ${errorText}`);
      }

      transcription = await whisperResponse.json();
      rawText = (transcription.text as string) || '';
    }

    // Notify raw transcription completed
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_RAW_COMPLETED', {
      audioFileId,
      text: rawText,
    });

    // ─── Layer 2: LLM Light Cleanup (readability) ─────────────────────────
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
        llmCleanedText = await applyStyleGuide(client, rawText, rules as StyleGuideRule[]);
      }
    }

    // ─── Layer 3: CVL Rule Engine (deterministic compliance) ─────────────
    await client.realtime.publish(`audio:${audioFileId}`, 'CVL_ENFORCEMENT', { audioFileId });
    const cvlResult: CVLResult = enforce(llmCleanedText);
    const formattedText = cvlResult.text;

    console.log(`CVL Engine: score=${cvlResult.score}, violations=${cvlResult.violations.length}`, cvlResult.stats);

    // Persist transcript with CVL metadata
    const transcriptData: Record<string, unknown> = {
      audio_file_id: audioFileId,
      style_guide_id: activeGuide?.id || null,
      raw_transcription: JSON.stringify(transcription),
      content: {
        raw: rawText,
        llm_cleaned: llmCleanedText,
        formatted: formattedText,
        applied_style_guide: activeGuide?.id || null,
        cvl_score: cvlResult.score,
        cvl_violations_count: cvlResult.violations.length,
        cvl_stats: cvlResult.stats,
      },
      status: 'completed',
      completed_at: new Date().toISOString(),
      full_text: formattedText,
    };

    const { data: transcript, error: insertError } = await client.database
      .from('transcripts')
      .insert([transcriptData])
      .select()
      .single();

    if (insertError) throw insertError;

    await client.database
      .from('audio_files')
      .update({
        transcription_status: 'completed',
        transcript_id: transcript.id,
      })
      .eq('id', audioFileId);

    // Final notification — frontend picks this up via realtime subscription
    await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_FINISHED', {
      audioFileId,
      transcriptId: transcript.id,
      text: formattedText,
    });
  } catch (error) {
    console.error('Background transcription error:', error);
    try {
      await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_FAILED', {
        audioFileId,
        error: String(error),
      });
      await client.database
        .from('audio_files')
        .update({ transcription_status: 'failed' })
        .eq('id', audioFileId);
    } catch (e) {
      console.error('Failed to notify error:', e);
    }
  }
}

// ─── Edge Function Entry Point ───────────────────────────────────────────────
// InsForge expects: export default { async fetch(req) {} }
// NOT: export default async function handler(req) {}

export default {
  async fetch(req: Request): Promise<Response> {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check — responds instantly for InsForge MCP probes
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'iflytek-transcribe' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
    const anonKey = Deno.env.get('ANON_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!baseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = createClient({ baseUrl, anonKey });

    if (req.method === 'POST') {
      try {
        const body = (await req.json()) as TranscribeRequest;
        const { audioFileId, useDiarization = true, provider = 'openai' } = body;

        if (!audioFileId) {
          return new Response(JSON.stringify({ error: 'Missing required field: audioFileId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Mark as processing (lightweight DB writes — fast)
        await client.realtime.publish(`audio:${audioFileId}`, 'TRANSCRIPTION_STARTED', {
          audioFileId,
          provider,
        });

        await client.database
          .from('audio_files')
          .update({ transcription_status: 'processing' })
          .eq('id', audioFileId);

        // Validate audio file exists
        const { data: audioFile, error: fetchError } = await client.database
          .from('audio_files')
          .select('*')
          .eq('id', audioFileId)
          .single();

        if (fetchError || !audioFile) {
          return new Response(JSON.stringify({ error: 'Audio file not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const storageUrl = audioFile.storage_url;
        if (!storageUrl) {
          return new Response(JSON.stringify({ error: 'Audio file has no storage URL' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Download audio buffer (needed before we can fire-and-forget)
        const audioResponse = await fetch(storageUrl);
        if (!audioResponse.ok) {
          return new Response(JSON.stringify({ error: 'Failed to download audio file' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const audioBuffer = await audioResponse.arrayBuffer();

        // 🔥 Fire-and-forget: kick off transcription in the background
        // Do NOT await — return 202 immediately so health checks never stall
        // Deno Deploy keeps the isolate alive while this promise is pending
        transcribeAsync(audioFileId, audioBuffer, provider, useDiarization, client, openAiKey);

        // Return immediately — frontend tracks progress via realtime events
        return new Response(
          JSON.stringify({ status: 'started', audioFileId }),
          { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (error) {
        console.error('Request handling error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to start transcription', details: String(error) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

