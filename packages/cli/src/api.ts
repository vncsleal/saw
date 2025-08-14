// Minimal public API (signature, feed generation, llms.txt, antiscrape helpers, verification schemas)
export { generateKeyPair, signFeed, verifyFeedSignature } from './core/crypto.js';
export { FeedSchema, ItemSchema } from './core/schemas.js';
export { canonicalize } from './core/canonicalize.js';

// Simple feed builder used by CLI and server helpers
export interface BuildFeedInput { site: string; blocks: Array<Record<string, unknown>>; secretKeyBase64: string; }
export function buildFeed(opts: BuildFeedInput) {
  const { site, blocks, secretKeyBase64 } = opts;
  const items = blocks.map(b=>({ id: String(b.id||''), type: b.type || 'doc', title: (b.title as string) || String(b.id||''), content: b.content ?? null, version: (b.version as string)||'v1', updated_at: (b.updated_at as string)|| new Date().toISOString() }));
  const base = { site, generated_at: new Date().toISOString(), items };
  const signature = signFeed(base, secretKeyBase64);
  return { ...base, signature } as const;
}
import { signFeed } from './core/crypto.js';

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

// Feed API route (access part): minimal fetch-style handler
export interface FeedRouteOptions {
  site: string;
  secretKeyBase64: string;
  getBlocks: () => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;
  publicKeyBase64?: string; // if provided, included as response header for convenience
}

export function createFeedRoute(opts: FeedRouteOptions) {
  const { site, secretKeyBase64, getBlocks, publicKeyBase64 } = opts;
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
    }
    try {
      const blocks = await getBlocks();
      const feed = buildFeed({ site, blocks, secretKeyBase64 });
      const headers: Record<string,string> = { 'content-type':'application/json; charset=utf-8' };
      if (publicKeyBase64) headers['x-saw-public-key'] = publicKeyBase64;
      return new Response(JSON.stringify(feed), { status:200, headers });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status:500, headers:{ 'content-type':'application/json' } });
    }
  };
}

// Optional Node.js (http) adapter
export function createNodeFeedHandler(opts: FeedRouteOptions) {
  const route = createFeedRoute(opts);
  return async function nodeHandler(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
    const method = req.method || 'GET';
    const url = 'http://localhost' + (req.url || '/');
    const request = new Request(url, { method });
    const response = await route(request);
    res.statusCode = response.status;
    for (const [k,v] of response.headers.entries()) res.setHeader(k, v);
    const body = await response.text();
    res.end(body);
  };
}

// Anti-scrape (canary) HTML generation minimal subset
export { buildAntiScrapeHTML, generateCanaryToken } from './antiscrape.js';
