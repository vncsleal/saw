import crypto from 'node:crypto';

/**
 * Canonicalize a JS value according to SAW canonical-json/1 rules.
 * Rules subset implemented:
 *  - UTF-8 implied by JS strings
 *  - Objects: lexicographically sorted keys
 *  - Arrays: preserve order
 *  - Numbers: shortest decimal (no trailing zeros, no exponent for small values)
 *  - No escaping of '/' beyond JSON default (JSON.stringify already doesn't escape '/')
 *  - Exclude signature fields handled by caller
 */
export function canonicalize(value) {
  return _canon(value);
}

function _canon(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new Error('Non-finite numbers not allowed');
    // Convert to shortest decimal
    let s = String(v);
    if (s.includes('e') || s.includes('E')) {
      // Expand exponent to decimal plain form
      s = expandExponent(s);
    }
    // Remove trailing zeros in fraction
    if (s.includes('.')) {
      s = s.replace(/\.0+$/, ''); // remove .0
      s = s.replace(/(\.\d*?)0+$/, '$1'); // remove trailing zeros
      if (s.endsWith('.')) s = s.slice(0, -1);
    }
    return s;
  }
  if (t === 'string') {
    return JSON.stringify(v);
  }
  if (t === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    return '[' + v.map(_canon).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(v).sort();
    const parts = [];
    for (const k of keys) {
      parts.push(JSON.stringify(k) + ':' + _canon(v[k]));
    }
    return '{' + parts.join(',') + '}';
  }
  throw new Error('Unsupported type: ' + t);
}

function expandExponent(s) {
  // Convert something like 1e-6 or 1.2e+5 to plain decimal
  const m = s.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!m) return s; // not exponent form we handle
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
    return sign + intPart + (fracPart.length ? '.' + fracPart : '');
  } else {
    // shift decimal left
    exp = -exp;
    while (exp > 0 && intPart.length > 0) {
      fracPart = intPart[intPart.length - 1] + fracPart;
      intPart = intPart.slice(0, -1);
      exp--;
    }
    if (exp > 0) {
      // need to pad zeros at front
      fracPart = '0'.repeat(exp) + fracPart;
      intPart = '0';
    }
    // remove leading zeros in intPart
    intPart = intPart.replace(/^0+/, '') || '0';
    return sign + '0.' + fracPart.replace(/0+$/, (tail) => tail.length === fracPart.length ? '' : tail); // trailing zeros trimmed later higher
  }
}

export function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

export function hashCanonical(value) {
  const c = canonicalize(value);
  return { canonical: c, sha256: sha256Hex(c) };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  // quick manual test
  const sample = { b: 1, a: 2 };
  const { canonical, sha256 } = hashCanonical(sample);
  console.log(canonical, sha256);
}
