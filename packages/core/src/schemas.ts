import { z } from 'zod';

export const BlockSchema = z.object({
  id: z.string().regex(/^block:[A-Za-z0-9_.-]+/),
  type: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  content: z.string(),
  structured: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  relations: z.array(z.object({ type: z.string(), target: z.string() })).optional(),
  version: z.string(),
  published_at: z.string().datetime().optional(),
  updated_at: z.string().datetime(),
  canonical_url: z.string().url().optional(),
  provenance: z.object({ authorId: z.string().optional(), commitId: z.string().optional() }).optional(),
  discoverability: z.object({ public: z.boolean().optional(), include_in_llms_txt: z.boolean().optional() }).optional(),
  block_hash: z.string().regex(/^[a-f0-9]{8,64}$/).optional(),
  canary: z.string().optional()
});

export const FeedItemSchema = BlockSchema.pick({
  id: true, type: true, title: true, version: true, updated_at: true, block_hash: true, canary: true
}).extend({
  summary: z.string().optional(),
  structured: z.record(z.any()).optional(),
  published_at: z.string().datetime().optional(),
  canonical_url: z.string().url().optional()
});

export const FeedSchema = z.object({
  site: z.string(),
  generated_at: z.string().datetime(),
  items: z.array(FeedItemSchema),
  signature: z.string(),
  signed_fields: z.array(z.string()).optional(),
  session_canary: z.string().optional()
});

export type Block = z.infer<typeof BlockSchema>;
export type Feed = z.infer<typeof FeedSchema>;
