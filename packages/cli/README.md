# saw-cli

Command-line interface for SAW (Structured Access Web): build & sign feeds, verify feeds & diffs, canonicalize JSON, manage keys, and detect canaries.

> Early draft reference implementation. Interfaces may change pre-1.0.

## Install

Dev / tooling dependency:
```bash
npm install --save-dev saw-cli
```
Or run ad hoc:
```bash
npx saw keygen
```

Requires Node >=18.

## Commands (summary)
```
saw canon <json>                   # Canonicalize inline JSON
saw hash <json>                    # Hash (sha256) of canonical form
saw keygen                         # Generate Ed25519 keypair (base64)
saw keygen-api                     # Generate HMAC API key (id + secret)
saw list-api                       # List stored API key IDs (local dev)
saw init <site>                    # Scaffold example server / feed
saw generate <site> [--events]     # Build & sign feed (needs SAW_PUBLIC_KEY/SAW_SECRET_KEY)
saw verify <feed|site> <pubKeyB64> [--json]  # Verify local file or remote site feed
saw diff <site> <pubKeyB64> --since <ISO>    # Fetch & verify signed diff subset
saw detect <text|file> [--remote site]       # Extract or map ephemeral canaries
```

## Examples
Generate & verify a feed locally:
```bash
# 1. Keypair
eval $(npx saw keygen | awk '{print "export "$1"="$2}' )   # exports SAW_PUBLIC_KEY / SAW_SECRET_KEY

# 2. Generate feed
npx saw generate example.com > feed.json

# 3. Verify feed
npx saw verify feed.json $SAW_PUBLIC_KEY --json
```

Diff subset verification:
```bash
npx saw diff example.com $SAW_PUBLIC_KEY --since 2025-01-01T00:00:00.000Z
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
- `SAW_PUBLIC_KEY` base64 public key (32 raw bytes -> 44 b64 chars)
- `SAW_SECRET_KEY` base64 secret key (64 raw bytes -> 88 b64 chars)
- `SAW_CANARY_SECRET` static canary derivation secret (optional)
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
Library APIs are exposed via `saw-core`; see that package README or the monorepo root README for in-depth details.
