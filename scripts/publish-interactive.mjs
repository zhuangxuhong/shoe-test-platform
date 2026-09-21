import readline from 'node:readline/promises';import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const config='.local/deployment.json';if(!fs.existsSync(config))throw Error('Configure .local/deployment.json first; see docs/release.md');
const cli=readline.createInterface({input:process.stdin,output:process.stdout});const ref=(await cli.question('Reviewed version/tag to publish: ')).trim();cli.close();if(!ref)throw Error('No version supplied');
const r=spawnSync(process.execPath,['scripts/release.mjs','--config',config,'--ref',ref],{stdio:'inherit'});process.exit(r.status||0);
