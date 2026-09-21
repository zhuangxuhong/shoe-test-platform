"use strict";
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'), staticDir=path.join(__dirname,'static');
const config=require('./config/shoe-config.json');
const pkg=require('../package.json');
function createServer(options={}) {
 const mode=options.mode||process.env.DATA_MODE||'demo';
 if(!['demo','teable'].includes(mode))throw Error('DATA_MODE must be demo or teable');
 const api=options.api||process.env.TEABLE_API_BASE_URL;
 const token=options.token||process.env.TEABLE_API_TOKEN;
 const table=options.table||process.env.TEABLE_TABLE_ID;
 const entry=options.entry||process.env.TEABLE_ENTRY_URL||'';
 if(mode==='teable'&&(!api||!token||!table))throw Error('Teable configuration is incomplete');
 if(entry&&!/^https?:\/\//.test(entry))throw Error('TEABLE_ENTRY_URL must be HTTP(S)');
 const json=(res,status,data,head)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(head?undefined:JSON.stringify(data));};
 async function upstream(route,params={}) {
  const u=new URL(api.replace(/\/$/,'')+'/table/'+encodeURIComponent(table)+route);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Teable HTTP '+r.status);
  return r.json();
 }
 async function data(){
  if(mode==='demo')return {fields:require('../fixtures/fields.json'),records:require('../fixtures/records.json')};
  const fields=await upstream('/field'),records=[];const take=1000;
  for(let skip=0;;skip+=take){
   if(skip>=100000)throw Error('Record safety limit reached; refuse partial results');
   const page=await upstream('/record',{take,skip,fieldKeyType:'name',cellFormat:'json'});
   if(!Array.isArray(page.records))throw Error('Invalid Teable response');
   records.push(...page.records);if(page.records.length<take)break;
  }
  return {fields,records};
 }
 return http.createServer(async(req,res)=>{
  const head=req.method==='HEAD';
  try {
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'只读分析服务，请在 Teable 登录后录入。'},head);
   const u=new URL(req.url,'http://localhost');
   if(u.pathname==='/api/health')return json(res,200,{ok:true,mode,version:pkg.version,revision:process.env.APP_REVISION||'working-tree'},head);
   if(u.pathname==='/api/config')return json(res,200,{metrics:config.defaultMetrics,derivedMetrics:config.derivedMetrics,metricRankModes:config.metricRankModes,taxonomy:config.taxonomy,brands:config.brands,fieldNames:config.fieldNames,entrySections:config.entrySections,entryUrl:mode==='demo'?'':entry,mode},head);
   if(u.pathname==='/api/records'){const d=await data();return json(res,200,{...d,count:d.records.length,metrics:config.defaultMetrics},head);}
   if(u.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'},head);
   let rel;try{rel=decodeURIComponent(u.pathname).replace(/^\/static\//,'/');}catch{return json(res,400,{error:'Invalid URL'},head);}
   if(rel.split(/[\/]/).some(x=>x==='..'||x.startsWith('.')))return json(res,404,{error:'Not found'},head);
   const target=path.resolve(staticDir,rel==='/'?'index.html':'.'+rel);
   if(!target.startsWith(staticDir+path.sep))return json(res,404,{error:'Not found'},head);
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}[path.extname(target)];
   if(!mime)return json(res,404,{error:'Not found'},head);
   let body;try{body=await fs.readFile(target);}catch{return json(res,404,{error:'Not found'},head);}
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(head?undefined:body);
  }catch{json(res,502,{error:'数据读取失败，请检查 Teable 地址、权限和服务状态。'},head);}
 });
}
if(require.main===module){const s=createServer();s.listen(Number(process.env.ANALYSIS_PORT||8091),process.env.ANALYSIS_HOST||'127.0.0.1',()=>console.log('Shoe platform: http://'+(process.env.ANALYSIS_HOST||'127.0.0.1')+':'+(process.env.ANALYSIS_PORT||8091)));}
module.exports={createServer};
