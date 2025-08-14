import { describe, it, expect } from 'vitest';
import { generateApiKey, computeRequestSignature, verifyRequestSignature } from './index.js';

function mockHeaders(h: Record<string,string>): Record<string,string> { return h; }

describe('auth HMAC', () => {
  it('accepts valid signature within skew', () => {
    const { id, secret, record } = generateApiKey();
    const ts = new Date().toISOString();
    const body = '{"x":1}';
    const sig = computeRequestSignature(secret, 'POST', '/api/saw/feed', body, ts);
    const headers = mockHeaders({ 'x-api-key': id, 'x-sig': sig, 'x-timestamp': ts });
    const result = verifyRequestSignature(record, secret, headers, 'POST', '/api/saw/feed', body);
    expect(result.ok).toBe(true);
  });
  it('rejects bad signature', () => {
    const { id, secret, record } = generateApiKey();
    const ts = new Date().toISOString();
    const body = '{"x":1}';
    const headers = mockHeaders({ 'x-api-key': id, 'x-sig': 'deadbeef', 'x-timestamp': ts });
    const result = verifyRequestSignature(record, secret, headers, 'POST', '/api/saw/feed', body);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('BAD_SIG');
  });
  it('rejects timestamp skew', () => {
    const { id, secret, record } = generateApiKey();
    const past = new Date(Date.now() - 3600_000).toISOString();
    const body = '{"x":1}';
    const sig = computeRequestSignature(secret, 'POST', '/api/saw/feed', body, past);
    const headers = mockHeaders({ 'x-api-key': id, 'x-sig': sig, 'x-timestamp': past });
    const result = verifyRequestSignature(record, secret, headers, 'POST', '/api/saw/feed', body, 1000);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SKEW');
  });
});
