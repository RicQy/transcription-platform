// ─── Speaker Label Formatting ────────────────────────────────────────────────
// CVL Rule: Normalize speaker labels to "Speaker N:" format.
//
// Handles:
//   "SPEAKER 1:" → "Speaker 1:"
//   "Speaker1:" → "Speaker 1:"
//   "S1:" → "Speaker 1:"
//   "Interviewee:" → preserved (named roles are allowed)
//   "Q:" / "A:" → "Question:" / "Answer:"

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/** Known role labels that should be preserved as-is */
const PRESERVED_ROLES = new Set([
  'interviewer',
  'interviewee',
  'judge',
  'witness',
  'plaintiff',
  'defendant',
  'counsel',
  'attorney',
  'prosecutor',
  'court reporter',
  'clerk',
  'moderator',
  'chairperson',
]);

/** Shorthand labels → expanded form */
const SHORTHAND_MAP: ReadonlyMap<string, string> = new Map([
  ['q', 'Question'],
  ['a', 'Answer'],
]);

/**
 * Normalize speaker labels to CVL format.
 */
export function formatSpeakerLabels(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  // Pattern 1: "Speaker N:" with various formats
  // Matches: SPEAKER 1:, speaker1:, Speaker-1:, Spkr 1:, etc.
  result = result.replace(
    /^((?:speaker|spkr|spk)\s*[-_]?\s*(\d+))\s*:/gim,
    (match, _label, num, offset) => {
      const replacement = `Speaker ${num}:`;
      if (match.trim() !== replacement) {
        violations.push({
          ruleId: 'speaker-labels',
          category: 'SpeakerFormatting',
          original: match.trim(),
          replacement,
          position: offset,
          severity: 'warning',
          message: `Normalized speaker label "${match.trim()}" → "${replacement}"`,
        });
      }
      return replacement;
    },
  );

  // Pattern 2: Shorthand labels (Q:, A:)
  result = result.replace(
    /^([QA])\s*:/gim,
    (match, letter: string, offset: number) => {
      const expanded = SHORTHAND_MAP.get(letter.toLowerCase());
      if (!expanded) return match;

      const replacement = `${expanded}:`;
      violations.push({
        ruleId: 'speaker-labels',
        category: 'SpeakerFormatting',
        original: match.trim(),
        replacement,
        position: offset,
        severity: 'warning',
        message: `Expanded shorthand "${match.trim()}" → "${replacement}"`,
      });
      return replacement;
    },
  );

  // Pattern 3: "S1:", "S2:" shorthand
  result = result.replace(
    /^S(\d+)\s*:/gim,
    (match, num, offset) => {
      const replacement = `Speaker ${num}:`;
      violations.push({
        ruleId: 'speaker-labels',
        category: 'SpeakerFormatting',
        original: match.trim(),
        replacement,
        position: offset,
        severity: 'warning',
        message: `Expanded shorthand "${match.trim()}" → "${replacement}"`,
      });
      return replacement;
    },
  );

  // Pattern 4: Ensure preserved roles have consistent capitalization
  const rolesPattern = [...PRESERVED_ROLES].join('|');
  const roleRegex = new RegExp(`^(${rolesPattern})\\s*:`, 'gim');
  result = result.replace(roleRegex, (match, role: string, offset: number) => {
    const properCase = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    const replacement = `${properCase}:`;
    if (match.trim() !== replacement) {
      violations.push({
        ruleId: 'speaker-labels',
        category: 'SpeakerFormatting',
        original: match.trim(),
        replacement,
        position: offset,
        severity: 'info',
        message: `Normalized role capitalization "${match.trim()}" → "${replacement}"`,
      });
    }
    return replacement;
  });

  // Pattern 5: Ensure space after colon in speaker labels
  result = result.replace(
    /^((?:Speaker \d+|Question|Answer|[A-Z][a-z]+):)(\S)/gm,
    (match, label, nextChar, offset) => {
      const replacement = `${label} ${nextChar}`;
      violations.push({
        ruleId: 'speaker-labels',
        category: 'SpeakerFormatting',
        original: match,
        replacement,
        position: offset,
        severity: 'info',
        message: 'Added space after speaker label colon',
      });
      return replacement;
    },
  );

  return { text: result, violations };
}
