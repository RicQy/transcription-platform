// ─── CVL Engine — Public API ─────────────────────────────────────────────────
// @transcribe/cvl-engine
//
// Deterministic, code-based TranscribeMe Legal CVL compliance engine.
// Zero LLM dependency. Same input = same output, always.
//
// Usage:
//   import { enforce } from '@transcribe/cvl-engine';
//   const result = enforce(rawTranscript);
//   console.log(result.text);   // CVL-compliant text
//   console.log(result.score);  // 0–100 compliance score

export { enforce } from './engine.js';

// Types
export type {
  CVLResult,
  Violation,
  ViolationSeverity,
  RuleResult,
  RuleConfig,
  EngineConfig,
  CVLRuleFunction,
} from './types.js';

export { DEFAULT_ENGINE_CONFIG } from './types.js';

// Individual rules (for advanced usage / testing)
export { removeFillers } from './rules/filler-removal.js';
export { normalizeSlang } from './rules/slang-normalization.js';
export { handleFalseStarts } from './rules/false-starts.js';
export { enforcePunctuation } from './rules/punctuation.js';
export { handleTags } from './rules/tags.js';
export { formatSpeakerLabels } from './rules/speaker-labels.js';
export { enforceCapitalization } from './rules/capitalization.js';
