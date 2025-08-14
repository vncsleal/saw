import { hashCanonical } from '../packages/core/dist/canonicalize.js';

const sample = { pricing:{ plans:[{name:'pro',usd:49.00},{name:'team',usd:129.0}]}, updated_at:'2025-08-14T00:00:00Z' };
const results = [];
for (let i=0;i<5;i++) {
  results.push(hashCanonical(sample));
}
const allCanonicalEqual = results.every(r=>r.canonical===results[0].canonical);
const allHashesEqual = results.every(r=>r.sha256===results[0].sha256);
if (!allCanonicalEqual || !allHashesEqual) {
  console.error('Determinism check FAILED', results);
  process.exit(1);
}
console.log('Determinism OK', results[0]);
