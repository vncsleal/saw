#!/usr/bin/env node
import { generateKeyPair } from 'saw-core';

function b64(u: Uint8Array) { return Buffer.from(u).toString('base64'); }

const kp = generateKeyPair();
console.log('# SAW Ed25519 Key Pair (DO NOT COMMIT SECRET)');
console.log('PUBLIC_KEY=' + b64(kp.publicKey));
console.log('SECRET_KEY=' + b64(kp.secretKey));
