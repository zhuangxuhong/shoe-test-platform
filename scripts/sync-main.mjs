import {syncMain} from './git-workflow.mjs';
console.log(JSON.stringify(syncMain()));
console.log('Source synchronized. No deployment or database change performed.');
