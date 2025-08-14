# SAW Spec Tooling

Utility scripts and test vectors supporting the SAW (Structured Access Web) draft specification.

## Contents
- `scripts/canonicalize.js` – Canonical JSON (canonical-json/1) implementation.
- `scripts/test-canonicalization.js` – Runs test vectors.
- `test-vectors/canonicalization.json` – Deterministic canonicalization fixtures.
- `schemas/` – JSON Schemas (block, feed, llms.txt normalized).

## Usage

Install dependencies (none external yet) and run canonicalization tests:

```bash
# run unit tests
npm test

# run canonicalization vector tests
npm run test:canon

# run determinism check (multiple runs consistency)
npm run determinism

# generate key pair (development only)
npm run build && node packages/cli/dist/index.js keygen
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

## Future Enhancements
- Signature test vectors (Ed25519) for feed subset.
- Canary generation test cases (static vs ephemeral format).
- Schema validation CLI integration.
- Cross-language (Go/Python) parity harness.
 - Next.js feed route example implementation.
 - Diff endpoint scaffold & tests.

## License
MIT
