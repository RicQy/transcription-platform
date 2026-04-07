import { describe, it, expect } from 'vitest';
import { enforce } from '../engine';
import { removeFillers } from '../rules/filler-removal';
import { normalizeSlang } from '../rules/slang-normalization';
import { handleFalseStarts } from '../rules/false-starts';
import { enforcePunctuation } from '../rules/punctuation';
import { handleTags } from '../rules/tags';
import { formatSpeakerLabels } from '../rules/speaker-labels';
import { enforceCapitalization } from '../rules/capitalization';


// ─── Individual Rule Tests ───────────────────────────────────────────────────

describe('Filler Removal', () => {
  it('removes basic fillers', () => {
    const { text } = removeFillers('I was, uh, going to the, um, store');
    expect(text).not.toContain('uh');
    expect(text).not.toContain('um');
    expect(text).toContain('going to the');
    expect(text).toContain('store');
  });

  it('preserves crutch phrases', () => {
    const { text } = removeFillers('I was, you know, going to the store');
    expect(text).toContain('you know');
  });

  it('returns violations for each filler removed', () => {
    const { violations } = removeFillers('uh, um, well, er');
    expect(violations.length).toBeGreaterThanOrEqual(3); // uh, um, er
    expect(violations.every((v) => v.ruleId === 'filler-removal')).toBe(true);
  });

  it('does nothing when disabled', () => {
    const input = 'I was, uh, going';
    const { text } = removeFillers(input, { enabled: false });
    expect(text).toBe(input);
  });
});

describe('Slang Normalization', () => {
  it('normalizes common contractions', () => {
    const { text } = normalizeSlang('I gonna wanna gotta do this');
    expect(text).toContain('going to');
    expect(text).toContain('want to');
    expect(text).toContain('got to');
  });

  it('preserves capitalization', () => {
    const { text } = normalizeSlang('Gonna do it');
    expect(text).toMatch(/^Going to/);
  });

  it('normalizes informal affirmatives', () => {
    const { text } = normalizeSlang('Yeah, nah, I dunno');
    expect(text).toContain('Yes');
    expect(text).toContain('no');
    expect(text).toContain('do not know');
  });

  it('records violations with originals', () => {
    const { violations } = normalizeSlang('gonna wanna');
    expect(violations.length).toBe(2);
    expect(violations[0].original).toBe('gonna');
    expect(violations[0].replacement).toBe('going to');
  });
});

describe('False Start Handling', () => {
  it('marks repeated words with double-dash', () => {
    const { text } = handleFalseStarts('The the defendant was present');
    expect(text).toContain('The--');
    expect(text).toContain('the defendant');
  });

  it('marks partial words as false starts', () => {
    const { text } = handleFalseStarts('pro probably the right answer');
    expect(text).toContain('pro--');
    expect(text).toContain('probably');
  });

  it('does not double-mark already marked text', () => {
    const input = 'The-- the defendant';
    const { text } = handleFalseStarts(input);
    expect(text).toBe(input);
  });
});

describe('Punctuation Enforcement', () => {
  it('collapses multiple spaces', () => {
    const { text } = enforcePunctuation('Hello    world');
    expect(text).toBe('Hello world');
  });

  it('removes space before punctuation', () => {
    const { text } = enforcePunctuation('Hello , world .');
    expect(text).toBe('Hello, world.');
  });

  it('adds space after punctuation', () => {
    const { text } = enforcePunctuation('Hello,world.How are you');
    expect(text).toContain('Hello, world.');
    expect(text).toContain('How are you');
  });

  it('preserves decimal numbers', () => {
    const { text } = enforcePunctuation('The amount was 3.5 million');
    expect(text).toContain('3.5');
  });
});

