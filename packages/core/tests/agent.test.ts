import { describe, it, expect } from 'vitest';
import { buildAgentDescriptor, generateKeyPairFromSeed } from './index.js';

describe('agent descriptor', () => {
  it('builds descriptor with fingerprint', () => {
    const kp = generateKeyPairFromSeed('agent-seed');
    const pub = Buffer.from(kp.publicKey).toString('base64');
    const d = buildAgentDescriptor({ site:'example.com', publicKeyBase64: pub });
    expect(d.site).toBe('example.com');
    expect(d.endpoints.feed).toContain('/api/saw/feed');
    expect(d.public_key_fingerprint.startsWith('ed25519:')).toBe(true);
    expect(d.public_key_fingerprint.length).toBeGreaterThan(8);
  });
});
