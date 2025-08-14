import http from 'node:http';
import { canonicalize } from '../../packages/core/src/canonicalize.js';

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
  } else {
    res.statusCode = 404; res.end('not found');
  }
});

server.listen(3000, ()=>{
  console.log('Example feed on http://localhost:3000/api/saw/feed');
});
