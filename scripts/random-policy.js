// Policy interventions use public observations and a separate seeded RNG, never the deck RNG.
export function randomizedCommand(v,id,policy,random,{engine,config,intel}){
 if(['delayTwoRounds','delayFirstLeg'].includes(policy)&&['bid','tie'].includes(v.phase)&&(policy==='delayTwoRounds'?v.metrics.cycles<=2:v.leg===0))return{type:v.phase,amount:0};
 const pick=choices=>choices[Math.floor(random()*choices.length)];
 if(policy==='randomBid'&&['bid','tie'].includes(v.phase)){
  const c=v.companies[v.auction.company],minimum=v.phase==='bid'?v.auction.reserve:Math.max(v.auction.reserve,v.auction.price+config.currencyUnit(v.rules)),cash=config.availableCash(v.players[id]);
  const levels=config.fundingPrices(config.fundingBand(c.position),v.rules).slice(0,3-c.reserve).filter(x=>x>=minimum&&x<=cash);
  return{type:v.phase,amount:pick([0,...new Set(levels)])};
 }
 if(policy==='randomCall'&&v.phase==='call')return pick([...engine.eligibleCompanies(v,id).map(company=>({type:'call',company})),...v.companies.filter(c=>engine.lead(c)===id).map(c=>({type:'changeFounder',company:c.id})),...(v.version<91?[{type:'raiseMoney'}]:[]),{type:'call',company:null}]);
 if(policy==='randomValue'&&v.phase==='intelPlay'){
  const choices=intel.canDrawIntel(v,id)?[{type:'drawValue'}]:[];
  if(intel.canExchangeIntel?.(v,id))choices.push(...v.players[id].intel.map((_,card)=>({type:'exchangeValue',card})));
  for(const [card,item] of v.players[id].intel.entries())for(const company of intel.intelTargets(v,id,item.kind)){
   const seconds=intel.intelSecondTargets(v,id,item.kind,company);
   for(const target of item.kind==='move'?[undefined,...seconds]:seconds.length?seconds:[undefined])choices.push({type:'playIntel',card,company,target});
  }
  return choices.length?pick(choices):{type:'passValue'};
 }
 if(policy==='randomFounder'&&v.phase==='founder'){
  const choices=v.founderMarket.flatMap((f,i)=>config.canHireFounder(f,v.leg)?[i]:[]);
  if(v.rules.intelMode==='off')choices.unshift(-1);
  return{type:'founder',choice:pick(choices)};
 }
 if(policy==='randomPower'&&v.phase==='power')return{type:'power',choice:Math.floor(random()*v.powerChoice.options.length)};
}
