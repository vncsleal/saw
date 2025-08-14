#!/usr/bin/env node
/**
 * Append synthetic canonicalization fixtures up to target count (default 200).
 * Will not duplicate existing names. Skips if already >= target.
 */
import fs from 'node:fs';
import path from 'node:path';
import { hashCanonical } from '../packages/cli/dist/api.js';

const TARGET = parseInt(process.env.FIXTURE_TARGET || '200', 10);
const fixturesPath = path.join(process.cwd(),'canonicalization-fixtures','fixtures.json');
if (!fs.existsSync(fixturesPath)) {
  console.error('fixtures.json not found');
  process.exit(1);
}
const fixtures = JSON.parse(fs.readFileSync(fixturesPath,'utf8'));
if (fixtures.length >= TARGET) {
  console.log('Already have', fixtures.length, 'fixtures (>= target)');
  process.exit(0);
}
const existingNames = new Set(fixtures.map(f=>f.name));

function add(name, input) {
  if (existingNames.has(name)) return;
  fixtures.push({ name, input });
  existingNames.add(name);
}

// Generators
const unicodeSets = [
  '😀😃😄😁😆😅😂🤣',
  '👩‍🚀🚀🌕⭐️✨',
  '𝔘𝔫𝔦𝔠𝔬𝔡𝔢𝔘𝔫𝔲𝔰𝔲𝔞𝔩',
  '🇺🇳🇺🇸🇯🇵🇨🇦',
  'éêèë (combining)',
  '\u202Ertl test\u202C end'
];

function numberVariants(i) {
  return {
    small: i / 1000,
    negSmall: -i / 1000,
    pow10: 10 ** (i % 10),
    frac: 1 / (i+1),
    mix: [i, i+0.12345, -(i+0.54321), Number((Math.PI * i).toFixed(8))]
  };
}

function deepObj(depth) {
  let o = { leaf: depth };
  for (let d=depth-1; d>=0; d--) o = { ['k'+d]: o };
  return o;
}

function mixedArray(i) {
  return [i, { a:i, b:i.toString() }, [i, i+1, { nested:true }], 's'+i, i%2===0, null];
}

let counter = 0;
for (let i=0; fixtures.length < TARGET && i < 5000; i++) {
  // Number variant fixtures
  add(`auto-num-${i}`, numberVariants(i));
  if (fixtures.length >= TARGET) break;
  // Deep object every 7th
  if (i % 7 === 0) add(`auto-deep-${i}`, deepObj( (i % 6) + 2));
  if (fixtures.length >= TARGET) break;
  // Mixed array
  add(`auto-mixarr-${i}`, { arr: mixedArray(i), idx:i });
  if (fixtures.length >= TARGET) break;
  // Unicode rotation
  if (i < unicodeSets.length) add(`auto-unicode-${i}`, { text: unicodeSets[i] });
  if (fixtures.length >= TARGET) break;
  // Key ordering stress: shuffle keys
  const keys = ['alpha','beta','gamma','delta','epsilon','zeta','eta','theta'];
  const shuffled = [...keys].sort(()=>Math.random()-0.5);
  const obj = {};
  shuffled.forEach((k,ki)=>obj[k]=ki + i);
  add(`auto-keys-${i}`, obj);
  // Sparse-ish object with numeric-like keys
  add(`auto-numeric-keys-${i}`, { '0': i, '10': i+10, '2': i+2, '01': 'lead', A:i%3 });
  // Nested arrays complexity
  if (i % 5 === 0) add(`auto-nested-arr-${i}`, { nest: [[[i],[i+1,[i+2]]]] });
  // Escapes & control chars
  if (i % 11 === 0) add(`auto-esc-${i}`, { s: `line1\nline2\t${i}`, quote: '"' + i + '"' });
  counter++;
}

// Backfill canonical + sha256 for any fixture missing them (locks determinism)
let backfilled = 0;
for (const f of fixtures) {
  if (!f.canonical || !f.sha256) {
    const { canonical, sha256 } = hashCanonical(f.input);
    f.canonical = canonical;
    f.sha256 = sha256;
    backfilled++;
  }
}
fs.writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2));
console.log('Fixture expansion complete:', fixtures.length, 'total (added', counter, '), backfilled canonical fields', backfilled);
