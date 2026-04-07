// ─── Punctuation Enforcement ─────────────────────────────────────────────────
// CVL Rule: Enforce consistent, legal-grade punctuation.
//
// Rules:
// 1. No double spaces
// 2. Single space after punctuation (period, comma, colon, semicolon)
// 3. No space before punctuation
// 4. Proper sentence-ending punctuation
// 5. No orphaned punctuation
// 6. Proper dash formatting (em-dash with spaces for interruptions)

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/**
 * Enforce CVL punctuation rules.
 */
export function enforcePunctuation(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  // Rule 1: Collapse multiple spaces to single space
  result = result.replace(/[ \t]{2,}/g, (match, offset) => {
    violations.push({
      ruleId: 'punctuation',
      category: 'PunctuationConvention',
      original: match,
      replacement: ' ',
      position: offset,
      severity: 'info',
      message: 'Collapsed multiple spaces',
    });
    return ' ';
  });

  // Rule 2: Remove space before punctuation marks
  result = result.replace(/\s+([.,;:!?])/g, (match, punc, offset) => {
    if (match === punc) return match; // No change needed
    violations.push({
      ruleId: 'punctuation',
      category: 'PunctuationConvention',
      original: match,
      replacement: punc,
      position: offset,
      severity: 'info',
      message: `Removed space before "${punc}"`,
    });
    return punc;
  });

  // Rule 3: Ensure single space after punctuation (except at end of text)
  result = result.replace(/([.,;:!?])(\S)/g, (match, punc, nextChar, offset) => {
    // Don't add space after periods in abbreviations or numbers (e.g., "3.5", "Dr.")
    if (punc === '.' && /\d/.test(nextChar)) return match;
    // Don't split double-dash false start markers
    if (punc === '-' || nextChar === '-') return match;

    const replacement = `${punc} ${nextChar}`;
    violations.push({
      ruleId: 'punctuation',
      category: 'PunctuationConvention',
      original: match,
      replacement,
      position: offset,
      severity: 'info',
      message: `Added space after "${punc}"`,
    });
    return replacement;
  });

  // Rule 4: Remove duplicate punctuation (except ellipsis ...)
  result = result.replace(/([.,;:!?])\1+/g, (match, punc, offset) => {
    if (match === '...' || match === '…') return match; // Preserve ellipsis
    violations.push({
      ruleId: 'punctuation',
      category: 'PunctuationConvention',
      original: match,
      replacement: punc,
      position: offset,
      severity: 'warning',
      message: `Removed duplicate punctuation "${match}"`,
    });
    return punc;
  });

  // Rule 5: Normalize dashes — "- -" or "– –" to proper em-dash " — "
  result = result.replace(/\s*[-–]{2,}\s*/g, (match, offset) => {
    // Don't touch false-start markers (word--)
    if (/\w$/.test(text.substring(0, offset))) return '--';

    violations.push({
      ruleId: 'punctuation',
      category: 'PunctuationConvention',
      original: match,
      replacement: ' — ',
      position: offset,
      severity: 'info',
      message: 'Normalized dash to em-dash',
    });
    return ' — ';
  });

  // Rule 6: Trim trailing/leading whitespace per line
  result = result
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  return { text: result, violations };
}
