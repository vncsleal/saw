import { buildFeed, generateKeyPair } from '../packages/core/dist/index.js';
import fs from 'node:fs';

function makeBlocks(n) {
  const now = new Date().toISOString();
  const arr = [];
  for (let i=0;i<n;i++) {
    arr.push({ id:`block:${i}`, type:'doc', title:`Title ${i}`, content:'x'.repeat(200), version:'v1', updated_at: now });
  }
  return arr;
}

const sizes = [1,10,50,100,250,500];
const kp = generateKeyPair();
const secretKeyBase64 = Buffer.from(kp.secretKey).toString('base64');

console.log('# feed build benchmark');
for (const n of sizes) {
  const blocks = makeBlocks(n);
  const start = performance.now();
  buildFeed({ site:'bench.local', blocks, secretKeyBase64 });
  const dur = performance.now() - start;
  console.log(`${n}\t${dur.toFixed(2)}ms`);
}
