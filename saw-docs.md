# SAW Documentation — Structured Access Web (Comprehensive Draft)

Version: 1.0 (Draft)
Status: Working Reference (supersedes overlapping descriptive sections in `saw-standard.md` but does not replace normative spec text yet)

---
## 0. Executive Summary
SAW (Structured Access Web) establishes a publisher-driven, cryptographically verifiable pathway for Large Language Models (LLMs) and agents to consume *canonical structured content* while deliberately reducing the utility of naïve HTML scraping. It introduces a minimal artifact set (llms.txt, signed feed, block model) plus operational practices (canaries, differential content, anti-scrape friction) and verification workflows that generate evidence of legitimate ingestion.

Core premise: *Make the legitimate structured feed cheaper, richer, fresher, and more trustworthy than scraping — while making casual scraping noisy and low-value.*

---
## 1. Design Goals
1. Canonical Truth: Provide a single signed source for atomic content (Blocks) and updates.
2. Efficient Consumption: Enable incremental, low-bandwidth refresh (cursor + since semantics) for AI agents.
3. Verifiable Provenance: Allow third parties to cryptographically prove feed authorship and ingestion.
4. Scraper Cost Escalation: Increase engineering & compute cost for uncooperative HTML scraping without harming human UX or accessibility.
5. Minimal Publisher Overhead: Provide drop‑in library + CLI with <10 minute onboarding (“SAW Lite”).
6. Extensible Evolution: Support future extensions (search/RAG, per-key differential salts, diff feeds) via versioning and stable contracts.
7. Transparency & Reciprocity: Make participation publicly declared (llms.txt) and let publishers observe usage signals (events, canaries).

---
## 2. Core Principles
- Principle of Reciprocity: Structured feed access ↔ verifiable ingestion signals.
- Principle of Parsimony: Start with the smallest useful artifact set; avoid premature complexity.
- Principle of Verifiability: All canonical feeds are signed; requests optionally authenticated.
- Principle of Differential Value: The feed conveys higher precision & structured fields withheld or softened in HTML.
- Principle of Accessibility Preservation: Anti-scrape measures must not degrade assistive technologies or violate ethical content norms.
- Principle of Determinism: Canonicalization rules are deterministic; signature mismatches are diagnosable.
- Principle of Layered Hardening: Adopt anti-scrape measures incrementally (Level ladder) based on risk profile.

---
## 3. Artifact Set Overview (Minimal Normative)
| Artifact | Purpose | Mandatory Fields (Baseline) |
|----------|---------|------------------------------|
| `/.well-known/llms.txt` | Discovery + public key fingerprint | SAW-Version, AI-Feed-URL, Public-Key (Ed25519), Updated-At |
| `/api/saw/feed` (JSON) | Canonical signed content feed | site, generated_at, items[], signature |
| Feed Item | Atomic structured unit reference | id, type, title, summary?, structured?, version, updated_at, published_at?, canonical_url, block_hash, canary |
| `/agent-interface.json` | Machine-readable site interface map | site, version, generated_at, endpoints, usage_policy |
| `/api/blocks/{id}` | Full block detail API | Block object (content + structured + provenance) |
| `/api/saw/diff?since=ISO` (optional) | Incremental change listing | changed[], removed[], generated_at, signature |

Expansion artifacts (later phases): sitemap.json (block mapping), embeddings endpoint, RAG hints.

