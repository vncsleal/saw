import { describe, it, expect } from 'vitest';
import { generateKeyPairFromSeed, signFeed, verifyFeedSignature } from './index.js';
import fs from 'node:fs';

interface GoldenVector { seed:string; public_key_base64:string; feed_subset:unknown; signature_base64:string; }

const vector: GoldenVector = JSON.parse(fs.readFileSync(new URL('../../../test-vectors/signature-golden.json', import.meta.url), 'utf8'));

describe('signature golden vector', ()=>{
  it('matches expected deterministic signature', ()=>{
    const kp = generateKeyPairFromSeed(vector.seed);
    const pubB64 = Buffer.from(kp.publicKey).toString('base64');
    expect(pubB64).toEqual(vector.public_key_base64);
    const sig = signFeed(vector.feed_subset, Buffer.from(kp.secretKey).toString('base64'));
    expect(sig).toEqual(vector.signature_base64);
  });
  it('verifies using stored signature', ()=>{
    const ok = verifyFeedSignature(vector.feed_subset, vector.signature_base64, vector.public_key_base64);
    expect(ok).toBe(true);
  });
});