describe('Tag Handling', () => {
  it('normalizes non-standard tags', () => {
    const { text } = handleTags('He said [unintelligible] and then [unclear]');
    expect(text).toContain('[inaudible]');
    expect(text).not.toContain('[unintelligible]');
    expect(text).not.toContain('[unclear]');
  });

  it('converts parenthetical tags to brackets', () => {
    const { text } = handleTags('He said (inaudible) something');
    expect(text).toContain('[inaudible]');
    expect(text).not.toContain('(inaudible)');
  });

  it('normalizes laughter tags', () => {
    const { text } = handleTags('And then [laughs] he said');
    expect(text).toContain('[laughter]');
  });

  it('preserves already-correct tags', () => {
    const input = 'He said [inaudible] and then [pause]';
    const { text } = handleTags(input);
    expect(text).toBe(input);
  });
});

describe('Speaker Label Formatting', () => {
  it('normalizes speaker label format', () => {
    const { text } = formatSpeakerLabels('SPEAKER 1: Hello');
    expect(text).toBe('Speaker 1: Hello');
  });

  it('adds space in "SpeakerN:" format', () => {
    const { text } = formatSpeakerLabels('Speaker1: Hello');
    expect(text).toBe('Speaker 1: Hello');
  });

  it('expands shorthand Q: and A:', () => {
    const { text } = formatSpeakerLabels('Q: What happened?\nA: I saw it.');
    expect(text).toContain('Question:');
    expect(text).toContain('Answer:');
  });

  it('expands S1: shorthand', () => {
    const { text } = formatSpeakerLabels('S1: Hello\nS2: Hi there');
    expect(text).toContain('Speaker 1:');
    expect(text).toContain('Speaker 2:');
  });
});

describe('Capitalization', () => {
  it('capitalizes sentence starts', () => {
    const { text } = enforceCapitalization('hello. world. how are you?');
    expect(text).toMatch(/^Hello\./);
    expect(text).toContain('. World.');
    expect(text).toContain('. How are you?');
  });

  it('de-shouts non-acronym caps', () => {
    const { text } = enforceCapitalization('I WAS NOT THERE that day');
    expect(text).not.toContain('WAS');
    expect(text).not.toContain('NOT');
    expect(text).not.toContain('THERE');
  });

  it('preserves acronyms', () => {
    const { text } = enforceCapitalization('The FBI and CIA were involved');
    expect(text).toContain('FBI');
    expect(text).toContain('CIA');
  });

  it('capitalizes standalone i', () => {
    const { text } = enforceCapitalization('i was there and i saw it');
    expect(text).toContain('I was');
    expect(text).toContain('I saw');
  });
});

// ─── Full Pipeline Test ──────────────────────────────────────────────────────

describe('CVL Engine (full pipeline)', () => {
  it('processes a complete transcript through all rules', () => {
    const input = [
      'SPEAKER 1: uh i gonna tell you what happened, um, at the, uh, location',
      'speaker1: yeah (inaudible) and then the the defendant was was there',
      'S2: I WAS NOT THERE that day, nah, i dunno what they talking about',
    ].join('\n');

    const result = enforce(input);

    // Fillers removed
    expect(result.text).not.toMatch(/\buh\b/i);
    expect(result.text).not.toMatch(/\bum\b/i);

    // Slang normalized
    expect(result.text).toContain('going to');
    expect(result.text).not.toContain('gonna');

    // Tags standardized
    expect(result.text).toContain('[inaudible]');
    expect(result.text).not.toContain('(inaudible)');

    // Speaker labels formatted
    expect(result.text).toContain('Speaker 1:');
    expect(result.text).toContain('Speaker 2:');

    // Score is between 0 and 100
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    // Has violations
    expect(result.violations.length).toBeGreaterThan(0);

    // Has stats
    expect(result.stats).toBeDefined();
    expect(typeof result.stats['filler-removal']).toBe('number');
  });

  it('returns score of 100 for already-compliant text', () => {
    const input = 'Speaker 1: I was at the location on that day.';
    const result = enforce(input);
    expect(result.score).toBe(100);
    expect(result.violations.length).toBe(0);
  });

  it('respects disabled rules', () => {
    const input = 'I gonna, uh, do this';
    const result = enforce(input, {
      slangNormalization: { enabled: false },
    });
    // Slang not normalized (disabled)
    expect(result.text).toContain('gonna');
    // But fillers still removed (enabled by default)
    expect(result.text).not.toContain('uh');
  });
});
