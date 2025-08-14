import { Block, BlockSchema, FeedSchema } from './schemas.js';
import { canonicalize, sha256Hex } from './canonicalize.js';
import { signFeed } from './crypto.js';
import { enrichBlocksWithCanaries, EventEmitterLike } from './canary.js';

export interface BuildFeedOptions {
  site: string;
  blocks: Block[];
  generatedAt?: string;
  sign?: (canonicalSubset: string) => string; // returns base64 signature (Phase 1)
}

export function buildFeed(opts: BuildFeedOptions & { secretKeyBase64?: string, canarySecret?: string, events?: EventEmitterLike }) {
  const generated_at = opts.generatedAt || new Date().toISOString();
  const sourceBlocks = opts.canarySecret ? enrichBlocksWithCanaries(opts.blocks, opts.canarySecret) : opts.blocks;
  opts.events?.emit('feed.request', { site: opts.site, block_count: sourceBlocks.length });
  const items = sourceBlocks.map(b => {
    BlockSchema.parse(b); // validate
    const structural = { id: b.id, type: b.type, title: b.title, version: b.version, updated_at: b.updated_at };
    const canonicalStructural = canonicalize(structural);
    const block_hash = sha256Hex(canonicalStructural).slice(0, 16); // short hash placeholder for Phase 0
  type FeedItemBase = { id:string; type:string; title:string; version:string; updated_at:string; block_hash:string; canary?:string; structured?: { meta: { canary: string } } };
  const base: FeedItemBase = {
      id: b.id,
      type: b.type,
      title: b.title,
      version: b.version,
      updated_at: b.updated_at,
      block_hash
    };
    if (opts.canarySecret) {
  base.canary = b.canary!; // enriched value (enrichBlocksWithCanaries guarantees)
  base.structured = { meta: { canary: b.canary! } };
    }
    return base;
  });
  const feedSubset = { site: opts.site, generated_at, items };
  let signature = 'UNSIGNED';
  if (opts.secretKeyBase64) {
    signature = signFeed(feedSubset, opts.secretKeyBase64);
  }
  const feed = { ...feedSubset, signature, signed_fields: ['site','generated_at','items'] };
  FeedSchema.pick({ site:true, generated_at:true, items:true }).parse(feed);
  opts.events?.emit('feed.response', { site: opts.site, items: items.length, signature_present: signature !== 'UNSIGNED' });
  return feed;
}
