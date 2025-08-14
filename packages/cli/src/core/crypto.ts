import nacl from 'tweetnacl';
import { canonicalize } from './canonicalize.js';
import crypto from 'node:crypto';

export interface KeyPair { publicKey: Uint8Array; secretKey: Uint8Array; }
export function generateKeyPair(): KeyPair { return nacl.sign.keyPair(); }
export function generateKeyPairFromSeed(seed: string): KeyPair { const h = crypto.createHash('sha256').update(seed,'utf8').digest(); const seed32 = new Uint8Array(h.slice(0,32)); return nacl.sign.keyPair.fromSeed(seed32); }
export function signDetached(message: Uint8Array, secretKey: Uint8Array): Uint8Array { return nacl.sign.detached(message, secretKey); }
export function verifyDetached(message: Uint8Array, sig: Uint8Array, publicKey: Uint8Array): boolean { return nacl.sign.detached.verify(message, sig, publicKey); }
export function signFeed(feedSubset: unknown, secretKeyB64: string): string { const key = Buffer.from(secretKeyB64,'base64'); if (key.length!==64) throw new Error('SECRET_KEY must be 64 bytes'); const canonical = canonicalize(feedSubset); const sig = signDetached(Buffer.from(canonical), key); return Buffer.from(sig).toString('base64'); }
export function verifyFeedSignature(feedSubset: unknown, signatureB64: string, publicKeyB64: string): boolean { const pubKey = Buffer.from(publicKeyB64,'base64'); const canonical = canonicalize(feedSubset); const sig = Buffer.from(signatureB64,'base64'); return verifyDetached(Buffer.from(canonical), sig, pubKey); }
