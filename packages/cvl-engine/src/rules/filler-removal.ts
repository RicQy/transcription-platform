// ─── Filler Word Removal ─────────────────────────────────────────────────────
// CVL Rule: Remove disallowed fillers while preserving crutch words.
//
// Disallowed fillers: uh, um, ah, er, erm, hmm, hm, mm
// Preserved crutch words: "you know", "I mean", "like" (when not a filler)
// The word "like" is only removed when it appears as a standalone filler,
// not when it's part of a phrase (e.g., "I like that").

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/** Fillers that are ALWAYS removed */
const FILLER_WORDS = [
  'uh',
  'um',
  'uhm',
  'ah',
  'er',
  'erm',
  'hmm',
  'hm',
  'mm',
  'mmm',
  'mhm',
];

/**
 * Crutch phrases that look like fillers but MUST be preserved.
 * Checked before filler removal to prevent false positives.
 */
const CRUTCH_PHRASES = [
  'you know',
  'i mean',
  'you see',
  'sort of',
  'kind of',
];

/**
 * "like" as a filler — only matched when surrounded by commas or at
 * sentence boundaries, not when used as a verb/preposition.
 * Pattern: ", like," or "like," at start of clause
 */
const FILLER_LIKE_PATTERN = /(?:^|[,.])\s*\blike\b\s*(?=[,.])/gi;

/**
 * Remove filler words from transcript text.
 * Preserves crutch phrases and contextual uses of ambiguous words.
 */
export function removeFillers(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  // Step 1: Protect crutch phrases by replacing with placeholders
  const crutchPlaceholders: Array<{ placeholder: string; phrase: string }> = [];
  for (const phrase of CRUTCH_PHRASES) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = regex.exec(result)) !== null) {
      const placeholder = `__CRUTCH_${idx}__`;
      crutchPlaceholders.push({ placeholder, phrase: match[0] });
      idx++;
    }
    // Replace all occurrences at once
    if (idx > 0) {
      let cIdx = 0;
      result = result.replace(regex, () => {
        const ph = crutchPlaceholders[crutchPlaceholders.length - idx + cIdx].placeholder;
        cIdx++;
        return ph;
      });
    }
  }

  // Step 2: Remove standalone filler words
  for (const filler of FILLER_WORDS) {
    // Match filler as a whole word, optionally followed/preceded by comma
    const pattern = new RegExp(
      `(?:,\\s*)?\\b${filler}\\b(?:\\s*,)?`,
      'gi',
    );

    result = result.replace(pattern, (match, offset) => {
      violations.push({
        ruleId: 'filler-removal',
        category: 'FillerWordHandling',
        original: match.trim(),
        replacement: '',
        position: offset,
        severity: 'info',
        message: `Removed filler word "${match.trim()}"`,
      });
      return '';
    });
  }

  // Step 3: Remove filler "like" (contextual)
  result = result.replace(FILLER_LIKE_PATTERN, (match, offset) => {
    violations.push({
      ruleId: 'filler-removal',
      category: 'FillerWordHandling',
      original: match.trim(),
      replacement: '',
      position: offset,
      severity: 'info',
      message: 'Removed filler "like"',
    });
    // Keep the leading punctuation if present
    const leadingPunc = match.match(/^[,.]/);
    return leadingPunc ? leadingPunc[0] : '';
  });

  // Step 4: Restore crutch phrases
  for (const { placeholder, phrase } of crutchPlaceholders) {
    result = result.replace(placeholder, phrase);
  }

  // Step 5: Clean up double spaces and orphaned commas
  result = result.replace(/\s{2,}/g, ' ');
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/\s+([,.])/g, '$1');

  return { text: result.trim(), violations };
}
