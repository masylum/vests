import {mkdirSync,writeFileSync} from 'node:fs';
import {simulateLiveDice} from './live-dice-simulate.js';
import {DICE_BOT_VERSION} from '../src/live-dice-bots.js';

const [directory='docs/dice-immediate-v157/run-01',cohort='bulk',group]=process.argv.slice(2);
const samples=cohort==='planner';
if(!['bulk','planner'].includes(cohort))throw Error('Choose bulk or planner.');
mkdirSync(directory,{recursive:true});
const rows=[];
const policies=['diversification'];
const seats=samples?[2,2,2,3,3,3,4,4,4,4]:Array.from({length:90},(_,i)=>2+i%3);
for(const [index,players] of seats.entries()){
 if(group&&players!==Number(group))continue;
 const seed=(samples?157700:157100)+index;
 for(const revision of [156,157]){
  const trace=samples&&revision===157;
  const options={seed,players,policies,revision,supportPolicy:samples?'planner':'legacy'};
  const row={...options,cohort,bot:DICE_BOT_VERSION};
  try {
   const g=simulateLiveDice({...options,trace});
   const sales=g.auctionHistory.filter(a=>a.winner!==null);
   const turns=g.log.filter(e=>e.type==='action'&&e.command.type==='call');
   const winCredit=g.players.map(p=>g.winners?.includes(p.id)?1/g.winners.length:0);
   const orderWins=Array.from({length:players},(_,offset)=>winCredit[(g.first-(g.round-1)+players*g.round+offset)%players]);
   Object.assign(row,{status:g.ended?'complete':'censored',reason:g.endReason??g.cutoff,
    rounds:g.round,positions:g.companies.map(c=>c.position),scores:g.scores,orderWins,
    spread:Math.max(...g.companies.map(c=>c.position))-Math.min(...g.companies.map(c=>c.position)),
    prices:sales.map(a=>a.paid),auctionCount:g.auctionHistory.length,bankCards:g.log.filter(e=>e.type==='bankFunding').length,
    recoveryDiscards:g.log.filter(e=>e.type==='deferred').length,
    valuePlays:g.log.filter(e=>e.type==='valueResolved').length,calls:turns.length});
   if(trace)writeFileSync(`${directory}/sample-${seed}.json`,JSON.stringify({row,replay:g.replay,events:g.log,decisions:g.decisions,accounts:g.accounts}));
  } catch(error){Object.assign(row,{status:'failed',error:error.stack});}
  rows.push(row);
  writeFileSync(`${directory}/${cohort}${group?'-'+group:''}.jsonl`,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 }
}
console.log(`${cohort}: ${rows.length} games, ${rows.filter(r=>r.status==='complete').length} complete`);
