# saw

Unified library + CLI for SAW (Structured Access Web): build & sign feeds, verify feeds & diffs, canonicalize JSON, manage keys, detect canaries, and provide anti‑scrape helpers.

> Early draft reference implementation. Interfaces may change pre-1.0.

## Install

Project dependency (includes programmatic APIs + CLI):
```bash
npm install saw
```
Ad hoc usage (no install):
```bash
npx saw key gen --env
```

Requires Node >=18.

## Commands (summary)
New hierarchical style (preferred):
```
saw feed build [--site <site>] [--out feed.json] [--events]
saw feed verify <feed.json|site> [publicKeyBase64] [--json]
saw llms init --url <feedUrl> --public-key <base64> [--fingerprint-len N] [--out public/.well-known/llms.txt]
saw key gen [--env] [--json] [--dotenv] [--env-file <path>] [--force]
saw key gen-api
saw key list-api
saw diff verify <site> <publicKeyBase64> --since <ISO> [--json]
saw detect <text|file> [--remote <base>]
```

Legacy aliases (still work): `generate`, `verify`, `diff`, `keygen`, `keygen-api`, `list-api`.

## Examples
Generate & verify a feed locally:
```bash
# 1. Keypair (choose one)
# a) Shell exports
eval "$(npx saw key gen --env)"
# b) Write to .env (will not overwrite existing keys unless --force)
npx saw key gen --dotenv
# c) JSON (for scripting)
npx saw key gen --json > keypair.json

# 2. Generate feed (new style)
SAW_SITE=example.com npx saw feed build --out feed.json

# 3. Verify feed (local file requires key arg or SAW_PUBLIC_KEY env)
npx saw verify feed.json $SAW_PUBLIC_KEY --json

# Remote site (public key auto-discovered via header or llms.txt fingerprint)
npx saw verify example.com
```

Diff subset verification:
```bash
npx saw diff verify example.com $SAW_PUBLIC_KEY --since 2025-01-01T00:00:00.000Z
```

Per-key salted canaries (server-driven) + static canaries:
```bash
SAW_PUBLIC_KEY=... SAW_SECRET_KEY=... SAW_CANARY_SECRET=static npx saw generate example.com --events
```

Ephemeral detection (Phase 4 experimental):
```bash
npx saw detect page.html
npx saw detect page.html --remote example.com
```

## Environment Variables
Required for feed build:
- `SAW_PUBLIC_KEY` base64 public key (32 raw bytes -> 44 b64 chars)
- `SAW_SECRET_KEY` base64 secret key (64 raw bytes -> 88 b64 chars)

Optional:
- `SAW_SITE` default site/domain (used when not passing --site)
- `SAW_FEED_URL` override feed URL when auto-writing llms.txt
- `SAW_CANARY_SECRET` static canary derivation secret
- `SAW_EPHEMERAL_TTL_MS` override ephemeral token TTL (server side)
- `SAW_DETECT_WEBHOOK` webhook URL for detection & feed events (server side)

## Security Notes
Treat `SAW_SECRET_KEY` and canary secrets as production credentials. Rotate by publishing the new `Public-Key-Base64` while still accepting the old key for a grace window, then retire it. Never commit secrets or use seeded key generation (`generateKeyPairFromSeed`) outside tests.

## Exit Codes
- 0 success / verified
- 1 generic failure (invalid signature, malformed input)
- >1 reserved for future granular codes (e.g., network, schema mismatch)

## Development
From repo root:
```bash
npm run build && node packages/cli/dist/index.js --help
```

## License
MIT

---
Consolidation notice: former separate core & CLI packages are now unified; import all APIs from `saw`.
