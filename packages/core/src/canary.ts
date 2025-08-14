import crypto from 'node:crypto';
import { Block } from './schemas.js';

export interface CanaryOptions {
  secret: string; // HMAC secret
  id: string;     // block id
  version: string; // block version
  length?: number; // length of base62 output (default 10)
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toBase62(buf: Buffer): string {
  const big = BigInt('0x' + buf.toString('hex'));
  let x = big;
  let out = '';
  const base = 62n;
  while (x > 0n) { const r = x % base; out = BASE62[Number(r)] + out; x = x / base; }
  return out || '0';
}

export function generateStaticCanary(opts: CanaryOptions & { salt?: string }): string {
  const { secret, id, version, salt } = opts;
  const h = crypto.createHmac('sha256', secret).update(id + '|' + version + (salt ? '|' + salt : '')).digest();
  const b62 = toBase62(h).replace(/^[0O]+/, '');
  const len = opts.length ?? 10;
  return b62.slice(0, len);
}

export interface EventEmitterLike { emit(event: string, payload: unknown): void; }
export class SimpleEventEmitter implements EventEmitterLike {
  emit(event: string, payload: unknown) {
    const data = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : { payload };
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + '\n');
  }
}

export function enrichBlocksWithCanaries(blocks: Block[], secret: string, emitter?: EventEmitterLike, salt?: string) {
  return blocks.map(b => {
  const canary = generateStaticCanary({ secret, id: b.id, version: b.version, salt });
    emitter?.emit('canary.issued', { id: b.id, version: b.version, canary });
    return { ...b, canary };
  });
}
