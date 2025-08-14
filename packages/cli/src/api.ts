// Public API barrel for saw (merged core + helpers)
export { canonicalize, sha256Hex, hashCanonical } from './core/canonicalize.js';
export { generateKeyPair, generateKeyPairFromSeed, signFeed, verifyFeedSignature } from './core/crypto.js';
export { feedHash, buildFeedCore } from './core/feed.js';
export { diffCanonical, diffStringArrays } from './core/diff.js';
export { buildAuthHeaders } from './core/auth.js';
export { ItemSchema, FeedSchema } from './core/schemas.js';
export { buildLLMsTxtEntry } from './core/llmsTxt.js';
export { createInMemoryStore } from './core/store.js';
export { generateEphemeralToken } from './core/ephemeral.js';
export { AgentQueue } from './core/agent.js';
export {
  createFeedHandler,
  createDetectHandler,
  createFeedFetchHandler,
  createDetectFetchHandler
} from './server.js';
export type { SawFeedItem, CreateFeedHandlerOptions, CreateDetectHandlerOptions } from './server.js';
export { buildAntiScrapeHTML, createAntiScrapePageHandler, generateCanaryToken, extractCanariesFromHtml } from './antiscrape.js';

// Re-implementations / adapters for previously separate higher-level functions expected by CLI
export interface BuildFeedInput { site: string; blocks: Array<Record<string, unknown>>; secretKeyBase64: string; canarySecret?: string; events?: SimpleEventEmitter; }
export function buildFeed(opts: BuildFeedInput) {
  const { site, blocks, secretKeyBase64, canarySecret, events } = opts;
  const items = blocks.map(b=>({ id: String(b.id||''), type: b.type || 'doc', title: (b.title as string) || String(b.id||''), content: b.content ?? null, version: (b.version as string)||'v1', updated_at: (b.updated_at as string)|| new Date().toISOString() }));
  const base = { site, generated_at: new Date().toISOString(), items };
  const signature = signFeed(base, secretKeyBase64);
  events?.emit('blockCount', items.length);
  return { ...base, signature, canary: canarySecret ? { hint: 'present' } : undefined } as const;
}

// local import for internal use of sign/verify (re-exports above don't create bindings)
import { signFeed, verifyFeedSignature } from './core/crypto.js';

export function generateLlmsTxt(args: { feedUrl: string; publicKeyFingerprint: string; publicKey: string; }) {
  const { feedUrl, publicKeyFingerprint, publicKey } = args;
  return [
    '# SAW llms.txt',
    `AI-Feed-URL: ${feedUrl}`,
    `Public-Key: ${publicKeyFingerprint}`,
    `Public-Key-Base64: ${publicKey}`,
    ''
  ].join('\n');
}

export function generateApiKey() {
  const id = 'ak_' + Math.random().toString(36).slice(2,10);
  const secret = 'ask_' + Math.random().toString(36).slice(2,18);
  const salt = Math.random().toString(36).slice(2,10);
  const record = { id, salt };
  return { id, secret, record };
}

export function verifySignedDiff(diffObj: unknown, publicKeyB64: string): boolean {
  if (!diffObj || typeof diffObj !== 'object') return false;
  if (!('signature' in diffObj)) return false;
  const { signature, ...subset } = diffObj as { signature: string } & Record<string, unknown>;
  try { return verifyFeedSignature(subset, signature, publicKeyB64); } catch { return false; }
}

export function detectCanaries(text: string) {
  const regex = /\b[A-Z]{3,5}-\d{3,6}\b/g; // simple pattern detector
  const matches = text.match(regex) || [];
  return { count: matches.length, matches };
}

// Simple event emitter if not already exposed
export class SimpleEventEmitter {
  private handlers: Record<string, Array<(...args: unknown[])=>void>> = {};
  on(event: string, fn: (...args: unknown[])=>void) { (this.handlers[event] ||= []).push(fn); }
  emit(event: string, ...args: unknown[]) { (this.handlers[event]||[]).forEach(fn=>fn(...args)); }
}
