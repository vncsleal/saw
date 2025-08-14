import { FeedSchema, verifyFeedSignature } from './api.js';

interface Feed { site: string; generated_at: string; items: Array<{ id: string; [k: string]: unknown }>; signature: string; }
import { createHash } from 'node:crypto';
import fs from 'node:fs';

export interface VerifyResult {
  ok: boolean;
  code: number; // 0 ok, 2 signature fail, 3 schema/network
  message: string;
}

interface LlmsMeta { feedUrl?: string; fingerprint?: string; }

export function parseLlmsTxt(txt: string): LlmsMeta {
  const meta: LlmsMeta = {};
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...rest] = trimmed.split(':');
    const key = k.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'ai-feed-url') meta.feedUrl = value;
    if (key === 'public-key' && value.startsWith('ed25519:')) meta.fingerprint = value.slice('ed25519:'.length);
  }
  return meta;
}

function fingerprintPublicKey(pubKeyB64: string): string {
  const h = createHash('sha256').update(Buffer.from(pubKeyB64, 'base64')).digest('hex');
  return h.slice(0,8);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent':'saw-cli/verify' }});
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}


export async function verifyRemote(base: string, publicKeyB64?: string): Promise<VerifyResult> {
  try {
    let siteBase = base;
    if (!/^https?:\/\//i.test(siteBase)) {
      if (siteBase.startsWith('localhost') || siteBase.includes(':')) siteBase = 'http://' + siteBase; else siteBase = 'https://' + siteBase;
    }
    const llmsUrl = siteBase.replace(/\/$/, '') + '/.well-known/llms.txt';
  const llmsTxt = await fetchText(llmsUrl);
  const hasLlms = !!llmsTxt.trim();
    const meta = parseLlmsTxt(llmsTxt);
    if (!meta.feedUrl) return { ok:false, code:3, message:'llms.txt missing AI-Feed-URL'};
  // Fetch feed directly to capture headers for auto public key discovery
  const feedRes = await fetch(meta.feedUrl, { headers:{ 'user-agent':'saw-cli/verify' } });
  if (!feedRes.ok) return { ok:false, code:3, message:'HTTP '+feedRes.status+' for feed'};
  const headerPk = feedRes.headers.get('x-saw-public-key') || feedRes.headers.get('X-SAW-Public-Key');
  if (!publicKeyB64) publicKeyB64 = headerPk || process.env.SAW_PUBLIC_KEY;
  if (!publicKeyB64) return { ok:false, code:3, message:'Public key not provided and not exposed via x-saw-public-key header'};
  let feedUnknown: unknown;
  try { feedUnknown = await feedRes.json(); } catch { return { ok:false, code:3, message:'Invalid JSON at feed URL'}; }
  let feed: Feed;
  try { feed = FeedSchema.parse(feedUnknown); } catch (e: unknown) { return { ok:false, code:3, message:'Schema invalid: '+ (e instanceof Error ? e.message : String(e)) }; }
  const subset = { site: feed.site, generated_at: feed.generated_at, items: feed.items };
  const sigOk = verifyFeedSignature(subset, feed.signature, publicKeyB64);
    if (!sigOk) return { ok:false, code:2, message:'Signature verification failed'};
    if (meta.fingerprint) {
      const fp = fingerprintPublicKey(publicKeyB64);
      if (fp !== meta.fingerprint) return { ok:false, code:2, message:`Fingerprint mismatch (expected ${meta.fingerprint} got ${fp})` };
    }
    const parts = [ 'Signature OK' ];
    if (!hasLlms) parts.push('llms.txt missing');
    if (!headerPk) parts.push('no header key');
    return { ok:true, code:0, message: parts.join(' | ') };
  } catch (e: unknown) {
    return { ok:false, code:3, message: e instanceof Error ? e.message : String(e) };
  }
}

export function verifyLocal(feedPath: string, publicKeyB64: string): VerifyResult {
  try {
    const txt = fs.readFileSync(feedPath, 'utf8');
  const feedParsedUnknown = JSON.parse(txt);
  let feed: Feed;
  try { feed = FeedSchema.parse(feedParsedUnknown); } catch (e: unknown) { return { ok:false, code:3, message:'Schema invalid: '+ (e instanceof Error ? e.message : String(e)) }; }
  const subset = { site: feed.site, generated_at: feed.generated_at, items: feed.items };
  const sigOk = verifyFeedSignature(subset, feed.signature, publicKeyB64);
    if (!sigOk) return { ok:false, code:2, message:'Signature verification failed'};
    return { ok:true, code:0, message:'Signature OK'};
  } catch (e: unknown) {
    return { ok:false, code:3, message: e instanceof Error ? e.message : String(e) };
  }
}
