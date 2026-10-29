import {threadId} from 'node:worker_threads';
let calls=0;
export function run(job){if(job.exit)process.exit(0);if(job.fail)throw Error('Expected pool failure');return {value:job.value*2,threadId,calls:++calls};}
