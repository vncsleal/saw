import { describe, it, expect } from 'vitest';
import { detectCanaries } from './ephemeral.js';

// Conformance Test ID: CT-DETECT-01
// Ensures detector classification & confidence scoring behave as specified.
describe('CT-DETECT-01 detector conformance', () => {
  it('produces expected classification & confidence ordering', () => {
    const none = detectCanaries('plain text without markers');
    expect(none.classification).toBe('none');
    expect(none.confidence).toBe(0);

    const singleOnce = detectCanaries('one token c-AAAA1111 present');
    expect(singleOnce.classification).toBe('single');
    expect(singleOnce.confidence).toBeGreaterThan(0);

    const singleRepeat = detectCanaries('repeat c-BBBB2222 tokens c-BBBB2222 again c-BBBB2222');
    expect(singleRepeat.classification).toBe('single');
    expect(singleRepeat.confidence).toBeGreaterThanOrEqual(singleOnce.confidence);

    const multi = detectCanaries('two tokens c-CCCC3333 plus c-DDDD4444 here');
    expect(multi.classification).toBe('multiple');
  // Multi should generally not be lower than single-once baseline
  expect(multi.confidence).toBeGreaterThanOrEqual(singleOnce.confidence);

    for (const r of [none, singleOnce, singleRepeat, multi]) {
      expect(typeof r.rationale).toBe('string');
      expect(r.rationale.length).toBeGreaterThan(0);
    }
  });
});
