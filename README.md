# SAW Tooling Monorepo

Reference implementation (early draft) for SAW (Structured Access Web): canonicalization, signed feed generation, static canaries, verification CLI, and examples.

## Contents
- `packages/core` – Core library (canonicalize, sign/verify, feed builder, canary generator, agent descriptor, event emitter).
- `packages/cli` – CLI (`canon`, `hash`, `keygen`, `init`, `generate`, `verify`).
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
If SAW_CANARY_SECRET is set, each feed item gains `canary` and `structured.meta.canary` fields. Omit the secret to exclude them (useful for diffing behavior or public vs private feeds).

## Future Enhancements
- Per-key salted canaries (Phase 3)
- HMAC request auth & diff implementation (Phase 3)
- Ephemeral session canaries + detector (Phase 4)
- Extension registry & search stub (Phase 5)
- Additional language SDKs

## License
MIT
