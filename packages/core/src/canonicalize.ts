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
  // Minimal stub; Phase 1 will supply full implementation; currently returns numeric string unchanged.
  return Number(s).toString();
}

import crypto from 'crypto';
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashCanonical(value: unknown) {
  const c = canonicalize(value);
  return { canonical: c, sha256: sha256Hex(c) };
}