---
## 4. Canonical Data Model
### 4.1 Block
```
Block {
  id: string;                // e.g. "block:pricing-2025"
  type: string;              // domain taxonomy (e.g. pricing, doc, news)
  title: string;
  summary?: string;
  content: string;           // Markdown or structured text
  structured?: object;       // Machine fields (e.g. {pricing:{plan:"pro", monthly_usd:49}})
  tags?: string[];
  relations?: {type:string; target:string;}[]; // graph edges
  version: string;           // semantic or commit hash fragment
  published_at?: string;     // ISO8601
  updated_at: string;        // ISO8601
  canonical_url?: string;    // Public deep link
  provenance?: {authorId?:string; commitId?:string};
  discoverability?: { public:boolean; include_in_llms_txt:boolean; };
}
```
### 4.2 PageManifest (Optional Rendering Layout)
```
PageManifest {
  id: string;                // e.g. "page:home"
  blocks: string[];          // Ordered Block IDs
  layoutHints?: object;      // Non-normative layout metadata
}
```
### 4.3 Derived Fields
- `block_hash`: SHA256(canonicalize(structural_subset))
  - structural_subset excludes `content` if extremely large (configurable), includes metadata & structured.
- `canary`: Short token (base62, 10 chars) derived from HMAC(secret, id|version|salt) truncated after collision check.

---
## 5. Canonicalization Specification (canonical-json/1)
Deterministic serialization for signing & hashing.
1. Encoding: UTF-8.
2. Whitespace: No extra whitespace (compact JSON) except single commas & colons as per JSON grammar.
3. Object Key Ordering: Lexicographically ascending (byte-wise) at all nesting levels.
4. Arrays: Preserve declared order.
5. Numbers: Represent as shortest round-trip decimal (no trailing zeros, no `+`, scientific only if needed by standard JSON parser behavior is **disallowed**; force plain decimal string). Example: `1.0` → `1`, `0.5000` → `0.5`.
6. Booleans / null: Lowercase standard tokens.
7. Strings: Standard JSON escaping; forbid unnecessary escaping of `/` (do not escape `/`).
8. Excluded Fields: Signature fields (`signature`, `signed_fields`) are excluded from the digest input.
9. Digest Input: UTF-8 string of canonical JSON; `block_hash = SHA256(canonical_json)`; `feed_signature = Ed25519(sign(private_key, canonical_json_subset))`.
10. Subset for Feed Signature: Top-level fields `site`, `generated_at`, `items` only (unless `signed_fields` explicitly enumerates more). Items themselves are canonicalized recursively.

Pseudo-code:
```
function canonicalize(value):
  if object: sort keys asc; emit {k: canonicalize(v)}
  if array: emit [canonicalize(each) in order]
  if number: convert to minimal decimal string
  else: emit primitive JSON per standard
```

---
## 6. Cryptographic Model
### 6.1 Payload Signature (Ed25519)
- Key pair: 32-byte seed (private), 32-byte public.
- Public key fingerprint in `llms.txt`: `ed25519:<first_8_bytes_hex_of_SHA256(pubkey)>`.
- Field: `signature` (base64url of detached signature).
- Optional `signed_fields` array (canonical order) for transparency.

### 6.2 Request Authentication (HMAC) (Optional)
Headers:
- `X-API-KEY`: issued key ID.
- `X-TIMESTAMP`: RFC3339 UTC.
- `X-SIG`: base64(HMAC_SHA256(secret, method + "\n" + path + "\n" + timestamp + "\n" + body_sha256_hex)).
- Reject if clock skew > ±120s or mismatch.

### 6.3 Canary Tokens
- Static per (id, version) for base attribution.
- Optional ephemeral per request: `canary_session` appended to each item or feed-level `session_canary`.
- Entropy: ≥52 bits effective (10 chars base62 ≈ 62^10 ≈ 8.39e17 > 2^59; safe).
- Collision policy: Regenerate if existing token present; maintain uniqueness index.

---
## 7. Anti-Scrape Strategy Ladder
| Level | Techniques | Human Impact | Activation Trigger |
|-------|------------|--------------|--------------------|
| 1 | Deferred critical paragraphs (XHR), hidden canary comments | Negligible | Baseline |
| 2 | Sentence fragmentation, random data-* attrs per build | Low | Elevated scrape volume |
| 3 | Differential phrasing (approx numbers in HTML) vs exact in feed | Low | Targeted data extraction observed |
| 4 | Attribute hashing, mild content order permutation (stable a11y order) | Low-Med | Sustained bot infra | 
| 5 | IP-fingerprint variant templates; JS assembly of some numeric literals | Medium | High-value target / abuse |
| 6 | Rate-tier gating via bot scores; ephemeral content shards loaded after interaction | Medium | Extreme / paid content |

