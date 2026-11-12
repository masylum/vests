import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateDice} from './dice-simulate.js';
import {DEAL_FLOW_VERSION} from '../src/deal-flow.js';
import {DICE_BOT_VERSION} from '../archive/legacy-dice/dice-bots.js';
const out=process.argv[2]??'docs/dice-pacing-v130',count=Number(process.argv[3]??40);
fs.mkdirSync(out,{recursive:true});
const files=['src','scripts'].flatMap(dir=>fs.readdirSync(dir).filter(f=>f.endsWith('.js')).map(f=>`${dir}/${f}`));
const sources=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
for(const f of files){fs.mkdirSync(`${out}/source/${f.split('/')[0]}`,{recursive:true});fs.copyFileSync(f,`${out}/source/${f}`);}
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({version:DEAL_FLOW_VERSION,bot:DICE_BOT_VERSION,count,seeds:[3000,3000+count-1],players:4,design:'3 payout multipliers × 2 dice settings × 2 action settings × self-play/mixed; paired seeds, rotating mixed seats. Fixed heuristic-1 valuation retained for attribution; not calibrated for two-dice growth. Ten full replay samples.',sources},null,2));
const rows=[];const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;const quantile=(x,p)=>[...x].sort((a,b)=>a-b)[Math.floor((x.length-1)*p)]??0;
for(const actionsPerRound of [5,3])for(const dicePerShare of [1,2])for(const payoutStep of [1,2,3])for(const cohort of ['self','mixed']){
 const subset=[];
 for(let i=0;i<count;i++){
  const policies=cohort==='self'?['balanced']:Array.from({length:4},(_,j)=>['balanced','growth','saver','random'][(j+i)%4]);
  const g=simulateDice({seed:3000+i,players:4,payoutStep,dicePerShare,actionsPerRound,policies});
  const sold=g.auctionHistory.filter(a=>a.winner!==null),prices=sold.map(a=>a.paid);
  const row={seed:3000+i,actionsPerRound,dicePerShare,payoutStep,cohort,auctions:g.auctionHistory.length,sales:sold.length,shares:g.companies.reduce((n,c)=>n+c.tokens.length,0),rolls:g.metrics.rolls,actions:g.metrics.actions,prices,scores:g.scores,positions:g.companies.map(c=>c.position),finishers:g.companies.filter(c=>c.position===24).length,capital:g.players.map(p=>p.capitalCalled)};
  rows.push(row);subset.push(row);
 }
 console.log(JSON.stringify({actionsPerRound,dicePerShare,payoutStep,cohort,auctions:mean(subset.map(r=>r.auctions)),rolls:mean(subset.map(r=>r.rolls)),price:mean(subset.flatMap(r=>r.prices))}));
}
fs.writeFileSync(`${out}/games.jsonl`,rows.map(r=>JSON.stringify(r)).join('\n'));
const summaries=[];
for(const actionsPerRound of [5,3])for(const dicePerShare of [1,2])for(const payoutStep of [1,2,3]){
 const group=rows.filter(r=>r.actionsPerRound===actionsPerRound&&r.dicePerShare===dicePerShare&&r.payoutStep===payoutStep),prices=group.flatMap(r=>r.prices),m=mean(prices);
 summaries.push({actionsPerRound,dicePerShare,payoutStep,games:group.length,auctions:mean(group.map(r=>r.auctions)),sales:mean(group.map(r=>r.sales)),shares:mean(group.map(r=>r.shares)),rolls:mean(group.map(r=>r.rolls)),price:m,priceSD:Math.sqrt(mean(prices.map(p=>(p-m)**2))),p10:quantile(prices,.1),p25:quantile(prices,.25),median:quantile(prices,.5),p75:quantile(prices,.75),p90:quantile(prices,.9),max:Math.max(...prices),finishers:mean(group.map(r=>r.finishers)),threeFinishers:mean(group.map(r=>r.finishers>=3?1:0)),capital:mean(group.flatMap(r=>r.capital))});
}
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summaries,null,2));
for(let i=0;i<10;i++){
 const setup={seed:4000+i,players:4,actionsPerRound:i<2?5:3,dicePerShare:i<2?1:2,payoutStep:1+i%3,policies:Array.from({length:4},(_,j)=>['balanced','growth','saver','random'][(j+i)%4]),trace:true};
 const g=simulateDice(setup);fs.writeFileSync(`${out}/sample-${i}.json`,JSON.stringify(g));
 fs.writeFileSync(`${out}/sample-${i}-timeline.json`,JSON.stringify({setup,scores:g.scores,auctions:g.auctionHistory,events:g.log,decisions:g.decisions},null,2));
}
console.log('Saved '+rows.length+' games and ten replay-verified samples to '+out);
