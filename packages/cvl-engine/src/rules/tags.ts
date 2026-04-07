// ─── Tag Handling ────────────────────────────────────────────────────────────
// CVL Rule: Standardize transcript tags for unclear audio, overlaps, pauses.
//
// Standard tags:
//   [inaudible]            — audio cannot be understood
//   [overlapping speech]   — multiple speakers talking simultaneously
//   [pause]                — significant pause in speech
//   [background noise]     — notable background noise
//   [laughter]             — laughter
//   [crosstalk]            — overlapping conversation
//   [phonetic]             — uncertain spelling, written phonetically
//   [sic]                  — intentionally preserved as spoken (errors)

import type { RuleConfig, RuleResult, Violation } from '../types.js';

/** Map of non-standard tag variants → standardized tag */
const TAG_NORMALIZATIONS: ReadonlyMap<string, string> = new Map([
  // Inaudible variants
  ['[unintelligible]', '[inaudible]'],
  ['[unclear]', '[inaudible]'],
  ['[indiscernible]', '[inaudible]'],
  ['[inaudible speech]', '[inaudible]'],
  ['[not clear]', '[inaudible]'],
  ['[cannot understand]', '[inaudible]'],
  ['[incomprehensible]', '[inaudible]'],
  ['(inaudible)', '[inaudible]'],
  ['(unintelligible)', '[inaudible]'],
  ['(unclear)', '[inaudible]'],

  // Overlap variants
  ['[overtalk]', '[overlapping speech]'],
  ['[overlap]', '[overlapping speech]'],
  ['[talking over]', '[overlapping speech]'],
  ['[simultaneous speech]', '[overlapping speech]'],
  ['(overlapping)', '[overlapping speech]'],
  ['(crosstalk)', '[crosstalk]'],

  // Pause variants
  ['[long pause]', '[pause]'],
  ['[silence]', '[pause]'],
  ['[brief pause]', '[pause]'],
  ['(pause)', '[pause]'],
  ['(silence)', '[pause]'],

  // Noise variants
  ['[noise]', '[background noise]'],
  ['[static]', '[background noise]'],
  ['(background noise)', '[background noise]'],

  // Laughter variants
  ['[laughing]', '[laughter]'],
  ['[laughs]', '[laughter]'],
  ['(laughter)', '[laughter]'],
  ['(laughing)', '[laughter]'],

  // Parentheses → brackets (CVL standard is square brackets)
  ['(phonetic)', '[phonetic]'],
  ['(sic)', '[sic]'],
]);

/** All valid standard tags */
const VALID_TAGS = new Set([
  '[inaudible]',
  '[overlapping speech]',
  '[pause]',
  '[background noise]',
  '[laughter]',
  '[crosstalk]',
  '[phonetic]',
  '[sic]',
]);

/**
 * Standardize transcript tags to CVL format.
 */
export function handleTags(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) {
    return { text, violations: [] };
  }

  const violations: Violation[] = [];
  let result = text;

  // Step 1: Normalize known non-standard tags
  for (const [variant, standard] of TAG_NORMALIZATIONS) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'gi');

    result = result.replace(pattern, (match, offset) => {
      violations.push({
        ruleId: 'tags',
        category: 'TagUsage',
        original: match,
        replacement: standard,
        position: offset,
        severity: 'warning',
        message: `Standardized tag "${match}" → "${standard}"`,
      });
      return standard;
    });
  }

  // Step 2: Convert parenthetical tags to square brackets if they look like tags
  result = result.replace(/\(([^)]{1,30})\)/g, (match, content: string, offset: number) => {
    const asSquare = `[${content.toLowerCase()}]`;
    if (VALID_TAGS.has(asSquare)) {
      violations.push({
        ruleId: 'tags',
        category: 'TagUsage',
        original: match,
        replacement: asSquare,
        position: offset,
        severity: 'warning',
        message: `Converted parenthetical tag to square brackets: "${match}" → "${asSquare}"`,
      });
      return asSquare;
    }
    return match; // Not a known tag — leave parentheses as-is
  });

  // Step 3: Ensure proper spacing around tags — space before and after
  result = result.replace(/(\S)(\[(?:inaudible|overlapping speech|pause|background noise|laughter|crosstalk|phonetic|sic)\])/gi,
    '$1 $2');
  result = result.replace(/(\[(?:inaudible|overlapping speech|pause|background noise|laughter|crosstalk|phonetic|sic)\])(\S)/gi,
    '$1 $2');

  return { text: result, violations };
}