Guardrails:
- Always retain accurate JSON-LD for SEO & screen readers (ARIA landmarks stable).
- Never inject deceptive human-visible misinformation; differential content must remain semantically equivalent.

---
## 8. Differential Content & Verification
Purpose: Provide *evidentiary markers* distinguishing feed ingestion from HTML scraping.
Categories:
1. Precision Differential: Feed has exact metrics; HTML rounds/ranges.
2. Structural Differential: Feed includes structured.meta fields absent in HTML.
3. Token Differential: Canaries present in feed & optionally hidden in HTML (for cross-correlation).
4. Version Differential: Feed exposes `version` & `block_hash`; HTML omits or defers.

Evidence Confidence Levels:
- Level A: Output contains a static canary + matches per-request ephemeral token + logged `feed.request` with same API key.
- Level B: Output contains static canary only → likely feed or secondary distribution.
- Level C: Output expresses exact feed-only precision values without canary → probable feed ingestion.
- Level D: Output mirrors HTML approximate phrasing → uncertain / HTML source.

---
## 9. Event Schema (Publisher Emission)
All events recommended as either JSON lines or OpenTelemetry spans.
Common fields: `event_type`, `timestamp`, `site`, `request_id?`, `api_key_id?`, `ip_hash?` (SHA256(ip + salt)), `user_agent?`.

Events:
- `feed.request`: {items_hint?, since?, cursor?, signature_verified:boolean}
- `feed.response`: {item_count, signed:boolean, static_canaries:[string], ephemeral_canary?:string, latency_ms}
- `block.fetch`: {block_id, public:boolean, etag_match:boolean}
- `canary.issued`: {token, item_id, version, scope:"static"|"ephemeral"}
- `canary.detected`: {token, evidence_source, matched_item_id?, matched_request_id?, confidence_level}
- `suspicious.activity`: {pattern:"rapid_html_requests"|"headless_fingerprint"|..., sample_count}
- `diff.generated`: {since, changed_count, removed_count}
- `spec.violation`: {component:"canonicalization"|..., detail}

---
## 10. CLI / Tooling (SAW Lite)
Commands:
- `saw init` — Create `saw.config.(js|ts)`, generate dev Ed25519 keys, example Block.
- `saw generate` — Produce feed (`feed.json`), `llms.txt`, `agent-interface.json`; print summary & signature verification result.
- `saw verify <url>` — Fetch remote `llms.txt` and feed; validate signatures, schema, canonicalization; output report + exit code.
- `saw diff --since <ISO>` — Emit diff (changed ids + block_hashes).
- `saw keygen` — Generate production key pair (stdout or file).
- `saw canon <file>` — Canonicalize arbitrary JSON & output hash (debugging).

Exit Codes (verify): 0 = pass, 1 = schema error, 2 = signature mismatch, 3 = network/retrieval failure.

---
## 11. Configuration Schema (`saw.config`) (Draft)
```
export interface SawConfig {
  site: string;                 // "example.com"
  feedUrl?: string;             // override if served on subdomain
  blocksDir: string;            // relative path to content blocks
  outputDir: string;            // where generated artifacts land
  publicKeyPath: string;        // Ed25519 pub key
  privateKeyPath: string;       // Ed25519 priv key (secure)
  canarySecretPath: string;     // HMAC secret for canaries
  canary: { perRequest?: boolean; length?: number; base?: "base62"|"base32" }; 
  diff: { enable?: boolean; excludeLargeContent?: boolean; };
  discovery: { includeAgentInterface?: boolean; }; 
  htmlDifferential?: { enabled:boolean; precisionStrategy?:"round"|"range"; };
  logging?: { format:"json"|"text"; stdout?:boolean; };
  hooks?: {
    onFeedBuilt?(ctx): Promise<void>|void;
    onCanaryIssued?(ctx): Promise<void>|void;
    onVerifyComplete?(report): Promise<void>|void;
  };
}
```

