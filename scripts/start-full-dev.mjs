import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
if(!fs.existsSync('.env.teable-dev')){const db=crypto.randomBytes(24).toString('hex'),redis=crypto.randomBytes(24).toString('hex');fs.writeFileSync('.env.teable-dev',`DEV_DB_PASSWORD=${db}
DEV_REDIS_PASSWORD=${redis}
POSTGRES_USER=teable
POSTGRES_DB=teable
POSTGRES_PASSWORD=${db}
PRISMA_DATABASE_URL=postgresql://teable:${db}@db:5432/teable
BACKEND_CACHE_PROVIDER=redis
BACKEND_CACHE_REDIS_URI=redis://default:${redis}@cache:6379/0
SECRET_KEY=${crypto.randomBytes(32).toString('hex')}
PUBLIC_ORIGIN=http://127.0.0.1:13001
NEXT_ENV_IMAGES_ALL_REMOTE=true
`);}
const r=spawnSync('docker',['compose','--env-file','.env.teable-dev','-f','deploy/compose.dev.yaml','up','-d'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);console.log('Test Teable: http://127.0.0.1:13001; see docs/development.md for first setup.');
