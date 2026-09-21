const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');const {createServer}=require('../analysis-web/server');
async function start(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
async function stop(s){s.closeAllConnections();await new Promise(r=>s.close(r));}
test('demo works independently; mutations and local files stay inaccessible',async()=>{const s=createServer({mode:'demo'}),url=await start(s);try{
 const d=await(await fetch(url+'/api/records')).json();assert.equal(d.count,18);assert.ok(d.records.every(r=>r.fields['唯一ID号'].startsWith('DEMO')));
 const c=await(await fetch(url+'/api/config')).json();assert.equal(c.entryUrl,'');assert.ok(!JSON.stringify(c).includes('apiToken'));
 for(const method of ['POST','PATCH','PUT','DELETE'])assert.equal((await fetch(url+'/api/records',{method})).status,405);
 for(const f of ['/.env','/server.js','/config/shoe-config.json','/api/next-id','/%2e%2e%5cpackage.json'])assert.equal((await fetch(url+f)).status,404);
 assert.equal((await fetch(url+'/')).status,200);assert.equal((await fetch(url+'/vendor/echarts.min.js')).status,200);
 }finally{await stop(s);}});
test('live pagination reads beyond first page and keeps token on server',async()=>{let auth=[],skips=[];const fake=http.createServer((req,res)=>{auth.push(req.headers.authorization);const u=new URL(req.url,'http://test');res.setHeader('Content-Type','application/json');if(u.pathname.endsWith('/field'))return res.end('[]');const skip=Number(u.searchParams.get('skip'));skips.push(skip);res.end(JSON.stringify({records:Array.from({length:skip===0?1000:2},(_,i)=>({id:'r'+(skip+i),fields:{}}))}));});const api=await start(fake);const s=createServer({mode:'teable',api:api+'/api',token:'test-only',table:'test-table',entry:'http://localhost:13001/'}),url=await start(s);try{const d=await(await fetch(url+'/api/records')).json();assert.equal(d.count,1002);assert.deepEqual(skips,[0,1000]);assert.ok(auth.every(x=>x==='Bearer test-only'));}finally{await stop(s);await stop(fake);}});
test('incomplete live configuration refuses startup',()=>{assert.throws(()=>createServer({mode:'teable',api:'http://localhost',token:'',table:''}));});