---
## 12. Implementation Phases (Recast)
| Phase | Duration | Deliverables | Completion Criteria |
|-------|----------|--------------|---------------------|
| 0 Prep | 1w | Keys, config, baseline blocks | `saw init` success | 
| 1 Lite | 2w | Canonicalization, signed feed, llms.txt, CLI verify | External verify passes |
| 2 Hardening | 2w | Static canaries, differential HTML (Level 1–2), events | Evidence events emitted |
| 3 Attribution | 2w | HMAC auth, per-key salted canaries, diff endpoint | Authenticated feed logs | 
| 4 Verification Ops | 2w | Ephemeral canaries, detection pipeline spec | Confidence Level A achievable | 
| 5 Extensions | ongoing | Search/RAG, registry, performance tuning | Adoption KPIs | 

---
## 13. Validation Harness (External LLM Sampling)
---
## 12a. Conformance Profiles (Normative Draft)
Publishers and tool implementers can target profiles that bundle required artifacts & behaviors. A higher profile implies all requirements of lower profiles unless explicitly waived.

| Profile | Purpose | Mandatory Artifacts | Required Features | Optional Enhancements |
|---------|---------|---------------------|-------------------|-----------------------|
| Core | Fast onboarding; minimal verifiable feed | llms.txt, /api/saw/feed, Ed25519 signature | Canonicalization (rules 1–9), static canaries, block_hash, CLI verify pass | Diff endpoint |
| Hardened | Adds stronger attribution & anti-scrape | Core + events emission, differential HTML Level 1–2, per-block canary uniqueness | Event schema (feed.request/feed.response/canary.issued), HMAC request auth (for authenticated keys), precision differential policy documented | Per-request ephemeral canaries |
| Advanced | Full verification & ops telemetry | Hardened + ephemeral canaries, diff endpoint, detection pipeline | Evidence Levels A/B derivable, canary collision monitor, spec.violation events | Extensions (rag-hints, search index hints) |

Normative MUST statements (abridged):
- Core MUST produce a feed whose canonicalization hash of top-level subset reproducibly matches local generation across two independent implementations.
- Core MUST embed a detached Ed25519 signature covering `site`, `generated_at`, `items` subset.
- Core MUST include a `block_hash` for every item derived from canonical structural subset.
- Hardened MUST emit `feed.request` and `feed.response` events for each served feed request (batched allowed within 1s window max).
- Hardened MUST implement at least one precision differential (e.g., rounding HTML numeric metrics) documented in `agent-interface.json` usage_policy.
- Advanced MUST support ephemeral per-request canaries OR provide justification for deterministic alternative with equivalent entropy >= 52 bits.
- Advanced SHOULD expose a signed diff endpoint if average item count > 500 or update frequency > 1/min.

Schema References:
- Block Schema: `schemas/block.schema.json`
- Feed Schema: `schemas/feed.schema.json`
- llms.txt Schema (normalized form): `schemas/llms-txt.schema.json`

Test Vectors:
- Canonicalization vectors: `test-vectors/canonicalization.json`

Verification Algorithm (High-Level):
1. Fetch `llms.txt` → parse & extract feed URL + public key fingerprint.
2. Fetch feed JSON → validate against Feed Schema (Core MUST pass).
3. For each item: validate Block Schema (Core MUST pass).
4. Canonicalize feed subset; verify Ed25519 signature using declared public key.
5. Recompute each `block_hash`; mismatch → fail (exit code 2).
6. (If Advanced) Compare ephemeral canary presence & uniqueness within TTL window; log anomalies.
7. Emit verification report (machine & human format).

Failure Modes & Codes (proposed mapping):
- 1 Schema violation (core) | 2 Signature mismatch | 3 Network retrieval failure | 4 Canonicalization divergence | 5 Canary policy violation.

