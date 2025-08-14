import { describe, it, expect } from 'vitest';
import { canonicalize, hashCanonical } from './canonicalize';

describe('canonicalize', () => {
  it('sorts object keys deterministically', () => {
    const a = canonicalize({ b:1, a:2 });
    const b = canonicalize({ a:2, b:1 });
    expect(a).toEqual('{"a":2,"b":1}');
    expect(b).toEqual(a);
  });
  it('hashCanonical stable across runs', () => {
    const r1 = hashCanonical({ x:1, y:0.5 });
    const r2 = hashCanonical({ y:0.5, x:1 });
    expect(r1.canonical).toEqual(r2.canonical);
    expect(r1.sha256).toEqual(r2.sha256);
  });
});
