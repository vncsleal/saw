import { describe, it, expect } from 'vitest';
import { buildFeed, generateKeyPairFromSeed, generateApiKey } from '../src/index.js';

const blocks = [ { id:'block:salt', type:'doc', title:'Salted', content:'', version:'v1', updated_at:'2025-01-01T00:00:00Z' } ];

describe('per-key salted canaries', () => {
  it('produces different canaries for different key salts', () => {
    const kp = generateKeyPairFromSeed('salt-base');
    const { record: rec1 } = generateApiKey();
    const { record: rec2 } = generateApiKey();
    const feed1 = buildFeed({ site:'ex', blocks, secretKeyBase64: Buffer.from(kp.secretKey).toString('base64'), canarySecret:'secret', perKeySalt: rec1.salt });
    const feed2 = buildFeed({ site:'ex', blocks, secretKeyBase64: Buffer.from(kp.secretKey).toString('base64'), canarySecret:'secret', perKeySalt: rec2.salt });
    expect(feed1.items[0].canary).not.toEqual(feed2.items[0].canary);
  });
});