Interoperability Goal: Two independent implementations SHOULD achieve identical canonicalization output & signature verification for all vectors before claiming profile support.

---
Components:
1. Test Domain: Controlled Blocks with precise metrics + HTML approximations.
2. Prompt Set: A fixed list of queries (metrics, pricing, unique canary presence, structured detail).
3. Collection Script: Semi-automated query execution (respect ToS) storing raw outputs.
4. Analyzer: Regex extraction for canaries & numeric pattern comparison vs feed.
5. Metrics: feed_hit_ratio, scrape_leakage_ratio, ingestion_latency.

Sample Prompts:
- "What is the exact p95 API latency reported by test-saw.example?"
- "List the pricing tiers and exact monthly USD amounts from test-saw.example." (HTML has ranges; feed has exact)
- "Do you see any short tokens starting with 'c-' related to test-saw.example content?"
- "Summarize the latest news block from test-saw.example and include any reference IDs." (Blocks have IDs like block:news-2025-08)

---
## 14. Metrics & KPIs
Publisher KPIs:
- Feed Adoption Ratio = feed_request_block_hits / (feed_request_block_hits + suspicious_html_block_hits)
- Verified Ingestion Rate = verified_feed_outputs / total_llm_outputs_sampled
- Differential Leakage Rate = outputs_with_html_only_markers / total_llm_outputs_sampled
- Publish→Feed Latency p95
- Canary Detection Confidence distribution (A/B/C/D)

System Health:
- p95_feed_latency, feed_error_rate, signature_failure_rate, canary_collision_count

Security/Abuse:
- suspicious.activity events per day, false_positive_rate (manual sampling)

---
## 15. Risk Analysis & Mitigations
| Risk | Description | Mitigation |
|------|-------------|------------|
| Advanced JS Scrapers | Execute client JS & reconstruct DOM | Accept; rely on differential precision & canaries | 
| Key Compromise | Private key leaked | Rotate keys; llms.txt lists both old/new during transition | 
| Canary Enumeration | Attacker brute forces truncated tokens | High entropy, salted HMAC, monitor anomaly queries | 
| Accessibility Regression | Fragmentation confuses screen readers | Automated a11y tests (axe-core) CI gating | 
| SEO Degradation | Over-noisy HTML harms indexing | Keep JSON-LD clean; throttle noise density | 
| Legal Concerns Over Decoys | Misinterpretation as misinformation | Keep decoys hidden / clearly non-authoritative | 
| Token Leakage to Caches | Public caches replicate canaries | Tokens are non-sensitive; expire ephemeral quickly | 

