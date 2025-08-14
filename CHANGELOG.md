# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and adheres to Semantic Versioning.

## [0.1.1] - 2025-08-14
### Changed
- Moved all test files out of `src` into dedicated `tests/` directories to prevent test artifacts from being published.
- Adjusted TypeScript build scripts to build core and CLI sequentially and to ensure clean dist outputs.
- Updated `@saw/core` `types` and `exports.types` to point to compiled declarations in `dist/` instead of source.
- Reduced published package size by excluding tests from emission.

### Added
- Harness sanity run confirms: 200/200 canonicalization fixtures, zero mismatches, detector corpus 0 failures.
- Publication prep: version bump to 0.1.1 for `@saw/core` and `@saw/cli` with CLI dependency aligned to `^0.1.1`.

### Fixed
- Resolved build issues caused by stale incremental TS build info after test relocation.
- Ensured CLI build no longer fails due to missing core dist outputs.

## [0.1.0] - 2025-08-14
### Added
- Initial public release of `@saw/core` and `@saw/cli` providing canonicalization, signed feed generation & verification, diff subset verification, canary issuance & detection, webhook schemas, and verification harness.

