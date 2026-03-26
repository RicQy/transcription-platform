/// <reference path="./deno.d.ts" />
import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface Segment {
  id: string;
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface ValidationError {
  segmentId: string;
  ruleId: string;
  errorType: string;
  positionStart: number;
  positionEnd: number;
  message: string;
  isResolved: boolean;
}

interface ValidationRule {
  id: string;
  rule_type: string;
  rule_text: string;
}

const SPEAKER_PATTERN = /^Speaker\s+\d+:/i;
const INAUDIBLE_PATTERN = /\[\s*inaudible\s*\]/gi;
const OVERLAPPING_PATTERN = /\[\s*overlapping\s*\]/gi;
const FILLER_WORDS = [
  '\bum\b',
  '\buh\b',
  '\ber\b',
  '\bah\b',
  '\blike\b',
  '\byou\s+know\b',
  '\bI\s+mean\b',
];

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
      const body = (await req.json()) as { segments: Segment[] };
      const { segments } = body;

      if (!segments || !Array.isArray(segments)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid segments array' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: activeGuide, error: guideError } = await client.database
        .from('style_guides')
        .select('id, version')
        .eq('is_active', true)
        .single();

      if (guideError || !activeGuide) {
        return new Response(
          JSON.stringify({
            error: 'No active style guide found',
            validationErrors: [],
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const { data: rules, error: rulesError } = await client.database
        .from('style_guide_rules')
        .select('id, rule_type, rule_text')
        .eq('guide_id', activeGuide.id)
        .eq('is_active', true);

      if (rulesError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch rules' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validationErrors: ValidationError[] = [];

      for (const segment of segments) {
        const text = segment.text;

        for (const rule of rules || []) {
          const ruleObj = rule as ValidationRule;

          if (ruleObj.rule_type === 'SpeakerFormatting') {
            if (!SPEAKER_PATTERN.test(text)) {
              const speakerMatch = text.match(/^(Speaker\s*\d+)/i);
              if (!speakerMatch) {
                validationErrors.push({
                  segmentId: segment.id,
                  ruleId: ruleObj.id,
                  errorType: 'SPEAKER_LABEL',
                  positionStart: 0,
                  positionEnd: 0,
                  message: `Speaker label format incorrect. Expected format: "Speaker 1:", "Speaker 2:", etc.`,
                  isResolved: false,
                });
              }
            }
          }

          if (ruleObj.rule_type === 'TagUsage') {
            if (!INAUDIBLE_PATTERN.test(text) && !OVERLAPPING_PATTERN.test(text)) {
              const lowerText = text.toLowerCase();
              if (
                lowerText.includes('inaudible') ||
                lowerText.includes('unintelligible') ||
                lowerText.includes('could not hear') ||
                lowerText.includes('couldnt hear')
              ) {
                if (!text.includes('[') || !text.includes(']')) {
                  validationErrors.push({
                    segmentId: segment.id,
                    ruleId: ruleObj.id,
                    errorType: 'TAG_MISUSE',
                    positionStart: 0,
                    positionEnd: 0,
                    message: `Unclear speech should be marked with [inaudible] tags, not plain text.`,
                    isResolved: false,
                  });
                }
              }
            }
          }

          if (ruleObj.rule_type === 'FillerWordHandling') {
            for (const filler of FILLER_WORDS) {
              const fillerRegex = new RegExp(filler, 'gi');
              let match;
              while ((match = fillerRegex.exec(text)) !== null) {
                validationErrors.push({
                  segmentId: segment.id,
                  ruleId: ruleObj.id,
                  errorType: 'FORMATTING',
                  positionStart: match.index,
                  positionEnd: match.index + match[0].length,
                  message: `Filler word "${match[0]}" should be removed from transcription.`,
                  isResolved: false,
                });
              }
            }
          }

          if (ruleObj.rule_type === 'CapitalizationRule') {
            const words = text.split(/\s+/);
            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const cleanWord = word.replace(/[^a-zA-Z]/g, '');

              if (cleanWord.length > 0) {
                const isProperNoun = /^[A-Z][a-z]+$/.test(cleanWord) && i > 0;
                const isStartOfSentence =
                  i === 0 ||
                  text
                    .slice(
                      text.indexOf(word) - (i > 0 ? text.split(/\s+/)[i - 1].length + 1 : 0),
                      text.indexOf(word),
                    )
                    .endsWith('. ');

                if (
                  cleanWord === cleanWord.toUpperCase() &&
                  cleanWord.length > 2 &&
                  !isProperNoun &&
                  !isStartOfSentence
                ) {
                  validationErrors.push({
                    segmentId: segment.id,
                    ruleId: ruleObj.id,
                    errorType: 'FORMATTING',
                    positionStart: text.indexOf(word),
                    positionEnd: text.indexOf(word) + word.length,
                    message: `Word "${cleanWord}" appears to be unnecessarily capitalized. Only capitalize proper nouns and sentence beginnings.`,
                    isResolved: false,
                  });
                  break;
                }
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          guideId: activeGuide.id,
          guideVersion: activeGuide.version,
          rulesCount: rules?.length || 0,
          segmentsValidated: segments.length,
          validationErrors,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
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

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
