import { Block, BlockSchema, FeedSchema } from './schemas.js';
import { canonicalize, sha256Hex } from './canonicalize.js';
import { signFeed } from './crypto.js';

export interface BuildFeedOptions {
  site: string;
  blocks: Block[];
  generatedAt?: string;
  sign?: (canonicalSubset: string) => string; // returns base64 signature (Phase 1)
}

export function buildFeed(opts: BuildFeedOptions & { secretKeyBase64?: string }) {
  const generated_at = opts.generatedAt || new Date().toISOString();
  const items = opts.blocks.map(b => {
    BlockSchema.parse(b); // validate
    const structural = { id: b.id, type: b.type, title: b.title, version: b.version, updated_at: b.updated_at };
    const canonicalStructural = canonicalize(structural);
    const block_hash = sha256Hex(canonicalStructural).slice(0, 16); // short hash placeholder for Phase 0
    return {
      id: b.id,
      type: b.type,
      title: b.title,
      version: b.version,
      updated_at: b.updated_at,
      block_hash,
      canary: b.canary || 'pending'
    };
  });
  const feedSubset = { site: opts.site, generated_at, items };
  let signature = 'UNSIGNED';
  if (opts.secretKeyBase64) {
    signature = signFeed(feedSubset, opts.secretKeyBase64);
  }
  const feed = { ...feedSubset, signature, signed_fields: ['site','generated_at','items'] };
  FeedSchema.pick({ site:true, generated_at:true, items:true }).parse(feed);
  return feed;
}
