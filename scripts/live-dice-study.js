import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {simulateLiveDice} from './live-dice-simulate.js';
import {LIVE_DICE_VERSION} from '../src/live-dice-rules.js';
import {DICE_BOT_VERSION} from '../src/live-dice-bots.js';
const dir=process.argv[2]??'docs/dice-round-v132/run-01';
if(fs.existsSync(dir))throw Error('Study folders are immutable: choose a new output path.');
fs.mkdirSync(dir+'/samples',{recursive:true});fs.mkdirSync(dir+'/source',{recursive:true});
const files=[...fs.readdirSync('src').map(f=>'src/'+f).filter(f=>fs.statSync(f).isFile()),'package.json','package-lock.json','scripts/live-dice-study.js','scripts/live-dice-simulate.js','scripts/live-dice-report.js','scripts/live-dice-metrics.json'];
const hash=crypto.createHash('sha256');for(const file of files){const data=fs.readFileSync(file);hash.update(file).update(data);fs.mkdirSync(path.dirname(dir+'/source/'+file),{recursive:true});fs.copyFileSync(file,dir+'/source/'+file);}
const protocol={version:LIVE_DICE_VERSION,bot:DICE_BOT_VERSION,source:hash.digest('hex'),created:new Date().toISOString(),metricRevision:3,cohorts:[{name:'self',seeds:'1001–1040',policies:['balanced']},{name:'mixed',seeds:'1001–1040',policies:['balanced','growth','saver','random'],rotation:'seed modulo four; all policies exposed equally at each seat'},{name:'dice comparison',seeds:'2001–2020',policies:['balanced'],dicePolicies:['adaptive','safe','balanced','risky'],scope:'All seats use the named dice policy; all other decisions identical.'}],players:[2,3,4],decisionLimit:2000,samples:'First ten completed attempts of seeds 3001 onward, cycling 2/3/4 players, mixed rotated policies. Failed/stalled attempts retained separately.',targets:{termination:'100% completed; no failures or stalls',length:'Exploratory: fewer auctions than previous fixed-round game; no established human-minute target',spread:'Exploratory: positions, range and zero-paying company count',components:'Exploratory exposure, selection and contribution; no causal strength ranking'},random:'Uniform legal action candidates and uniform integer bid 0..cash; stress baseline, not a competent bidding policy.',budget:'All nine dice pairs evaluated exactly over 16 summed-number/fumble outcomes through authoritative founder resolver; heuristic future payouts/bids/value plays/hiring.',confounding:'Rules changed since v131; the dice forecast was adapted to joint reveals and round limits. Other decision heuristics are unchanged. This is not a pure rule-only controlled comparison.'};
fs.writeFileSync(dir+'/manifest.json',JSON.stringify(protocol,null,2));
fs.copyFileSync('scripts/live-dice-metrics.json',dir+'/metric-registry.json');
const records=[],attempts=[],start=Date.now();
function record(g,meta){
 const actions=g.log.filter(e=>e.type==='action'),sold=g.auctionHistory.filter(a=>a.winner!==null),positions=g.companies.map(c=>c.position),mean=positions.reduce((a,b)=>a+b,0)/6;
 const values={},founders={},types={},pairs={};
 for(const a of actions){types[a.command.type]=(types[a.command.type]??0)+1;for(const k of new Set(a.values))((values[k]??={exposures:0,plays:0,noEffect:0}).exposures++);for(const f of a.founders)((founders[f]??={companyActions:0,marketActions:0,hires:0,forward:0,backward:0}).companyActions++);for(const f of a.market)((founders[f]??={companyActions:0,marketActions:0,hires:0,forward:0,backward:0}).marketActions++);}
 for(const e of g.log){if(e.type==='valueResolved'){const v=values[e.value.kind]??={exposures:0,plays:0,noEffect:0};v.plays++;v.noEffect+=!!e.value.noEffect;}if(e.type==='diceChoice'&&!e.setup){const key=e.dice.join('+');pairs[key]=(pairs[key]??0)+1;}}
 for(const [f,m] of Object.entries(g.metrics.founderMovement??{}))Object.assign(founders[f]??={companyActions:0,marketActions:0,hires:0},m);
 for(const e of g.log.filter(e=>e.type==='founder')){if(e.founder!=null)(founders[e.founder]??={companyActions:0,marketActions:0,hires:0,forward:0,backward:0}).hires++;}
 return {...meta,meaningful:g.simulationStats.meaningful,steps:g.simulationStats.steps,status:g.ended?'complete':g.stalled?'stalled':'censored',rounds:g.round,leg:g.leg+1,legEnds:g.log.filter(e=>e.type==='legEnd').map(e=>({leg:e.leg+1,round:e.round,turn:e.turn})),reveals:g.metrics.reveals,actions:actions.length,auctions:g.auctionHistory.length,sales:sold.length,shares:g.companies.reduce((n,c)=>n+c.tokens.length,0),rolls:g.metrics.rolls,prices:sold.map(a=>a.paid),positions,spread:Math.max(...positions)-Math.min(...positions),positionSD:Math.sqrt(positions.reduce((n,x)=>n+(x-mean)**2,0)/6),zeroPaying:positions.filter(p=>p<=10).length,unused:g.players.map(p=>p.dealFlow.length),scores:g.scores,winners:g.winners,capital:g.players.map(p=>p.capitalCalled),actionsByType:types,actionsByRound:g.log.filter(e=>e.type==='roundEnd').map(e=>e.actions.reduce((a,b)=>a+b,0)),dicePairs:pairs,values,founders};
}
function run(meta,trace=false){try{const g=simulateLiveDice({...meta,trace});return {g,row:record(g,meta)};}catch(error){return {row:{...meta,status:'failed',error:error.stack}};}}
for(const players of [2,3,4]){
 for(const cohort of ['self','mixed'])for(let seed=1001;seed<=1040;seed++){
  const base=['balanced','growth','saver','random'],policies=cohort==='self'?['balanced']:base.map((_,i)=>base[(i+seed)%4]);
  records.push(run({players,seed,cohort,policies,dicePolicy:'adaptive'}).row);
 }
 for(const dicePolicy of ['adaptive','safe','balanced','risky'])for(let seed=2001;seed<=2020;seed++)records.push(run({players,seed,cohort:'dice',policies:['balanced'],dicePolicy}).row);
 console.log(`Completed ${players}-player cohorts (${records.length} attempts)`);
}
let completed=0;
for(let seed=3001;completed<10&&seed<3101;seed++){
 const players=2+(seed-3001)%3,base=['balanced','growth','saver','random'],policies=base.map((_,i)=>base[(i+seed)%4]);
 const {g,row}=run({players,seed,cohort:'sample',policies,dicePolicy:'adaptive'},true);attempts.push(row);
 if(g){const filename=`samples/${seed}.json`;fs.writeFileSync(dir+'/'+filename,JSON.stringify({meta:row,replay:g.replay,decisions:g.decisions,events:g.log,metrics:g.metrics,accounts:g.accounts,companies:g.companies},null,2));row.file=filename;}
 if(row.status==='complete')completed++;
}
fs.writeFileSync(dir+'/games.jsonl',records.map(r=>JSON.stringify(r)).join('\n')+'\n');fs.writeFileSync(dir+'/sample-attempts.json',JSON.stringify(attempts,null,2));
fs.writeFileSync(dir+'/runtime.json',JSON.stringify({seconds:(Date.now()-start)/1000,attempted:records.length,completedSamples:completed},null,2));
console.log(dir);
