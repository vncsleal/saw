# SAW Verification Harness (Internal)

Purpose: Consolidated repeatable checks to assert Phase 4 Verification Ops readiness before release tagging.

## Components
1. Canonicalization determinism over fixture corpus (target 200 – expand as needed).
2. Feed signing + signature verification (golden negative tests handled in unit tests).
3. Agent descriptor fingerprint generation consistency.
4. Detector sample run exercising ephemeral canary issuance & detection.
5. (Planned) Diff integrity & signed diff verification sample.
6. (Planned) Webhook emission mock validation.

## Usage
Run locally:
```
npm run harness
```
Exit code 0 = pass, 1 = failures. Inspect console sections.

## Adding New Checks
Extend `scripts/run-verification-harness.mjs` with a new section and push result classification into the `failures` array logic.

## CI Integration
Add as a separate job after unit tests & coverage to gate releases. For flakiness investigation, capture harness stdout as an artifact.

## Expansion Roadmap
- Integrate diff construction with an earlier snapshot to exercise removal detection.
- Add multi-run canonicalization triple-pass hashing to detect nondeterministic JSON serialization regressions.
- Collect detector confidence metrics once implemented (scoring vs just classification).
- Validate webhook payload schema against a Zod validator.

## Ownership
Core engineering team; modifications require review when altering pass/fail criteria.
