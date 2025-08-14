import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import { generateKeyPairFromSeed, buildFeed, generateLlmsTxt, Feed } from 'saw-core';
import { verifyRemote } from '../src/verify.js';
import { createHash } from 'node:crypto';

let server: Server;
let port: number;
let goodFeed: Feed;
let tamperedFeed: Feed;
let publicKeyB64: string;

beforeAll(async () => {
  const kp = generateKeyPairFromSeed('remote-verify-seed');
  publicKeyB64 = Buffer.from(kp.publicKey).toString('base64');
  const secretKeyB64 = Buffer.from(kp.secretKey).toString('base64');
  const blocks = [
    { id:'block:rv', type:'doc', title:'Remote Verify', content:'Test', version:'v1', updated_at:'2025-01-01T00:00:00.000Z' }
  ];
  goodFeed = buildFeed({ site:'remote.test', blocks, secretKeyBase64: secretKeyB64 });
  // tampered: flip one char in signature
  tamperedFeed = { ...goodFeed, signature: 'A'+goodFeed.signature.slice(1) } as Feed;
  const fp = createHash('sha256').update(Buffer.from(publicKeyB64,'base64')).digest('hex').slice(0,8);
  const llmsTemplate = generateLlmsTxt({ site:'remote.test', feedUrl:'http://localhost:0/api/saw/feed', publicKeyFingerprint:`ed25519:${fp}`, publicKey: publicKeyB64 });

  server = createServer((req,res)=>{
    if (req.url === '/api/saw/feed') {
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify(goodFeed));
    } else if (req.url === '/api/saw/feed-tampered') {
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify(tamperedFeed));
    } else if (req.url === '/.well-known/llms.txt') {
      const adjusted = llmsTemplate.replace('http://localhost:0/api/saw/feed', `http://localhost:${port}/api/saw/feed`);
      res.setHeader('content-type','text/plain');
      res.end(adjusted);
    } else if (req.url === '/.well-known/llms-tampered.txt') {
      const adjusted = llmsTemplate.replace('http://localhost:0/api/saw/feed', `http://localhost:${port}/api/saw/feed-tampered`);
      res.setHeader('content-type','text/plain');
      res.end(adjusted);
    } else {
      res.statusCode = 404; res.end('not found');
    }
  });
  await new Promise<void>(resolve => { server.listen(0, ()=>{ const addr = server.address(); if (typeof addr === 'object' && addr) port = addr.port; resolve(); }); });
});

afterAll(()=>{ server.close(); });

describe('verifyRemote integration', ()=>{
  it('verifies valid remote feed', async () => {
    const result = await verifyRemote(`localhost:${port}`, publicKeyB64);
    expect(result.ok).toBe(true);
    expect(result.code).toBe(0);
  });
  it('fails on tampered signature', async () => {
    // For tampered case, temporarily swap server handler for /api/saw/feed
    const originalGood = goodFeed;
    goodFeed = tamperedFeed; // server will now serve tampered at /api/saw/feed
    const result = await verifyRemote(`localhost:${port}`, publicKeyB64);
    expect(result.ok).toBe(false);
    expect(result.code).toBe(2);
    goodFeed = originalGood; // restore
  });
});
