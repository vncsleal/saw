import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { verifyFeedSignature } from '../src/api.js';

interface Golden { public_key_base64: string; feed_subset: unknown; signature_base64: string; }

describe('signature golden vector', () => {
  test('verifies known signature', () => {
  const p = path.join(process.cwd(),'packages','cli','test-vectors','signature-golden.json');
    const g: Golden = JSON.parse(fs.readFileSync(p,'utf8'));
    const ok = verifyFeedSignature(g.feed_subset, g.signature_base64, g.public_key_base64);
    expect(ok).toBe(true);
  });
});
