import { describe, it, expect } from 'vitest';
import { signFeed, generateKeyPair, verifySignedDiff } from './index.js';

describe('verifySignedDiff', () => {
  it('verifies a properly signed diff subset', () => {
    const kp = generateKeyPair();
    const publicKeyB64 = Buffer.from(kp.publicKey).toString('base64');
    const secretKeyB64 = Buffer.from(kp.secretKey).toString('base64');
    const subset = { site:'example.com', since: '1970-01-01T00:00:00Z', changed:[{ id:'a', version:'v1', updated_at: new Date().toISOString() }], removed: [] };
    const signature = signFeed(subset, secretKeyB64);
    const diff = { ...subset, signature };
    expect(verifySignedDiff(diff, publicKeyB64)).toBe(true);
    const bad = { ...diff, changed:[{ ...diff.changed[0], version:'v2' }] };
    expect(verifySignedDiff(bad, publicKeyB64)).toBe(false);
  });
});
