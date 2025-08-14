import http from 'node:http';

const port = process.env.PORT || 4001;

http.createServer((req,res)=>{
  if (req.method === 'POST') {
    let body='';
    req.on('data', c=>body+=c);
    req.on('end', ()=>{
      try { console.log('# webhook event', JSON.parse(body)); } catch { console.log('# raw body', body); }
      res.end('ok');
    });
  } else { res.end('ok'); }
}).listen(port, ()=>{
  console.log('Webhook receiver listening on', port);
});
