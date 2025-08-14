#!/usr/bin/env node
import { generateKeyPair, buildFeed, generateLlmsTxt, generateApiKey, verifySignedDiff, detectCanaries, SimpleEventEmitter } from './api.js';
import { verifyRemote, verifyLocal } from './verify.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer local working directory .saw-apikeys.json; fallback to package directory copy if present
function resolveApiKeyFile(): string {
  const candidates = [
    path.join(process.cwd(), '.saw-apikeys.json'),
    path.join(__dirname, '..', '.saw-apikeys.json'), // package root (after build dist/ -> ..)
    path.join(__dirname, '.saw-apikeys.json') // in case of source execution
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  // default to CWD for creation
  return candidates[0];
}

function printHelp() {
  const lines = [
    'SAW CLI',
    'Usage: saw <command> [options]',
    '',
    'Quick commands:',
    '  saw keygen                                  Generate keypair (stdout)',
    '  saw feed                                    Build & sign feed (auto; uses env SAW_SECRET_KEY)',
    '  saw llms                                    Generate llms.txt (auto infer URL & key)',
    '  saw verify <feed.json|site> [publicKey]     Verify feed (local needs key; remote auto key/header)',
    '  saw antiscrape <text|file> [--remote <b>]   Detect / compare canaries',
    '  saw init                                    One-shot setup (keys + sample block + feed + llms.txt)',
    '',
    'Extended commands:',
    '  key gen [--env|--json|--dotenv|--env-file <p>] [--force]',
    '  key gen-api | key list-api                  Manage HMAC API keys (dev)',
    '  feed build [--site <site>] [--out file] [--events]',
    '  feed verify <file|site> [publicKeyBase64] [--json]',
    '  llms init [--url <feedUrl>] [--public-key <base64>] [--fingerprint-len N] [--out path]',
    '  diff verify <site> <publicKeyBase64> --since <ISO> [--json]',
    '  detect <text|file> [--remote <base>]',
    '',
    'Environment:',
    '  SAW_PUBLIC_KEY SAW_SECRET_KEY (required for feed build)',
    '  Optional: SAW_SITE, SAW_FEED_URL, SAW_CANARY_SECRET',
  ];
  console.log(lines.join('\n'));
}

async function buildFeedCommand(args: string[]) {
  const siteIdx = args.indexOf('--site');
  const outIdx = args.indexOf('--out');
  const eventsFlag = args.includes('--events');
  const site = siteIdx !== -1 ? args[siteIdx+1] : (process.env.SAW_SITE || 'localhost:3000');
  const outFile = outIdx !== -1 ? args[outIdx+1] : 'feed.json';
  const secretKey = process.env.SAW_SECRET_KEY;
  if (!secretKey) { console.error('Missing SAW_SECRET_KEY'); process.exit(1); }
  const blocksDir = 'content/blocks';
  if (!fs.existsSync(blocksDir)) {
    fs.mkdirSync(blocksDir, { recursive: true });
    fs.writeFileSync(path.join(blocksDir,'sample.json'), JSON.stringify({ id:'block:sample', type:'doc', title:'Sample', content:'Hello', version:'v1', updated_at:new Date().toISOString() }, null, 2));
    console.log('Initialized sample block at content/blocks/sample.json');
  }
  const files = fs.readdirSync(blocksDir).filter(f=>f.endsWith('.json'));
  const blocks = files.map(f=>JSON.parse(fs.readFileSync(path.join(blocksDir,f),'utf8')));
  const canarySecret = process.env.SAW_CANARY_SECRET;
  const emitter = eventsFlag ? new SimpleEventEmitter() : undefined;
  const feed = buildFeed({ site, blocks, secretKeyBase64: secretKey, canarySecret, events: emitter });
  fs.writeFileSync(outFile, JSON.stringify(feed, null, 2));
  const pubKey = process.env.SAW_PUBLIC_KEY;
  if (pubKey) {
    const crypto = await import('node:crypto');
    const fp = crypto.createHash('sha256').update(Buffer.from(pubKey,'base64')).digest('hex').slice(0,8);
    const feedUrl = process.env.SAW_FEED_URL || `https://${site}/api/saw/feed`;
  const llms = generateLlmsTxt({ feedUrl, publicKeyFingerprint:`ed25519:${fp}`, publicKey: pubKey });
    fs.mkdirSync('.well-known',{recursive:true});
    fs.writeFileSync('.well-known/llms.txt', llms);
  }
  console.log(`Feed written to ${outFile}`);
}

async function llmsInitCommand(args: string[]) {
  const urlIdx = args.indexOf('--url');
  const pkIdx = args.indexOf('--public-key');
  const fpLenIdx = args.indexOf('--fingerprint-len');
  const outIdx = args.indexOf('--out');
  let feedUrl = urlIdx !== -1 ? args[urlIdx+1] : '';
  const pubKey = pkIdx !== -1 ? args[pkIdx+1] : (process.env.SAW_PUBLIC_KEY || '');
  if (!pubKey) { console.error('Missing public key: provide --public-key or set SAW_PUBLIC_KEY'); process.exit(1); }
  if (!feedUrl) {
    const siteRaw = process.env.SAW_SITE || 'localhost:3000';
    const needsHttp = siteRaw.includes('localhost') || siteRaw.includes(':');
    const base = /^https?:\/\//i.test(siteRaw) ? siteRaw.replace(/\/$/,'') : (needsHttp?'http://':'https://')+siteRaw.replace(/\/$/,'');
    feedUrl = base + '/api/saw/feed';
  }
  const fpLen = fpLenIdx !== -1 ? parseInt(args[fpLenIdx+1],10) : 8;
  const outFile = outIdx !== -1 ? args[outIdx+1] : 'public/.well-known/llms.txt';
  const crypto = await import('node:crypto');
  const fp = crypto.createHash('sha256').update(Buffer.from(pubKey,'base64')).digest('hex').slice(0,fpLen);
  const llms = generateLlmsTxt({ feedUrl, publicKeyFingerprint:`ed25519:${fp}`, publicKey: pubKey });
  fs.mkdirSync(path.dirname(outFile), { recursive:true });
  fs.writeFileSync(outFile, llms);
  console.log('Wrote', outFile);
}

async function verifyCommand(args: string[]) {
  const target = args[0];
  const maybePubKey = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
  const jsonFlag = args.includes('--json');
  if (!target) { console.error('Usage: saw verify <feed.json|site> [publicKeyBase64] [--json]'); process.exit(1); }
  const isFile = fs.existsSync(target) && target.endsWith('.json');
  if (isFile) {
    const pubKey = maybePubKey || process.env.SAW_PUBLIC_KEY;
    if (!pubKey) { console.error('Public key required for local file verification (provide arg or set SAW_PUBLIC_KEY)'); process.exit(1); }
    const result = verifyLocal(target, pubKey);
    console.log(jsonFlag ? JSON.stringify(result) : result.message);
    process.exit(result.code);
  } else {
    const result = await verifyRemote(target, maybePubKey);
    console.log(jsonFlag ? JSON.stringify(result) : result.message);
    process.exit(result.code);
  }
}

async function diffVerifyCommand(args: string[]) {
  const site = args[0];
  const pubKey = args[1];
  const sinceIdx = args.indexOf('--since');
  const since = sinceIdx !== -1 ? args[sinceIdx+1] : '';
  const jsonFlag = args.includes('--json');
  if (!site || !pubKey || !since) { console.error('Usage: saw diff verify <site> <publicKeyBase64> --since <ISO> [--json]'); process.exit(1); }
  let base = site;
  if (!/^https?:\/\//i.test(base)) { if (base.startsWith('localhost') || base.includes(':')) base = 'http://' + base; else base = 'https://' + base; }
  const url = base.replace(/\/$/,'') + '/api/saw/diff?since=' + encodeURIComponent(since);
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

async function detectCommand(args: string[]) {
  const target = args[0];
  if (!target) { console.error('Usage: saw detect <text|file> [--remote <base>]'); process.exit(1); }
  const remoteIdx = args.indexOf('--remote');
  const remoteBase = remoteIdx !== -1 ? args[remoteIdx+1] : undefined;
  let text: string;
  if (fs.existsSync(target)) text = fs.readFileSync(target,'utf8'); else {
    const filtered: string[] = [];
    for (let i=0;i<args.length;i++) { if (args[i] === '--remote') { i++; continue; } filtered.push(args[i]); }
    text = filtered.join(' ');
  }
  const local = detectCanaries(text);
  if (!remoteBase) { console.log(JSON.stringify(local)); process.exit(0); }
  let base = remoteBase;
  if (!/^https?:\/\//i.test(base)) { if (base.startsWith('localhost') || base.includes(':')) base = 'http://' + base; else base = 'https://' + base; }
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

async function initOneShot() {
  let pub = process.env.SAW_PUBLIC_KEY || '';
  let sec = process.env.SAW_SECRET_KEY || '';
  const envFile = '.env';
  if (!pub || !sec) {
    if (fs.existsSync(envFile)) {
      const current = fs.readFileSync(envFile,'utf8');
      const mPub = current.match(/^SAW_PUBLIC_KEY=(.+)$/m);
      const mSec = current.match(/^SAW_SECRET_KEY=(.+)$/m);
      if (mPub) pub = mPub[1].trim();
      if (mSec) sec = mSec[1].trim();
    }
  }
  if (!pub || !sec) {
    const kp = generateKeyPair();
    pub = Buffer.from(kp.publicKey).toString('base64');
    sec = Buffer.from(kp.secretKey).toString('base64');
    let existing = fs.existsSync(envFile) ? fs.readFileSync(envFile,'utf8').replace(/\n*$/,'\n') : '';
    if (!/SAW_PUBLIC_KEY=/.test(existing)) existing += `SAW_PUBLIC_KEY=${pub}\n`;
    if (!/SAW_SECRET_KEY=/.test(existing)) existing += `SAW_SECRET_KEY=${sec}\n`;
    fs.writeFileSync(envFile, existing);
    console.log('Generated keypair -> .env');
  } else {
    console.log('Keys present (env or .env) – reusing');
  }
  await buildFeedCommand([]); // defaults for site/out
  // Auto-generate an API key if none exist yet
  const apiKeyFile = resolveApiKeyFile();
  if (!fs.existsSync(apiKeyFile)) {
    const { id, secret } = generateApiKey();
    fs.writeFileSync(apiKeyFile, JSON.stringify([{ id, secret }], null, 2));
    console.log('Generated initial API key:', id);
  }
  console.log('Init complete');
}

async function main() {
  const [, , arg1, arg2, ...tail] = process.argv;
  const cmd = arg1;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { printHelp(); return; }

  // Group routing (feed|llms|key|diff|detect)
  if (['feed','llms','key','diff','detect'].includes(cmd)) {
    const group = cmd;
    const sub = arg2;
    const rest = tail;
    if (group === 'feed') {
      if (!sub || sub === 'build') return buildFeedCommand(rest);
      if (sub === 'verify') return verifyCommand(rest);
      console.error('Unknown feed subcommand'); process.exit(1);
    } else if (group === 'llms') {
      if (!sub || sub === 'init') return llmsInitCommand(rest);
      console.error('Unknown llms subcommand'); process.exit(1);
    } else if (group === 'key') {
      if (sub === 'gen') {
        const envFlag = rest.includes('--env');
        const jsonFlag = rest.includes('--json');
        const dotenvFlag = rest.includes('--dotenv');
        const envFileIdx = rest.indexOf('--env-file');
        const forceFlag = rest.includes('--force');
        const envFile = envFileIdx !== -1 ? rest[envFileIdx+1] : '.env';
        const kp = generateKeyPair();
        const pub = Buffer.from(kp.publicKey).toString('base64');
        const sec = Buffer.from(kp.secretKey).toString('base64');
        if (jsonFlag) {
          console.log(JSON.stringify({ publicKey: pub, secretKey: sec }));
        } else if (dotenvFlag) {
          try {
            let existing = '';
            if (fs.existsSync(envFile)) {
              const current = fs.readFileSync(envFile,'utf8');
              const hasPub = /^.*SAW_PUBLIC_KEY=.*$/m.test(current);
              const hasSec = /^.*SAW_SECRET_KEY=.*$/m.test(current);
              if ((hasPub || hasSec) && !forceFlag) { console.error(`Refusing to overwrite existing keys in ${envFile} (use --force).`); process.exit(1); }
              existing = current.replace(/\n*$/,'\n');
            }
            const toAppend = `SAW_PUBLIC_KEY=${pub}\nSAW_SECRET_KEY=${sec}\n`;
            fs.writeFileSync(envFile, existing + toAppend);
            console.log(`Wrote keys to ${envFile}`);
          } catch (e: unknown) {
            console.error('Failed to write env file:', e instanceof Error ? e.message : String(e));
            process.exit(1);
          }
        } else if (envFlag) {
          console.log('export SAW_PUBLIC_KEY=' + pub);
          console.log('export SAW_SECRET_KEY=' + sec);
        } else {
          console.log('# SAW Ed25519 Key Pair (DO NOT COMMIT SECRET)');
          console.log('PUBLIC_KEY=' + pub);
          console.log('SECRET_KEY=' + sec);
        }
        return;
      } else if (sub === 'gen-api') {
        const { id, secret, record } = generateApiKey();
        const file = resolveApiKeyFile();
        let arr: Array<{ id:string; secret:string }> = [];
        if (fs.existsSync(file)) arr = JSON.parse(fs.readFileSync(file,'utf8'));
        arr.push({ id, secret });
        fs.writeFileSync(file, JSON.stringify(arr, null, 2));
        console.log('# SAW API Key (store secret securely)');
        console.log('ID=' + id); console.log('SECRET=' + secret); console.log('SALT=' + record.salt);
        return;
      } else if (sub === 'list-api') {
        const file = resolveApiKeyFile();
        if (!fs.existsSync(file)) { console.log('No API keys'); return; }
        const arr: Array<{ id:string; secret:string }> = JSON.parse(fs.readFileSync(file,'utf8'));
        console.log(arr.map(k=>k.id).join('\n'));
        return;
      }
      console.error('Unknown key subcommand'); process.exit(1);
    } else if (group === 'diff') {
      if (sub === 'verify') return diffVerifyCommand(rest);
      console.error('Unknown diff subcommand'); process.exit(1);
    } else if (group === 'detect') {
      return detectCommand([sub, ...rest].filter(Boolean));
    }
  }

  // Simplified top-level commands
  const rest = process.argv.slice(3);
  if (cmd === 'keygen') {
    const kp = generateKeyPair();
    console.log('# SAW Ed25519 Key Pair (DON\'T COMMIT SECRET)');
    console.log('PUBLIC_KEY=' + Buffer.from(kp.publicKey).toString('base64'));
    console.log('SECRET_KEY=' + Buffer.from(kp.secretKey).toString('base64'));
    return;
  }
  if (cmd === 'feed') return buildFeedCommand(rest);
  if (cmd === 'llms') return llmsInitCommand(rest);
  if (cmd === 'verify') return verifyCommand(rest);
  if (cmd === 'antiscrape') return detectCommand(rest);
  if (cmd === 'init') return initOneShot();

  console.error('Unknown command: ' + cmd);
  printHelp();
  process.exit(1);
}

main().catch(e => { console.error('Error:', e instanceof Error ? e.message : String(e)); process.exit(1); });
