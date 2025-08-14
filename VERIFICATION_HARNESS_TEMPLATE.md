# SAW Verification Harness Template (External Adaptation)

Use this template to build a verification harness for your own deployment of SAW-compatible feeds.

## Goals
- Confirm feed canonicalization & signatures are stable.
- Exercise ephemeral canary issuance and detection mapping.
- Provide quick signal prior to publishing feeds or rotating keys.

## Checklist
- [ ] Fetch llms.txt and extract Public-Key line.
- [ ] Fetch feed JSON; verify signature over signed_fields subset.
- [ ] Recompute canonical hashes for items and compare against block_hash fields (optional extension if raw blocks available).
- [ ] Issue an ephemeral canary via your application instrumentation (or simulate) and ensure detector captures it in a mock model output.
- [ ] Run canonicalization determinism over local corpus (add your domain-specific edge cases).
- [ ] Record fingerprints & timestamps for audit.

## Example Script Snippet (Pseudo)
```js
const feed = await fetch(feedUrl).then(r=>r.json());
verifySignature(feed, publicKey);
const sampleOutput = modelRun(prompt + token);
const detection = detectCanaries(sampleOutput);
assert(detection.unique.includes(token));
```

## Reporting
Capture:
- Timestamp
- Feed generated_at
- Signature verification result
- Detector tokens summary

Store as JSON for traceability.

## Extending
Add diff verification (fetch /diff?since=<iso>) and verifySignedDiff.
Add webhook receiver test to ensure canary.detected events emit.

## Governance
Automate nightly; fail build if signature or detection fails.
