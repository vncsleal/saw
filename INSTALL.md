# Installation & Next.js Integration Guide

This guide shows how to consume `@saw/core` (and optionally the `@saw/cli`) inside a Next.js project (App Router or Pages). It assumes the packages are published; while they remain private you can `npm link` or use a relative workspace reference.

## 1. Install Dependencies

```bash
# Once published
npm install @saw/core
# (Optional) CLI for local feed/diff ops & key generation
npm install --save-dev @saw/cli
```

While private (in this monorepo):
```bash
# From the saw repo root (this repo)
npm run build
npm pack packages/core  # produces saw-core-x.y.z.tgz
# In your Next.js project
npm install ../path/to/saw-core-x.y.z.tgz
```

## 2. Generate Keys
Use the CLI (recommended) or programmatic API.
```bash
# In the saw repo (or after installing @saw/cli)
npx saw keygen
# Outputs base64 PUBLIC_KEY and SECRET_KEY
```
Store them as Next.js env vars (never commit the secret):
```
# .env.local
SAW_PUBLIC_KEY=...
SAW_SECRET_KEY=...
SAW_CANARY_SECRET=optional-static-canary-secret
SAW_EPHEMERAL_TTL_MS=300000
```

## 3. Directory Layout for Content
Example project structure:
```
content/blocks/
  doc-intro.json
  faq.json
```
Each block object minimal fields:
```json
{
  "id": "block:faq",
  "type": "doc",
  "title": "FAQ",
  "content": "...markdown or text...",
  "version": "v3",
  "updated_at": "2025-08-14T12:00:00.000Z"
}
```

## 4. Feed Endpoint (Next.js App Router)
Create `app/api/saw/feed/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { buildFeed } from '@saw/core';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs'; // needs node crypto

function loadBlocks() {
  const dir = path.join(process.cwd(), 'content/blocks');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

export async function GET(req: NextRequest) {
  const secretKeyBase64 = process.env.SAW_SECRET_KEY!; // ensure set
  const canarySecret = process.env.SAW_CANARY_SECRET; // optional
  const site = process.env.SAW_SITE || req.nextUrl.host || 'example.com';
  const blocks = loadBlocks();
  const feed = buildFeed({ site, blocks, secretKeyBase64, canarySecret });
  return NextResponse.json(feed, { headers: { 'cache-control': 'no-store' } });
}
```
(Pages Router `pages/api/saw/feed.ts` uses default export handler signature.)

## 5. Diff Endpoint
Maintain a lightweight in-memory (or DB-backed) index of block metadata. Simple approach: regenerate and compute diff server-side filtered by a `since` timestamp.
`app/api/saw/diff/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { buildFeed, signDiffSubset } from '@saw/core'; // if signDiffSubset exported; else manually rebuild & filter then sign
import fs from 'node:fs';
import path from 'node:path';
import { canonicalize, hashCanonical, signCanonical } from '@saw/core';

export const runtime = 'nodejs';

function loadBlocks() { /* same as feed */ }

export async function GET(req: NextRequest) {
  const sinceIso = req.nextUrl.searchParams.get('since');
  if (!sinceIso) return new NextResponse('missing since', { status: 400 });
  const since = new Date(sinceIso);
  if (isNaN(+since)) return new NextResponse('invalid since', { status: 400 });
  const secretKeyBase64 = process.env.SAW_SECRET_KEY!;
  const site = process.env.SAW_SITE || req.nextUrl.host || 'example.com';
  const blocks = loadBlocks();
  const changed = blocks
    .filter(b => new Date(b.updated_at) > since)
    .map(b => ({ id: b.id, version: b.version, updated_at: b.updated_at }));
  // For demo we do not track deletions
  const subset = { site, since: since.toISOString(), changed, removed: [] as string[] };
  // Sign canonicalized subset (excluding signature field)
  const { canonical } = hashCanonical(subset);
  const signature = signCanonical(canonical, secretKeyBase64);
  return NextResponse.json({ ...subset, signature });
}
```
Adjust if the core package exposes a higher-level helper for diffs.

## 6. Detection Endpoint (Ephemeral Canaries)
Expose POST /api/saw/detect that maps detected tokens back to issuance events (here a simple in-memory map; production should use a short TTL store like Redis):
`app/api/saw/detect/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { detectCanaries } from '@saw/core';

const issued = new Map<string, { ts: number; requestId: string }>();

// Example hook to register canaries when feed/page rendered
export function registerCanary(token: string) {
  issued.set(token, { ts: Date.now(), requestId: crypto.randomUUID() });
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  const local = detectCanaries(text || '');
  const ttl = Number(process.env.SAW_EPHEMERAL_TTL_MS) || 300_000;
  const now = Date.now();
  const mapping: Record<string, string> = {};
  for (const t of local.uniqueTokens) {
    const meta = issued.get(t);
    if (meta && now - meta.ts <= ttl) mapping[t] = meta.requestId;
  }
  return NextResponse.json({ ...local, mapping });
}
```
Integrate `registerCanary` where you embed tokens (e.g., server-rendered page route).

