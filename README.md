# SAW Tooling Monorepo

Reference implementation (early draft) for SAW (Structured Access Web): canonicalization, signed feed generation, static + per-key salted canaries, attribution (API keys + HMAC), signed diff subsets, verification CLI, and examples.

## Contents
- `packages/core` – Core library (canonicalize, sign/verify, feed builder, canary generator, agent descriptor, event emitter).
- `packages/cli` – CLI (`canon`, `hash`, `keygen`, `keygen-api`, `list-api`, `init`, `generate`, `verify`, `diff`).
- `test-vectors/` – Canonicalization & signature vectors.
- `examples/node` – Feed & diff scaffold + anti-scrape snippets.
- `schemas/` – JSON Schemas (block, feed, llms.txt normalized).
- `scripts/` – Determinism & legacy canonicalization script.

## Usage

Install and run tests:

```bash
# run unit tests
npm test

## Core Commands

```bash
# Canonicalize inline JSON
node packages/cli/dist/index.js canon '{"b":2,"a":1}'

# Generate feed (requires keys; add SAW_CANARY_SECRET to embed static canaries & emit canary events)
SAW_PUBLIC_KEY=... SAW_SECRET_KEY=... SAW_CANARY_SECRET=secret \
   node packages/cli/dist/index.js generate example.com --events

# Verify local feed (prints structured events with --json)
node packages/cli/dist/index.js verify feed.json $SAW_PUBLIC_KEY --json

# Verify remote site (expects .well-known/llms.txt)
node packages/cli/dist/index.js verify example.com $SAW_PUBLIC_KEY

# Generate HMAC API key (Phase 3 attribution)
node packages/cli/dist/index.js keygen-api

# List locally stored API key IDs
node packages/cli/dist/index.js list-api

# Fetch & verify a signed diff subset (requires since timestamp)
node packages/cli/dist/index.js diff example.com $SAW_PUBLIC_KEY --since 2025-01-01T00:00:00.000Z
```

## Determinism & Vectors
`npm run determinism` executes multi-run canonicalization stability check; golden signature vector locks signing behavior.
```

Expected output: all vectors pass.

## Adding New Test Vectors
1. Append a new object to `vectors` with `name`, `input`, and placeholder `sha256`.
2. Run `node` REPL or adapt the hash helper:
   ```bash
   node -e "import('./scripts/canonicalize.js').then(m=>{const {hashCanonical}=m;const obj={example:1};const r=hashCanonical(obj);console.log(r);});"
   ```
3. Replace placeholder hash & (if needed) canonical string.
4. Re-run tests and confirm PASS.

## Events
When you add --events to generate, the CLI streams JSON lines such as:
{"event":"feed.request","site":"example.com","block_count":1}
{"event":"feed.response","site":"example.com","items":1,"signature_present":true}

Event schema (fields may expand):
- feed.request: { ts, event, site, block_count }
- canary.issued: { ts, event, id, version, canary }
- feed.response: { ts, event, site, items, signature_present }

## Canary Fields
If `SAW_CANARY_SECRET` is set, each feed item gains `canary` and `structured.meta.canary` fields. Omit the secret to exclude them (useful for diffing behavior or public vs private feeds). When per-key salted canaries are desired (attribution), supply `perKeySalt` when calling `buildFeed` (the example server derives this from the API key record salt) so each consumer sees a distinct deterministic value.

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

## Future Enhancements
- Ephemeral session canaries + detector (Phase 4)
- Extension registry & search stub (Phase 5)
- Additional language SDKs
- Performance benchmarks & 200+ canonicalization fixture corpus

## Benchmarks
## Coverage Enforcement
Run with threshold (initial 70%):
```bash
npm run coverage:enforce
```
Increase threshold to 90% after expanding fixtures (edit `scripts/enforce-coverage.mjs`).

## Webhook Receiver (Demo)
Start a local receiver to observe detection/feed events:
```bash
node scripts/webhook-receiver.mjs &
SAW_DETECT_WEBHOOK=http://localhost:4001 node examples/node/server.js
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
