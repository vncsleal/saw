/**
 * Agent Interface Generator (Phase 1 stub)
 * Produces a minimal JSON describing endpoints and public key fingerprint for consumption by clients.
 */
import { createHash } from 'node:crypto';

export interface AgentDescriptorOptions {
  site: string;
  publicKeyBase64: string;
  feedUrl?: string; // defaults to https://<site>/api/saw/feed
  diffUrl?: string; // defaults to https://<site>/api/saw/diff
  version?: string; // spec version
}

export interface AgentDescriptor {
  site: string;
  version: string;
  endpoints: { feed: string; diff: string; };
  public_key_fingerprint: string; // ed25519:<first8>
}

export function buildAgentDescriptor(opts: AgentDescriptorOptions): AgentDescriptor {
  const feedUrl = opts.feedUrl || `https://${opts.site}/api/saw/feed`;
  const diffUrl = opts.diffUrl || `https://${opts.site}/api/saw/diff`;
  const hash = createHash('sha256').update(Buffer.from(opts.publicKeyBase64,'base64')).digest('hex').slice(0,8);
  return {
    site: opts.site,
    version: opts.version || '1.0',
    endpoints: { feed: feedUrl, diff: diffUrl },
    public_key_fingerprint: `ed25519:${hash}`
  };
}