## 7. Embedding Ephemeral Tokens in a Page
Add to `app/page.tsx` (or a layout) server component:
```tsx
import { randomEphemeralCanary } from '@saw/core';
import { registerCanary } from './api/saw/detect/route';

export default function Home() {
  const token = randomEphemeralCanary();
  registerCanary(token);
  return (
    <main>
      <h1>Docs</h1>
      <span style={{display:'none'}} data-saw-ephemeral={token}>{token}</span>
      {/* Optionally also inside an HTML comment for redundancy */}
      {/* {`<!-- ${token} -->`} */}
      <p>Welcome.</p>
    </main>
  );
}
```

## 8. Generating llms.txt
You can pre-generate `.well-known/llms.txt` using the CLI during build or a script:
```bash
PUBLIC_KEY_FINGERPRINT=$(echo -n $SAW_PUBLIC_KEY | base64 --decode | openssl sha256 -binary | xxd -p -c 256 | cut -c1-8)
node -e "import('@saw/core').then(m=>{const txt=m.generateLlmsTxt({site:process.env.SAW_SITE||'example.com',feedUrl:`https://${process.env.SAW_SITE}/api/saw/feed`,publicKeyFingerprint:`ed25519:${process.env.SAW_SITE?'' : ''}${'ed25519:'}${'${PUBLIC_KEY_FINGERPRINT}'}`,publicKey:process.env.SAW_PUBLIC_KEY});require('fs').mkdirSync('.well-known',{recursive:true});require('fs').writeFileSync('.well-known/llms.txt',txt);})"
```
(Or create on demand in a route.)

Simpler programmatic Next.js route `app/.well-known/llms.txt/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { generateLlmsTxt } from '@saw/core';

export async function GET(req: NextRequest) {
  const site = process.env.SAW_SITE || req.nextUrl.host || 'example.com';
  const publicKey = process.env.SAW_PUBLIC_KEY!;
  // Derive fingerprint (first 8 hex bytes of sha256(pubkey bytes))
  const hash = await crypto.subtle.digest('SHA-256', Buffer.from(publicKey, 'base64'));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const fp = 'ed25519:' + hex.slice(0,8);
  const body = generateLlmsTxt({ site, feedUrl:`https://${site}/api/saw/feed`, publicKeyFingerprint: fp, publicKey });
  return new NextResponse(body, { headers: { 'content-type':'text/plain; charset=utf-8' } });
}
```

## 9. Verification (Consumer Side)
Consumers fetch the feed, canonicalize & verify using @saw/core or the CLI:
```bash
npx saw verify example.com $SAW_PUBLIC_KEY
```

Programmatic:
```ts
import { verifyFeed } from '@saw/core'; // if exported; else manual canonicalize & signature check
```

## 10. Webhooks (Optional)
If implementing webhooks, emit events (`feed.response`, `diff.response`, `detect.request`, `canary.detected`, `ingest.upsert`) to a configured URL with a short retry policy. Skeleton emitter pattern:
```ts
async function postWebhook(evt: any) {
  const url = process.env.SAW_DETECT_WEBHOOK;
  if (!url) return;
  try { await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(evt) }); } catch {}
}
```
Call within feed/diff/detect handlers.

## 11. Security & Operational Notes
- Keep `SAW_SECRET_KEY` server-only (never expose to client bundle).
- Regenerate static canary secret if compromised; rotate keys by publishing overlapping windows (old + new) until clients update.
- Use persistent storage for diffs if clients rely on incremental syncing; otherwise they may fall back to full feed.
- Ephemeral token store should be memory + TTL (Redis / in-memory LRU). Avoid unbounded growth.

## 12. Minimal Client Detector Usage
```ts
import { detectCanaries } from '@saw/core';
const result = detectCanaries(scrapedText);
console.log(result.uniqueTokens, result.classification, result.confidence_band);
```

## 13. Environment Variable Summary
| Variable | Purpose |
|----------|---------|
| SAW_PUBLIC_KEY | Base64 Ed25519 public key (publishable) |
| SAW_SECRET_KEY | Base64 Ed25519 secret (server only) |
| SAW_CANARY_SECRET | Static canary generation secret (optional) |
| SAW_EPHEMERAL_TTL_MS | Ephemeral detection token lifetime (default 300000) |
| SAW_SITE | Canonical site host override |
| SAW_DETECT_WEBHOOK | Webhook endpoint URL (optional) |

## 14. Deployment Checklist
- [ ] Env vars set in hosting platform (secret values) 
- [ ] Content blocks present / build pipeline populates them
- [ ] Feed, diff, detect routes respond 200 locally
- [ ] `.well-known/llms.txt` reachable
- [ ] Public key published (docs / dev portal)
- [ ] Basic integration test: fetch feed -> verify signature -> detect ephemeral token

## 15. Future Hardening Ideas
- Add ETag/version headers to feed & diff responses
- Signed pagination for very large feeds
- Rate limiting on detect endpoint
- Structured JSON schema validation on inbound webhooks

---
Questions or improvements? Open an issue in the repo.
