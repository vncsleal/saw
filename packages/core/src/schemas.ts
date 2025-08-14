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

// Webhook payload schemas (best-effort, may be partial depending on server implementation)
export const WebhookFeedResponseSchema = z.object({ items: z.number().optional(), ephemeral: z.string().optional() }).passthrough();
export const WebhookPageResponseSchema = z.object({ ephemeral: z.string().optional() }).passthrough();
export const WebhookDetectRequestSchema = z.object({ tokens: z.number(), matched: z.number().optional(), confidence: z.number().min(0).max(1).optional() }).passthrough();
export const WebhookCanaryDetectedSchema = z.object({
  tokens: z.array(z.string()),
  totalOccurrences: z.number(),
  matched: z.array(z.object({ token: z.string(), requestId: z.string() })),
  unknown: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  confidence_band: z.enum(['none','low','medium','high']).optional(),
  classification: z.enum(['none','single','multiple']),
  rationale: z.string()
}).passthrough();

// Newly documented (Phase 4) additional events
export const WebhookDiffResponseSchema = z.object({
  since: z.string().optional(),
  changed: z.number().optional(),
  removed: z.number().optional(),
  signature_present: z.boolean().optional()
}).passthrough();

export const WebhookIngestUpsertSchema = z.object({
  id: z.string().regex(/^block:/),
  version: z.string()
}).passthrough();

export type Block = z.infer<typeof BlockSchema>;
export type Feed = z.infer<typeof FeedSchema>;
export type WebhookCanaryDetected = z.infer<typeof WebhookCanaryDetectedSchema>;
export type WebhookDiffResponse = z.infer<typeof WebhookDiffResponseSchema>;
export type WebhookIngestUpsert = z.infer<typeof WebhookIngestUpsertSchema>;
