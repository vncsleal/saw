import { Block } from './schemas.js';
import { verifyFeedSignature } from './crypto.js';

export interface DiffResult { changed: Array<{ id: string; version: string; updated_at: string }>; removed: string[]; }

export function computeDiff(sinceISO: string, current: Block[], previous: Block[]): DiffResult {
  const since = Date.parse(sinceISO || '1970-01-01T00:00:00Z');
  const prevMap = new Map(previous.map(b => [b.id, b]));
  const changed: DiffResult['changed'] = [];
  for (const b of current) {
    const prev = prevMap.get(b.id);
    if (!prev) {
      if (Date.parse(b.updated_at) >= since) changed.push({ id: b.id, version: b.version, updated_at: b.updated_at });
    } else if (prev.version !== b.version || prev.updated_at !== b.updated_at) {
      if (Date.parse(b.updated_at) >= since) changed.push({ id: b.id, version: b.version, updated_at: b.updated_at });
    }
    prevMap.delete(b.id);
  }
  // Removed: blocks that existed previously but are absent now. We include them if their disappearance is after 'since'.
  // Simpler first pass: always include removed regardless of timestamp to guarantee consumer awareness.
  const removed = Array.from(prevMap.values()).map(b => b.id);
  return { changed, removed };
}

// Helper to verify a signed diff subset. The subset must include site, since, changed, removed.
export function verifySignedDiff(diff: { site: string; since: string; changed: DiffResult['changed']; removed: string[]; signature: string }, publicKeyB64: string): boolean {
  const { signature, ...subset } = diff;
  return verifyFeedSignature(subset, signature, publicKeyB64);
}
