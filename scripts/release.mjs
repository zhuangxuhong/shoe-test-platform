import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2),rollback=args.includes('--rollback'),dry=args.includes('--dry-run');const value=k=>args[args.indexOf(k)+1];
if(!args.includes('--config'))throw Error('Usage: node scripts/release.mjs --config /private/deployment.json --ref v2.0.0 [--dry-run|--rollback]');
const configFile=path.resolve(value('--config')),cfg=JSON.parse(fs.readFileSync(configFile));
for(const k of ['composeFile','service','project','container','healthUrl','dataUrl','stateDir','envFile','entryUrl','network'])if(!cfg[k])throw Error('Missing deployment key '+k);
if(!path.isAbsolute(cfg.composeFile)||!path.isAbsolute(cfg.envFile)||!path.isAbsolute(cfg.stateDir))throw Error('Deployment paths must be absolute');
if(!fs.existsSync(cfg.envFile)||!fs.existsSync(cfg.composeFile))throw Error('Local deployment config missing');
const exec=(cmd,a,extra={})=>{const r=spawnSync(cmd,a,{encoding:'utf8',...extra});if(r.status!==0)throw Error(cmd+' failed: '+(r.stderr||'').slice(-1200));return r.stdout?.trim();};
const compose=(override)=>['compose','-p',cfg.project,'--env-file',cfg.envFile,'-f',cfg.composeFile,'-f',override,'up','-d','--no-deps','--no-build',cfg.service];
const state=path.resolve(cfg.stateDir),latest=path.join(state,'last-release.json');
const revision=rollback?null:exec('git',['rev-parse','--verify',(args.includes('--ref')?value('--ref'):'HEAD')+'^{commit}']);
if(!rollback&&exec('git',['status','--porcelain','--untracked-files=normal']))throw Error('Commit or preserve local work first; deployment requires a clean repository');
if(!rollback&&cfg.environment!=='verification'&&(!args.includes('--ref')||value('--ref')==='HEAD'))throw Error('Production requires an explicit reviewed tag or commit');
if(!rollback&&!fs.existsSync('migrations/manifest.json'))throw Error('Missing migration manifest');
const migrations=!rollback?JSON.parse(exec('git',['show',revision+':migrations/manifest.json'])):null;
if(migrations&&migrations.automaticMigrations.length)throw Error('Database changes require a separately reviewed backup/migration plan');
if(dry){console.log(JSON.stringify({dryRun:true,revision,service:cfg.service,project:cfg.project,compose:cfg.composeFile,stateDir:state,rollback},null,2));process.exit(0);}
fs.mkdirSync(state,{recursive:true});const lock=path.join(state,'release.lock');const fd=fs.openSync(lock,'wx');
function override(file,image,rev){const obj={services:{[cfg.service]:{image,environment:{DATA_MODE:cfg.environment==='verification'?'demo':'teable',TEABLE_ENTRY_URL:cfg.entryUrl,APP_REVISION:rev}}}};fs.writeFileSync(file,JSON.stringify(obj));}
async function verify(rev){for(let i=0;i<20;i++){try{const h=await fetch(cfg.healthUrl,{signal:AbortSignal.timeout(2000)});const d=await h.json();if(h.ok&&(!rev||d.revision===rev)){const data=await fetch(cfg.dataUrl,{signal:AbortSignal.timeout(5000)});const records=await data.json();if(data.ok&&Array.isArray(records.records)&&records.records.length>=(cfg.minRecords||1))return;}}catch{}await new Promise(r=>setTimeout(r,1500));}throw Error('Post-release health/data validation failed');}
try{
 if(rollback){const last=JSON.parse(fs.readFileSync(latest));if(path.resolve(last.composeFile)!==path.resolve(cfg.composeFile))throw Error('Rollback configuration mismatch');exec('docker',compose(last.rollbackFile));await verify(null);console.log('Previous application image restored; database untouched.');}
 else{
  const id=revision.slice(0,12),dir=path.join(state,Date.now()+'-'+id);fs.mkdirSync(dir);const previous=exec('docker',['inspect',cfg.container,'--format','{{.Image}}']);
  const tar=path.join(dir,'source.tar');exec('git',['archive','--format=tar','-o',tar,revision]);const source=path.join(dir,'source');fs.mkdirSync(source);exec('tar',['-xf',tar,'-C',source]);
  const image='shoe-analysis:'+id;exec('docker',['build','-f',path.join(source,'analysis-web/Dockerfile'),'-t',image,source]);
  exec('docker',['save','-o',path.join(dir,'previous-image.tar'),previous]);fs.copyFileSync(cfg.composeFile,path.join(dir,'compose-before.yaml'));fs.copyFileSync(cfg.envFile,path.join(dir,'private-env-backup'));
  const rollbackFile=path.join(dir,'rollback.json'),nextFile=path.join(dir,'release.json');override(rollbackFile,previous,'rollback');override(nextFile,image,revision);
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({revision,previous,image,rollbackFile,composeFile:cfg.composeFile},null,2));
  try{exec('docker',compose(nextFile));await verify(revision);}catch(e){exec('docker',compose(rollbackFile));throw Error('Release failed; previous image restored: '+e.message);}
  fs.copyFileSync(path.join(dir,'manifest.json'),latest);console.log('Published '+revision+'; backup: '+dir);
 }
}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
