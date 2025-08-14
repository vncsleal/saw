import fs from 'node:fs';
import path from 'node:path';
import { hashCanonical } from '../packages/cli/dist/core/canonicalize.js';

const fixturesPath = path.join(process.cwd(),'canonicalization-fixtures','fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath,'utf8'));
for (const f of fixtures) {
  const { canonical, sha256 } = hashCanonical(f.input);
  f.canonical = canonical;
  f.sha256 = sha256;
}
fs.writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2));
console.log('Updated fixtures with canonical + sha256');
