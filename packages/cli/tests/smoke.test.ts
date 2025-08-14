import { describe, test, expect } from 'vitest';
import { generateKeyPair, buildFeed, verifyFeedSignature } from '../src/api.js';

function b64(buf: Uint8Array) { return Buffer.from(buf).toString('base64'); }

describe('smoke', () => {
  test('keypair -> feed -> verify', () => {
    const kp = generateKeyPair();
    const pub = b64(kp.publicKey);
    const sec = b64(kp.secretKey);
    const blocks = [{ id:'block:smoke', type:'doc', title:'Smoke', content:'Test', version:'v1', updated_at:new Date().toISOString() }];
    const feed = buildFeed({ site:'smoke.local', blocks, secretKeyBase64: sec });
    const subset = { site: feed.site, generated_at: feed.generated_at, items: feed.items };
    expect(verifyFeedSignature(subset, feed.signature, pub)).toBe(true);
  });
});
