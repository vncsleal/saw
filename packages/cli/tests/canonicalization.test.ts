import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hashCanonical } from '../src/core/canonicalize.js';

interface Vector { name: string; input: unknown; canonical: string; sha256: string; }

const vectorsPath = path.join(process.cwd(), 'packages', 'cli', 'test-vectors', 'canonicalization.json');
const raw = fs.readFileSync(vectorsPath,'utf8');
const data = JSON.parse(raw) as { vectors: Vector[] };

describe('canonicalization vectors', () => {
  for (const v of data.vectors) {
    test(v.name, () => {
      const { canonical, sha256 } = hashCanonical(v.input);
      expect(canonical).toBe(v.canonical);
      expect(sha256).toBe(v.sha256);
    });
  }
});
