#!/usr/bin/env node
import { canonicalize, hashCanonical, generateKeyPair, buildFeed, generateLlmsTxt, generateApiKey, verifySignedDiff, detectCanaries } from '@saw/core';
import { SimpleEventEmitter } from '@saw/core';
import { verifyRemote, verifyLocal } from './verify.js';
import fs from 'node:fs';
import path from 'node:path';

function printHelp() {
  console.log(`SAW CLI (early scaffold)\nCommands:\n  canon <json|file>           Canonicalize inline JSON string OR JSON file path\n  hash <json>                 Canonicalize + SHA256 hash\n  keygen                      Generate Ed25519 key pair\n  keygen-api                  Generate HMAC API key (Phase 3)\n  list-api                    List local API key IDs\n  init                        Scaffold config & sample block\n  generate <site>             Build signed feed from content/blocks\n  verify <feed.json|site> <publicKeyBase64> [--json]  Verify local file or remote site\n  diff <site> <publicKeyBase64> --since <ISO>        Fetch & verify remote diff\n  detect <text|file> [--remote <base>]              Detect canary tokens (optionally map via remote)\n  help                        Show help`);
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
      case 'keygen-api': {
        const { id, secret, record } = generateApiKey();
        // For simplicity, append to a local file .saw-apikeys.json
        const file = '.saw-apikeys.json';
  let arr: Array<{ id:string; secret:string }> = [];
        if (fs.existsSync(file)) arr = JSON.parse(fs.readFileSync(file,'utf8'));
        arr.push({ id, secret });
        fs.writeFileSync(file, JSON.stringify(arr, null, 2));
        console.log('# SAW API Key (store secret securely)');
        console.log('ID=' + id);
        console.log('SECRET=' + secret);
        console.log('SALT=' + record.salt);
        break;
      }
      case 'list-api': {
        const file = '.saw-apikeys.json';
        if (!fs.existsSync(file)) { console.log('No API keys'); break; }
  const arr: Array<{ id:string; secret:string }> = JSON.parse(fs.readFileSync(file,'utf8'));
  console.log(arr.map(k=>k.id).join('\n'));
        break;
      }
      case 'canon': {
        if (!rest.length) {
          console.error('Usage: saw canon <json|file>');
          process.exit(1);
        }
        const arg = rest[0];
        let text: string;
        if (fs.existsSync(arg)) {
          text = fs.readFileSync(arg, 'utf8');
        } else {
          text = inputRaw; // treat as inline JSON
        }
        let value: unknown;
        try { value = JSON.parse(text); } catch (e) { console.error('Invalid JSON'); process.exit(1); }
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
  const eventsFlag = rest.includes('--events');
        const secretKey = process.env.SAW_SECRET_KEY;
        if (!secretKey) {
          console.error('Missing SAW_SECRET_KEY environment variable');
          process.exit(1);
        }
        const blocksDir = 'content/blocks';
        const files = fs.readdirSync(blocksDir).filter(f=>f.endsWith('.json'));
        const blocks = files.map(f=>JSON.parse(fs.readFileSync(path.join(blocksDir,f),'utf8')));
  const canarySecret = process.env.SAW_CANARY_SECRET;
  const emitter = eventsFlag ? new SimpleEventEmitter() : undefined;
  const feed = buildFeed({ site, blocks, secretKeyBase64: secretKey, canarySecret, events: emitter });
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
        const jsonFlag = rest.includes('--json');
        if (!target || !pubKey) {
          console.error('Usage: saw verify <feed.json|site> <publicKeyBase64> [--json]');
          process.exit(1);
        }
        const isFile = fs.existsSync(target) && target.endsWith('.json');
        if (isFile) {
          const result = verifyLocal(target, pubKey);
          console.log(jsonFlag ? JSON.stringify(result) : result.message);
          process.exit(result.code);
        } else {
          const result = await verifyRemote(target, pubKey);
          console.log(jsonFlag ? JSON.stringify(result) : result.message);
          process.exit(result.code);
        }
      }
  break;
      case 'diff': {
        const site = rest[0];
        const pubKey = rest[1];
        const sinceIdx = rest.indexOf('--since');
        const since = sinceIdx !== -1 ? rest[sinceIdx+1] : '';
        const jsonFlag = rest.includes('--json');
        if (!site || !pubKey || !since) {
          console.error('Usage: saw diff <site> <publicKeyBase64> --since <ISO> [--json]');
          process.exit(1);
        }
        let base = site;
        if (!/^https?:\/\//i.test(base)) {
          if (base.startsWith('localhost') || base.includes(':')) base = 'http://' + base; else base = 'https://' + base;
        }
        const url = base.replace(/\/$/, '') + '/api/saw/diff?since=' + encodeURIComponent(since);
        try {
          const res = await fetch(url, { headers:{ 'user-agent':'saw-cli/diff' } });
          if (!res.ok) throw new Error('HTTP '+res.status);
          const txt = await res.text();
          const parsed = JSON.parse(txt);
          if (!parsed.signature) throw new Error('No signature');
          const ok = verifySignedDiff(parsed, pubKey);
          const out = { ok, code: ok?0:2, message: ok?'Diff signature OK':'Diff signature failed', changed: parsed.changed?.length||0, removed: parsed.removed?.length||0 };
          console.log(jsonFlag ? JSON.stringify(out) : out.message + ` (changed=${out.changed} removed=${out.removed})`);
          process.exit(out.code);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (jsonFlag) console.log(JSON.stringify({ ok:false, code:3, message:msg })); else console.error('Error fetching diff:', msg);
          process.exit(3);
        }
      }
  break;
      case 'detect': {
        const target = rest[0];
        if (!target) { console.error('Usage: saw detect <text|file> [--remote <base>]'); process.exit(1); }
        const remoteIdx = rest.indexOf('--remote');
        const remoteBase = remoteIdx !== -1 ? rest[remoteIdx+1] : undefined;
        let text: string;
        if (fs.existsSync(target)) text = fs.readFileSync(target,'utf8'); else {
          // Exclude --remote arguments from inline text
          const filtered: string[] = [];
          for (let i=0;i<rest.length;i++) {
            if (rest[i] === '--remote') { i++; continue; }
            filtered.push(rest[i]);
          }
          text = filtered.join(' ');
        }
  const local = detectCanaries(text);
        if (!remoteBase) {
          console.log(JSON.stringify(local));
          process.exit(0);
        }
        let base = remoteBase;
        if (!/^https?:\/\//i.test(base)) {
          if (base.startsWith('localhost') || base.includes(':')) base = 'http://' + base; else base = 'https://' + base;
        }
        try {
          const res = await fetch(base.replace(/\/$/, '') + '/api/saw/detect', { method:'POST', headers:{ 'content-type':'application/json','user-agent':'saw-cli/detect' }, body: JSON.stringify({ text }) });
          if (!res.ok) throw new Error('HTTP '+res.status);
          const remote = await res.json();
          console.log(JSON.stringify({ local, remote }));
          process.exit(0);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('Remote detection failed:', msg);
          console.log(JSON.stringify({ local, remoteError: msg }));
          process.exit(2);
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
