# saw

Minimal library + CLI for SAW (Structured Access Web).

Features:
* Generate Ed25519 keypairs
* Build & sign structured content feeds (canonical JSON)
* Verify feed signatures (file or object)
* Emit `llms.txt` with `Public-Key-Base64` & feed reference
* Inject lightweight anti‑scrape canary token into HTML
* Create a tiny feed route handler (Node / Fetch)

Intentionally removed for simplicity: diff APIs, detection server, seeded keygen, large harness scripts.

> Pre‑1.0: small surface by design; minor changes may occur.

## Install
```bash
npm install saw
# or ad‑hoc
npx saw key gen --env
```
Requires Node >=18.

## CLI Commands
```
saw key gen              # Generate Ed25519 keypair
saw feed build           # Build & sign feed (feed.json)
saw verify <feed.json> [publicKeyBase64]
saw llms init --url <feedUrl> --public-key <base64> [--out <path>] [--fingerprint-len N]
saw antiscrape <file|->  # Wrap HTML with token + honeypot (stdout)
saw init                 # Scaffold keys + sample feed + llms.txt
```
Aliases (`keygen`, `feed`, `generate`, `llms`, `verify`) remain.

## Quick Start
```bash
# 1. Keys
eval "$(npx saw key gen --env)"   # exports SAW_PUBLIC_KEY / SAW_SECRET_KEY

# 2. Build feed
SAW_SITE=example.com npx saw feed build --out feed.json

# 3. Verify
npx saw verify feed.json $SAW_PUBLIC_KEY --json

# 4. llms.txt
npx saw llms init --url https://example.com/api/saw/feed --public-key $SAW_PUBLIC_KEY --out public/.well-known/llms.txt

# 5. Anti‑scrape HTML
npx saw antiscrape index.html > index.instrumented.html
```

## Environment Variables
Required to build a feed:
* `SAW_PUBLIC_KEY` (base64, 32 raw bytes -> 44 chars)
* `SAW_SECRET_KEY` (base64, 64 raw bytes -> 88 chars)

Optional:
* `SAW_SITE` default site/domain
* `SAW_FEED_URL` override feed URL in llms.txt
* `SAW_CANARY_SECRET` static canary derivation secret

## Exit Codes
* 0 success / verified
* 1 failure (invalid input, signature, or IO)

## Programmatic API
```ts
import {
	generateKeyPair,
	buildFeed,
	signFeed,
	verifyFeedSignature,
	generateLlmsTxt,
	buildAntiScrapeHTML,
	createFeedRoute
} from 'saw';

const { publicKeyBase64, secretKeyBase64 } = generateKeyPair();
const feed = buildFeed({
	site: 'example.com',
	blocks: [ { id:'block:home', type:'doc', title:'Home', version:'v1', updated_at:new Date().toISOString(), block_hash:'abc123' } ]
}, secretKeyBase64);

const ok = verifyFeedSignature(feed, feed.signature!, publicKeyBase64);
const llms = generateLlmsTxt({ site:'example.com', feedPath:'/api/saw/feed', publicKeyBase64 });
const { html, token } = buildAntiScrapeHTML('<html><body>Hello</body></html>');
const handler = createFeedRoute(async ()=> feed, { exposePublicKeyHeader:true, publicKeyBase64 });
```

## Development
```bash
npm run build
node packages/cli/dist/index.js --help
```

## License
MIT

---
Minimal core & CLI live in one package; import APIs from `saw`.
