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
  let sigBinary = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    sigBinary += String.fromCharCode(sigBytes[i]);
  }
  return btoa(sigBinary);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
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

  const baseUrl = 'api.xfyun.cn';
  const path = '/v1/service/v1/iat';
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${baseUrl}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = await buildSignature(signatureOrigin, IFLYTEK_API_SECRET);

  const param = {
    engine_type: 'sms16k',
    language: 'en_us',
    accent: 'mandarin',
    audio_format: 'wav',
    sample_rate: '16000',
    webflag: 1,
  };
  const paramBase64 = arrayBufferToBase64(new TextEncoder().encode(JSON.stringify(param)).buffer);

  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]));
  formData.append('format', 'wav');
  formData.append('rate', '16000');
  formData.append('engine_type', 'sms16k');
  formData.append('lang', 'en_us');
  formData.append('accent', 'mandarin');
  formData.append('appid', IFLYTEK_APP_ID);
  formData.append('api_key', IFLYTEK_API_KEY);
  formData.append('ts', Math.floor(Date.now() / 1000).toString());
  formData.append('sign', signatureSha);
  formData.append('param', paramBase64);

  console.log('iFLYTEK: Sending request to API...');

  const response = await fetch(`https://${baseUrl}${path}`, {
    method: 'POST',
    body: formData,
  });

  console.log('iFLYTEK: Response status =', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`iFLYTEK API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('iFLYTEK: Result code =', result.code);

  if (result.code !== 0) {
    throw new Error(`iFLYTEK error: ${result.desc} (code: ${result.code})`);
  }

  const transcription = result.data.result.ws
    .map((s: { cw: { w: string }[] }) => s.cw.map((w: { w: string }) => w.w).join(''))
    .join(' ');

  console.log('iFLYTEK: Transcription complete:', transcription.substring(0, 100));
  return transcription;
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

      const client = createClient({ baseUrl, anonKey });

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

      const storageUrl = audioFile.storage_url;
      if (!storageUrl) {
        return new Response(JSON.stringify({ error: 'Audio file has no storage URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const audioResponse = await fetch(storageUrl);
      if (!audioResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to download audio file' }), {
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

        const iflytekResult = await transcribeWithIFLyTek(audioBuffer);
        rawText = iflytekResult;
        transcription = { text: rawText, provider: 'iflytek' };
      } else {
        if (!openAiKey) {
          return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        formData.append('file', blob, 'audio.mp3');
        formData.append('model', 'gpt-4o-transcribe-diarize');
        formData.append('response_format', useDiarization ? 'diarized_json' : 'verbose_json');

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAiKey}`,
          },
          body: formData,
        });

        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          console.error('Whisper API error:', errorText);
          await client.database
            .from('audio_files')
            .update({ transcription_status: 'failed' })
            .eq('id', audioFileId);
          return new Response(
            JSON.stringify({ error: 'Whisper transcription failed', details: errorText }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        transcription = await whisperResponse.json();

        if (transcription.text) {
          rawText = transcription.text as string;
        } else if (transcription.segments) {
          rawText = (transcription.segments as Array<{ speaker?: string; text: string }>)
            .map((seg) => {
              const speaker = seg.speaker ? `${seg.speaker}: ` : '';
              return `${speaker}${seg.text}`;
            })
            .join('\n');
        }
      }

      const { data: activeGuide } = await client.database
        .from('style_guides')
        .select('id')
        .eq('is_active', true)
        .single();

      let formattedText = rawText;
      if (activeGuide) {
        const { data: rules } = await client.database
          .from('style_guide_rules')
          .select('rule_type, rule_text')
          .eq('guide_id', activeGuide.id)
          .eq('is_active', true);

        if (rules && rules.length > 0) {
          console.log('Applying style guide rules:', rules.length);
          formattedText = await applyStyleGuide(client, rawText, rules as StyleGuideRule[]);
        }
      }

      const transcriptData: Record<string, unknown> = {
        audio_file_id: audioFileId,
        style_guide_id: activeGuide?.id || null,
        raw_transcription: JSON.stringify(transcription),
        content: {
          raw: rawText,
          formatted: formattedText,
          applied_style_guide: activeGuide?.id || null,
        },
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      if (formattedText) {
        transcriptData.full_text = formattedText;
      }

      const { data: transcript, error: insertError } = await client.database
        .from('transcripts')
        .insert([transcriptData])
        .select()
        .single();

      if (insertError) {
        console.error('Failed to save transcript:', insertError);
        return new Response(
          JSON.stringify({
            error: 'Transcription succeeded but failed to save',
            transcription,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await client.database
        .from('audio_files')
        .update({
          transcription_status: 'completed',
          transcript_id: transcript.id,
        })
        .eq('id', audioFileId);

      return new Response(
        JSON.stringify({
          success: true,
          transcript,
          transcription,
          formatted: formattedText,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
