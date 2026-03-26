// deno-lint-ignore-file
declare const Deno: {
  env: { get(key: string): string | undefined };
};
import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface TranscribeRequest {
  audioFileId: string;
  provider?: 'openai' | 'iflytek';
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

async function transcribeWithIFLyTek(audioBuffer: ArrayBuffer): Promise<string> {
  console.log('iFLYTEK: Starting transcription');
  console.log('iFLYTEK: APP_ID =', IFLYTEK_APP_ID);
  console.log('iFLYTEK: Audio size =', audioBuffer.byteLength, 'bytes');

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

  const audioBase64 = uint8ArrayToBase64(new Uint8Array(audioBuffer));

  const formData = new FormData();
  formData.append('audio', audioBase64);
  formData.append('appid', IFLYTEK_APP_ID);
  formData.append('rate', '16000');
  formData.append('format', 'wav');
  formData.append('engine_type', 'sms16k');
  formData.append('lang', 'en_us');
  formData.append('accent', 'mandarin');

  console.log('iFLYTEK: Sending request to API...');

  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Appid': IFLYTEK_APP_ID,
      'X-CurTime': curTime,
      'X-Param': paramBase64,
      'X-CheckSum': checkSum,
    },
    body: new URLSearchParams({
      audio: audioBase64,
      appid: IFLYTEK_APP_ID,
    }).toString(),
  });

  console.log('iFLYTEK: Response status =', response.status);

  const responseText = await response.text();
  console.log('iFLYTEK: Response body length =', responseText.length);

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
      const { audioFileId, provider = 'iflytek' } = body;

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

      console.log('Downloading audio, storage_key:', audioFile.storage_key);
      let audioBuffer: ArrayBuffer;

      try {
        // Use SDK storage download (handles auth internally)
        const { data: blob, error: downloadError } = await client.storage
          .from('audio-files')
          .download(audioFile.storage_key);

        if (downloadError || !blob) {
          throw new Error(downloadError?.message || 'SDK download returned no data');
        }

        audioBuffer = await blob.arrayBuffer();
        console.log('Audio downloaded via SDK, size:', audioBuffer.byteLength);
      } catch (sdkErr) {
        console.log('SDK download failed, trying authenticated fetch:', sdkErr);

        // Fallback: fetch with auth header
        const audioResponse = await fetch(audioFile.storage_url, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
          },
        });

        if (!audioResponse.ok) {
          const errBody = await audioResponse.text().catch(() => '');
          console.error('Audio fetch failed:', audioResponse.status, errBody);
          await client.database
            .from('audio_files')
            .update({ transcription_status: 'failed' })
            .eq('id', audioFileId);
          return new Response(
            JSON.stringify({
              error: 'Failed to download audio',
              details: `HTTP ${audioResponse.status}: ${errBody}`,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        audioBuffer = await audioResponse.arrayBuffer();
        console.log('Audio downloaded via fetch, size:', audioBuffer.byteLength);
      }


      if (provider === 'iflytek') {
        if (!IFLYTEK_APP_ID || !IFLYTEK_API_KEY || !IFLYTEK_API_SECRET) {
          return new Response(JSON.stringify({ error: 'iFLYTEK credentials not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        try {
          const result = await transcribeWithIFLyTek(audioBuffer);

          const { data: transcript, error: insertError } = await client.database
            .from('transcripts')
            .insert([
              {
                audio_file_id: audioFileId,
                raw_transcription: JSON.stringify({ text: result, provider: 'iflytek' }),
                content: { raw: result, formatted: result },
                status: 'completed',
                completed_at: new Date().toISOString(),
              },
            ])
            .select()
            .single();

          if (insertError) {
            throw new Error(`Failed to save transcript: ${insertError.message}`);
          }

          await client.database
            .from('audio_files')
            .update({ transcription_status: 'completed', transcript_id: transcript.id })
            .eq('id', audioFileId);

          return new Response(JSON.stringify({ success: true, transcript }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
      }

      return new Response(JSON.stringify({ error: 'Provider not supported' }), {
        status: 400,
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
