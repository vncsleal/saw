import { describe, it, expect } from 'vitest';
import { buildFeed, generateKeyPairFromSeed, Block } from '../src/index.js';

const blocks: Block[] = [
  { id:'block:c1', type:'doc', title:'C1', content:'', version:'v1', updated_at:'2025-01-01T00:00:00Z' } as Block
];

describe('feed structured.meta canary injection', () => {
  it('includes structured.meta.canary when canarySecret provided', () => {
  const kp = generateKeyPairFromSeed('feed-canary');
	const feed = buildFeed({ site:'ex', blocks, secretKeyBase64: Buffer.from(kp.secretKey).toString('base64'), canarySecret:'secret' });
  expect(feed.items[0].structured?.meta?.canary).toBeDefined();
  });
  it('omits canary fields when canarySecret absent', () => {
    const kp = generateKeyPairFromSeed('feed-canary2');
    const feed = buildFeed({ site:'ex', blocks, secretKeyBase64: Buffer.from(kp.secretKey).toString('base64') });
    expect(feed.items[0].canary).toBeUndefined();
    expect(feed.items[0].structured).toBeUndefined();
  });
});
