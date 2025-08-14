# SAW Build Plan — Internal Implementation Playbook

Version: 1.0 (Draft)
Status: Engineering Execution Document (NOT for public docs site)

---
## 1. Purpose & Scope
Internal guide to build the SAW reference implementation (libraries, CLI, examples) delivering the structured, signed feed + anti-scrape & verification primitives. Public-facing adoption, philosophy, and paradigm live solely in `saw-docs.md`. This file MUST NOT be published externally.

In Scope:
- Core TypeScript library (@saw/core) – canonicalization, signing, canary generation, schemas.
- CLI (@saw/cli) – init, generate, verify, diff, detect, canon.
- Example integrations (Next.js, plain Node/Express) demonstrating feed route + llms.txt generation.
- Anti-scrape Level 1–2 example snippets (not a framework).
- Verification tooling (detector, ephemeral canaries).

Out of Scope (for initial cycles):
- UI dashboards, advanced bot management vendor integrations, multi-language SDKs (Python/Go), embeddings/search production pipeline.

---
## 2. Objectives
1. Deterministic, signed feed artifact generation with <10 min onboarding.
2. Verifiable ingestion evidence (static + optional ephemeral canaries, per-key salted variants).
3. Tooling enabling external signature & schema verification (`saw verify`).
4. Anti-scrape baseline examples that raise cost without harming accessibility/SEO.
5. Extension hooks & registry for future capabilities (search/RAG, provenance chains).

---
## 3. Engineering KPIs
| KPI | Target (Phase 4) | Measurement |
|-----|------------------|------------|
| Canonicalization determinism | 100% identical over 200 fixtures, 3 runs | Snapshot hash CI |
| Signature verification failure (false negatives) | 0 | Test matrix |
| Feed gen p95 latency (100 blocks) | <250ms | Benchmark script |
| Core crypto & canonical code coverage | ≥90% | Coverage report |
| Canary collisions | 0 | Collision check log |
| CLI negative test classification accuracy | 100% | Automated test suite |

---
## 4. Profiles
| Profile | Required Features |
|---------|-------------------|
| Core | llms.txt, signed feed, canonicalization, static canaries, CLI generate/verify |
| Hardened | Core + anti-scrape examples (L1–2), event emission, diff scaffold |
| Advanced | Hardened + HMAC auth, per-key salted canaries, diff functional, ephemeral canaries |

---
## 5. Phase Overview
| Phase | Duration | Deliverables | Exit Gate |
|-------|----------|-------------|-----------|
| 0 Prep | 1w | Repo scaffold, keys, config, schemas | Init script success |
| 1 Lite | 2w | Canonicalization, signed feed, CLI verify | External verify pass |
| 2 Hardening | 2w | Static canaries, anti-scrape L1–2, events | Events emitted |
| 3 Attribution | 2w | HMAC auth, per-key canary salt, diff working | Auth + diff tests pass |
| 4 Verification Ops | 2w | Ephemeral canaries, detector tool, harness docs | Confidence A demo |
| 5 Extensions | ongoing | Extension registry, search stub | Registry online |

---
## 6. Detailed Phase Tasks
### Phase 0 — Preparation
- Scaffold monorepo: packages/core, packages/cli, examples/next, examples/node, content/blocks.
- Ed25519 keygen script (`saw keygen` internal usage) – DO NOT commit private key.
- Zod + JSON Schema for Block, Feed item, llms.txt.
- Stub canonicalizer (sort keys) + baseline test.
- CI: lint, typecheck, test.

Acceptance: `npm test` passes; keys generated; schemas compile.

### Phase 1 — SAW Lite Core
- Deterministic canonicalizer (canonical-json/1 rules) + 200 fixture vectors.
- Ed25519 sign/verify wrapper (tweetnacl) + golden vector tests.
- Feed builder: block → item (block_hash + static canary placeholder).
- CLI: init, generate, verify (fetch remote llms.txt + feed, signature check, schema validation, exit codes 0/1/2/3).
- Agent interface generator.
- Diff endpoint scaffold (returns 501 NOT_IMPLEMENTED + signature over empty changed[] for stability).

Acceptance: verify passes; tamper negative test fails; canonicalization deterministic snapshot.

### Phase 2 — Hardening
- Static canary generator: HMAC(secret, id|version) → base62(10) w/ collision check.
- Insert canary into feed items & structured.meta.
- Event emitter: feed.request, feed.response, canary.issued (stdout JSON lines).
- Anti-scrape examples (deferred paragraph loader, hidden comment canary, fragmentation utility).
- CLI `--json` output for verify.
- `saw canon <file>` command.

