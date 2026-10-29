import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {mean,quantile,ratio,interval,contrast,holm,equalCategoryTest,random} from './statistics.js';
import {exitRevenue} from './exit-revenue.js';
import {founderCluster,founderCredits} from './founder-credit.js';
const out=process.argv[2];
if(!out)throw Error('Pass a new study directory explicitly; historical reports are immutable.');
const read=f=>JSON.parse(fs.readFileSync(path.join(out,f)));
const manifest=read('study/study.json'),protocol=read('protocol.json'),runs=read('study/raw.json');
assert(protocol.primary.founders.includes('final net money'),'Recalculate historical metrics in a new comparison directory, not in the old report.');
const {COMPANIES,FOUNDERS,VERSION}=await import(pathToFileURL(path.resolve(out,'study/source/config.js')));
const {INTEL_CARDS}=await import(pathToFileURL(path.resolve(out,'study/source/intel.js')));
assert(manifest.finished);assert.equal(runs.length,1000);assert.equal(manifest.completed,1000);assert.equal(manifest.playerCount,4);
assert.equal(new Set(runs.map(r=>r.seed)).size,1000);
const sum=a=>a.reduce((s,x)=>s+x,0),ci=a=>interval(a,{iterations:5000}),scalar=a=>({mean:mean(a),median:quantile(a,.5),p10:quantile(a,.1),p90:quantile(a,.9),p95:quantile(a,.95),max:Math.max(...a),ci:ci(a.map(x=>[1,x]))});
for(const r of runs){
 assert(r.ok);assert.equal(r.players,4);assert.equal(r.samples,8);assert.equal(r.version,VERSION);assert(r.native?.available&&r.native.calls>0&&r.native.fallbacks===0);
 assert.deepEqual(exitRevenue(r.settlement,r.history),r.exit);
 const ledger=r.exit.byPlayer.map(a=>a.map(()=>0));for(const i of r.metrics.investments)ledger[i.player][i.company]+=i.payout;assert.deepEqual(ledger,r.exit.byPlayer);
 for(const a of r.settlement.accounts)assert.equal(r.scores[a.player],a.cash-a.unpaid-a.fee);
 assert.equal(50*(4+r.actions.raise)+r.exit.total+sum(r.cards.map(c=>c.cashChange??0))-sum(r.auctions.map(a=>a.paid))-sum(r.settlement.accounts.map(a=>a.due+a.fee)),sum(r.scores),'Money creation/spending/obligations ledger');
 assert(r.pileFlows.every(f=>f.closed&&f.start+f.added-f.drawn-f.burned===f.end));
}
const companies=COMPANIES.slice(0,6).map(c=>{
 const revenue=runs.map(r=>[1,r.exit.companies[c.id].revenue]);
 const rows=runs.map(r=>r.exit.companies[c.id]);
 const spending=runs.map(r=>sum(r.auctions.filter(a=>a.company===c.id).map(a=>a.paid)));
 const issued=sum(rows.map(c=>c.investorShares));
 return {id:c.id,name:c.name,total:sum(rows.map(c=>c.revenue)),mean:ratio(revenue),ci:ci(revenue),auctionSpend:mean(spending),perShare:sum(rows.map(c=>c.revenue))/issued,heldShares:issued,zero:mean(rows.map(c=>+(c.revenue===0))),position:scalar(runs.map(r=>r.companies[c.id].position)),meanSupplyLeft:mean(runs.map(r=>r.companies[c.id].supply))};
});
const companyTests=holm(companies.flatMap((a,i)=>companies.slice(i+1).map(b=>({a:a.id,b:b.id,...contrast(runs.map(r=>[1,r.exit.companies[a.id].revenue]),runs.map(r=>[1,r.exit.companies[b.id].revenue]),{iterations:5000})}))));
const founderClusters=id=>runs.map(r=>founderCluster(r,id));
const founders=FOUNDERS.map((f,id)=>{
 const clusters=founderClusters(id);
 const mix=companies.map(c=>{const served=runs.filter(r=>r.history[c.id].includes(id));return {company:c.id,served:served.length,mean:served.length?mean(served.map(r=>r.exit.companies[c.id].revenue)):null};});
 return {id,name:f.name,users:sum(clusters.map(c=>c[0])),served:sum(clusters.map(c=>c[0])),games:clusters.filter(c=>c[0]).length,total:sum(clusters.map(c=>c[1])),mean:ratio(clusters),ci:ci(clusters),rounds:sum(runs.map(r=>r.exposure[id]?.rounds??0)),ready:sum(runs.map(r=>r.exposure[id]?.ready??0)),hires:sum(runs.map(r=>r.hires[id]??0)),offers:sum(runs.map(r=>r.powers[id]?.offered??0)),uses:sum(runs.map(r=>r.powers[id]?.used??0)),movement:sum(runs.map(r=>(r.movement[id]?.forward??0)-(r.movement[id]?.backward??0))),companyMix:mix};
});
const founderBoot=founders.map(()=>[]),rng=random(12345);
for(let b=0;b<5000;b++){
 const counts=new Float64Array(founders.length),cash=new Float64Array(founders.length);
 for(let i=0;i<runs.length;i++){const r=runs[Math.floor(rng()*runs.length)];for(const f of founderCredits(r.scores,r.concurrent)){counts[f.founder]++;cash[f.founder]+=f.money;}}
 for(let f=0;f<founders.length;f++)founderBoot[f].push(counts[f]?cash[f]/counts[f]:null);
}
const founderTests=holm(founders.flatMap((a,i)=>founders.slice(i+1).map(b=>{const test=contrast(founderClusters(a.id),founderClusters(b.id),{iterations:0});return {a:a.id,b:b.id,...test,ci:(()=>{const diffs=founderBoot[a.id].flatMap((x,i)=>x!==null&&founderBoot[b.id][i]!==null?[x-founderBoot[b.id][i]]:[]);return[quantile(diffs,.025),quantile(diffs,.975)];})()};})));
const cards=Object.entries(INTEL_CARDS).map(([kind,card])=>{
 const plays=runs.flatMap(r=>r.cards.filter(c=>c.kind===kind));
 const users=runs.map(r=>r.scores.flatMap((_,p)=>r.played[p].includes(kind)?[p]:[]));
 const used=runs.map((r,i)=>[users[i].length,sum(users[i].map(p=>r.scores[p]))]);
 const unused=runs.map((r,i)=>[4-users[i].length,sum(r.scores.filter((_,p)=>!users[i].includes(p)))]);
 const opportunities=runs.map(r=>r.choices.filter(c=>c.cards.some(x=>x.kind===kind))),eligible=opportunities.map(a=>a.filter(c=>c.cards.some(x=>x.kind===kind&&x.eligible)).length);
 const selections=opportunities.map(a=>a.filter(c=>c.command==='playIntel'&&c.selected===kind).length);
 assert.equal(sum(selections),plays.length,`Resolved play/selection mismatch: ${kind}`);
 const selected=eligible.map((n,i)=>[n,selections[i]]);
 return {kind,name:card.name,plays:plays.length,games:runs.filter(r=>r.cards.some(c=>c.kind===kind)).length,users:sum(used.map(c=>c[0])),nonusers:sum(unused.map(c=>c[0])),userMoney:ratio(used),nonuserMoney:ratio(unused),...contrast(used,unused,{iterations:5000}),heldOpportunities:sum(opportunities.map(a=>a.length)),eligibleOpportunities:sum(eligible),selection:ratio(selected),selectionCi:ci(selected),exchanges:sum(opportunities.map(a=>a.filter(c=>c.command==='exchangeValue'&&c.selected===kind).length)),noEffect:mean(plays.map(c=>+!!c.noEffect)),cashChange:sum(plays.map(c=>c.cashChange??0)),meanCash:mean(plays.map(c=>c.cashChange??0)),legs:[0,1,2].map(leg=>plays.filter(c=>c.leg===leg).length)};
});
const valueCards=holm(cards);
const actionKeys=Object.keys(runs[0].actions),actions=Object.fromEntries(actionKeys.map(k=>[k,sum(runs.map(r=>r.actions[k]))]));
const meaningful=actions.auction+actions.hire+actions.pass;
const scores=runs.flatMap(r=>r.scores),flows=runs.flatMap(r=>r.pileFlows),wins=Array.from({length:4},(_,i)=>sum(runs.map(r=>r.winners.includes(i)?1/r.winners.length:0)));
const seatMoney=Array.from({length:4},(_,i)=>({seat:i+1,...scalar(runs.map(r=>r.scores[i])),winCredit:wins[i]/1000}));
const uniqueWins=Array.from({length:4},(_,i)=>runs.filter(r=>r.winners.length===1&&r.winners[0]===i).length);
const seatsTest=equalCategoryTest(uniqueWins,{iterations:10000});
const health={rounds:scalar(runs.map(r=>r.roundCount)),score:scalar(scores),gameMeanMoney:scalar(runs.map(r=>mean(r.scores))),grossPerInvestor:mean(runs.map(r=>r.exit.total/4)),defaults:mean(runs.map(r=>r.defaults/4)),defaultsCi:ci(runs.map(r=>[4,r.defaults])),negative:mean(scores.map(x=>+(x<0))),negativeCi:ci(runs.map(r=>[4,r.scores.filter(s=>s<0).length])),obligationsPerInvestor:mean(runs.flatMap(r=>r.settlement.accounts.map(a=>a.due/55))),spread:scalar(runs.map(r=>Math.max(...r.final.positions)-Math.min(...r.final.positions))),winnerMargin:scalar(runs.map(r=>{const s=[...r.scores].sort((a,b)=>b-a);return s[0]-s[1];})),tiedWinnerGames:runs.filter(r=>r.winners.length>1).length,seatMoney,seatsTest,actions,mainDecisions:meaningful,passRate:actions.pass/meaningful,hireRate:actions.hire/meaningful,contested:sum(runs.map(r=>r.metrics.contested))/sum(runs.map(r=>r.metrics.auctions)),auctionTies:sum(runs.map(r=>r.metrics.ties))/sum(runs.map(r=>r.metrics.auctions)),pile:{rounds:flows.length,added:mean(flows.map(f=>f.added)),treasury:mean(flows.map(f=>f.treasuryAdded)),removed:mean(flows.map(f=>f.drawn)),burned:mean(flows.map(f=>f.burned)),end:scalar(flows.map(f=>f.end)),lastRoundEnd:scalar(runs.map(r=>r.pileFlows.at(-1).end))},bidding:[0,1,2].map(leg=>{const bids=runs.flatMap(r=>r.bids.filter(b=>b.leg===leg)),paid=runs.flatMap(r=>r.auctions.filter(a=>a.leg===leg&&a.winner!==null));return {leg:leg+1,count:bids.length,pass:mean(bids.map(b=>+(b.amount===0))),positiveMedian:quantile(bids.filter(b=>b.amount>0).map(b=>b.amount),.5),paidMean:mean(paid.map(a=>a.paid)),paidMedian:quantile(paid.map(a=>a.paid),.5),paidP90:quantile(paid.map(a=>a.paid),.9)};})};
const blocks=Array.from({length:4},(_,i)=>runs.filter(r=>r.seed>=1100000+250*i&&r.seed<1100000+250*(i+1)));
const stability={companies:companies.map(c=>({id:c.id,name:c.name,means:blocks.map(a=>mean(a.map(r=>r.exit.companies[c.id].revenue)))})),founders:founders.map(f=>({id:f.id,name:f.name,means:blocks.map(a=>ratio(a.map(r=>{return founderCluster(r,f.id);})))}))};
health.score.ci=health.gameMeanMoney.ci;
health.pile.end.ci=ci(runs.map(r=>[r.pileFlows.length,sum(r.pileFlows.map(f=>f.end))]));
health.leverage=[1,2,3,4].map(n=>{const a=runs.flatMap(r=>r.settlement.accounts.filter(a=>a.due===55*n).map(a=>({score:r.scores[a.player],default:a.unpaid>0})));return {LPs:n,investors:a.length,money:mean(a.map(a=>a.score)),default:mean(a.map(a=>+a.default))};}).filter(a=>a.investors);
assert(founders.every(f=>Number.isFinite(f.movement)));
const auditSummary=read('bot-audit/summary.json');assert.equal(auditSummary.length,10);
const anomalies=read('bot-audit/history-anomalies.json');
const summary={studyId:protocol.studyId,version:VERSION,protocol,manifest,health,companies,companyTests,founders,founderTests,valueCards,stability,auditSummary,reliability:{completed:1000,failed:0,censored:0,accountingMismatches:0,pileMismatches:0,nativeFallbacks:sum(runs.map(r=>r.native.fallbacks)),nativeCalls:sum(runs.map(r=>r.native.calls)),mainReplays:10,auditedReplays:10,historyRewrites:anomalies.length,auditGamesWithHistoryRewrites:new Set(anomalies.map(a=>a.seed)).size},provenance:{protocolSha256:createHash('sha256').update(fs.readFileSync(path.join(out,'protocol.json'))).digest('hex'),analysisSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex')}};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
const cell=x=>'"'+String(x).replaceAll('"','""')+'"';
const receipts=[['seed','investor','company','shares','exit_price','receipts','final_money','company_founder_history']];
for(const r of runs)for(const c of r.exit.companies)for(let p=0;p<4;p++)receipts.push([r.seed,p+1,COMPANIES[c.company].name,r.settlement.holdings[p][c.company],c.price,c.receipts[p],r.scores[p],c.founders.map(id=>FOUNDERS[id].name).join(' | ')]);
fs.writeFileSync(path.join(out,'exit-payments.csv'),receipts.map(a=>a.map(cell).join(',')).join('\n')+'\n');
const founderReceipts=[['seed','investor','founder','final_net_money_credit']];
for(const r of runs)for(const f of founderCredits(r.scores,r.concurrent))founderReceipts.push([r.seed,f.player+1,FOUNDERS[f.founder].name,f.money]);
fs.writeFileSync(path.join(out,'founder-credits.csv'),founderReceipts.map(a=>a.map(cell).join(',')).join('\n')+'\n');
console.log(JSON.stringify({companies:companies.map(c=>[c.name,c.mean,c.ci]),founders:[...founders].sort((a,b)=>b.mean-a.mean).map(f=>[f.name,f.served,f.mean,f.ci]),cards:valueCards.map(c=>[c.name,c.plays,c.selection,c.estimate,c.ci,c.adjustedP]),health,companySignificant:companyTests.filter(t=>t.significant),founderSignificant:founderTests.filter(t=>t.significant).length},null,2));
