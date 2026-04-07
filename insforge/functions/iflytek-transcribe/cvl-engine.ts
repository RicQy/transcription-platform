// ─── CVL Engine (Inline Build for Deno Edge) ─────────────────────────────────
// This is the bundled CVL Rule Engine from packages/cvl-engine.
// Inlined here because Deno Edge Functions cannot import workspace packages.
//
// Source of truth: packages/cvl-engine/src/
// If you modify rules, update BOTH locations.
//
// Last synced: 2026-04-07
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViolationSeverity = 'error' | 'warning' | 'info';

export interface Violation {
  ruleId: string;
  category: string;
  original: string;
  replacement: string;
  position: number;
  severity: ViolationSeverity;
  message: string;
}

export interface CVLResult {
  text: string;
  violations: Violation[];
  score: number;
  stats: Record<string, number>;
}

interface RuleResult {
  text: string;
  violations: Violation[];
}

interface RuleConfig {
  enabled: boolean;
}

interface EngineConfig {
  fillerRemoval: RuleConfig;
  slangNormalization: RuleConfig;
  falseStarts: RuleConfig;
  punctuation: RuleConfig;
  tags: RuleConfig;
  speakerLabels: RuleConfig;
  capitalization: RuleConfig;
}

const DEFAULT_CONFIG: EngineConfig = {
  fillerRemoval: { enabled: true },
  slangNormalization: { enabled: true },
  falseStarts: { enabled: true },
  punctuation: { enabled: true },
  tags: { enabled: true },
  speakerLabels: { enabled: true },
  capitalization: { enabled: true },
};

// ─── Filler Removal ──────────────────────────────────────────────────────────

const FILLER_WORDS = ['uh','um','uhm','ah','er','erm','hmm','hm','mm','mmm','mhm'];
const CRUTCH_PHRASES = ['you know','i mean','you see','sort of','kind of'];

/**
 * "like" as a filler — only matched when surrounded by commas or at
 * sentence boundaries, not when used as a verb/preposition.
 */
const FILLER_LIKE_PATTERN = /(?:^|[,.])\s*\blike\b\s*(?=[,.])/gi;

function removeFillers(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  // Step 1: Protect crutch phrases with placeholders
  const crutchPlaceholders: Array<{ placeholder: string; phrase: string }> = [];
  for (const phrase of CRUTCH_PHRASES) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    let idx = 0;
    while (regex.exec(result) !== null) {
      crutchPlaceholders.push({ placeholder: `__CRUTCH_${crutchPlaceholders.length}__`, phrase });
      idx++;
    }
    if (idx > 0) {
      let cIdx = 0;
      result = result.replace(regex, () => {
        const ph = crutchPlaceholders[crutchPlaceholders.length - idx + cIdx].placeholder;
        cIdx++;
        return ph;
      });
    }
  }

  // Step 2: Remove standalone fillers
  for (const filler of FILLER_WORDS) {
    const pattern = new RegExp(`(?:,\\s*)?\\b${filler}\\b(?:\\s*,)?`, 'gi');
    result = result.replace(pattern, (match, offset) => {
      violations.push({ ruleId: 'filler-removal', category: 'FillerWordHandling', original: match.trim(), replacement: '', position: offset, severity: 'info', message: `Removed filler "${match.trim()}"` });
      return '';
    });
  }

  // Step 3: Remove filler "like" (contextual)
  result = result.replace(FILLER_LIKE_PATTERN, (match, offset) => {
    violations.push({ ruleId: 'filler-removal', category: 'FillerWordHandling', original: match.trim(), replacement: '', position: offset, severity: 'info', message: 'Removed filler "like"' });
    const leadingPunc = match.match(/^[,.]/);
    return leadingPunc ? leadingPunc[0] : '';
  });

  // Step 4: Restore crutch phrases
  for (const { placeholder, phrase } of crutchPlaceholders) {
    result = result.replace(placeholder, phrase);
  }

  // Step 5: Cleanup
  result = result.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').replace(/\s+([,.])/g, '$1');
  return { text: result.trim(), violations };
}

