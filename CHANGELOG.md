# Changelog
## [0.2.0] - 2025-08-14
### Breaking / Structural
- Consolidated prior split packages into a single published package `saw` with combined library & CLI.
- Unified feed schema (`site`,`generated_at`,`items`,`signature`).

### Added
- Server helpers: `createFeedHandler`, `createDetectHandler`, fetch variants, and anti-scrape HTML injection utilities.
- Anti-scrape implementation: `buildAntiScrapeHTML`, canary token injection, honeypot link option.
- `init` now auto-generates an initial API key if none exist.
- Public API barrel exports route & anti-scrape helpers.

### Changed
- `verify` now reports presence of llms.txt, header public key, and detect endpoint in its message.
- Simplified bin mapping to single `saw` executable.

### Removed
- Legacy multi-package workspace (`packages/core` removed).

### Internal
- Updated README for single-package usage and server helper examples.


All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and adheres to Semantic Versioning.

## [0.1.2] - 2025-08-14  
[Legacy split packages]
### Added
- Package-level READMEs (usage, examples, security notes) now included in published tarballs.
- Root README security & key handling section.

### Changed
- Version bump only (no runtime code changes).

### Notes
- This release exists solely to surface new documentation on npm; logic identical to 0.1.1.

## [0.1.1] - 2025-08-14  
[Legacy split packages]
### Changed
- Moved all test files out of `src` into dedicated `tests/` directories to prevent test artifacts from being published.
- Adjusted TypeScript build scripts to build core and CLI sequentially and to ensure clean dist outputs.
- Updated core library `types` and `exports.types` to point to compiled declarations in `dist/` instead of source.
- Reduced published package size by excluding tests from emission.

### Added
- Harness sanity run confirms: 200/200 canonicalization fixtures, zero mismatches, detector corpus 0 failures.
- Publication prep: version bump to 0.1.1 for both packages with CLI dependency aligned to `^0.1.1`.

### Fixed
- Resolved build issues caused by stale incremental TS build info after test relocation.
- Ensured CLI build no longer fails due to missing core dist outputs.

## [0.1.0] - 2025-08-14  
[Legacy initial public releases]
### Added
- Initial public release providing canonicalization, signed feed generation & verification, diff subset verification, canary issuance & detection, webhook schemas, and verification harness.

