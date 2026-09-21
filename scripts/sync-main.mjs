import {spawnSync} from 'node:child_process';
function run(args){const r=spawnSync('git',args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();}
if(run(['status','--porcelain']))throw Error('Working tree has changes; preserve or commit them before synchronization.');
if(run(['branch','--show-current'])!=='main')throw Error('Switch to main after preserving your feature work.');
console.log('Fetching '+run(['remote','get-url','origin']));run(['fetch','origin','main']);console.log(run(['merge','--ff-only','origin/main']));console.log('Source synchronized. No deployment or database change performed.');
