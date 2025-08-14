import { describe, it, expect } from 'vitest';
import { generateStaticCanary } from '../src/canary.js';

describe('generateStaticCanary', () => {
  it('differs with salt and respects length', () => {
    const base = { secret:'sec', id:'id1', version:'v1' } as const;
    const c1 = generateStaticCanary({ ...base, salt:'salt1', length:12 });
    const c2 = generateStaticCanary({ ...base, salt:'salt2', length:12 });
    expect(c1).not.toEqual(c2);
    expect(c1.length).toBe(12);
  });
});
