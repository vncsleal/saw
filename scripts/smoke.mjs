#!/usr/bin/env node
// Simple smoke test: generate keypair, build feed, verify feed.
import { generateKeyPair, buildFeed, verifyFeedSignature } from '../packages/cli/dist/api.js';
import fs from 'node:fs';

function b64(buf){ return Buffer.from(buf).toString('base64'); }

const kp = generateKeyPair();
const pub = b64(kp.publicKey);
const sec = b64(kp.secretKey);

const blocks = [{ id:'block:smoke', type:'doc', title:'Smoke', content:'Test', version:'v1', updated_at:new Date().toISOString() }];
const feed = buildFeed({ site:'smoke.test', blocks, secretKeyBase64: sec });
fs.writeFileSync('smoke-feed.json', JSON.stringify(feed, null, 2));

const subset = { site: feed.site, generated_at: feed.generated_at, items: feed.items };
const ok = verifyFeedSignature(subset, feed.signature, pub);
if (!ok) {
  console.error('Smoke verify FAILED');
  process.exit(1);
}
console.log('Smoke verify OK');
console.log('PublicKey(Base64)=', pub);