// ─── Slang Normalization ─────────────────────────────────────────────────────

const SLANG_MAP = new Map<string, string>([
  ['gonna','going to'],['wanna','want to'],['gotta','got to'],['hafta','have to'],
  ['oughta','ought to'],['shoulda','should have'],['coulda','could have'],['woulda','would have'],
  ['musta','must have'],['kinda','kind of'],['sorta','sort of'],['lotta','a lot of'],
  ['outta','out of'],['dunno','do not know'],['lemme','let me'],['gimme','give me'],
  ['gotcha','got you'],['betcha','bet you'],["ain't",'is not'],["y'all",'you all'],
  ['yeah','yes'],['yep','yes'],['yup','yes'],['nah','no'],['nope','no'],
  ['cos','because'],["'cause",'because'],['cuz','because'],
  ['prolly','probably'],['supposably','supposedly'],['irregardless','regardless'],
]);

function normalizeSlang(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  for (const [slang, formal] of SLANG_MAP) {
    const escaped = slang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(pattern, (match, offset) => {
      const replacement = match[0] === match[0].toUpperCase() ? formal.charAt(0).toUpperCase() + formal.slice(1) : formal;
      violations.push({ ruleId: 'slang-normalization', category: 'SlangNormalization', original: match, replacement, position: offset, severity: 'warning', message: `Normalized "${match}" → "${replacement}"` });
      return replacement;
    });
  }
  return { text: result, violations };
}

// ─── False Starts ────────────────────────────────────────────────────────────

const RESTART_PHRASES = [
  'I mean', "I'm sorry", 'sorry', 'let me rephrase', 'rather',
  'or rather', 'well actually', 'actually', 'no wait', 'wait',
];

