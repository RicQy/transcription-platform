import OpenAI from 'openai';
import type { StyleGuideRule } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function generateValidationLogic(
  ruleId: string,
  ruleText: string,
  openaiClient?: OpenAI,
): Promise<string | null> {
  const client = openaiClient ?? new OpenAI({ apiKey: env.OPENAI_API_KEY });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a code generator. Convert a transcription style guide rule into a JavaScript validation function.
The function signature must be: function(text) { return []; }
It should return an array of objects: { start: number, end: number, message: string, errorType: string }
errorType must be one of: FORMATTING, TAG_MISUSE, PUNCTUATION, SPEAKER_LABEL, RULE_VIOLATION
Return ONLY the function body as a string, no markdown, no explanation.
Example output: function(text) { const errors = []; if (text.includes('  ')) { errors.push({ start: 0, end: text.length, message: 'Double spaces found', errorType: 'FORMATTING' }); } return errors; }`,
        },
        {
          role: 'user',
          content: `Rule: ${ruleText}`,
        },
      ],
    });

    const logic = response.choices[0]?.message?.content?.trim() ?? null;

    if (logic) {
      await prisma.styleGuideRule.update({
        where: { id: ruleId },
        data: { validationLogic: logic },
      });
    }

    return logic;
  } catch (err) {
    logger.error('Validation codegen failed', { ruleId, err });
    return null;
  }
}

export async function generateValidationLogicForGuide(
  guideId: string,
  openaiClient?: OpenAI,
): Promise<void> {
  const rules = await prisma.styleGuideRule.findMany({
    where: { guideId, isActive: true, validationLogic: null },
  });

  logger.info('Generating validation logic for rules', { guideId, count: rules.length });

  await Promise.all(
    rules.map((rule: StyleGuideRule) => generateValidationLogic(rule.id, rule.ruleText, openaiClient)),
  );
}
