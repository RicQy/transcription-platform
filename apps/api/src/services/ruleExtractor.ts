import OpenAI from 'openai';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { ParsedPdf } from './pdfParser';

const RuleSchema = z.object({
  rule_type: z.string(),
  rule_text: z.string(),
  source_page: z.number().int().positive(),
});

const RulesArraySchema = z.array(RuleSchema);

export interface ExtractedRule {
  ruleType: string;
  ruleText: string;
  sourcePage: number;
}

export async function extractRules(
  guideId: string,
  parsed: ParsedPdf,
  openaiClient?: OpenAI,
): Promise<ExtractedRule[]> {
  const client = openaiClient ?? new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Build page-annotated text (limit to avoid token overflow)
  const annotated = parsed.pages
    .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
    .join('\n\n')
    .slice(0, 60_000);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a transcription style guide parser. Extract all transcription rules from the provided text. Return a JSON object with a "rules" array where each item has: rule_type (string, one of: SpeakerFormatting, TagUsage, FillerWordHandling, PunctuationConvention, CapitalizationRule, TimestampRequirement, FormattingExample, Other), rule_text (string, the rule description), source_page (integer, the page number where the rule appears).',
      },
      {
        role: 'user',
        content: annotated,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '{"rules":[]}';
  let parsed_json: unknown;
  try {
    parsed_json = JSON.parse(content);
  } catch {
    logger.warn('Failed to parse OpenAI response as JSON', { content });
    return [];
  }

  const raw = (parsed_json as Record<string, unknown>)['rules'];
  const validated = RulesArraySchema.safeParse(raw);
  if (!validated.success) {
    logger.warn('Rule validation failed', { errors: validated.error.flatten() });
    return [];
  }

  const rules = validated.data;

  // Persist to DB
  await prisma.styleGuideRule.createMany({
    data: rules.map((r) => ({
      guideId,
      ruleType: r.rule_type,
      ruleText: r.rule_text,
      sourcePage: r.source_page,
      isActive: true,
    })),
  });

  return rules.map((r) => ({
    ruleType: r.rule_type,
    ruleText: r.rule_text,
    sourcePage: r.source_page,
  }));
}
