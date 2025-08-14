import { describe, it, expect } from 'vitest';
import { generateKeyPairFromSeed, signFeed, verifySignedDiff } from './index.js';

describe('verifySignedDiff', () => {
  it('verifies signed diff subset', () => {
    const kp = generateKeyPairFromSeed('diff-sig-test');
    const secretB64 = Buffer.from(kp.secretKey).toString('base64');
    const publicB64 = Buffer.from(kp.publicKey).toString('base64');
    const subset = { site:'example.local', since:'2025-01-01T00:00:00.000Z', changed:[{ id:'block:1', version:'v2', updated_at:'2025-01-02T00:00:00.000Z' }], removed:['block:old'] };
    const signature = signFeed(subset, secretB64);
    const ok = verifySignedDiff({ ...subset, signature }, publicB64);
    expect(ok).toBe(true);
    const bad = verifySignedDiff({ ...subset, signature: 'A'+signature.slice(1) }, publicB64);
    expect(bad).toBe(false);
  });
});
