import { describe, it, expect } from 'vitest';
import { generateStaticCanary } from '../src/canary.js';

// Simple collision check over sample ids/versions

describe('canary collision check', () => {
  it('no collisions in sample set', () => {
    const secret = 'sample-secret';
    const seen = new Set<string>();
    for (let i=0;i<200;i++) {
      const id = 'block:'+i;
      const v = 'v'+(i%5);
      const c = generateStaticCanary({ secret, id, version: v });
      const key = c;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
