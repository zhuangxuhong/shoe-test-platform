import fs from 'node:fs';import crypto from 'node:crypto';
const origin='http://127.0.0.1:13001',api=origin+'/api';fs.mkdirSync('.local',{recursive:true});
const file='.local/test-account.json';let account=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {email:'developer@example.test',password:crypto.randomBytes(18).toString('base64url'),name:'Local Developer'};
if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(account,null,2));let cookies='';
async function req(method,path,body){const r=await fetch(api+path,{method,headers:{'Content-Type':'application/json',...(cookies?{Cookie:cookies}:{})},body:body?JSON.stringify(body):undefined});const set=r.headers.getSetCookie();if(set.length)cookies=set.map(x=>x.split(';')[0]).join('; ');const d=await r.text();if(!r.ok)throw Error(method+' '+path+' HTTP '+r.status+' '+d.slice(0,300));return d?JSON.parse(d):null;}
try{await req('POST','/auth/signin',{email:account.email,password:account.password});}catch{await req('POST','/auth/signup',account);await req('POST','/auth/signin',{email:account.email,password:account.password});}
const getOrCreate=async(items,name,route,body)=>items.find(x=>x.name===name)||await req('POST',route,body);
const space=await getOrCreate(await req('GET','/space'),'Shoe development','/space',{name:'Shoe development'});
const base=await getOrCreate(await req('GET',`/space/${space.id}/base`),'Shoe fixtures','/base',{spaceId:space.id,name:'Shoe fixtures'});
const config=JSON.parse(fs.readFileSync('analysis-web/config/shoe-config.json')),fixture=JSON.parse(fs.readFileSync('fixtures/records.json')),fields=JSON.parse(fs.readFileSync('fixtures/fields.json'));
const defs=fields.map(f=>{const out={...f};if(f.type==='singleSelect'||f.type==='multipleSelect'){let vals=fixture.flatMap(r=>{const v=r.fields[f.name];return Array.isArray(v)?v:v?[v]:[]});for(const cat of config.taxonomy)for(const g of cat.groups||[])if(g.field===f.name)vals.push(...g.tags.map(t=>typeof t==='string'?t:t.name));if(f.name==='一级品类')vals.push(...config.taxonomy.map(x=>x.name));if(f.name==='品牌')vals.push(...config.brands.map(x=>x.name));out.options={choices:[...new Set(vals)].map(name=>({name}))};}return out;});
let table=await getOrCreate(await req('GET',`/base/${base.id}/table`),'Shoe tests','/base/'+base.id+'/table',{name:'Shoe tests',description:'Isolated fictional developer fixtures, schema v1',fields:defs,records:[],fieldKeyType:'name'});
let live=await req('GET',`/table/${table.id}/field`);let sys=live.find(x=>x.name==='系统序号');if(!sys)sys=await req('POST',`/table/${table.id}/field`,{name:'系统序号',type:'autoNumber'});
let data=await req('GET',`/table/${table.id}/record?take=1000&fieldKeyType=name`);
if(!data.records.length){await req('POST',`/table/${table.id}/record`,{fieldKeyType:'name',typecast:true,records:fixture.map((r,i)=>({fields:{...r.fields,'唯一ID号':'T'+String(i+1).padStart(4,'0')}}))});}
const id=live.find(x=>x.name==='唯一ID号');if(id.type!=='formula')await req('PUT',`/table/${table.id}/field/${id.id}/convert`,{name:'唯一ID号',type:'formula',options:{expression:`CONCATENATE("T", IF({${sys.id}} < 10000, RIGHT(CONCATENATE("0000", {${sys.id}}), 4), CONCATENATE({${sys.id}})))`}});
live=await req('GET',`/table/${table.id}/field`);const identity=['唯一ID号','测试日期','名称'];const physical=['整鞋重量(g)','鞋垫重量(g)','后跟高度(mm)','前掌高度(mm)','整鞋落差(mm)','鞋垫高度(mm)','前掌宽度(mm)','中腰宽度(mm)','后跟宽度(mm)','落锤ID','后跟减震(G)','后跟回弹(R)','压缩量(DM)','峰值力(N)','扭转ID','L扭转力矩(N.m)','R扭转力矩(N.m)','弯折(N)','备注','起翘高度','起翘点','回弹速率'];
const groups={'01 实验数据录入':[...identity,...physical],'02 鞋款资料与分类':[...identity,'品牌','一级品类','功能标签','场景标签','结构标签','测试人','购买人','有无鞋垫','插入图片','备注'],'03 生物力学指标':[...identity,...config.entrySections.find(s=>s.name==='生物力学数据').fields,'备注'],'04 代谢指标':[...identity,...config.entrySections.find(s=>s.name==='代谢数据').fields,'备注'],'全部数据':live.map(f=>f.name).filter(n=>n!=='系统序号')};let views=await req('GET',`/table/${table.id}/view`);let entry;
for(const [name,visible] of Object.entries(groups)){const ordered=[...new Set([...visible,...live.map(f=>f.name)])];const meta=Object.fromEntries(live.map(f=>[f.id,{order:ordered.indexOf(f.name),hidden:!visible.includes(f.name),width:['名称','备注'].includes(f.name)?250:140}]));let v=views.find(x=>x.name===name);if(!v)v=await req('POST',`/table/${table.id}/view`,{name,type:'grid',columnMeta:meta});if(!entry)entry=v.id;}
const url=`${origin}/base/${base.id}/${table.id}/${entry}`;fs.writeFileSync('.local/teable-test.json',JSON.stringify({schemaVersion:1,baseId:base.id,tableId:table.id,entryUrl:url},null,2));
// Remove only the unused default view of this dedicated fixture table.
for(const v of views)if(v.name==='Grid view')await req('DELETE',`/table/${table.id}/view/${v.id}`);
const finalViews=await req('GET',`/table/${table.id}/view`);let previous;
for(const name of Object.keys(groups)){const v=finalViews.find(x=>x.name===name);if(previous)await req('PUT',`/table/${table.id}/view/${v.id}/order`,{anchorId:previous,position:'after'});previous=v.id;}
const tokenFile='.local/test-token.json';let token=fs.existsSync(tokenFile)?JSON.parse(fs.readFileSync(tokenFile)):null;
if(!token||!token.baseIds?.includes(base.id)||Date.parse(token.expiredTime)<Date.now()+86400000){token=await req('POST','/access-token',{name:'Local analysis read only',scopes:['table|read','record|read','field|read','view|read'],baseIds:[base.id],expiredTime:new Date(Date.now()+30*86400000).toISOString()});fs.writeFileSync(tokenFile,JSON.stringify(token));}
fs.writeFileSync('.env.teable-analysis',`DATA_MODE=teable
ANALYSIS_HOST=127.0.0.1
ANALYSIS_PORT=8092
TEABLE_API_BASE_URL=${api}
TEABLE_TABLE_ID=${table.id}
TEABLE_API_TOKEN=${token.token}
TEABLE_ENTRY_URL=${url}
`);
console.log('Test schema and read-only analysis token ready. Local credentials: .local/test-account.json (do not commit).');console.log('Entry: '+url);console.log('Run node --env-file=.env.teable-analysis analysis-web/server.js for full integration on port 8092.');
