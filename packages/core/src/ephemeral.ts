import crypto from 'node:crypto';

// Ephemeral canary tokens: c-<base62>
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function randomBase62(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i=0;i<bytes.length;i++) out += BASE62[bytes[i] % 62];
  return out;
}

export interface EphemeralRecord { token: string; requestId: string; ts: number; }

export class EphemeralCanaryStore {
  private ttlMs: number;
  private map = new Map<string, EphemeralRecord>();
  constructor(ttlMs = 10 * 60 * 1000) { this.ttlMs = ttlMs; }
  issue(requestId: string): string {
    const token = 'c-' + randomBase62(10);
    const rec: EphemeralRecord = { token, requestId, ts: Date.now() };
    this.map.set(token, rec);
    return token;
  }
  private sweep(now = Date.now()) {
    for (const [tok, rec] of this.map.entries()) {
      if (now - rec.ts > this.ttlMs) this.map.delete(tok);
    }
  }
  lookup(token: string): EphemeralRecord | undefined {
    this.sweep();
    const rec = this.map.get(token);
    if (!rec) return undefined;
    if (Date.now() - rec.ts > this.ttlMs) { this.map.delete(token); return undefined; }
    return rec;
  }
  size() { this.sweep(); return this.map.size; }
}

// Detector utility
export interface DetectResult { tokens: string[]; unique: string[]; count: number; classification: string; }

const DEFAULT_REGEX = /c-[A-Za-z0-9]{8,12}/g;

export function detectCanaries(text: string, pattern: RegExp = DEFAULT_REGEX): DetectResult {
  const matches = text.match(pattern) || [];
  const unique = Array.from(new Set(matches));
  let classification = 'none';
  if (unique.length === 1) classification = 'single';
  else if (unique.length > 1) classification = 'multiple';
  return { tokens: matches, unique, count: matches.length, classification };
}