---
## 16. Governance & Versioning
- SAW-Version semantic: MAJOR.MINOR (patch optional). Breaking canonicalization or mandatory field additions require MAJOR increment.
- Deprecation Policy: Old fields maintained for ≥1 MINOR with deprecation notice in docs & `llms.txt` `SAW-Notice` line.
- Extension Registry: Proposed via RFP docs (SAW-RFP-###) in a public repo; accepted extensions referenced from `llms.txt` via `SAW-Ext:` lines.
- Validator: Reference CLI & hosted service must align with canonical JSON test vectors.

---
## 17. Publisher Responsibilities vs SAW Library Responsibilities
| Aspect | Publisher | SAW Library |
|--------|-----------|-------------|
| Content correctness | Provide accurate Blocks | None |
| Key storage & rotation | Secure & rotate keys | Provide generation & verification utilities |
| Logging & retention | Persist events & feed requests | Emit structured events |
| Bot detection enforcement | Integrate WAF/CDN rules | Offer hook points / guidance |
| Data privacy compliance | Ensure regulatory compliance | None |
| Anti-scrape tuning | Choose Level ladder activation | Provide implementation recipes |

---
## 18. Non-Goals (Clarifications)
- Perfect prevention of scraping.
- Proprietary or closed ingestion channel.
- Mandatory UI/dashboard.
- Hard dependency on any cloud provider.
- Semantic interpretation or ranking logic (beyond structured feed).

---
## 19. Example Artifact Sketches
### 19.1 llms.txt (Minimal)
```
# SAW llms.txt
SAW-Version: 1.0
AI-Feed-URL: https://ai.example.com/api/saw/feed
Public-Key: ed25519:4f3a9b12
Updated-At: 2025-08-14T12:00:00Z
Preferred-Crawl-Rate: 1/min
Disallow: /private
Allow: /public
```
### 19.2 Feed (Truncated Example)
```
{
  "site":"example.com",
  "generated_at":"2025-08-14T12:00:00Z",
  "items":[{
    "id":"block:news-2025-08-launch",
    "type":"news",
    "title":"Launch Milestone",
    "summary":"We launched SAW Lite",
    "structured":{"category":"announcement","metrics":{"p95_latency_ms":420}},
    "version":"v1",
    "updated_at":"2025-08-14T11:58:00Z",
    "published_at":"2025-08-14T11:58:00Z",
    "canonical_url":"https://example.com/news/launch",
    "block_hash":"1af3...",
    "canary":"c-8b7f2a9x"
  }],
  "signature":"BASE64URL(...)"
}
```

---
## 20. Quickstart (Narrative)
1. Install: `npm i @saw/core @saw/cli`.
2. Init: `npx saw init` → creates keys, sample block.
3. Generate: `npx saw generate` → outputs feed, llms.txt.
4. Serve feed route via framework adapter (e.g., `createSawFeedHandler(config)`).
5. Validate externally: `npx saw verify https://example.com/.well-known/llms.txt`.
6. Enable Level 1 anti-scrape: Defer core paragraphs, add hidden canary comments.
7. Publish & sample LLM queries for verification.

---
// Implementation playbook moved to internal build plan: see `saw-build-plan.md`.
## 21. Future Extensions (Roadmap Candidates)
- `SAW-Ext: rag-hints` – Provide chunking hints & embedding metadata.
- `SAW-Ext: media-manifest` – Structured reference for media assets & licenses.
- `SAW-Ext: license-bundle` – Machine-readable licensing terms per block.
- `SAW-Ext: provenance-chain` – Supply Merkle proofs or transparency log references.
- Multi-language SDKs (Python, Go) replicating canonicalization.
- Signed diff streams over Server-Sent Events (SSE) or WebSockets.

---
## 22. Glossary
| Term | Definition |
|------|------------|
| Block | Atomic unit of canonical content in SAW |
| Canary | Short token enabling ingestion verification |
| Differential Content | Strategically varied HTML vs feed values |
| Feed | Signed structured JSON listing Blocks / updates |
| llms.txt | Discovery manifest for SAW support |
| Canonicalization | Deterministic JSON serialization for signatures |
| Ephemeral Canary | Short-lived token bound to a specific feed request |
| Differential Leakage | When an AI output mirrors HTML-only differences |
| Verification Level | Confidence category for ingestion evidence |

---
## 23. Summary & Positioning Statement
SAW delivers a pragmatic, low-friction mechanism for sites to expose structured, signed, attribution-friendly content to LLMs while applying ethically bounded friction to naïve scraping. Its layered approach (artifacts → signatures → canaries → differential anti-scrape) accelerates trustworthy AI ingestion without compromising accessibility or integrity.

---
## 24. Change Log (for this Document)
- 2025-08-14: Initial comprehensive draft created (consolidated goals, canonicalization spec, event schema, ladder strategy, validation harness).
- 2025-08-14: Added Step-by-Step Implementation Playbook (Section 21) and renumbered subsequent sections.
- 2025-08-14: Separated implementation playbook into `saw-build-plan.md`; removed Section 21 from public docs; renumbered sections.
- 2025-08-14: Added Conformance Profiles (12a), JSON Schemas (block/feed/llms.txt) & canonicalization test vectors reference.

---
End of document.
