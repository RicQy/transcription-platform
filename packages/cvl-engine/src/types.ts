// ─── CVL Rule Engine Types ───────────────────────────────────────────────────
// All types are engine-internal. No external dependencies.

/** Severity of a CVL violation */
export type ViolationSeverity = 'error' | 'warning' | 'info';

/** A single CVL violation detected and corrected by the engine */
export interface Violation {
  /** Which rule caught this */
  ruleId: string;
  /** Human-readable category */
  category: string;
  /** What was found in the original text */
  original: string;
  /** What it was replaced with (empty string = deletion) */
  replacement: string;
  /** Character offset in the *input* text (before this rule ran) */
  position: number;
  /** Severity level */
  severity: ViolationSeverity;
  /** Explanation for QA review */
  message: string;
}

/** Result of running the full CVL pipeline */
export interface CVLResult {
  /** Final CVL-compliant text */
  text: string;
  /** Every correction applied, in order */
  violations: Violation[];
  /** Compliance score: 0–100 (100 = no violations found) */
  score: number;
  /** Per-rule statistics */
  stats: Record<string, number>;
}

/** Result from a single rule pass */
export interface RuleResult {
  /** Text after this rule was applied */
  text: string;
  /** Violations detected by this rule */
  violations: Violation[];
}

/** A CVL rule function signature */
export type CVLRuleFunction = (text: string, config?: RuleConfig) => RuleResult;

/** Per-rule configuration (loaded from style guide DB rows) */
export interface RuleConfig {
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Additional rule-specific options */
  options?: Record<string, unknown>;
}

/** Full engine configuration — maps rule IDs to their config */
export interface EngineConfig {
  fillerRemoval: RuleConfig;
  slangNormalization: RuleConfig;
  falseStarts: RuleConfig;
  punctuation: RuleConfig;
  tags: RuleConfig;
  speakerLabels: RuleConfig;
  capitalization: RuleConfig;
}

/** Default config: all rules enabled */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  fillerRemoval: { enabled: true },
  slangNormalization: { enabled: true },
  falseStarts: { enabled: true },
  punctuation: { enabled: true },
  tags: { enabled: true },
  speakerLabels: { enabled: true },
  capitalization: { enabled: true },
};
