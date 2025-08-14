/**
 * SAW canonical-json/1 implementation (Phase 0 stub -> Phase 1 complete rules)
 * Rules implemented now: object key sort, arrays preserve order, numbers shortest decimal (basic), primitives.
 * TODO Phase 1: forbid scientific notation by expanding; refine number trimming logic identical to JS reference vectors.
 */
export function canonicalize(value: unknown): string {
  return canon(value);
}

function canon(v: any): string {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new Error('Non-finite numbers not allowed');
    let s = String(v);
    if (s.includes('e') || s.includes('E')) {
      // placeholder; Phase 1 will expand exponent deterministically
      s = expandExponent(s);
    }
    if (s.includes('.')) {
      s = s.replace(/\.0+$/, '');
      s = s.replace(/(\.\d*?)0+$/, '$1');
      if (s.endsWith('.')) s = s.slice(0, -1);
    }
    return s;
  }
  if (t === 'string') return JSON.stringify(v);
  if (t === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (t === 'object') {
    const keys = Object.keys(v).sort();
    const parts: string[] = [];
    for (const k of keys) parts.push(JSON.stringify(k) + ':' + canon(v[k]));
    return '{' + parts.join(',') + '}';
  }
  throw new Error('Unsupported type: ' + t);
}

function expandExponent(s: string): string {
  // Convert exponent form to plain decimal without scientific notation.
  const m = s.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!m) return s; // not exponent form
  const sign = m[1];
  let intPart = m[2];
  let fracPart = m[3] || '';
  let exp = parseInt(m[4], 10);
  if (exp === 0) return sign + intPart + (fracPart ? '.' + fracPart : '');
  if (exp > 0) {
    // shift decimal right
    while (exp > 0 && fracPart.length) {
      intPart += fracPart[0];
      fracPart = fracPart.slice(1);
      exp--;
    }
    if (exp > 0) intPart = intPart + '0'.repeat(exp);
  const out = sign + intPart + (fracPart.length ? '.' + fracPart : '');
  return out;
  } else {
    exp = -exp; // negative exponent -> shift decimal left
    // Move digits from intPart into fracPart
    while (exp > 0) {
      if (intPart.length === 0) {
        fracPart = '0' + fracPart;
      } else {
        fracPart = intPart[intPart.length - 1] + fracPart;
        intPart = intPart.slice(0, -1);
      }
      exp--;
    }
    if (intPart.length === 0) intPart = '0';
    // Trim leading zeros in intPart but keep at least one
    intPart = intPart.replace(/^0+/, '') || '0';
    // Remove trailing zeros from fracPart then trailing dot handled by caller
    // We cannot remove them here yet since we want canonical decimal trimming logic later.
  const out = sign + intPart + '.' + fracPart;
  return out; // trailing zero trimming occurs in caller
  }
}

import crypto from 'crypto';
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashCanonical(value: unknown) {
  const c = canonicalize(value);
  return { canonical: c, sha256: sha256Hex(c) };
}
