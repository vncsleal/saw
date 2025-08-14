import { buildFeed, detectCanaries } from './api.js';

// Shared item type (loosely defined)
export interface SawFeedItem { id: string; title?: string; content?: unknown; version?: string; updated_at?: string; type?: string; [k: string]: unknown; }

export interface CreateFeedHandlerOptions {
  site: string;
  secretKeyBase64: string; // 64-byte Ed25519 secret key (base64)
  publicKeyBase64?: string; // if provided, will be emitted in header
  getBlocks: () => Promise<SawFeedItem[]> | SawFeedItem[];
  canarySecret?: string;
  exposePublicKeyHeader?: boolean;
}

export type NodeHandler = (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void | Promise<void>;

export function createFeedHandler(opts: CreateFeedHandlerOptions): NodeHandler {
  return async function feedHandler(req, res): Promise<void> {
  if (req.method && req.method !== 'GET') { res.statusCode = 405; res.setHeader('allow','GET'); res.end('Method Not Allowed'); return; }
    try {
      const blocks = await opts.getBlocks();
  const feed = buildFeed({ site: opts.site, blocks: blocks as Record<string, unknown>[], secretKeyBase64: opts.secretKeyBase64, canarySecret: opts.canarySecret });
      res.statusCode = 200;
      res.setHeader('content-type','application/json; charset=utf-8');
      if (opts.exposePublicKeyHeader && opts.publicKeyBase64) res.setHeader('x-saw-public-key', opts.publicKeyBase64);
      res.end(JSON.stringify(feed));
    } catch (e: unknown) {
      res.statusCode = 500; res.setHeader('content-type','application/json');
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
  };
}

export interface CreateDetectHandlerOptions {
  // Optional: remote comparison base etc could be added later
}

export function createDetectHandler(): NodeHandler {
  return async function detectHandler(req, res): Promise<void> {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('allow','POST'); res.end('Method Not Allowed'); return; }
    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.isBuffer(c)? c : Buffer.from(c));
      const bodyTxt = Buffer.concat(chunks).toString('utf8');
  let parsed: unknown = {};
  try { parsed = JSON.parse(bodyTxt || '{}'); } catch { parsed = {}; }
  const text = isObject(parsed) && typeof parsed.text === 'string' ? parsed.text : '';
      const local = detectCanaries(text);
      res.statusCode = 200; res.setHeader('content-type','application/json');
      res.end(JSON.stringify({ local }));
    } catch (e: unknown) {
      res.statusCode = 500; res.setHeader('content-type','application/json');
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
  };
}

// Fetch / edge style handlers -------------------------------------------------
export interface FeedFetchHandlerOptions extends CreateFeedHandlerOptions {}
export function createFeedFetchHandler(opts: FeedFetchHandlerOptions) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status:405, headers:{ allow:'GET' } });
    try {
      const blocks = await opts.getBlocks();
  const feed = buildFeed({ site: opts.site, blocks: blocks as Record<string, unknown>[], secretKeyBase64: opts.secretKeyBase64, canarySecret: opts.canarySecret });
      const headers: Record<string,string> = { 'content-type':'application/json; charset=utf-8' };
      if (opts.exposePublicKeyHeader && opts.publicKeyBase64) headers['x-saw-public-key'] = opts.publicKeyBase64;
      return new Response(JSON.stringify(feed), { status:200, headers });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status:500, headers:{ 'content-type':'application/json' } });
    }
  };
}

export function createDetectFetchHandler(): (request: Request)=>Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status:405, headers:{ allow:'POST' } });
    try {
      const body: unknown = await request.json().catch(()=>({}));
      const text = isObject(body) && typeof body.text === 'string' ? body.text : '';
      const local = detectCanaries(text);
      return new Response(JSON.stringify({ local }), { status:200, headers:{ 'content-type':'application/json' } });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status:500, headers:{ 'content-type':'application/json' } });
    }
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
