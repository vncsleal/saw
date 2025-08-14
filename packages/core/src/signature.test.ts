import { describe, it, expect } from 'vitest';
import { generateKeyPair, signFeed, verifyFeedSignature } from './crypto.js';

describe('feed signature', () => {
  it('signs and verifies feed subset', () => {
    const kp = generateKeyPair();
    const subset = { site:'example.com', generated_at:'2025-08-14T00:00:00Z', items:[] };
    const sig = signFeed(subset, Buffer.from(kp.secretKey).toString('base64'));
    const ok = verifyFeedSignature(subset, sig, Buffer.from(kp.publicKey).toString('base64'));
    expect(ok).toBe(true);
  });
  it('fails on tamper', () => {
    const kp = generateKeyPair();
    const subset = { site:'example.com', generated_at:'2025-08-14T00:00:00Z', items:[] };
    const sig = signFeed(subset, Buffer.from(kp.secretKey).toString('base64'));
    const tampered = { ...subset, site:'evil.com' };
    const ok = verifyFeedSignature(tampered, sig, Buffer.from(kp.publicKey).toString('base64'));
    expect(ok).toBe(false);
  });
});
