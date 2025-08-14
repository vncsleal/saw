import nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  return nacl.sign.keyPair();
}

export function signDetached(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, secretKey);
}

export function verifyDetached(message: Uint8Array, sig: Uint8Array, publicKey: Uint8Array): boolean {
  return nacl.sign.detached.verify(message, sig, publicKey);
}
