import { describe, it, expect } from 'vitest';
import { canonicalize, hashCanonical } from './canonicalize';
import fs from 'node:fs';
import path from 'node:path';

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
  it('applies deterministically over fixture corpus', () => {
    const fixturesPath = path.join(process.cwd(),'canonicalization-fixtures','fixtures.json');
    if (!fs.existsSync(fixturesPath)) return; // skip if not generated yet
    const fixtures = JSON.parse(fs.readFileSync(fixturesPath,'utf8'));
    for (const f of fixtures) {
      const { canonical, sha256 } = hashCanonical(f.input);
      if (f.canonical) expect(canonical).toEqual(f.canonical);
      if (f.sha256) expect(sha256).toEqual(f.sha256);
    }
  });
});
