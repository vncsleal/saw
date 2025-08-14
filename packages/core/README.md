# saw-core

Canonicalization, signing, diff subset verification, canaries, and schema helpers for SAW (Structured Access Web).

> Early draft reference implementation. APIs may evolve prior to 1.0.

## Install

```bash
npm install saw-core
```

Requires Node >=18 (ESM, built-in `crypto`, fetch/TLA readiness).

## Features
- Stable JSON canonicalization (property ordering, whitespace-free)
- Ed25519 feed & diff signatures (`tweetnacl`)
- Feed builder with optional static + per-key salted canaries
- Deterministic keypair generation (test-only) & random key generation
- Signed diff subset verification
- Agent descriptor fingerprint helper
- Zod schemas for validation

## Quick Example
```ts
import { generateKeyPair, buildFeed, verifyFeedSignature, canonicalize } from 'saw-core';

// 1. Keys
const { publicKey, secretKey } = generateKeyPair();
const pubB64 = Buffer.from(publicKey).toString('base64');
const secB64 = Buffer.from(secretKey).toString('base64');

// 2. Build a feed for a site
const feed = buildFeed({
  site: 'example.com',
  blocks: [
    { id: 'intro', content: 'Welcome', updated_at: new Date().toISOString() }
  ],
  secretKeyB64: secB64,
  // optional: canarySecret: 'your-static-canary-secret'
});

// 3. Verify signature
const ok = verifyFeedSignature({ ...feed, signature: undefined }, feed.signature, pubB64);
console.log('verified?', ok);

// 4. Canonical form of an object
console.log(canonicalize({ b: 2, a: 1 })); // => {"a":1,"b":2}
```

## Key Handling
Treat the secret (64 raw bytes, 88 base64 chars) like a production credential. See the root monorepo `README.md` Security & Key Handling section for rotation and storage guidance.

## Determinism & Tests
The monorepo includes vectors & a harness that exercise canonicalization, signing, diff verification, detector samples, and webhook schemas. Run from repo root:
```bash
npm run harness
```

## When To Use `generateKeyPairFromSeed`
Only for repeatable tests / fixtures. Never for production keys: seeded derivation is predictable.

## Diff Subsets
Servers can expose a signed subset of changed / removed blocks. Use `verifySignedDiff(diff, publicKeyB64)` (re-exported by core) to confirm authenticity before applying.

## API Surface (Selected)
- `generateKeyPair()` / `generateKeyPairFromSeed(seed)`
- `buildFeed(options)`
- `verifyFeedSignature(feedSubset, signatureB64, publicKeyB64)`
- `canonicalize(value)` / `hashCanonical(value)`
- `generateLlmsTxt(meta)`
- `verifySignedDiff(diffObj, publicKeyB64)`
- `generateApiKey()` (HMAC attribution phase)

## License
MIT

---
For CLI usage (generate / verify commands) see the `saw-cli` package or the monorepo root README.
