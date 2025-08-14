import { Block, BlockSchema, FeedSchema } from './schemas';
import { canonicalize, sha256Hex } from './canonicalize';

export interface BuildFeedOptions {
  site: string;
  blocks: Block[];
  generatedAt?: string;
  sign?: (canonicalSubset: string) => string; // returns base64 signature (Phase 1)
}

export function buildFeed(opts: BuildFeedOptions) {
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
  const feed = { site: opts.site, generated_at, items, signature: 'UNSIGNED' };
  FeedSchema.pick({ site:true, generated_at:true, items:true }).parse(feed);
  return feed;
}
