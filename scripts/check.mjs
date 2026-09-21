import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const run=(args)=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);};
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const f of ['analysis-web','scripts','tests'].flatMap(files).filter(x=>/\.(js|mjs)$/.test(x)&&!x.includes('vendor')))run(['--check',f]);
run(['--test','--test-isolation=none',...files('tests').filter(x=>x.endsWith('.test.js'))]);run(['scripts/audit.mjs']);
