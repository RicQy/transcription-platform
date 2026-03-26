/// <reference path="./deno.d.ts" />
import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RULE_PATTERNS = [
  /^(?:rule|guideline|policy|standard)\s*:?\s*/i,
  /^[-•*]\s*/,
  /^\d+\.\s*(?:rule|guideline)/i,
];

const RULE_TYPE_KEYWORDS: Record<string, string[]> = {
  SpeakerFormatting: ['speaker', 'speaker label', 'speaker format', 'attribution'],
  TagUsage: ['tag', 'inaudible', 'unintelligible', 'redact', 'censor'],
  FillerWordHandling: ['filler', 'filler word', 'uh', 'um', 'erm'],
  PunctuationConvention: ['punctuation', 'comma', 'period', 'colon', 'semicolon'],
  CapitalizationRule: ['capital', 'uppercase', 'capitalize'],
  TimestampRequirement: ['timestamp', 'time stamp', 'time code'],
  FormattingExample: ['format', 'example', 'formatting'],
  Other: [],
};

function classifyRuleType(text: string): string {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(RULE_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return type;
    }
  }
  return 'Other';
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

  const client = createClient({
    baseUrl,
    anonKey,
  });

  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as {
        version: string;
        storageKey: string;
        storageUrl: string;
      };
      const { version, storageKey, storageUrl } = body;

      if (!version || !storageKey || !storageUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: version, storageKey, storageUrl' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const { data: existingGuides } = await client.database
        .from('style_guides')
        .select('id')
        .eq('is_active', true);

      const { data: newGuide, error: insertError } = await client.database
        .from('style_guides')
        .insert([
          {
            version,
            storage_key: storageKey,
            storage_url: storageUrl,
            is_active: true,
            parsed_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError || !newGuide) {
        return new Response(
          JSON.stringify({ error: 'Failed to create style guide', details: insertError }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const guideId = newGuide.id;

      if (existingGuides && existingGuides.length > 0) {
        const idsToDeactivate = existingGuides
          .map((g: { id: string }) => g.id)
          .filter((id: string) => id !== guideId);

        if (idsToDeactivate.length > 0) {
          await client.database
            .from('style_guides')
            .update({ is_active: false })
            .in('id', idsToDeactivate);
        }
      }

      const commonRules: Array<{
        guide_id: string;
        rule_type: string;
        rule_text: string;
        source_page: number | null;
        is_active: boolean;
      }> = [
        {
          guide_id: guideId,
          rule_type: 'SpeakerFormatting',
          rule_text:
            'Speaker labels must be formatted as "Speaker 1:", "Speaker 2:", etc. Each speaker must be identified with a unique label followed by a colon. Example: Speaker 1: Hello, how are you?',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'TagUsage',
          rule_text:
            'Use [inaudible] when audio cannot be understood. Use [overlapping speech] for simultaneous speakers. Use [pause] for significant pauses.',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'FillerWordHandling',
          rule_text:
            'Remove filler words such as "um", "uh", "er", "ah", and "like" from the transcription. Only transcribe meaningful words.',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'PunctuationConvention',
          rule_text:
            'Use proper punctuation. Add commas, periods, question marks, and exclamation points where appropriate for natural speech flow.',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'CapitalizationRule',
          rule_text:
            'Capitalize proper nouns, names, titles, and the beginning of sentences only. All other words should be lowercase.',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'TimestampRequirement',
          rule_text:
            'Timestamps are not required in the transcript body. The transcript should be clean and readable without time codes.',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'FormattingExample',
          rule_text:
            'Format transcripts with speaker labels followed by their dialogue on the same line. Example: Speaker 1: Thank you for joining us today.',
          source_page: null,
          is_active: true,
        },
        {
          guide_id: guideId,
          rule_type: 'Other',
          rule_text:
            'Follow all legal transcription standards and conventions. Maintain accuracy and verbatim transcription where possible while applying style guidelines.',
          source_page: null,
          is_active: true,
        },
      ];

      const { error: rulesError } = await client.database
        .from('style_guide_rules')
        .insert(commonRules);

      if (rulesError) {
        console.error('Failed to insert rules:', rulesError);
      }

      const { data: finalGuide } = await client.database
        .from('style_guides')
        .select('*, rules:style_guide_rules(*)')
        .eq('id', guideId)
        .single();

      return new Response(JSON.stringify(finalGuide), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: String(error) }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  }

  if (req.method === 'GET') {
    const { data: guides, error } = await client.database
      .from('style_guides')
      .select('*, rules:style_guide_rules(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch style guides' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(guides), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing guide ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await client.database.from('style_guide_rules').delete().eq('guide_id', id);

    const { error } = await client.database.from('style_guides').delete().eq('id', id);

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to delete style guide' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
