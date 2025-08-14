import nacl from 'tweetnacl';
import { canonicalize } from './canonicalize.js';

export interface KeyPair { publicKey: Uint8Array; secretKey: Uint8Array; }
export function generateKeyPair(): KeyPair { return nacl.sign.keyPair(); }
export function signFeed(feedSubset: unknown, secretKeyB64: string): string {
	const key = Buffer.from(secretKeyB64,'base64');
	if (key.length!==64) throw new Error('SECRET_KEY must be 64 bytes');
	const canonical = canonicalize(feedSubset);
	const sig = nacl.sign.detached(Buffer.from(canonical), key);
	return Buffer.from(sig).toString('base64');
}
export function verifyFeedSignature(feedSubset: unknown, signatureB64: string, publicKeyB64: string): boolean {
	const pubKey = Buffer.from(publicKeyB64,'base64');
	const canonical = canonicalize(feedSubset);
	const sig = Buffer.from(signatureB64,'base64');
	return nacl.sign.detached.verify(Buffer.from(canonical), sig, pubKey);
}
