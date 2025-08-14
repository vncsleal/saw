import { z } from 'zod';
import { canonicalize, hashCanonical } from './canonicalize.js';
import { FeedSchema, ItemSchema } from './schemas';

export type Item = z.infer<typeof ItemSchema>;
export type Feed = z.infer<typeof FeedSchema>;
export interface BuildFeedCoreInput { site: string; items: Item[]; }
export function buildFeedCore(input: BuildFeedCoreInput): Omit<Feed,'signature'> { return { site: input.site, generated_at: new Date().toISOString(), items: input.items.map(i=>({ ...i, content: i.content ?? null })) }; }
export function feedHash(feed: Omit<Feed,'signature'>): string { const canonical = canonicalize({ site: feed.site, generated_at: feed.generated_at, items: feed.items }); return hashCanonical(canonical).sha256; }
