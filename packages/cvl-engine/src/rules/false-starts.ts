// ─── False Start Handling ────────────────────────────────────────────────────
// CVL Rule: Preserve false starts with double-dash notation.
// A "false start" is when a speaker begins a word or phrase, stops,
// and restarts. TranscribeMe CVL requires these to be preserved with --.
//
// Examples:
//   "I was go I mean I went" → "I was go-- I mean I went"
//   "The the defendant" → "The-- the defendant"

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/**
 * Detect and format false starts with double-dash notation.
 *
 * Heuristics:
 * 1. Repeated word at start: "The the" → "The-- the"
 * 2. Truncated word followed by correction: detected via partial word match
 * 3. Explicit restart markers: "I mean", "I'm sorry", "let me rephrase"
 */
export function handleFalseStarts(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  // Pattern 1: Repeated words — "The the", "I I", "we we"
  // The first occurrence gets a -- if it doesn't already have one
  result = result.replace(
    /\b(\w+)\s+\1\b/gi,
    (match, word, offset) => {
      const alreadyMarked = match.includes('--');
      if (alreadyMarked) return match;

      const replacement = `${word}-- ${word.toLowerCase()}`;
      violations.push({
        ruleId: 'false-starts',
        category: 'FalseStartHandling',
        original: match,
        replacement,
        position: offset,
        severity: 'info',
        message: `Marked repeated word "${word}" as false start`,
      });
      return replacement;
    },
  );

  // Pattern 2: Restart phrases — word(s) followed by "I mean" or "sorry" + correction
  const restartPhrases = [
    'I mean',
    "I'm sorry",
    'sorry',
    'let me rephrase',
    'rather',
    'or rather',
    'well actually',
    'actually',
    'no wait',
    'wait',
  ];

  for (const phrase of restartPhrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match: word(s) + restart phrase, where the word(s) before don't already end in --
    const pattern = new RegExp(
      `(\\b\\w+(?:\\s+\\w+){0,3})\\s+(?:${escaped})\\b`,
      'gi',
    );

    result = result.replace(pattern, (match, beforePhrase, offset) => {
      if (beforePhrase.trim().endsWith('--')) return match;

      const replacement = `${beforePhrase.trim()}-- ${phrase}`;
      violations.push({
        ruleId: 'false-starts',
        category: 'FalseStartHandling',
        original: match,
        replacement,
        position: offset,
        severity: 'info',
        message: `Marked false start before "${phrase}"`,
      });
      return replacement;
    });
  }

  // Pattern 3: Words that end abruptly (partial words) — detected by
  // a short word (1-3 chars) followed by a longer word starting with the same letters
  // e.g., "pro probably" → "pro-- probably"
  result = result.replace(
    /\b([a-zA-Z]{1,4})\s+([a-zA-Z]{4,})\b/gi,
    (match, partial: string, full: string, offset: number) => {
      // Only match if the full word starts with the partial
      if (!full.toLowerCase().startsWith(partial.toLowerCase())) return match;
      if (partial.toLowerCase() === full.toLowerCase()) return match;
      if (match.includes('--')) return match;

      const replacement = `${partial}-- ${full}`;
      violations.push({
        ruleId: 'false-starts',
        category: 'FalseStartHandling',
        original: match,
        replacement,
        position: offset,
        severity: 'info',
        message: `Marked partial word "${partial}" as false start before "${full}"`,
      });
      return replacement;
    },
  );

  return { text: result, violations };
}
