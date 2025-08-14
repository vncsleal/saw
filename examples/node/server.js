import http from 'node:http';
import { buildFeed } from '../../packages/core/dist/index.js';
import { deferredParagraph, fragmentationUtility, clientBootstrap } from './antiScrape.js';

const blocks = [{ id:'block:hello', type:'doc', title:'Hello', content:'Hello *SAW*', version:'v1', updated_at: new Date().toISOString() }];

const server = http.createServer((req,res)=>{
  if (req.url === '/api/saw/feed') {
    const secret = process.env.SAW_SECRET_KEY;
    const canarySecret = process.env.SAW_CANARY_SECRET;
    const feed = buildFeed({ site:'example.local', blocks, secretKeyBase64: secret, canarySecret });
    const body = JSON.stringify(feed);
    res.setHeader('content-type','application/json');
    res.end(body);
  } else if (req.url && req.url.startsWith('/api/saw/diff')) {
    // Phase 1 scaffold: always 501, stable signed empty diff subset
    const since = new URL('http://x'+req.url).searchParams.get('since') || '';
    const diffSubset = { site:'example.local', since, changed:[], removed:[] };
    let signature = 'UNSIGNED';
    const secret = process.env.SAW_SECRET_KEY;
    if (secret) {
      // reuse buildFeed signing helper indirectly (or keep signFeed import if preferred)
      // For simplicity we leave diff unsigned or mimic signFeed logic inline later
    }
    res.statusCode = 501; // Not Implemented
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ ...diffSubset, signature, note:'Diff not implemented yet' }));
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
