/// <reference path="./deno.d.ts" />
import { createClient } from 'npm:@insforge/sdk';
import md5 from 'npm:md5';

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

async function transcribeWithIFLyTek(audioBuffer: ArrayBuffer): Promise<string> {
  console.log('iFLYTEK: Starting transcription');
  console.log('iFLYTEK: APP_ID =', IFLYTEK_APP_ID);
  console.log('iFLYTEK: Audio size =', audioBuffer.byteLength, 'bytes');

  const host = 'api.xfyun.cn';
  const path = '/v1/service/v1/iat';
  const curTime = Math.floor(Date.now() / 1000).toString();

  const param = {
    engine_type: 'sms16k',
    aue: 'raw',
  };
  const paramStr = JSON.stringify(param);
  const paramBase64 = btoa(paramStr);

  const checkSumInput = IFLYTEK_API_KEY + curTime + paramBase64;
  const checkSum = md5(checkSumInput);

  const audioBase64 = uint8ArrayToBase64(new Uint8Array(audioBuffer));

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

function buildStyleGuidePrompt(rules: StyleGuideRule[]): string {
  if (!rules || rules.length === 0) {
    return 'Apply standard legal transcription formatting.';
  }
  const rulesText = rules.map((r) => `- ${r.rule_type}: ${r.rule_text}`).join('\n');
  return `You are a legal transcription editor. Format the following transcript strictly according to these style guide rules:\n\n${rulesText}\n\nIMPORTANT:\n1. Apply ALL rules consistently\n2. Return ONLY the formatted transcript`;
}

async function applyStyleGuide(
  client: ReturnType<typeof createClient>,
  transcription: string,
  rules: StyleGuideRule[],
): Promise<string> {
  const prompt = buildStyleGuidePrompt(rules);

  const completion = await client.ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    messages: [{ role: 'user', content: `${prompt}\n\nTranscript:\n${transcription}` }],
    temperature: 0.3,
    maxTokens: 8000,
  });

  return completion.choices[0]?.message?.content?.trim() || transcription;
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
      const { audioFileId, useDiarization = true, provider = 'openai' } = body;

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
          headers: { Authorization: `Bearer ${openAiKey}` },
          body: formData,
        });

        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          await client.database
            .from('audio_files')
            .update({ transcription_status: 'failed' })
            .eq('id', audioFileId);
          return new Response(JSON.stringify({ error: 'Whisper failed', details: errorText }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        transcription = await whisperResponse.json();
        rawText = (transcription.text as string) || '';
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
          formattedText = await applyStyleGuide(client, rawText, rules as StyleGuideRule[]);
        }
      }

      const transcriptData: Record<string, unknown> = {
        audio_file_id: audioFileId,
        style_guide_id: activeGuide?.id || null,
        raw_transcription: JSON.stringify(transcription),
        content: { raw: rawText, formatted: formattedText },
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
        return new Response(
          JSON.stringify({ error: 'Failed to save transcript', details: insertError }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      await client.database
        .from('audio_files')
        .update({ transcription_status: 'completed', transcript_id: transcript.id })
        .eq('id', audioFileId);

      return new Response(JSON.stringify({ success: true, transcript, formatted: formattedText }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Transcription error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: String(error) }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
