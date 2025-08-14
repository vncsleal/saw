## Canonicalization Fixture Corpus

This directory stores the determinism corpus used by the verification harness and unit tests.

File: `fixtures.json`
- Array of objects: `{ name, input, canonical?, sha256? }`.
- `canonical` and `sha256` are backfilled by `scripts/generate-additional-fixtures.mjs` if missing to lock expected output.

Targets:
- Phase 4 target: 200 fixtures (achieved).
- Future expansion: edge cases for extremely deep nesting, numeric extremes (NaN excluded), Unicode normalization edge cases, near-miss token strings that must not alter ordering.

Regenerate / Expand:
```bash
node scripts/generate-additional-fixtures.mjs          # fills up to default target (200)
FIXTURE_TARGET=250 node scripts/generate-additional-fixtures.mjs
```

Validation:
`npm run harness` reports fixture count & mismatch tally. Any canonical or hash mismatch increments failure counters (ensuring regression visibility).

Contribution Guidelines:
1. Prefer minimal `input` objects illustrating a distinct ordering / serialization property.
2. Avoid massive payloads; keep individual fixture canonical JSON under ~2KB.
3. If adding manually, leave out `canonical`/`sha256` (script will fill) OR compute via:
```bash
node -e "import('./packages/cli/dist/api.js').then(m=>{const {hashCanonical}=m;const f=JSON.parse(process.argv[1]);console.log(hashCanonical(f));});" '{"b":2,"a":1}'
```
4. Ensure names are unique and kebab-cased.

Planned Improvements:
- Triple-run nondeterminism spot check.
- Split corpus into thematic groups if size grows (>1000) for targeted benchmarking.
