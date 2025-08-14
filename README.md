# SAW Tooling Monorepo

[![npm version (saw-core)](https://img.shields.io/npm/v/saw-core)](https://www.npmjs.com/package/saw-core)
[![npm version (saw-cli)](https://img.shields.io/npm/v/saw-cli)](https://www.npmjs.com/package/saw-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Reference implementation (early draft) for SAW (Structured Access Web): canonicalization, signed feed generation, static + per-key salted canaries, attribution (API keys + HMAC), signed diff subsets, verification CLI, and examples.

## Contents
- `packages/core` – Core library (canonicalize, sign/verify, feed builder, canary generator, agent descriptor, event emitter).
- `packages/cli` – CLI (`canon`, `hash`, `keygen`, `keygen-api`, `list-api`, `init`, `generate`, `verify`, `diff`).
- `test-vectors/` – Canonicalization & signature vectors.
- `examples/node` – Feed & diff scaffold + anti-scrape snippets.
- `schemas/` – JSON Schemas (block, feed, llms.txt normalized).
- `scripts/` – Determinism & legacy canonicalization script.

## Installation

Core library (runtime dependency):
```bash
npm install saw-core
```

CLI (dev / tooling dependency):
```bash
npm install --save-dev saw-cli
```

Or run on demand with npx (no install):
```bash
npx saw keygen
```

## Quick Start

Generate a keypair and build a minimal feed:
```bash
node -e "import('saw-core').then(m=>{const kp=m.generateKeyPair();console.log('PUBLIC',Buffer.from(kp.publicKey).toString('base64'));console.log('SECRET',Buffer.from(kp.secretKey).toString('base64'));})"

# Suppose you saved PUBLIC & SECRET to env vars
SAW_PUBLIC_KEY=... SAW_SECRET_KEY=... node packages/cli/dist/index.js generate example.com > feed.json

# Verify the feed
node packages/cli/dist/index.js verify feed.json $SAW_PUBLIC_KEY --json
```

## Security & Key Handling
Feed & diff signatures use Ed25519 (tweetnacl). Treat secret keys and canary secrets as production credentials.

Guidelines:
- Never commit secrets: keep `SAW_SECRET_KEY`, `SAW_CANARY_SECRET`, API key secrets, and HMAC salts out of VCS. Use `.env` (git‑ignored) or secret managers (1Password, Vault, AWS/GCP secret stores).
- Ed25519 secret key length: 64 raw bytes (base64 length 88). Public key: 32 raw bytes (base64 length 44). Validation: the library enforces 64‑byte secret input when signing.
- Generation: use `saw keygen` for random keys. Only use `generateKeyPairFromSeed` for deterministic test fixtures; never for production (seed predictability compromises signatures).
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

## Usage (CLI Commands)

Run unit tests:
```bash
npm test

## Core Commands
### Core Commands
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

Expected output: all vectors pass.

## Adding New Test Vectors
1. Append a new object to `vectors` with `name`, `input`, and placeholder `sha256`.
2. Run `node` REPL or adapt the hash helper:
   ```bash
   node -e "import('./scripts/canonicalize.js').then(m=>{const {hashCanonical}=m;const obj={example:1};const r=m.hashCanonical(obj);console.log(r);});"
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

## Verification Ops Harness
The repository includes an internal verification harness script (`scripts/run-verification-harness.mjs`) that consolidates key Phase 4 readiness checks.

Current sections:
1. Canonicalization determinism across the fixture corpus (verifies stored `canonical` + `sha256`).
2. Feed signing & signature verification (fresh keypair each run).
3. Agent descriptor fingerprint generation.
4. Detector sample (issues ephemeral canary, validates detection, confidence & band).
5. Detector corpus accuracy (`detector-samples/ground-truth.json`).
6. Diff subset verification (remote if server auto-started, else simulated). Verifies signature when harness started server with generated key.
7. Webhook payload schema validation (parses recent `/api/saw/logs` entries with Zod schemas for feed.response, page.response, detect.request, canary.detected).
8. Machine-readable JSON summary (`harness-results.json`).

Run locally:
```bash
npm run harness
```
Exit code is non‑zero if any section fails or fixture count < target (default 200).

Environment vars:
```
FIXTURE_TARGET=250        # require larger canonicalization corpus size
HARNESS_START_SERVER=1    # auto-start example server (enables real diff + webhook validation)
HARNESS_DIFF_BASE=...     # override base URL for diff endpoint
HARNESS_LOG_BASE=...      # override logs endpoint (default http://localhost:3000/api/saw/logs)
HARNESS_OUTPUT=results.json  # change JSON summary filename
HARNESS_REQUIRE_WEBHOOKS=1   # (future) fail run if webhook validation skipped
HARNESS_PUBLIC_KEY_B64=...   # external diff: supply remote public key if llms.txt lacks Public-Key-Base64
```

Summary file shape (example excerpt):
```
{
   "fixtureCount": 200,
   "canonicalMismatches": 0,
   "detector": { "classification":"single","confidence":0.7,"confidence_band":"medium","tokens":1,"occurrences":2 },
   "diff": { "mode":"remote","verified": true },
   "failures": []
}
```

### Extending the Harness
Add new sections inside the script and append failure labels to the `failures` array before summary write. Keep each section idempotent & side‑effect free where possible.

### Detector Corpus Workflow
The `detector-samples/` directory contains sample `.txt` files plus `ground-truth.json` defining expected `unique` count and `classification` for each sample. To add new samples:
1. Create `sample-<n>-<label>.txt` with representative content.
2. Append an entry to `ground-truth.json` with `{ "file": "sample-<n>-<label>.txt", "unique": <int>, "classification": "none|single|multiple" }`.
3. Run the harness; ensure `Detector failures=0`.
4. Include near‑miss tokens (e.g., `c-abc123` too short) in future with a separate label—these should not increment the `unique` count.

### Confidence & Rationale
Detector result fields:
- `confidence` (0–1 numeric)
- `confidence_band` (none|low|medium|high) thresholds: >=0.85 high, >=0.6 medium, >0 low
- `rationale` (human readable summary)
Prefer `confidence_band` for coarse alerting; use raw `confidence` for tuning and future scoring models.

### Machine-Readable Output (Future)
Planned: emit a JSON summary file (e.g., `harness-results.json`) for CI ingestion.

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
