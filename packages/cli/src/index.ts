#!/usr/bin/env node
import { canonicalize, hashCanonical, generateKeyPair, buildFeed, generateLlmsTxt } from '@saw/core';
import { verifyRemote, verifyLocal } from './verify.js';
import fs from 'node:fs';
import path from 'node:path';

function printHelp() {
  console.log(`SAW CLI (early scaffold)\nCommands:\n  canon <json>        Canonicalize inline JSON string\n  hash <json>         Canonicalize + SHA256 hash\n  keygen              Generate Ed25519 key pair\n  init                Scaffold config & sample block\n  generate <site>     Build signed feed from content/blocks\n  verify <feed.json|site> <publicKeyBase64>  Verify local file or remote site\n  help                Show help`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }
  const inputRaw = rest.join(' ');
  try {
    switch (cmd) {
      case 'canon': {
        const value = JSON.parse(inputRaw);
        console.log(canonicalize(value));
        break;
      }
      case 'hash': {
        const value = JSON.parse(inputRaw);
        const { canonical, sha256 } = hashCanonical(value);
        console.log(canonical + '\n' + sha256);
        break;
      }
      case 'keygen': {
        const kp = generateKeyPair();
        console.log('# SAW Ed25519 Key Pair (DON\'T COMMIT SECRET)');
        console.log('PUBLIC_KEY=' + Buffer.from(kp.publicKey).toString('base64'));
        console.log('SECRET_KEY=' + Buffer.from(kp.secretKey).toString('base64'));
        break;
      }
      case 'init': {
        fs.mkdirSync('content/blocks', { recursive: true });
        const samplePath = 'content/blocks/sample.json';
        if (!fs.existsSync(samplePath)) {
          fs.writeFileSync(samplePath, JSON.stringify({ id:'block:sample', type:'doc', title:'Sample', content:'Hello', version:'v1', updated_at:new Date().toISOString() }, null, 2));
          console.log('Created', samplePath);
        } else {
          console.log('Sample block already exists');
        }
        break;
      }
      case 'generate': {
        const site = rest[0] || 'example.com';
        const secretKey = process.env.SAW_SECRET_KEY;
        if (!secretKey) {
          console.error('Missing SAW_SECRET_KEY environment variable');
          process.exit(1);
        }
        const blocksDir = 'content/blocks';
        const files = fs.readdirSync(blocksDir).filter(f=>f.endsWith('.json'));
        const blocks = files.map(f=>JSON.parse(fs.readFileSync(path.join(blocksDir,f),'utf8')));
        const feed = buildFeed({ site, blocks, secretKeyBase64: secretKey });
        fs.writeFileSync('feed.json', JSON.stringify(feed, null, 2));
        // fingerprint: first 8 hex bytes of sha256 of public key
        const pubKey = process.env.SAW_PUBLIC_KEY;
        if (pubKey) {
          const crypto = await import('node:crypto');
          const hash = crypto.createHash('sha256');
          hash.update(Buffer.from(pubKey,'base64'));
          const fp = hash.digest('hex').slice(0,8);
          const llms = generateLlmsTxt({ site, feedUrl:`https://${site}/api/saw/feed`, publicKeyFingerprint:`ed25519:${fp}`, publicKey: pubKey });
          fs.mkdirSync('.well-known',{recursive:true});
          fs.writeFileSync('.well-known/llms.txt', llms);
        } else {
          console.warn('SAW_PUBLIC_KEY not set; skipping llms.txt');
        }
        console.log('Wrote feed.json with', feed.items.length, 'items');
        break;
      }
      case 'verify': {
        const target = rest[0];
        const pubKey = rest[1];
        if (!target || !pubKey) {
          console.error('Usage: saw verify <feed.json|site> <publicKeyBase64>');
          process.exit(1);
        }
        const isFile = fs.existsSync(target) && target.endsWith('.json');
        if (isFile) {
          const result = verifyLocal(target, pubKey);
          console.log(result.message);
          process.exit(result.code);
        } else {
          const result = await verifyRemote(target, pubKey);
          console.log(result.message);
          process.exit(result.code);
        }
      }
  break;
  default:
        console.error('Unknown command: ' + cmd);
        printHelp();
        process.exit(1);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Error:', msg);
    process.exit(1);
  }
}

main();
