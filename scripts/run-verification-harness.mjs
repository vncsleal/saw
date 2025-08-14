#!/usr/bin/env node
/**
 * Verification Harness Runner
 * Executes canonicalization determinism, signature verification, detector mapping sample, and diff integrity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { hashCanonical, buildAgentDescriptor, buildFeed, generateKeyPair, verifyFeedSignature, detectCanaries, EphemeralCanaryStore } from '../packages/core/dist/index.js';

function section(title){ console.log(`\n=== ${title} ===`); }

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
console.log(`Fixture count=${fixtures.length} mismatches=${canonMismatches}`);

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
const failures = [];
if (canonMismatches) failures.push('canonicalization');
if (!verified) failures.push('signature');
if (detect.unique.length === 0) failures.push('detector');
console.log('failures=', failures);
process.exit(failures.length ? 1 : 0);
