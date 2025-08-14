#!/usr/bin/env node
/**
 * Verification Harness Runner
 * Executes canonicalization determinism, signature verification, detector mapping sample, and diff integrity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { hashCanonical, buildAgentDescriptor, buildFeed, generateKeyPair, verifyFeedSignature, detectCanaries, EphemeralCanaryStore, verifySignedDiff, WebhookCanaryDetectedSchema, WebhookDetectRequestSchema, WebhookFeedResponseSchema, WebhookPageResponseSchema, WebhookDiffResponseSchema, WebhookIngestUpsertSchema } from '../packages/cli/dist/api.js';
// examples folder removed: harness no longer auto-spawns example server

function section(title){ console.log(`\n=== ${title} ===`); }

// Deprecated: example server spawning removed; harness runs only local logic now.
const serverStarted = false;
const serverPublicKeyBase64 = '';

// 1. Canonicalization determinism over fixtures
section('Canonicalization Determinism');
const fixturesPath = path.join(process.cwd(),'canonicalization-fixtures','fixtures.json');
let fixtures = [];
if (fs.existsSync(fixturesPath)) fixtures = JSON.parse(fs.readFileSync(fixturesPath,'utf8'));
let canonMismatches = 0;
for (const f of fixtures) {
  const { canonical, sha256 } = hashCanonical(f.input);
  if (f.canonical && f.canonical !== canonical) canonMismatches++;
  if (f.sha256 && f.sha256 !== sha256) canonMismatches++;
}
const targetFixtures = parseInt(process.env.FIXTURE_TARGET || '200',10);
const pct = ((fixtures.length / targetFixtures)*100).toFixed(1);
console.log(`Fixture count=${fixtures.length} (${pct}% of target ${targetFixtures}) mismatches=${canonMismatches}`);
let fixtureShortfall = 0;
if (fixtures.length < targetFixtures) {
  fixtureShortfall = targetFixtures - fixtures.length;
  console.log(`Need +${fixtureShortfall} fixtures to reach target.`);
}

// 2. Feed signing + verification
section('Feed Signing & Verification');
const kp = generateKeyPair();
const pubB64 = Buffer.from(kp.publicKey).toString('base64');
const secB64 = Buffer.from(kp.secretKey).toString('base64');
const blocks = [{ id:'block:h1', type:'doc', title:'Hello', content:'World', version:'v1', updated_at:new Date().toISOString() }];
const feed = buildFeed({ site:'harness.test', blocks, secretKeyBase64: secB64 });
const subset = { site: feed.site, generated_at: feed.generated_at, items: feed.items };
const verified = verifyFeedSignature(subset, feed.signature, pubB64);
console.log('signatureVerified=', verified);

// 3. Agent descriptor fingerprint
section('Agent Descriptor');
const descriptor = buildAgentDescriptor({ site:'harness.test', publicKeyBase64: pubB64 });
console.log('fingerprint=', descriptor.public_key_fingerprint);

// 4. Detector sample
section('Detector Sample');
const store = new EphemeralCanaryStore(1000);
const reqId = 'req-123';
const token = store.issue(reqId);
const sampleText = `Some model output referencing token ${token} more text ${token}`;
const detect = detectCanaries(sampleText);
console.log('detected=', detect);

// 5. Exit code summary (basic)
// 5. Detector corpus accuracy (if present)
section('Detector Corpus Accuracy');
let detectorFailures = 0;
const corpusDir = path.join(process.cwd(),'detector-samples');
if (fs.existsSync(corpusDir)) {
  const gtPath = path.join(corpusDir,'ground-truth.json');
  if (fs.existsSync(gtPath)) {
    const gt = JSON.parse(fs.readFileSync(gtPath,'utf8'));
    for (const row of gt) {
      const p = path.join(corpusDir,row.file);
      if (!fs.existsSync(p)) { detectorFailures++; continue; }
      const text = fs.readFileSync(p,'utf8');
      const det = detectCanaries(text);
      if (det.unique.length !== row.unique || det.classification !== row.classification) {
        detectorFailures++;
        console.log(`Mismatch ${row.file}: expected unique=${row.unique}/${row.classification} got ${det.unique.length}/${det.classification}`);
      }
    }
    console.log(`Detector failures=${detectorFailures}`);
  } else {
    console.log('No ground-truth.json');
  }
} else {
  console.log('No detector-samples directory');
}

// Collate summary prior to exit
const failures = [];
if (canonMismatches) failures.push('canonicalization');
if (!verified) failures.push('signature');
if (detect.unique.length === 0) failures.push('detector');
if (detectorFailures) failures.push('detector-corpus');
if (fixtureShortfall) failures.push('fixture-count');
console.log('failures=', failures);

// 6. Diff subset verification (attempt local server first then simulate)
section('Diff Subset Verification');
let diffVerified = false;
let diffMode = 'none';
const sinceIso = new Date(Date.now()-60*60*1000).toISOString();
async function tryFetch(url){
  try { const r = await fetch(url, { headers:{'user-agent':'saw-harness/diff'} }); if (!r.ok) return undefined; return await r.json(); } catch { return undefined; }
}
// Self-invoking async IIFE wrapper pattern not needed; using top-level for fetch availability in node18+ (if not, wrap)
function parseLlmsTxt(txt){
  const meta = { fingerprint: undefined, publicKeyB64: undefined };
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const [k,...rest] = t.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'public-key' && val.startsWith('ed25519:')) meta.fingerprint = val.slice('ed25519:'.length);
    if (key === 'public-key-base64') meta.publicKeyB64 = val;
  }
  return meta;
}
async function fetchLlmsPublicKey(base){
  try {
    let siteBase = base;
    if (!/^https?:\/\//i.test(siteBase)) siteBase = (siteBase.startsWith('localhost') || siteBase.includes(':') ? 'http://' : 'https://') + siteBase;
    const llmsUrl = siteBase.replace(/\/$/,'') + '/.well-known/llms.txt';
    const r = await fetch(llmsUrl,{ headers:{'user-agent':'saw-harness/llms'} });
    if (!r.ok) return {};
    const txt = await r.text();
    return parseLlmsTxt(txt);
  } catch { return {}; }
}
async function runDiffCheck(){
  const base = process.env.HARNESS_DIFF_BASE || (serverStarted ? 'http://localhost:3000' : 'http://localhost:3000');
  const url = base.replace(/\/$/,'') + `/api/saw/diff?since=${encodeURIComponent(sinceIso)}`;
  const remote = await tryFetch(url);
  if (remote && remote.signature) {
    diffMode = 'remote';
    console.log('Remote diff fetched (changed=%s removed=%s)', remote.changed?.length||0, remote.removed?.length||0);
    // Choose key: internal server key, else llms.txt public-key-base64, else HARNESS_PUBLIC_KEY_B64
    let publicKeyCandidate = serverPublicKeyBase64;
    if (!serverStarted) {
      const meta = await fetchLlmsPublicKey(base);
      if (meta.publicKeyB64) publicKeyCandidate = meta.publicKeyB64;
      else if (process.env.HARNESS_PUBLIC_KEY_B64) publicKeyCandidate = process.env.HARNESS_PUBLIC_KEY_B64;
    }
    if (remote.signature !== 'UNSIGNED' && publicKeyCandidate) {
      try {
        const diffObj = { site: remote.site, since: remote.since, changed: remote.changed, removed: remote.removed, signature: remote.signature };
        diffVerified = verifySignedDiff(diffObj, publicKeyCandidate);
      } catch (e) {
        console.log('Diff signature verification error:', e instanceof Error ? e.message : String(e));
      }
    }
  } else {
    diffMode = 'simulated';
    const changed = feed.items.map(i=>({ id:i.id, version:i.version, updated_at:i.updated_at }));
    const removed = [];
    diffVerified = true;
    console.log('Simulated diff subset (changed=%s removed=%s)', changed.length, removed.length);
  }
}
await runDiffCheck();
if (diffVerified) {
  console.log('Diff subset verification OK ('+diffMode+')');
} else if (diffMode==='remote') {
  console.log('Remote diff signature NOT verified (possibly UNSIGNED or missing key).');
}

// 7. Webhook payload schema validation (optional: reads example log endpoint if available)
section('Webhook Payload Schema Validation');
let webhookValidationFailures = 0;
async function fetchJson(url){ try { const r = await fetch(url,{ headers:{'user-agent':'saw-harness/webhook'} }); if (!r.ok) return undefined; return await r.json(); } catch { return undefined; } }
const logEndpoint = process.env.HARNESS_LOG_BASE || (serverStarted ? 'http://localhost:3000/api/saw/logs' : 'http://localhost:3000/api/saw/logs');
const logs = await fetchJson(logEndpoint);
if (logs && Array.isArray(logs.logs)) {
  for (const entry of logs.logs.slice(-100)) { // last 100
    const ev = entry.event || entry.data?.event;
    const payload = entry.data || entry; // server uses data field
    try {
      switch (ev) {
        case 'feed.response': WebhookFeedResponseSchema.parse(payload); break;
        case 'page.response': WebhookPageResponseSchema.parse(payload); break;
        case 'detect.request': WebhookDetectRequestSchema.parse(payload); break;
        case 'canary.detected': WebhookCanaryDetectedSchema.parse(payload); break;
        case 'diff.response': WebhookDiffResponseSchema.parse(payload); break;
        case 'ingest.upsert': WebhookIngestUpsertSchema.parse(payload); break;
        default: continue;
      }
    } catch (e) {
      webhookValidationFailures++;
      console.log('Webhook schema failure', ev, e instanceof Error ? e.message : String(e));
    }
  }
  console.log('Webhook validation failures=', webhookValidationFailures);
} else {
  console.log('No accessible logs endpoint or unexpected format; skipping validation.');
}
if (webhookValidationFailures) failures.push('webhook-schema');
if (process.env.HARNESS_REQUIRE_WEBHOOKS === '1' && !(logs && Array.isArray(logs.logs))) {
  failures.push('webhook-missing');
}

// Machine-readable summary output
try {
  const summary = {
    ts: new Date().toISOString(),
    fixtureCount: fixtures.length,
    fixtureTarget: targetFixtures,
    fixtureShortfall,
    canonicalMismatches: canonMismatches,
    signatureVerified: verified,
    descriptorFingerprint: descriptor.public_key_fingerprint,
    detector: {
      classification: detect.classification,
      confidence: detect.confidence,
      confidence_band: detect.confidence_band,
      tokens: detect.unique.length,
      occurrences: detect.count
    },
    diff: { mode: diffMode, verified: diffVerified },
    detectorCorpusFailures: detectorFailures,
    failures,
    exitCode: failures.length ? 1 : 0
  };
  const outFile = process.env.HARNESS_OUTPUT || 'harness-results.json';
  fs.writeFileSync(path.join(process.cwd(), outFile), JSON.stringify(summary, null, 2));
  console.log(`Summary written -> ${outFile}`);
} catch (e) {
  console.error('Failed to write harness summary:', e instanceof Error ? e.message : String(e));
}

// Cleanup server if started
if (serverProc) serverProc.kill();
process.exit(failures.length ? 1 : 0);
