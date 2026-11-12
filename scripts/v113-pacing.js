import fs from'node:fs';import path from'node:path';import{parallel}from'./parallel.js';
const out=path.resolve('docs/v113-pacing'),jobs=[];
for(const players of[2,3,4])for(const variant of['source','fifteen'])for(let i=0;i<8;i++)jobs.push({id:`${variant}-${players}-${i}`,variant,players,seed:213000+players*100+i,samples:12,source:out+'/'+variant,out,health:true});
fs.writeFileSync(out+'/protocol.json',JSON.stringify({target:'About nine rounds. Compare 15 vs 20 tokens at roughly 26 complete-set expected movement, both with corrected free hiring and the same revised bot. Eight setups per player count per variant; 12 samples for this exploratory pacing test. No tuning mid-run.',jobs},null,2));
await parallel(jobs,{moduleURL:new URL('./health-game.js',import.meta.url),workers:4,onResult:r=>{fs.appendFileSync(out+'/games.jsonl',JSON.stringify(r)+'\n');console.log(r.id,r.status,r.roundCount,r.error??'');}});
