import { z } from 'zod';

export const ItemSchema = z.object({ id: z.string(), title: z.string().optional(), content: z.unknown().nullable().optional(), version: z.string().optional(), updated_at: z.string().optional(), type: z.string().optional() });
export const FeedSchema = z.object({ site: z.string(), generated_at: z.string(), items: z.array(ItemSchema), signature: z.string() });
