/// <reference path="./deno.d.ts" />
import { createClient } from 'npm:@insforge/sdk';

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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function convertToPCM(mp3Buffer: ArrayBuffer): Promise<ArrayBuffer> {
  console.log('Converting MP3 to PCM...');

  const uint8Array = new Uint8Array(mp3Buffer);

  let start = 0;
  while (start < uint8Array.length - 4) {
    if (uint8Array[start] === 0xff && (uint8Array[start + 1] & 0xe0) === 0xe0) break;
    start++;
  }

  const frameCount = Math.floor((uint8Array.length - start) / 417);

  const pcmData: number[] = [];

  for (let i = 0; i < frameCount && start + i * 417 < uint8Array.length - 417; i++) {
    const frameStart = start + i * 417;
    const header =
      (uint8Array[frameStart] << 24) |
      (uint8Array[frameStart + 1] << 16) |
      (uint8Array[frameStart + 2] << 8) |
      uint8Array[frameStart + 3];

    const version = (header >> 19) & 0x3;
    const layer = (header >> 17) & 0x3;
    const bitrateIndex = (header >> 12) & 0xf;
    const sampleRateIndex = (header >> 10) & 0x3;
    const channels = (header >> 6) & 0x3;

    const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const sampleRates = [44100, 48000, 32000, 0];

    const bitrate = bitrates[bitrateIndex] * 1000;
    const sampleRate = sampleRates[sampleRateIndex];

    if (bitrate === 0 || sampleRate === 0) break;

    const frameSize = Math.floor(
      (144 * bitrate) / sampleRate + (version === 3 && layer === 1 ? 0 : 0),
    );
    const dataStart = frameStart + (version === 3 && layer === 3 ? 2 : 4);

    let ptr = dataStart;
    let left = 0,
      right = 0;

    for (let j = 0; j < 32 && ptr + 4 < frameStart + frameSize; j++) {
      const b1 = uint8Array[ptr];
      const b2 = uint8Array[ptr + 1];

      let sample = ((b1 & 0xff) << 24) | ((b2 & 0xff) << 16);
      sample >>= 16;

      if (sample > 32767) sample -= 65536;

      if (j < 16) left = (left * 32767 + sample) / 32768;
      else right = (right * 32767 + sample) / 32768;

      ptr += 2;
    }

    if (channels === 1) {
      pcmData.push(Math.floor(left));
      pcmData.push(Math.floor(left));
    } else {
      pcmData.push(Math.floor(left));
      pcmData.push(Math.floor(right));
    }
  }

  const pcmBuffer = new ArrayBuffer(pcmData.length * 2);
  const pcmView = new DataView(pcmBuffer);
  for (let i = 0; i < pcmData.length; i++) {
    const sample = Math.max(-32768, Math.min(32767, pcmData[i]));
    pcmView.setInt16(i * 2, sample, true);
  }

  console.log('Converted to PCM, size:', pcmBuffer.byteLength, 'bytes');
  return pcmBuffer;
}

async function transcribeWithIFLyTek(audioBuffer: ArrayBuffer): Promise<string> {
  console.log('iFLYTEK: Starting transcription');
  console.log('iFLYTEK: APP_ID =', IFLYTEK_APP_ID);
  console.log('iFLYTEK: Audio size =', audioBuffer.byteLength, 'bytes');

  const pcmBuffer = await convertToPCM(audioBuffer);
  const pcmBytes = new Uint8Array(pcmBuffer);

  let binary = '';
  for (let i = 0; i < pcmBytes.byteLength; i++) {
    binary += String.fromCharCode(pcmBytes[i]);
  }
  const audioBase64 = btoa(binary);

  const host = 'api.xfyun.cn';
  const path = '/v1/service/v1/iat';
  const curTime = Math.floor(Date.now() / 1000).toString();

  const param = { engine_type: 'sms16k', aue: 'raw' };
  const paramBase64 = btoa(JSON.stringify(param));

  const checkSumInput = IFLYTEK_API_KEY + curTime + paramBase64;
  const keyData = new TextEncoder().encode(IFLYTEK_API_SECRET);
  const inputData = new TextEncoder().encode(checkSumInput);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, inputData);
  const sigBytes = new Uint8Array(sig);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    sigBinary += String.fromCharCode(sigBytes[i]);
  }
  const checkSum = btoa(sigBinary);

  const body = new URLSearchParams();
  body.set('audio', audioBase64);
  body.set('appid', IFLYTEK_APP_ID);

  console.log('iFLYTEK: Calling API...');

  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      'X-Appid': IFLYTEK_APP_ID,
      'X-CurTime': curTime,
      'X-Param': paramBase64,
      'X-CheckSum': checkSum,
    },
    body: body.toString(),
  });

  console.log('iFLYTEK: Response status =', response.status);

  const responseText = await response.text();
  console.log('iFLYTEK: Response body:', responseText.substring(0, 800));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseText}`);
  }

  const result = JSON.parse(responseText);
  console.log('iFLYTEK: Result code =', result.code, 'desc =', result.desc);

  if (result.code !== 0 && result.code !== '0') {
    throw new Error(`iFLYTEK error ${result.code}: ${result.desc}`);
  }

  if (!result.data || !result.data.result || !result.data.result.ws) {
    throw new Error('No transcription result returned');
  }

  const transcription = result.data.result.ws
    .map((s: { cw: { w: string }[] }) => s.cw.map((w: { w: string }) => w.w).join(''))
    .join(' ');

  console.log('iFLYTEK: Transcription complete:', transcription.substring(0, 100));
  return transcription;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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
      const { audioFileId, provider = 'openai' } = body;

      if (!audioFileId) {
        return new Response(JSON.stringify({ error: 'Missing audioFileId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await client.database
        .from('audio_files')
        .update({ transcription_status: 'processing' })
        .eq('id', audioFileId);

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

      const audioResponse = await fetch(audioFile.storage_url);
      if (!audioResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to download audio' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      let rawText = '';
      let transcription: Record<string, unknown> = {};

      if (provider === 'iflytek') {
        if (!IFLYTEK_APP_ID || !IFLYTEK_API_KEY || !IFLYTEK_API_SECRET) {
          return new Response(JSON.stringify({ error: 'iFLYTEK credentials not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        try {
          const iflytekResult = await transcribeWithIFLyTek(audioBuffer);
          rawText = iflytekResult;
          transcription = { text: rawText, provider: 'iflytek' };
        } catch (e) {
          await client.database
            .from('audio_files')
            .update({ transcription_status: 'failed' })
            .eq('id', audioFileId);
          return new Response(JSON.stringify({ error: `iFLYTEK error: ${e}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: 'OpenAI provider not ready' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: transcript, error: insertError } = await client.database
        .from('transcripts')
        .insert([
          {
            audio_file_id: audioFileId,
            raw_transcription: JSON.stringify(transcription),
            content: { raw: rawText, formatted: rawText },
            status: 'completed',
            completed_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Failed to save transcript', details: insertError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await client.database
        .from('audio_files')
        .update({ transcription_status: 'completed', transcript_id: transcript.id })
        .eq('id', audioFileId);

      return new Response(JSON.stringify({ success: true, transcript }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Transcription error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: String(error) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
