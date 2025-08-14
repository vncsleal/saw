import http from 'node:http';
import { canonicalize, signFeed } from '../../packages/core/dist/index.js';

const blocks = [
  { id:'block:hello', type:'doc', title:'Hello', content:'Hello *SAW*', version:'v1', updated_at: new Date().toISOString() }
];

function buildFeed() {
  const items = blocks.map(b=>({
    id: b.id,
    type: b.type,
    title: b.title,
    version: b.version,
    updated_at: b.updated_at,
    block_hash: 'TODO',
    canary: 'TODO'
  }));
  return { site:'example.local', generated_at:new Date().toISOString(), items, signature:'UNSIGNED' };
}

const server = http.createServer((req,res)=>{
  if (req.url === '/api/saw/feed') {
    const feed = buildFeed();
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
      signature = signFeed(diffSubset, secret);
    }
    res.statusCode = 501; // Not Implemented
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ ...diffSubset, signature, note:'Diff not implemented yet' }));
  } else {
    res.statusCode = 404; res.end('not found');
  }
});

server.listen(3000, ()=>{
  console.log('Example feed on http://localhost:3000/api/saw/feed');
  console.log('Diff scaffold on http://localhost:3000/api/saw/diff?since=ISO');
});
