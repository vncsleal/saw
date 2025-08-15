# SAW (Structured Access Web)

[![npm version (@vncsleal/saw)](https://img.shields.io/npm/v/%40vncsleal%2Fsaw)](https://www.npmjs.com/package/@vncsleal/saw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Single-package implementation for canonical JSON, signed structured feed generation, llms.txt emission, verification (local & remote with auto key discovery), basic diff & detection helpers, canary detection, and server route utilities.

## Contents
- `packages/cli` – Library + CLI distribution (published as `@vncsleal/saw`).
- `canonicalization-fixtures/`, `test-vectors/` – Determinism / hash vectors.
- `scripts/` – Basic benchmarking & smoke scripts.
- `examples/` – Integration examples.

## Installation
```bash
npm install @vncsleal/saw
# or
pnpm add @vncsleal/saw
```

Ad-hoc:
```bash
npx @vncsleal/saw keygen
```

## Quick Start

Generate keys, build feed, verify:
```bash
# Generate Ed25519 keypair
npx @vncsleal/saw keygen > keys.txt
export SAW_PUBLIC_KEY=$(grep PUBLIC_KEY keys.txt | cut -d= -f2)
export SAW_SECRET_KEY=$(grep SECRET_KEY keys.txt | cut -d= -f2)

# Build feed (creates feed.json and optionally llms.txt if SAW_PUBLIC_KEY set)
npx @vncsleal/saw feed

# Verify locally
npx @vncsleal/saw verify feed.json $SAW_PUBLIC_KEY

# Verify remote (auto key discovery via x-saw-public-key if exposed)
npx @vncsleal/saw verify example.com
```

All-in-one project bootstrap:
```bash
npx @vncsleal/saw init
```

## Security & Key Handling
Feed & diff signatures use Ed25519 (tweetnacl). Treat secret keys and canary secrets as production credentials.

Guidelines:
- Never commit secrets: keep `SAW_SECRET_KEY`, `SAW_CANARY_SECRET`, API key secrets, and HMAC salts out of VCS. Use `.env` (git‑ignored) or secret managers (1Password, Vault, AWS/GCP secret stores).
- Ed25519 secret key length: 64 raw bytes (base64 length 88). Public key: 32 raw bytes (base64 length 44). Validation: the library enforces 64‑byte secret input when signing.
- Generation: use `saw keygen` for random keys. Deterministic seeded key generation has been removed to simplify the API.
- Rotation: issue a new keypair, publish updated `Public-Key-Base64` in `.well-known/llms.txt`, include both old & new for a grace period, then remove the old after clients update.
- Environment variables: prefix secrets with `SAW_` for clarity; do not echo them in CI logs. In containers, mount via secrets, not baked into images.
- Least privilege: if serving multiple sites, isolate per site keypairs so compromise scope is bounded.
- Canary secret (`SAW_CANARY_SECRET`): rotate independently of signing keys; a leak only reveals canary determinism, not signing ability.
- Per‑key canaries: derive a salt server‑side (e.g., first 8 hex chars of SHA‑256 of API key secret) and never send the salt itself to clients.
- API keys & HMAC: the API key secret must be long (>=32 random bytes). Return it only once on creation; store only a hashed form (e.g., SHA‑256) plus truncated salt/metadata.
- Memory hygiene: avoid long‑lived plaintext secrets in logs. Zero buffers after use in higher‑sensitivity environments (not implemented here; future hardening).
- Diff verification: always verify `signature` for diff subsets before trusting `changed` / `removed` arrays. Reject unsigned or malformed responses.
- Time skew: when adding timestamped request signing, enforce small clock drift (e.g., ±120s) to reduce replay window.
- Production monitoring: alert on repeated signature verification failures or sudden spike in canary detections (possible scraping).

Threat considerations:
- Secret key exposure lets attackers forge feeds/diffs: rotate immediately and broadcast compromise.
- Canary secret exposure enables prediction of static canaries: rotate; per‑key salted canaries mitigate blast radius.
- API key database leak (hashed secrets) still permits offline brute force if weak secrets allowed—enforce length & randomness.

Planned hardening (future): optional key vault interface, in‑memory secret zeroization, multi‑signature rotation window, structured security advisories.

## CLI Commands (concise)
```bash
keygen                 # Generate Ed25519 keypair
feed                   # Build & sign feed (feed.json) + optional llms.txt
llms                   # Generate llms.txt only (auto infer site/url)
verify <file|site>     # Verify local file or remote site feed
antiscrape <text|file> # Detect canary tokens (local or --remote base)
init                   # One-shot: keys + sample block + feed + llms.txt

# Extended groups:
key gen|gen-api|list-api
feed build|verify
llms init
diff verify --since <ISO>
detect <text|file> [--remote]
```

Examples:
```bash
npx @vncsleal/saw key gen --dotenv           # Write keys into .env
npx @vncsleal/saw feed build --site example.com --out feed.json
npx @vncsleal/saw llms init --url https://example.com/api/saw/feed --public-key $SAW_PUBLIC_KEY
npx @vncsleal/saw verify feed.json $SAW_PUBLIC_KEY --json
npx @vncsleal/saw verify example.com         # Remote (auto key header)
npx @vncsleal/saw antiscrape 'text with ABC-123456 token'
```

Environment variables:
```
SAW_PUBLIC_KEY  (base64)
SAW_SECRET_KEY  (base64, required to build feed)
SAW_SITE        (default host when inferring feed URL)
SAW_FEED_URL    (override llms feed URL)
SAW_CANARY_SECRET (optional static canaries)
```

Verification auto-discovers the public key via `x-saw-public-key` header if not provided.

## Determinism & Vectors
`npm run determinism` executes multi-run canonicalization stability check; golden signature vector locks signing behavior.

Expected output: all vectors pass.

## Adding New Test Vectors
1. Append a new object to `vectors` with `name`, `input`, and placeholder `sha256`.
2. Run `node` REPL or adapt the hash helper:
   ```bash
   node -e "import('./scripts/canonicalize.js').then(m=>{const {hashCanonical}=m;const obj={example:1};const r=m.hashCanonical(obj);console.log(r);});"
   ```
3. Replace placeholder hash & (if needed) canonical string.
4. Re-run tests and confirm PASS.

## Server Helpers
Import lightweight route creators for Node or edge runtimes:
```ts
import { createFeedHandler, createDetectHandler } from '@vncsleal/saw';
import http from 'node:http';

const handler = createFeedHandler({
   site: 'example.com',
   secretKeyBase64: process.env.SAW_SECRET_KEY!,
   publicKeyBase64: process.env.SAW_PUBLIC_KEY,
   exposePublicKeyHeader: true,
   getBlocks: async () => [ { id:'block:home', title:'Home', content:'Hello', version:'v1' } ]
});

http.createServer((req,res)=>{
   if (req.url === '/api/saw/feed') return handler(req,res);
   if (req.url === '/api/saw/detect') return createDetectHandler()(req,res);
   res.statusCode = 404; res.end('not found');
}).listen(3000);
```

Edge / Fetch style:
```ts
import { createFeedFetchHandler, createDetectFetchHandler } from '@vncsleal/saw';
export const GET = createFeedFetchHandler({ site:'example.com', secretKeyBase64: process.env.SAW_SECRET_KEY!, getBlocks: ()=>[{id:'b1'}] });
export const POST = createDetectFetchHandler();
```

Expose `/.well-known/llms.txt` (example build):
```bash
npx @vncsleal/saw llms > public/.well-known/llms.txt
```

Event schema (fields may expand):
- feed.request: { ts, event, site, block_count }
- canary.issued: { ts, event, id, version, canary }
- feed.response: { ts, event, site, items, signature_present }

## Canary Fields
If `SAW_CANARY_SECRET` is set, each feed item may include derived canary data (future expansion). Keep the secret private.

## Attribution & HMAC Request Signing (Phase 3)
The example server issues API keys with:
```
id: key_<hex>
secret: <base64url 32 bytes> (only shown once)
salt: first 8 hex of sha256(secret) (used for per-key canaries)
```
Client request signing (pseudo):
```
timestamp = new Date().toISOString()
body = JSON.stringify(payload)
sig = HMAC_SHA256(secret, [method.toUpperCase(), path, timestamp, body].join('\n')) (hex)
Headers:
   X-API-KEY: <id>
   X-TIMESTAMP: <timestamp>
   X-SIG: <sig>
```
Server verifies allowable clock skew (default 120s) and HMAC equality.

## Signed Diff Subsets
The server exposes `/api/saw/diff?since=<ISO>` returning a subset:
```
{ site, since, changed:[{id,version,updated_at}], removed:[id...], signature }
```
Signature is Ed25519 over the canonicalized subset (no `signature` field). CLI `diff` command fetches, verifies, and reports counts.

## Logging Endpoint
Example server exposes `/api/saw/logs` (demo only) showing recent structured events: feed responses, diffs, ingests.

## Ephemeral Canaries & Detection (Phase 4)
Experimental: server issues short-lived (TTL) tokens (`c-XXXXXXXXXX`) in:
- `X-SAW-EPHEMERAL` header on `/api/saw/feed`
- Hidden HTML node & comment on `/` page

Use `saw detect <text|file>` to extract tokens or `saw detect <text|file> --remote example.com` to map them via remote `/api/saw/detect`.

Example detection payload POST:
`POST /api/saw/detect { "text": "Scraped text containing c-ABCDEFGH12" }` returns mapping of recognized tokens to request IDs while within TTL.

Config environment vars:
`SAW_EPHEMERAL_TTL_MS` (default 300000) – token lifetime.
`SAW_DETECT_WEBHOOK` – if set, server POSTs JSON events for feed.response, page.response, detect.request.

Tokens expire (default 5–10 min) and are not retained long-term. Classification values: none | single | multiple.

## Anti-Scrape Utilities
Runtime helpers to embed canary tokens in HTML to catch naive scrapers:
```ts
import { buildAntiScrapeHTML } from '@vncsleal/saw';
const { html, token } = buildAntiScrapeHTML('<html><body><h1>Hello</h1></body></html>', { honeyLink:true, randomZeroWidth:true });
console.log(token, html.length);
```

Node handler:
```ts
import { createAntiScrapePageHandler } from '@vncsleal/saw';
import http from 'node:http';
const page = createAntiScrapePageHandler(()=>'<html><body>Welcome</body></html>', { honeyLink:true });
http.createServer((req,res)=>{
   if (req.url === '/') return page(req,res);
   res.statusCode = 404; res.end('not found');
}).listen(3000);
```

Detection: the existing `antiscrape` / `detect` command or `extractCanariesFromHtml` function can be used on scraped text to surface leaks.
## (Removed) Verification Harness
The previous multi-phase verification harness (canonicalization corpus, diff/detect, webhook validation) was removed to streamline the project. Remaining validation lives in unit tests and the simple smoke/benchmark scripts. Historical docs retained in git history if reference needed.

## Future Enhancements
- Rich diff endpoint helpers
- Optional HMAC request signing helper
- Multi-sig / key rotation windows
- Extended detector heuristics

## Benchmarks
## Coverage Enforcement
```bash
npm run coverage:enforce
```

## Webhook Receiver (Demo)
Start a local receiver to observe detection/feed events:
```bash
node scripts/webhook-receiver.mjs &
SAW_DETECT_WEBHOOK=http://localhost:4001 node your-server.js
```
Then issue feed or detect calls; events print with `# webhook event` prefix.
Run feed build micro-benchmark (rough, local):
```bash
npm run build --silent
node scripts/benchmark-feed.mjs
```
Outputs rows of `block_count\tms`. Target p95 for 100 blocks < 250ms (Phase KPI). Use multiple runs & average for stability.

## License
MIT
