import crypto from 'node:crypto';

export interface ApiKeyRecord {
  id: string; // public id
  secretHash: string; // hex sha256 of secret
  salt: string; // short salt derived from hash
}

export function generateApiKey(): { id: string; secret: string; record: ApiKeyRecord } {
  const id = 'key_' + crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const secretHash = sha256HexRaw(secret);
  const salt = secretHash.slice(0, 8);
  return { id, secret, record: { id, secretHash, salt } };
}

export function sha256HexRaw(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function computeRequestSignature(secret: string, method: string, path: string, body: string, timestamp: string): string {
  const h = crypto.createHmac('sha256', secret).update([method.toUpperCase(), path, timestamp, body].join('\n'));
  return h.digest('hex');
}

export interface VerifyResult { ok: boolean; code: string; message: string; }

export function verifyRequestSignature(rec: ApiKeyRecord, secret: string, headers: Record<string,string | undefined>, method: string, path: string, body: string, maxSkewMs = 120000): VerifyResult {
  const apiKey = headers['x-api-key'];
  const sig = headers['x-sig'];
  const ts = headers['x-timestamp'];
  if (!apiKey || apiKey !== rec.id) return { ok:false, code:'NO_KEY', message:'Missing or bad X-API-KEY' };
  if (!sig) return { ok:false, code:'NO_SIG', message:'Missing X-SIG' };
  if (!ts) return { ok:false, code:'NO_TS', message:'Missing X-TIMESTAMP' };
  const skew = Math.abs(Date.now() - Date.parse(ts));
  if (isNaN(skew) || skew > maxSkewMs) return { ok:false, code:'SKEW', message:'Timestamp skew' };
  const expected = computeRequestSignature(secret, method, path, body, ts);
  if (!timingSafeEqualHex(expected, sig)) return { ok:false, code:'BAD_SIG', message:'Signature mismatch' };
  return { ok:true, code:'OK', message:'Valid' };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
