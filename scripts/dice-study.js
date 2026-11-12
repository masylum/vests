import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {simulateDice} from './dice-simulate.js';
import {DICE_BOT_VERSION} from '../archive/legacy-dice/dice-bots.js';
import {DEAL_FLOW_VERSION} from '../src/deal-flow.js';
const out=process.argv[2]??'docs/dice-study',count=Number(process.argv[3]??60);
await mkdir(out+'/samples',{recursive:true});await mkdir(out+'/source/src',{recursive:true});await mkdir(out+'/source/scripts',{recursive:true});
const files=['src/dice-engine.js','src/dice-bots.js','src/deal-flow.js','src/engine.js','src/racing.js','src/config.js','src/movement.js','src/ownership.js','src/intel.js','src/card-expansion.js','src/clone.js','scripts/dice-simulate.js','scripts/dice-study.js','package.json','package-lock.json','scripts/dice-audit.js','scripts/dice-report.js','src/dice-app.js','src/dice.css','src/bootstrap.js','index.html','docs/dice-rules.md','docs/dice-study-reviews.json'];
const hashes={};for(const file of files){await mkdir(out+'/source/'+file.split('/').slice(0,-1).join('/'),{recursive:true});const body=await readFile(file);hashes[file]=createHash('sha256').update(body).digest('hex');await cp(file,out+'/source/'+file);}
const manifest={version:DEAL_FLOW_VERSION,bot:DICE_BOT_VERSION,sourceHashes:hashes,rng:'Mulberry32; policy uses public-state LCG',seedStart:1000,countPerConfiguration:count,players:[2,3,4],payoutSteps:[1,2],lineups:['balanced self-play','rotating balanced/growth/saver/random'],roundLimit:4,decisionLimit:3000,workerCount:1,node:process.version,command:`node scripts/dice-study.js ${out} ${count}`,sampleRule:'Ten fixed seeds 2000–2009; players cycle 2/3/4; step 1; rotating mixed seats',timestamp:new Date().toISOString(),metrics:{scores:'cash + per-share payout - total called capital',finishers:'companies at space 24 and unfumbled at final settlement',rolls:'all setup, purchased-share and centre dice',shares:'permanent owned shares at settlement',actions:'funding/capital/value/founder decisions (excludes bids and acknowledgements)',winCredit:'1/tied winners per winning seat'}};
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
const rows=[];const policies=['balanced','growth','saver','random'];
for(const players of [2,3,4])for(const payoutStep of [1,2])for(const lineup of ['self','mixed']){
 for(let i=0;i<count;i++){
  const lineupPolicies=lineup==='self'?Array(players).fill('balanced'):Array.from({length:players},(_,seat)=>policies[(seat+i)%4]);
  const config={seed:1000+i,players,payoutStep,policies:lineupPolicies};
  try{const g=simulateDice(config);rows.push({...config,status:'completed',scores:g.scores,winners:g.winners,positions:g.companies.map(c=>c.position),finishers:g.companies.filter(c=>c.position===24&&!c.down).length,shares:g.companies.reduce((n,c)=>n+c.tokens.length,0),rolls:g.metrics.rolls,baseMovement:g.metrics.baseMovement,actions:g.metrics.actions,capital:g.players.map(p=>p.capitalCalled),payments:g.metrics.payments,actionCounts:Object.fromEntries(['call','raiseMoney','valueAction','changeFounder'].map(type=>[type,g.log.filter(e=>e.type==='action'&&e.command.type===type).length]))});}
  catch(e){rows.push({...config,status:'failed',reason:e.stack});}
 }
 console.error(JSON.stringify({players,payoutStep,lineup,done:rows.length,failed:rows.filter(r=>r.status==='failed').length}));
 await writeFile(out+'/games.jsonl',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
}
for(let i=0;i<10;i++){
 const players=2+i%3,config={seed:2000+i,players,payoutStep:1,policies:Array.from({length:players},(_,seat)=>policies[(seat+i)%4]),trace:true};
 try{const g=simulateDice(config);await writeFile(`${out}/samples/game-${i+1}.json`,JSON.stringify({config,replay:g.replay,decisions:g.decisions,events:g.log,accounts:g.accounts,scores:g.scores,positions:g.companies.map(c=>c.position),metrics:g.metrics},null,2));}catch(e){await writeFile(`${out}/samples/game-${i+1}-failed.json`,JSON.stringify({config,error:e.stack}));}
}
const mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
const groups=[];for(const players of [2,3,4])for(const payoutStep of [1,2]){const group=rows.filter(r=>r.players===players&&r.payoutStep===payoutStep&&r.status==='completed');groups.push({players,payoutStep,games:group.length,score:mean(group.flatMap(r=>r.scores)),finishers:mean(group.map(r=>r.finishers)),threeFinishers:mean(group.map(r=>Number(r.finishers>=3))),rolls:mean(group.map(r=>r.rolls)),shares:mean(group.map(r=>r.shares)),capital:mean(group.flatMap(r=>r.capital)),negative:mean(group.flatMap(r=>r.scores.map(s=>Number(s<0)))),payment:mean(group.flatMap(r=>r.payments))});}
const summary={attempted:rows.length,failed:rows.filter(r=>r.status==='failed').length,groups};await writeFile(out+'/metrics.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
