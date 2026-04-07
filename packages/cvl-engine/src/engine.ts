// ─── CVL Engine — Main Orchestrator ──────────────────────────────────────────
// Runs all CVL rules in the correct order on a transcript.
// Returns the final compliant text + every violation found.

import type { CVLResult, EngineConfig, RuleResult, Violation } from './types.js';
import { DEFAULT_ENGINE_CONFIG } from './types.js';
import { removeFillers } from './rules/filler-removal.js';
import { normalizeSlang } from './rules/slang-normalization.js';
import { handleFalseStarts } from './rules/false-starts.js';
import { enforcePunctuation } from './rules/punctuation.js';
import { handleTags } from './rules/tags.js';
import { formatSpeakerLabels } from './rules/speaker-labels.js';
import { enforceCapitalization } from './rules/capitalization.js';

/**
 * The ordered pipeline of CVL rules.
 * ORDER MATTERS — rules are applied sequentially.
 *
 * 1. Speaker labels first (structural)
 * 2. Tags (structural)
 * 3. Filler removal (content cleanup)
 * 4. Slang normalization (content cleanup)
 * 5. False starts (content formatting)
 * 6. Punctuation (formatting)
 * 7. Capitalization (formatting — must run last)
 */
const RULE_PIPELINE: Array<{
  id: string;
  configKey: keyof EngineConfig;
  fn: (text: string, config?: { enabled: boolean }) => RuleResult;
}> = [
  { id: 'speaker-labels',      configKey: 'speakerLabels',      fn: formatSpeakerLabels },
  { id: 'tags',                 configKey: 'tags',               fn: handleTags },
  { id: 'filler-removal',      configKey: 'fillerRemoval',      fn: removeFillers },
  { id: 'slang-normalization',  configKey: 'slangNormalization', fn: normalizeSlang },
  { id: 'false-starts',        configKey: 'falseStarts',        fn: handleFalseStarts },
  { id: 'punctuation',         configKey: 'punctuation',        fn: enforcePunctuation },
  { id: 'capitalization',      configKey: 'capitalization',     fn: enforceCapitalization },
];

/**
 * Run the full CVL enforcement pipeline on a transcript.
 *
 * @param text     - Raw or LLM-cleaned transcript text
 * @param config   - Optional per-rule enable/disable configuration
 * @returns        - CVL-compliant text + all violations + compliance score
 *
 * @example
 * ```ts
 * import { enforce } from '@transcribe/cvl-engine';
 *
 * const result = enforce('uh Speaker1: i wanna go, um, you know');
 * console.log(result.text);
 * // "Speaker 1: I want to go, you know"
 * console.log(result.score);
 * // 72
 * ```
 */
export function enforce(
  text: string,
  config: Partial<EngineConfig> = {},
): CVLResult {
  const fullConfig: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...config };

  let currentText = text;
  const allViolations: Violation[] = [];
  const stats: Record<string, number> = {};

  for (const rule of RULE_PIPELINE) {
    const ruleConfig = fullConfig[rule.configKey];
    const result = rule.fn(currentText, ruleConfig);

    currentText = result.text;
    allViolations.push(...result.violations);
    stats[rule.id] = result.violations.length;
  }

  // Final whitespace cleanup
  currentText = currentText
    .replace(/\n{3,}/g, '\n\n')  // Max 1 blank line
    .replace(/[ \t]+$/gm, '')    // Trailing whitespace per line
    .trim();

  // Calculate compliance score
  // Base score starts at 100, deducted per violation by severity
  const score = calculateScore(allViolations, text.length);

  return {
    text: currentText,
    violations: allViolations,
    score,
    stats,
  };
}

/**
 * Calculate a compliance score from 0–100.
 *
 * Scoring:
 *   - error   → -5 points per violation
 *   - warning → -2 points per violation
 *   - info    → -0.5 points per violation
 *   - Minimum score is 0
 *   - Longer texts are more tolerant (violations normalized by length)
 */
function calculateScore(violations: Violation[], textLength: number): number {
  if (violations.length === 0) return 100;

  const basePenalty = violations.reduce((sum, v) => {
    switch (v.severity) {
      case 'error':   return sum + 5;
      case 'warning': return sum + 2;
      case 'info':    return sum + 0.5;
      default:        return sum;
    }
  }, 0);

  // Normalize: longer texts can tolerate more violations
  // A 1000-char text with 10 warnings is less bad than a 100-char text with 10 warnings
  const lengthFactor = Math.max(1, textLength / 200);
  const normalizedPenalty = basePenalty / lengthFactor;

  return Math.max(0, Math.round(100 - normalizedPenalty));
}
