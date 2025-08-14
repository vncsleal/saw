import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const result = spawnSync('npx', ['vitest', 'run', '--coverage'], { stdio:'inherit' });
if (result.status !== 0) process.exit(result.status||1);
let summary;
const summaryPath = './coverage/coverage-summary.json';
if (fs.existsSync(summaryPath)) {
  summary = JSON.parse(fs.readFileSync(summaryPath,'utf8'));
} else {
  // Attempt to derive from lcov as fallback (very naive parser)
  const lcovPath = './coverage/lcov.info';
  if (!fs.existsSync(lcovPath)) { console.error('Coverage summary not found'); process.exit(1); }
  const lcov = fs.readFileSync(lcovPath,'utf8');
  const lines = lcov.split(/\n/);
  let totalLinesFound=0,totalLinesHit=0,totalFuncsFound=0,totalFuncsHit=0, totalBranchesFound=0,totalBranchesHit=0;
  for (const line of lines) {
    if (line.startsWith('LF:')) totalLinesFound += parseInt(line.slice(3),10)||0;
    if (line.startsWith('LH:')) totalLinesHit += parseInt(line.slice(3),10)||0;
    if (line.startsWith('FNF:')) totalFuncsFound += parseInt(line.slice(4),10)||0;
    if (line.startsWith('FNH:')) totalFuncsHit += parseInt(line.slice(4),10)||0;
    if (line.startsWith('BRF:')) totalBranchesFound += parseInt(line.slice(4),10)||0;
    if (line.startsWith('BRH:')) totalBranchesHit += parseInt(line.slice(4),10)||0;
  }
  summary = { total: {
    lines: { pct: totalLinesFound? (totalLinesHit/totalLinesFound*100):100 },
    statements: { pct: totalLinesFound? (totalLinesHit/totalLinesFound*100):100 },
    functions: { pct: totalFuncsFound? (totalFuncsHit/totalFuncsFound*100):100 },
    branches: { pct: totalBranchesFound? (totalBranchesHit/totalBranchesFound*100):100 }
  }};
}
const coreKeys = Object.keys(summary).filter(k=>k.includes('packages/core/src'));
let total = { lines:{ pct:0 }, statements:{ pct:0 }, functions:{ pct:0 }, branches:{ pct:0 } };
// Use total from summary if present
if (summary.total) total = summary.total; else if (coreKeys.length) {
  // Compute simple average
  const agg = { lines:0, statements:0, functions:0, branches:0 };
  for (const k of coreKeys) {
    agg.lines += summary[k].lines.pct;
    agg.statements += summary[k].statements.pct;
    agg.functions += summary[k].functions.pct;
    agg.branches += summary[k].branches.pct;
  }
  total.lines.pct = agg.lines / coreKeys.length;
  total.statements.pct = agg.statements / coreKeys.length;
  total.functions.pct = agg.functions / coreKeys.length;
  total.branches.pct = agg.branches / coreKeys.length;
}
const thresholds = {
  lines: parseInt(process.env.COV_LINES||'95',10),
  statements: parseInt(process.env.COV_STATEMENTS||'95',10),
  functions: parseInt(process.env.COV_FUNCTIONS||'85',10),
  branches: parseInt(process.env.COV_BRANCHES||'80',10)
};
const failed = Object.entries({
  lines: total.lines.pct,
  statements: total.statements.pct,
  functions: total.functions.pct,
  branches: total.branches.pct
}).filter(([k,v])=>v < thresholds[k]);
if (failed.length) {
  console.error('Coverage below threshold(s)', failed, 'thresholds', thresholds);
  process.exit(1);
}
console.log('Coverage OK thresholds', thresholds, total);
