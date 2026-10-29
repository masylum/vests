import {currencyUnit} from './config.js';
import {shareCount} from './ownership.js';
// Shares pay once, at the final top-three exit; grants and obligations accumulate.
export function portfolioWealth(view,id,values,sample,{payment=0,company=null,shareCounts=null}={}) {
 const p=view.players[id];
 let wealth=p.cash-payment-(values[0].futureSpending?.[id]?.[sample]??0)+(p.savedCash??0)-(p.debt??0)-(p.fees??0)-p.obligation;
 for(const c of view.companies){const held=(shareCounts?shareCounts[c.id]:shareCount(c,id))+Number(company===c.id)+(values[c.id].futureShares?.[id]?.[sample]??0);wealth+=held*(values[c.id].finalPrices?.[sample]??values[c.id].legPrices?.at(-1)?.[sample]??values[c.id].prices[sample]);}
 return wealth;
}

// A first stake unlocks portfolio cards and founder combinations; duplicates do not.
export function portfolioOptions(view,id,company=null) {
 if(view.rules.intelMode==='off')return 0;
 const horizon=Math.max(0,1-Math.max(...view.companies.map(c=>c.position))/24);
 return view.companies.reduce((sum,c)=>{
  if(c.id!==company&&!c.tokens.some(t=>t.owner===id))return sum;
  const cards=(c.supplyCount??c.supply?.length??0)+(view.poolWeights?.[c.id]??0);
  return sum+2*horizon*Math.min(1,cards/4);
 },0);
}