Acceptance: Canary stable test; events appear; canonical feed unchanged except new fields.

### Phase 3 — Attribution
- API key issuance (key id + secret; hashed secret storage abstraction).
- HMAC request auth middleware (X-API-KEY, X-SIG, X-TIMESTAMP) with ±120s skew.
- Per-key salted canaries (inject key salt into HMAC input).
- Diff endpoint functional (?since=ISO) returning changed & removed IDs.
- Persistent log adapter interface (memory impl).

Acceptance: Two keys produce distinct canaries; unauthorized request rejected; diff list valid.

### Phase 4 — Verification Ops
- Ephemeral session canary per request (TTL store mapping token→request_id).
- Detector library + CLI `detect`: parse text for c-[A-Za-z0-9]{8,10} tokens; classify confidence.
- Verification harness prompts & doc (internal + publishable template for external tests, stored outside docs file).
- Optional webhook emitter on canary.detected.

Acceptance: Detector maps sample output to request_id; ephemeral uniqueness.

### Phase 5 — Extensions
- Extension registry JSON (supported SAW-Ext identifiers).
- Search stub endpoint (static ranking with schema) + interface for pluggable vector search.
- RFP template in /rfp for community extension proposals.

Acceptance: CLI lists extensions; invalid extension triggers validation error.

---
## 7. Cross-Cutting Quality Gates
| Gate | Criteria | Tool |
|------|---------|------|
| Lint/Type | 0 errors | ESLint + tsc |
| Tests | Coverage ≥ thresholds (core 90%) | Vitest/Jest |
| Determinism | 0 hash diffs across 3 runs | Custom script |
| Security | No high CVEs | npm audit / osv |
| Accessibility (examples) | Lighthouse ≥90 | CI script |
| Performance | p95 feed build < target | Benchmark harness |

Rollback Triggers:
- >2% signature mismatches in CI verify job.
- Accessibility score drop below 90 after anti-scrape change.
- Canary collision (increase length & regenerate).

---
## 8. Conformance Test IDs
| ID | Requirement | Validation |
|----|-------------|-----------|
| CT-FEED-SIGN-01 | Feed signature verifies | CLI verify |
| CT-FEED-SIGN-02 | Tamper detection works | Negative test |
| CT-CANARY-01 | Static canary stable | Unit test |
| CT-CANARY-02 | Version change -> new canary | Unit test |
| CT-CANARY-03 | Per-key salt diff | Auth test |
| CT-HMAC-01 | Valid auth accepted | Middleware test |
| CT-HMAC-02 | Skew beyond limit rejected | Middleware test |
| CT-CANON-01 | Canonicalization deterministic | Snapshot test |
| CT-DIFF-01 | Diff endpoint correct | Integration |
| CT-EPHEM-01 | Ephemeral TTL enforced | Unit test |
| CT-DETECT-01 | Detector classification works | Detector test |

---
## 9. Architecture (Implementation View)
Components: core library (pure funcs), CLI, adapters (Express/Next), storage abstraction (Keys, Blocks, Events), detector, test fixtures.

---
## 10. Dependencies
- Node LTS
- tweetnacl (Ed25519), built-in crypto
- Zod
- Vitest/Jest
- ESLint/Prettier
- OpenTelemetry API (optional)

---
## 11. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Canonical drift | Signature break | Golden vectors locked |
| Key leakage | Trust loss | Do not commit; CI secret scan |
| Performance regress | Slow adoption | Benchmark gating |
| a11y regression | Accessibility harm | axe-core CI |
| Anti-scrape arms race | Complexity creep | Keep examples minimal |

---
## 12. Staffing
Single core engineer + part-time security review Phases 1,3,4 + docs effort.

---
## 13. Timeline
Weeks 0–1: Phase 0 | 1–3: Phase 1 | 3–5: Phase 2 | 5–7: Phase 3 | 7–9: Phase 4 | 9+: Phase 5.

---
## 14. Release Process
Feature branch → PR → CI (lint, test, determinism) → Merge → Tag beta (Phase 1) → Tag stable (Phase 2) → Semantic version discipline thereafter.

---
## 15. Exit Criteria
All conformance tests pass; profiles implementable; reference site deployed; verification harness reproducible.

---
## 16. Appendices
A. Fixture Directories: canonicalization-fixtures/, feed-negative/, detector-samples/
B. Env Vars: SAW_PRIVATE_KEY_PATH, SAW_PUBLIC_KEY_PATH, SAW_CANARY_SECRET_PATH
C. Open Questions: content hashing thresholds, diff compression default.

---
End of internal build plan.