function handleFalseStarts(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  // Pattern 1: Repeated words — "The the" → "The-- the"
  result = result.replace(/\b(\w+)\s+\1\b/gi, (match, word, offset) => {
    if (match.includes('--')) return match;
    const replacement = `${word}-- ${word.toLowerCase()}`;
    violations.push({ ruleId: 'false-starts', category: 'FalseStartHandling', original: match, replacement, position: offset, severity: 'info', message: `Marked repeated word "${word}"` });
    return replacement;
  });

  // Pattern 2: Restart phrases — word(s) followed by "I mean", "sorry", etc.
  for (const phrase of RESTART_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\b\\w+(?:\\s+\\w+){0,3})\\s+(?:${escaped})\\b`, 'gi');
    result = result.replace(pattern, (match, beforePhrase, offset) => {
      if (beforePhrase.trim().endsWith('--')) return match;
      const replacement = `${beforePhrase.trim()}-- ${phrase}`;
      violations.push({ ruleId: 'false-starts', category: 'FalseStartHandling', original: match, replacement, position: offset, severity: 'info', message: `Marked false start before "${phrase}"` });
      return replacement;
    });
  }

  // Pattern 3: Partial words — "pro probably" → "pro-- probably"
  result = result.replace(/\b([a-zA-Z]{1,4})\s+([a-zA-Z]{4,})\b/gi, (match, partial: string, full: string, offset: number) => {
    if (!full.toLowerCase().startsWith(partial.toLowerCase())) return match;
    if (partial.toLowerCase() === full.toLowerCase()) return match;
    if (match.includes('--')) return match;
    const replacement = `${partial}-- ${full}`;
    violations.push({ ruleId: 'false-starts', category: 'FalseStartHandling', original: match, replacement, position: offset, severity: 'info', message: `Marked partial word "${partial}"` });
    return replacement;
  });
  return { text: result, violations };
}

// ─── Punctuation ─────────────────────────────────────────────────────────────

function enforcePunctuation(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  result = result.replace(/[ \t]{2,}/g, (match, offset) => {
    violations.push({ ruleId: 'punctuation', category: 'PunctuationConvention', original: match, replacement: ' ', position: offset, severity: 'info', message: 'Collapsed multiple spaces' });
    return ' ';
  });
  result = result.replace(/\s+([.,;:!?])/g, (match, punc, offset) => {
    if (match === punc) return match;
    violations.push({ ruleId: 'punctuation', category: 'PunctuationConvention', original: match, replacement: punc, position: offset, severity: 'info', message: `Removed space before "${punc}"` });
    return punc;
  });
  result = result.replace(/([.,;:!?])(\S)/g, (match, punc, nextChar, offset) => {
    if (punc === '.' && /\d/.test(nextChar)) return match;
    if (punc === '-' || nextChar === '-') return match;
    const replacement = `${punc} ${nextChar}`;
    violations.push({ ruleId: 'punctuation', category: 'PunctuationConvention', original: match, replacement, position: offset, severity: 'info', message: `Added space after "${punc}"` });
    return replacement;
  });
  result = result.replace(/([.,;:!?])\1+/g, (match, punc, offset) => {
    if (match === '...' || match === '…') return match;
    violations.push({ ruleId: 'punctuation', category: 'PunctuationConvention', original: match, replacement: punc, position: offset, severity: 'warning', message: `Removed duplicate "${match}"` });
    return punc;
  });
  // Normalize dashes — "- -" or "– –" to em-dash (skip false-start markers)
  result = result.replace(/\s*[-–]{2,}\s*/g, (match, offset) => {
    if (/\w$/.test(text.substring(0, offset))) return '--';
    violations.push({ ruleId: 'punctuation', category: 'PunctuationConvention', original: match, replacement: ' — ', position: offset, severity: 'info', message: 'Normalized dash to em-dash' });
    return ' — ';
  });
  result = result.split('\n').map(l => l.trim()).join('\n');
  return { text: result, violations };
}

// ─── Tags ────────────────────────────────────────────────────────────────────

const TAG_NORMALIZATIONS = new Map<string, string>([
  ['[unintelligible]','[inaudible]'],['[unclear]','[inaudible]'],['[indiscernible]','[inaudible]'],
  ['[inaudible speech]','[inaudible]'],['[not clear]','[inaudible]'],['[incomprehensible]','[inaudible]'],
  ['(inaudible)','[inaudible]'],['(unintelligible)','[inaudible]'],['(unclear)','[inaudible]'],
  ['[overtalk]','[overlapping speech]'],['[overlap]','[overlapping speech]'],['[talking over]','[overlapping speech]'],
  ['[simultaneous speech]','[overlapping speech]'],['(overlapping)','[overlapping speech]'],['(crosstalk)','[crosstalk]'],
  ['[long pause]','[pause]'],['[silence]','[pause]'],['[brief pause]','[pause]'],['(pause)','[pause]'],['(silence)','[pause]'],
  ['[noise]','[background noise]'],['[static]','[background noise]'],['(background noise)','[background noise]'],
  ['[laughing]','[laughter]'],['[laughs]','[laughter]'],['(laughter)','[laughter]'],['(laughing)','[laughter]'],
  ['(phonetic)','[phonetic]'],['(sic)','[sic]'],
]);
const VALID_TAGS = new Set(['[inaudible]','[overlapping speech]','[pause]','[background noise]','[laughter]','[crosstalk]','[phonetic]','[sic]']);

function handleTags(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  for (const [variant, standard] of TAG_NORMALIZATIONS) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), (match, offset) => {
      violations.push({ ruleId: 'tags', category: 'TagUsage', original: match, replacement: standard, position: offset, severity: 'warning', message: `Standardized "${match}" → "${standard}"` });
      return standard;
    });
  }
  result = result.replace(/\(([^)]{1,30})\)/g, (match, content: string, offset: number) => {
    const asSquare = `[${content.toLowerCase()}]`;
    if (VALID_TAGS.has(asSquare)) {
      violations.push({ ruleId: 'tags', category: 'TagUsage', original: match, replacement: asSquare, position: offset, severity: 'warning', message: `Converted "${match}" → "${asSquare}"` });
      return asSquare;
    }
    return match;
  });
  result = result.replace(/(\S)(\[(?:inaudible|overlapping speech|pause|background noise|laughter|crosstalk|phonetic|sic)\])/gi, '$1 $2');
  result = result.replace(/(\[(?:inaudible|overlapping speech|pause|background noise|laughter|crosstalk|phonetic|sic)\])(\S)/gi, '$1 $2');
  return { text: result, violations };
}

// ─── Speaker Labels ──────────────────────────────────────────────────────────

const PRESERVED_ROLES = new Set([
  'interviewer','interviewee','judge','witness','plaintiff','defendant',
  'counsel','attorney','prosecutor','court reporter','clerk','moderator','chairperson',
]);
const SHORTHAND_MAP = new Map([['q','Question'],['a','Answer']]);

function formatSpeakerLabels(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  // Pattern 1: "Speaker N:" variants
  result = result.replace(/^((?:speaker|spkr|spk)\s*[-_]?\s*(\d+))\s*:/gim, (match, _label, num, offset) => {
    const replacement = `Speaker ${num}:`;
    if (match.trim() !== replacement) violations.push({ ruleId: 'speaker-labels', category: 'SpeakerFormatting', original: match.trim(), replacement, position: offset, severity: 'warning', message: `Normalized "${match.trim()}" → "${replacement}"` });
    return replacement;
  });

  // Pattern 2: Q: / A: shorthand
  result = result.replace(/^([QA])\s*:/gim, (match, letter: string, offset: number) => {
    const expanded = SHORTHAND_MAP.get(letter.toLowerCase());
    if (!expanded) return match;
    const replacement = `${expanded}:`;
    violations.push({ ruleId: 'speaker-labels', category: 'SpeakerFormatting', original: match.trim(), replacement, position: offset, severity: 'warning', message: `Expanded "${match.trim()}" → "${replacement}"` });
    return replacement;
  });

  // Pattern 3: S1: shorthand
  result = result.replace(/^S(\d+)\s*:/gim, (match, num, offset) => {
    const replacement = `Speaker ${num}:`;
    violations.push({ ruleId: 'speaker-labels', category: 'SpeakerFormatting', original: match.trim(), replacement, position: offset, severity: 'warning', message: `Expanded "${match.trim()}" → "${replacement}"` });
    return replacement;
  });

  // Pattern 4: Preserved roles — normalize capitalization
  const rolesPattern = [...PRESERVED_ROLES].join('|');
  const roleRegex = new RegExp(`^(${rolesPattern})\\s*:`, 'gim');
  result = result.replace(roleRegex, (match, role: string, offset: number) => {
    const properCase = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    const replacement = `${properCase}:`;
    if (match.trim() !== replacement) {
      violations.push({ ruleId: 'speaker-labels', category: 'SpeakerFormatting', original: match.trim(), replacement, position: offset, severity: 'info', message: `Normalized role "${match.trim()}" → "${replacement}"` });
    }
    return replacement;
  });

  // Pattern 5: Space after colon
  result = result.replace(/^((?:Speaker \d+|Question|Answer|[A-Z][a-z]+):)(\S)/gm, (match, label, nextChar, offset) => {
    const replacement = `${label} ${nextChar}`;
    violations.push({ ruleId: 'speaker-labels', category: 'SpeakerFormatting', original: match, replacement, position: offset, severity: 'info', message: 'Added space after colon' });
    return replacement;
  });

  return { text: result, violations };
}

// ─── Capitalization ──────────────────────────────────────────────────────────

const ACRONYMS = new Set(['FBI','CIA','NSA','DOJ','SEC','IRS','EPA','FDA','FCC','LLC','LLP','INC','CEO','CFO','CTO','COO','VP','USA','UK','EU','UN','NATO','WHO','DNA','RNA','HIV','AIDS','COVID','AM','PM','EST','CST','MST','PST','MR','MRS','MS','DR','JR','SR','ID','SSN','DOB','DUI','DWI','PC','IT','HR','PR','QA','OK','TV','CD','DVD']);

function enforceCapitalization(text: string, config?: RuleConfig): RuleResult {
  if (config && !config.enabled) return { text, violations: [] };
  const violations: Violation[] = [];
  let result = text;

  // De-shout ALL CAPS (preserve acronyms)
  result = result.replace(/\b([A-Z]{3,})\b/g, (match, word, offset) => {
    if (ACRONYMS.has(word)) return match;
    const before = result.substring(0, offset).trimEnd();
    const isStart = !before || /[.!?:]\s*$/.test(before);
    const lower = word.toLowerCase();
    const replacement = isStart ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    violations.push({ ruleId: 'capitalization', category: 'CapitalizationRule', original: match, replacement, position: offset, severity: 'warning', message: `De-shouted "${match}"` });
    return replacement;
  });

  // Capitalize after sentence-ending punctuation
  result = result.replace(/([.!?])\s+([a-z])/g, (match, punc, letter, offset) => {
    const replacement = `${punc} ${letter.toUpperCase()}`;
    violations.push({ ruleId: 'capitalization', category: 'CapitalizationRule', original: match, replacement, position: offset, severity: 'info', message: 'Capitalized sentence start' });
    return replacement;
  });

  // Capitalize after speaker labels
  result = result.replace(/^((?:Speaker \d+|Question|Answer|[A-Z][a-z]+):)\s+([a-z])/gm, (match, label, letter, offset) => {
    const replacement = `${label} ${letter.toUpperCase()}`;
    violations.push({ ruleId: 'capitalization', category: 'CapitalizationRule', original: match, replacement, position: offset, severity: 'info', message: 'Capitalized after speaker label' });
    return replacement;
  });

  // Capitalize standalone "i"
  result = result.replace(/\bi\b/g, (match, offset) => {
    const before = result[offset - 1];
    const after = result[offset + 1];
    if (before && /\w/.test(before)) return match;
    if (after && /\w/.test(after)) return match;
    violations.push({ ruleId: 'capitalization', category: 'CapitalizationRule', original: 'i', replacement: 'I', position: offset, severity: 'info', message: 'Capitalized pronoun "I"' });
    return 'I';
  });

  // Capitalize start of transcript
  if (result.length > 0 && /^[a-z]/.test(result)) {
    violations.push({ ruleId: 'capitalization', category: 'CapitalizationRule', original: result.charAt(0), replacement: result.charAt(0).toUpperCase(), position: 0, severity: 'info', message: 'Capitalized start' });
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return { text: result, violations };
}

// ─── Engine Orchestrator ─────────────────────────────────────────────────────

const RULE_PIPELINE: Array<{ id: string; configKey: keyof EngineConfig; fn: (t: string, c?: RuleConfig) => RuleResult }> = [
  { id: 'speaker-labels', configKey: 'speakerLabels', fn: formatSpeakerLabels },
  { id: 'tags', configKey: 'tags', fn: handleTags },
  { id: 'filler-removal', configKey: 'fillerRemoval', fn: removeFillers },
  { id: 'slang-normalization', configKey: 'slangNormalization', fn: normalizeSlang },
  { id: 'false-starts', configKey: 'falseStarts', fn: handleFalseStarts },
  { id: 'punctuation', configKey: 'punctuation', fn: enforcePunctuation },
  { id: 'capitalization', configKey: 'capitalization', fn: enforceCapitalization },
];

export function enforce(text: string, config: Partial<EngineConfig> = {}): CVLResult {
  const fullConfig: EngineConfig = { ...DEFAULT_CONFIG, ...config };
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

  currentText = currentText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim();

  const score = allViolations.length === 0 ? 100 : Math.max(0, Math.round(100 - allViolations.reduce((sum, v) => {
    switch (v.severity) { case 'error': return sum + 5; case 'warning': return sum + 2; case 'info': return sum + 0.5; default: return sum; }
  }, 0) / Math.max(1, text.length / 200)));

  return { text: currentText, violations: allViolations, score, stats };
}
