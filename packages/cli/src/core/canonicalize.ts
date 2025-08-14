// Canonicalization utilities
/**
 * SAW canonical-json/1 implementation (Phase 1 subset).
 */
export function canonicalize(value: unknown): string { return canon(value); }
function canon(v: unknown): string {
	if (v === null) return 'null';
	const t = typeof v;
	if (t === 'number') {
		if (!Number.isFinite(v)) throw new Error('Non-finite numbers not allowed');
		let s = String(v);
		if (s.includes('e') || s.includes('E')) s = expandExponent(s);
		if (s.includes('.')) {
			s = s.replace(/\.0+$/, '');
			s = s.replace(/(\.\d*?)0+$/, '$1');
			if (s.endsWith('.')) s = s.slice(0,-1);
		}
		return s;
	}
	if (t === 'string') return JSON.stringify(v);
	if (t === 'boolean') return v ? 'true' : 'false';
	if (Array.isArray(v)) return '[' + (v as unknown[]).map(canon).join(',') + ']';
	if (t === 'object') {
		const obj = v as Record<string, unknown>;
		const keys = Object.keys(obj).sort();
		const parts: string[] = [];
		for (const k of keys) parts.push(JSON.stringify(k)+':'+canon(obj[k]));
		return '{' + parts.join(',') + '}';
	}
	throw new Error('Unsupported type: ' + t);
}
function expandExponent(s: string): string {
	const m = s.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
	if (!m) return s;
	const sign = m[1]; let intPart = m[2]; let fracPart = m[3]||''; let exp = parseInt(m[4],10);
	if (exp === 0) return sign + intPart + (fracPart ? '.'+fracPart : '');
	if (exp > 0) {
		while (exp > 0 && fracPart.length) { intPart += fracPart[0]; fracPart = fracPart.slice(1); exp--; }
		if (exp > 0) intPart = intPart + '0'.repeat(exp);
		return sign + intPart + (fracPart.length ? '.'+fracPart : '');
	} else {
		exp = -exp;
		while (exp > 0) {
			if (intPart.length === 0) { fracPart = '0' + fracPart; }
			else { fracPart = intPart[intPart.length-1] + fracPart; intPart = intPart.slice(0,-1); }
			exp--;
		}
		if (!intPart) intPart = '0';
		intPart = intPart.replace(/^0+/, '') || '0';
		return sign + intPart + '.' + fracPart;
	}
}
import crypto from 'node:crypto';
export function sha256Hex(input: string): string { return crypto.createHash('sha256').update(input,'utf8').digest('hex'); }
export function hashCanonical(value: unknown) { const c = canonicalize(value); return { canonical: c, sha256: sha256Hex(c) }; }
