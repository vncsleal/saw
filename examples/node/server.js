import http from 'node:http';
import { buildFeed, generateApiKey, verifyRequestSignature, MemoryKeyStore, MemoryBlockStore, MemoryLog, signFeed } from '../../packages/core/dist/index.js';
import { deferredParagraph, fragmentationUtility, clientBootstrap } from './antiScrape.js';

// In-memory stores
const keyStore = new MemoryKeyStore();
const blockStore = new MemoryBlockStore();
const log = new MemoryLog();

// Seed content & key (for demo only; DO NOT expose secret in production)
blockStore.set([{ id:'block:hello', type:'doc', title:'Hello', content:'Hello *SAW*', version:'v1', updated_at: new Date().toISOString() }]);
const { id: demoKeyId, secret: demoKeySecret, record: demoRecord } = generateApiKey();
keyStore.add(demoRecord);
console.log('# Demo API Key (store this securely)');
console.log('X-API-KEY:', demoKeyId);
console.log('X-SECRET (not stored server-side for demo):', demoKeySecret);

function parseBody(req) {
  return new Promise(resolve => {
    let data='';
    req.on('data', c=>data+=c);
    req.on('end', ()=>resolve(data));
  });
}

async function authenticate(req, body) {
  const keyId = req.headers['x-api-key'];
  const rec = keyId ? keyStore.get(String(keyId)) : undefined;
  if (!rec) return { ok:false, code:'NO_KEY', message:'Missing key' };
  // For demo we keep secret in memory only for the one key created at startup
  const secret = demoKeySecret; // In production fetch secret securely
  const headers = { 'x-api-key': keyId, 'x-sig': req.headers['x-sig'], 'x-timestamp': req.headers['x-timestamp'] };
  return verifyRequestSignature(rec, secret, headers, req.method||'GET', req.url||'/', body);
}

const server = http.createServer((req,res)=>{
  if (req.url === '/api/saw/feed') {
    (async () => {
      const secret = process.env.SAW_SECRET_KEY;
      const canarySecret = process.env.SAW_CANARY_SECRET;
      const blocks = blockStore.list();
      const feed = buildFeed({ site:'example.local', blocks, secretKeyBase64: secret, canarySecret, perKeySalt: demoRecord.salt });
      const body = JSON.stringify(feed);
      res.setHeader('content-type','application/json');
      res.end(body);
      log.write({ ts:new Date().toISOString(), level:'info', event:'feed.response', data:{ items: feed.items.length } });
    })();
  } else if (req.url && req.url.startsWith('/api/saw/diff')) {
    (async () => {
      const since = new URL('http://x'+req.url).searchParams.get('since') || '';
      const diff = blockStore.diffSince(since);
      const subset = { site:'example.local', since, changed: diff.changed, removed: diff.removed };
      let signature = 'UNSIGNED';
      const secret = process.env.SAW_SECRET_KEY;
      if (secret) signature = signFeed(subset, secret);
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({ ...subset, signature }));
      log.write({ ts:new Date().toISOString(), level:'info', event:'diff.response', data:{ since, changed: diff.changed.length, removed: diff.removed.length } });
    })();
  } else if (req.url === '/api/saw/keys') {
    // Simple list keys endpoint (no auth for demo)
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ keys: keyStore.list().map(k=>({ id:k.id, salt:k.salt })) }));
    log.write({ ts:new Date().toISOString(), level:'info', event:'keys.list', data:{ count: keyStore.list().length } });
  } else if (req.url === '/api/saw/ingest' && req.method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      const auth = await authenticate(req, body);
      if (!auth.ok) { res.statusCode = 401; res.end(JSON.stringify(auth)); return; }
      // Accept a block upsert { id, type, title, content, version }
      try {
        const data = JSON.parse(body);
        if (!data.id || !data.version) throw new Error('Missing id/version');
        const existing = blockStore.list().filter(b=>b.id!==data.id);
        const updated = { ...data, updated_at: new Date().toISOString() };
        blockStore.set([...existing, updated]);
        res.setHeader('content-type','application/json');
        res.end(JSON.stringify({ ok:true }));
        log.write({ ts:new Date().toISOString(), level:'info', event:'ingest.upsert', data:{ id:data.id, version:data.version } });
      } catch (e) {
        res.statusCode = 400; res.end(JSON.stringify({ ok:false, error: e instanceof Error ? e.message : String(e) }));
        log.write({ ts:new Date().toISOString(), level:'error', event:'ingest.error', data:{ error: e instanceof Error ? e.message : String(e) } });
      }
    })();
  } else if (req.url === '/api/saw/logs') {
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ logs: log.entries().slice(-200) }));
  } else if (req.url === '/' || req.url === '/index.html') {
    const para = deferredParagraph('This paragraph loads with a slight delay to raise scraping cost.', 200);
    const frag = fragmentationUtility('Fragment this longer body of text into randomized spans for mild obfuscation.');
    const html = `<!doctype html><html><head><title>SAW Example</title></head><body><h1>SAW Example</h1>${para}<p>${frag}</p><script>${clientBootstrap}</script><!-- hidden canary: c-demo1234 --></body></html>`;
    res.setHeader('content-type','text/html');
    res.end(html);
  } else {
    res.statusCode = 404; res.end('not found');
  }
});

server.listen(3000, ()=>{
  console.log('Example feed on http://localhost:3000/api/saw/feed');
  console.log('Diff scaffold on http://localhost:3000/api/saw/diff?since=ISO');
});
