import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, hashCanonical } from './canonicalize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vectorsPath = path.join(__dirname, '..', 'test-vectors', 'canonicalization.json');
const raw = fs.readFileSync(vectorsPath, 'utf8');
const data = JSON.parse(raw);
let failures = 0;

for (const v of data.vectors) {
  const { canonical, sha256 } = hashCanonical(v.input);
  if (canonical !== v.canonical) {
    console.error(`FAIL canonical mismatch for ${v.name}\n expected: ${v.canonical}\n got:      ${canonical}`);
    failures++;
  } else if (sha256 !== v.sha256) {
    console.error(`FAIL hash mismatch for ${v.name}\n expected: ${v.sha256}\n got:      ${sha256}`);
    failures++;
  } else {
    console.log(`PASS ${v.name}`);
  }
}

if (failures) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll canonicalization vectors passed.');
}
