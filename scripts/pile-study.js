import {mean,quantile,contrast} from './statistics.js';
const sum=a=>a.reduce((n,x)=>n+x,0);
export function pileStats(games){
 const flows=games.flatMap(g=>g.pileFlows),late=games.flatMap(g=>g.pileFlows.filter(f=>f.leg===2));
 for(const f of flows)if(!f.closed||f.start+f.added-f.drawn-(f.discarded??0)-f.burned!==f.end)throw Error('Unreconciled pile flow');
 return {games:games.length,rounds:flows.length,duration:mean(games.map(g=>g.roundCount)),resolved:sum(games.map(g=>g.metrics.revealed))/flows.length,shortRevealGames:mean(games.map(g=>+(g.metrics.revealed<5*g.roundCount))),start:mean(flows.map(f=>f.start)),added:mean(flows.map(f=>f.added)),treasuryAdded:mean(flows.map(f=>f.treasuryAdded)),otherAdded:mean(flows.map(f=>f.added-f.treasuryAdded)),drawn:mean(flows.map(f=>f.drawn)),discarded:mean(flows.map(f=>f.discarded??0)),burned:mean(flows.map(f=>f.burned)),carry:mean(flows.map(f=>f.end)),carry90:quantile(flows.map(f=>f.end),.9),lateCarry:mean(late.map(f=>f.end)),lateAuctionsPerRound:sum(games.map(g=>g.auctions.filter(a=>a.leg===2).length))/late.length,dryRounds:sum(games.map(g=>g.dryRounds)),defaults:mean(games.map(g=>g.defaults/g.players)),emptySupplies:mean(games.map(g=>g.companies.filter(c=>!c.supply).length))};
}
export function burnComparison(control,experiments){
 const seeds=new Set(experiments.map(g=>g.seed)),baseline=control.filter(g=>seeds.has(g.seed));
 return [2,3,4].map(burn=>{const games=burn===2?baseline:experiments.filter(g=>g.rules.burnPerRound===burn),bySeed=new Map(baseline.map(g=>[g.seed,g]));
 if(games.length!==seeds.size||games.some(g=>!bySeed.has(g.seed)))throw Error('Missing burn pairs');
 const carry=g=>mean(g.pileFlows.map(f=>f.end));
 return {burn,...pileStats(games),carryChange:contrast(games.map(g=>[1,carry(g)]),games.map(g=>[1,carry(bySeed.get(g.seed))]))};});
}
