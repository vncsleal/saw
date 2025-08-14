import crypto from 'node:crypto';
import { canonicalize } from './canonicalize.js';

export interface AuthHeadersOptions { method: string; path: string; body?: unknown; publicKey: string; secret: string; }
export function buildAuthHeaders(opts: AuthHeadersOptions) { const { method, path, body, publicKey, secret } = opts; const timestamp = new Date().toISOString(); const payload = { method: method.toUpperCase(), path, body: body ?? null, timestamp, publicKey }; const canonical = canonicalize(payload); const hmac = crypto.createHmac('sha256', Buffer.from(secret,'base64')).update(canonical).digest('base64'); return { 'x-saw-timestamp': timestamp, 'x-saw-public-key': publicKey, 'x-saw-signature': hmac }; }
