import {currencyUnit,capitalPenalty,ipoFinisher} from './config.js';
import {shareCount} from './ownership.js';
// Shares pay once, at the final top-three exit; grants and obligations accumulate.
export function portfolioWealth(view,id,values,sample,{payment=0,company=null,shareCounts=null}={}) {
 const p=view.players[id];
 let wealth=p.cash-payment-(values[0].futureSpending?.[id]?.[sample]??0)+(p.savedCash??0)-(p.debt??0)-(p.fees??0)-p.obligation-capitalPenalty(p);
 for(const c of view.companies){const held=(shareCounts?shareCounts[c.id]:shareCount(c,id))+Number(company===c.id)+(values[c.id].futureShares?.[id]?.[sample]??0);wealth+=held*(values[c.id].finalPrices?.[sample]??values[c.id].legPrices?.at(-1)?.[sample]??values[c.id].prices[sample]);}
 return wealth;
}

// All action and auction comparisons use the same discounted portfolio payoff.
export function portfolioSamples(view,id,values,{winner=null,paid=0,company=null}={}) {
 const wealth=(player,sample)=>{
  const acquired=winner===player?company:null;
  const proceeds=view.companies.reduce((sum,c)=>sum+(shareCount(c,player)+Number(c.id===acquired)+(values[c.id].futureShares?.[player]?.[sample]??0))*values[c.id].finalPrices[sample],0);
  const discount=Math.pow(.95,values[0].roundsToExit?.[sample]??0);
  return portfolioWealth(view,player,values,sample,{payment:winner===player?paid:0,company:acquired})-(1-discount)*proceeds+portfolioOptions(view,player,acquired);
 };
 return values[0].prices.map((_,sample)=>wealth(id,sample)-0.5*Math.max(...view.players.filter(p=>p.id!==id).map(p=>wealth(p.id,sample))));
}
export function riskUtility(outcomes){
 const mean=outcomes.reduce((sum,x)=>sum+x,0)/outcomes.length;
 return mean-.25*Math.sqrt(outcomes.reduce((sum,x)=>sum+(x-mean)**2,0)/outcomes.length);
}

// Reaching 24 while fumbled is not an exit: retain the value of finding recovery.
export function optionHorizon(view){
 const furthest=Math.max(...view.companies.map(c=>c.position));
 if(view.ended||furthest>=24&&ipoFinisher(view)!==null)return 0;
 const active=furthest>=24?Math.max(0,...view.companies.filter(c=>!c.down&&!c.hiringFumble).map(c=>c.position)):furthest;
 return Math.max(1/24,1-active/24);
}
// A first stake unlocks portfolio cards and founder combinations; duplicates do not.
export function portfolioOptions(view,id,company=null) {
 if(view.rules.intelMode==='off')return 0;
 const horizon=optionHorizon(view);
 const owned=view.companies.filter(c=>c.id===company||c.tokens.some(t=>t.owner===id));
 const access=owned.length?4*horizon:0;
 return access+view.companies.reduce((sum,c)=>{
  if(c.id!==company&&!c.tokens.some(t=>t.owner===id))return sum;
  const cards=(c.supplyCount??c.supply?.length??0)+(view.poolWeights?.[c.id]??0);
  return sum+2*horizon*Math.min(1,cards/4);
 },0);
}
