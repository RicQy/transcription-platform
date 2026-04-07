// ─── Capitalization ──────────────────────────────────────────────────────────
// CVL Rule: Enforce proper capitalization.
//
// Rules:
// 1. Sentence-initial capitalization (after . ! ?)
// 2. Capitalize after speaker labels ("Speaker 1: hello" → "Speaker 1: Hello")
// 3. Preserve ALL CAPS only for acronyms (FBI, CIA, etc.)
// 4. Lowercase shouted text ("I WAS NOT THERE" → "I was not there")
// 5. Preserve proper nouns (best-effort — relies on ASR output)

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/** Common acronyms that should stay uppercase */
const ACRONYMS = new Set([
  'FBI', 'CIA', 'NSA', 'DOJ', 'SEC', 'IRS', 'EPA', 'FDA', 'FCC',
  'LLC', 'LLP', 'INC', 'CEO', 'CFO', 'CTO', 'COO', 'VP',
  'USA', 'UK', 'EU', 'UN', 'NATO', 'WHO',
  'DNA', 'RNA', 'HIV', 'AIDS', 'COVID',
  'AM', 'PM', 'EST', 'CST', 'MST', 'PST',
  'MR', 'MRS', 'MS', 'DR', 'JR', 'SR',
  'ID', 'SSN', 'DOB', 'DUI', 'DWI',
  'PC', 'IT', 'HR', 'PR', 'QA',
  'OK', 'TV', 'CD', 'DVD',
]);

/** Words that should typically not be capitalized mid-sentence */
const LOWERCASE_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'of', 'by', 'up', 'as', 'if', 'is',
  'it', 'he', 'we', 'do', 'no', 'my',
]);

/**
 * Enforce CVL capitalization rules.
 */
export function enforceCapitalization(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  // Step 1: De-shout ALL CAPS words (3+ chars) that aren't acronyms
  result = result.replace(/\b([A-Z]{3,})\b/g, (match, word, offset) => {
    if (ACRONYMS.has(word)) return match;
    // Check if it's at the start of a sentence
    const before = result.substring(0, offset).trimEnd();
    const isStartOfSentence = !before || /[.!?:]\s*$/.test(before);

    const lower = word.toLowerCase();
    const replacement = isStartOfSentence
      ? lower.charAt(0).toUpperCase() + lower.slice(1)
      : lower;

    violations.push({
      ruleId: 'capitalization',
      category: 'CapitalizationRule',
      original: match,
      replacement,
      position: offset,
      severity: 'warning',
      message: `De-shouted "${match}" → "${replacement}"`,
    });

    return replacement;
  });

  // Step 2: Capitalize first letter after sentence-ending punctuation
  result = result.replace(
    /([.!?])\s+([a-z])/g,
    (match, punc, letter, offset) => {
      const replacement = `${punc} ${letter.toUpperCase()}`;
      violations.push({
        ruleId: 'capitalization',
        category: 'CapitalizationRule',
        original: match,
        replacement,
        position: offset,
        severity: 'info',
        message: 'Capitalized sentence start',
      });
      return replacement;
    },
  );

  // Step 3: Capitalize first letter after speaker labels
  result = result.replace(
    /^((?:Speaker \d+|Question|Answer|[A-Z][a-z]+):)\s+([a-z])/gm,
    (match, label, letter, offset) => {
      const replacement = `${label} ${letter.toUpperCase()}`;
      violations.push({
        ruleId: 'capitalization',
        category: 'CapitalizationRule',
        original: match,
        replacement,
        position: offset,
        severity: 'info',
        message: 'Capitalized first word after speaker label',
      });
      return replacement;
    },
  );

  // Step 4: Capitalize "I" when standalone
  result = result.replace(/\bi\b/g, (match, offset) => {
    // Only fix lowercase standalone "i" — ignore if inside a word
    const before = result[offset - 1];
    const after = result[offset + 1];
    if (before && /\w/.test(before)) return match;
    if (after && /\w/.test(after)) return match;

    violations.push({
      ruleId: 'capitalization',
      category: 'CapitalizationRule',
      original: 'i',
      replacement: 'I',
      position: offset,
      severity: 'info',
      message: 'Capitalized pronoun "I"',
    });
    return 'I';
  });

  // Step 5: Capitalize first character of entire text
  if (result.length > 0 && /^[a-z]/.test(result)) {
    const replacement = result.charAt(0).toUpperCase() + result.slice(1);
    violations.push({
      ruleId: 'capitalization',
      category: 'CapitalizationRule',
      original: result.charAt(0),
      replacement: result.charAt(0).toUpperCase(),
      position: 0,
      severity: 'info',
      message: 'Capitalized start of transcript',
    });
    result = replacement;
  }

  return { text: result, violations };
}
