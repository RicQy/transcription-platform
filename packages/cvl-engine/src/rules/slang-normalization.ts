// ─── Slang Normalization ─────────────────────────────────────────────────────
// CVL Rule: Normalize informal contractions and slang to formal English.
// This is a deterministic dictionary-based replacement — no LLM involved.

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/**
 * Map of informal slang → formal replacement.
 * Keys are lowercase. Matching is case-insensitive, whole-word only.
 */
const SLANG_MAP: ReadonlyMap<string, string> = new Map([
  // Contractions
  ['gonna', 'going to'],
  ['wanna', 'want to'],
  ['gotta', 'got to'],
  ['hafta', 'have to'],
  ['oughta', 'ought to'],
  ['shoulda', 'should have'],
  ['coulda', 'could have'],
  ['woulda', 'would have'],
  ['musta', 'must have'],
  ['kinda', 'kind of'],
  ['sorta', 'sort of'],
  ['lotta', 'a lot of'],
  ['outta', 'out of'],
  ['dunno', 'do not know'],
  ['lemme', 'let me'],
  ['gimme', 'give me'],
  ['gotcha', 'got you'],
  ['betcha', 'bet you'],

  // Informal words
  ["ain't", 'is not'],
  ["y'all", 'you all'],
  ['yeah', 'yes'],
  ['yep', 'yes'],
  ['yup', 'yes'],
  ['nah', 'no'],
  ['nope', 'no'],
  ['cos', 'because'],
  ["'cause", 'because'],
  ['cuz', 'because'],

  // Common mispronunciations in legal context
  ['prolly', 'probably'],
  ['supposably', 'supposedly'],
  ['irregardless', 'regardless'],
  ['nucular', 'nuclear'],
]);

/**
 * Normalize slang and informal contractions to standard English.
 */
export function normalizeSlang(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  for (const [slang, formal] of SLANG_MAP) {
    // Escape special regex chars in the slang word (for ain't, 'cause, etc.)
    const escaped = slang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');

    result = result.replace(pattern, (match, offset) => {
      // Preserve original capitalization
      const replacement = match[0] === match[0].toUpperCase()
        ? formal.charAt(0).toUpperCase() + formal.slice(1)
        : formal;

      violations.push({
        ruleId: 'slang-normalization',
        category: 'SlangNormalization',
        original: match,
        replacement,
        position: offset,
        severity: 'warning',
        message: `Normalized "${match}" → "${replacement}"`,
      });

      return replacement;
    });
  }

  return { text: result, violations };
}
