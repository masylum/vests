import {companyValue,dilution,slotCards} from './config.js';
export const INTEL_MODES={off:'Classic · no value cards',mixed:'Value cards',support:'Value cards',scouting:'Value cards'};
export const INTEL_CARDS={
 recover:{name:'Resolve crisis',timing:'turn',text:'**Move** a portfolio company **1** and **recover** it if fumbled.'},
 inside:{name:'Inside information',timing:'turn',text:'Inspect the **face-up growth discards**. Return **1 card** to the **growth pile**.'},
 move:{name:'Warm introduction',timing:'turn',text:'**Move up to 2** portfolio companies **1 each**, in your chosen order.'},
 bridge:{name:'Bridge financing',timing:'turn',text:'Pay **$3**: a portfolio company gains **1 treasury slot** (maximum 3).'},
 launch:{name:'Launch campaign',timing:'turn',text:'Inspect a portfolio company’s **top 2 supply cards**. **Deploy 1**; keep the other on top.'},
 learn:{name:'Illicit capital',timing:'turn',text:'Choose a portfolio company. Remove **its top 3 supply cards** face down; add **1 to its treasury** (maximum 3).'},
 smear:{name:'Executive hire',timing:'turn',text:'**Fumble** a portfolio company, then **deploy 3** of its supply cards.'},
 swap:{name:'Portfolio rebalance',timing:'turn',text:'**Swap** the spaces of **2** portfolio companies, then **fumble both**.'},
 waste:{name:'Wasteful advice',timing:'turn',text:'Transfer **1 treasury slot** between **2** portfolio companies.'},
 secondary:{name:'Secondary Market',timing:'turn',text:'Choose a portfolio company. Spend **1 of its treasury slots** and **$5** to gain **1 new share in it**.'},
 sell:{name:'Sell position',timing:'turn',text:'Sell **1 of your shares** for **$6 / $12 / $18** in leg 1 / 2 / 3.'},
 headhunt:{name:'Headhunting',timing:'turn',text:'**Swap the founders** of **2 portfolio companies**.'},
 advisor:{name:'Financial advisor',timing:'turn',text:'Choose a portfolio company. Return **2 of its discards to its supply**, then **move that company 1**.'},
 conflict:{name:'Portfolio conflict',timing:'turn',text:'**Move** a portfolio company **back 2**. Gain **$5**.'},
};
export const MAX_VALUE_HAND=3;
export function intelDeck(){return Object.keys(INTEL_CARDS).map((kind,id)=>({id,kind}));}
export const discardedCount=(g,cid)=>g.removed?g.removed.filter(c=>c.company===cid&&!c.burned).length:(g.companies[cid].discardCount??0);
export const canExchangeIntel=(g,id)=>g.players[id].intel.length>0&&g.players.reduce((n,p)=>n+(p.intelCount??p.intel?.length??0),0)<Object.keys(INTEL_CARDS).length;
export const canDrawIntel=(g,id)=>g.players[id].intel.length<MAX_VALUE_HAND&&g.players.reduce((n,p)=>n+(p.intelCount??p.intel?.length??0),0)<Object.keys(INTEL_CARDS).length;
export const invested=(g,id)=>g.companies.filter(c=>c.tokens.some(t=>t.owner===id));
export function intelLead(c){return [...new Set(c.tokens.map(t=>t.owner).filter(x=>x!==null))].sort((a,b)=>c.tokens.filter(t=>t.owner===b).length-c.tokens.filter(t=>t.owner===a).length||(c.lastBuy[b]??0)-(c.lastBuy[a]??0))[0];}
export function intelTargets(g,id,kind){
 if(!INTEL_CARDS[kind])return [];
 const own=invested(g,id),led=own.filter(c=>intelLead(c)===id),supply=c=>c.supplyCount??c.supply?.length??0;
 if(kind==='secondary')return own.filter(c=>c.reserve>=1&&c.tokens.length<g.rules.shareLimit&&g.players[id].cash-(g.players[id].locked??0)>=g.rules.secondaryCost).map(c=>c.id);
 if(kind==='advisor')return own.filter(c=>discardedCount(g,c.id)>=2).map(c=>c.id);
 if(kind==='waste')return own.filter(c=>c.reserve>0&&own.some(x=>x.id!==c.id&&x.reserve<3)).map(c=>c.id);
 if(kind==='conflict')return own.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='inside')return g.companies.filter(c=>discardedCount(g,c.id)>0).map(c=>c.id);
 if(kind==='headhunt')return own.length>=2?own.map(c=>c.id):[];
 if(kind==='smear')return own.map(c=>c.id);
 if(kind==='swap')return own.filter(c=>own.some(x=>x.position!==c.position)).map(c=>c.id);
 if(kind==='back')return g.companies.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='move')return own.filter(c=>c.position<24).map(c=>c.id);
 return (kind==='founder'?led:own).filter(c=>kind==='recover'?c.position<24:kind==='bridge'?c.reserve<3&&supply(c)>0&&g.players[id].cash-(g.players[id].locked??0)>=g.rules.bridgeCost:kind==='learn'?supply(c)>0:['scout','launch'].includes(kind)?supply(c)>0:kind==='move'?c.position<24:true).map(c=>c.id);
}
export const playableIntel=(g,card)=>g.phase==='call'||g.phase==='intelPlay';
export function intelValue(g,id,kind,cid){
 const c=g.companies[cid],fraction=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),weight=fraction*(1+c.position/24);
 if(kind==='sell'){const price=companyValue(c.position,g.rules)/dilution(c),payout=g.rules.sellPayouts[g.leg];return (payout-price)/3;}
 if(kind==='secondary'){const n=c.tokens.length,own=c.tokens.filter(t=>t.owner===id).length;return (1-own/(n+1))*2-Math.min(slotCards(c,c.reserve),c.supplyCount??c.supply?.length??0)*.35-g.rules.secondaryCost/3;}
 if(kind==='waste')return -weight*((c.supplyCount??c.supply?.length??0)>0?1.2:0);
 if(kind==='conflict')return g.rules.conflictPayout/3+(1-2*fraction)*Math.min(2,c.position);
 if(kind==='smear')return (1-2*fraction)*2+weight*Math.min(3,c.supplyCount??c.supply?.length??0)*.6;
 if(kind==='learn')return (1-2*fraction)*1.5+(c.reserve<3?weight*1.8:0);
 if(kind==='advisor')return weight*(c.position>=23?10:2);
 if(kind==='headhunt')return 0; // Bot swap choices use paired portfolio forecasts.
 if(kind==='inside')return Math.max(...(g.discarded??g.removed??[]).filter(card=>!card.burned&&card.company===cid).map(card=>discardValue(g,id,card)));
 if(kind==='back')return (1-2*fraction)*Math.min(2,c.position)*(1+c.position/24);
 return weight*(kind==='move'?(c.position>=23?10:1):kind==='recover'?(c.position>=23?10:1)+(c.down?2.5:0):kind==='learn'?Math.min(5,c.discardCount??g.removed?.filter(x=>x.company===cid&&!x.burned).length??0):kind==='bridge'?1.2:kind==='founder'?.6:kind==='swap'?.5:1.5);
}
export function discardValue(g,id,card){
 const c=g.companies[card.company],own=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),leading=c.position===Math.max(...g.companies.map(c=>c.position));
 const movement=c.down&&card.signature!=='recover'?.5:card.effect==='fumble'?(c.founder===11?2:-3):card.signature==='breakthrough'?(leading?1:3):(card.printed??0)+(card.signature?.5:0);
 return movement*(own-.3*(1-own));
}
export function intelSecondTargets(g,id,kind,cid){
 if(kind==='headhunt')return invested(g,id).filter(c=>c.id!==cid).map(c=>c.id);
 if(kind==='waste')return invested(g,id).filter(c=>c.id!==cid&&c.reserve<3).map(c=>c.id);
 if(kind==='move')return intelTargets(g,id,kind).filter(x=>x!==cid);
 if(kind==='swap')return g.companies.filter(c=>c.id!==cid&&c.tokens.some(t=>t.owner===id)&&c.position!==g.companies[cid].position).map(c=>c.id);
 return [];
}
export function bestIntelPlay(g,id,score=(kind,cid)=>intelValue(g,id,kind,cid)){
 let best={value:-Infinity,card:-1};
 for(const [card,item] of (g.players[id].intel??[]).entries())if(!item.disabled&&playableIntel(g,item))for(const company of intelTargets(g,id,item.kind)){
  const seconds=intelSecondTargets(g,id,item.kind,company);
  const targets=item.kind==='move'?[undefined,...seconds]:seconds.length?seconds:[undefined];
  for(const target of targets){
   let value=score(item.kind,company,target);
   if(item.kind==='waste')value-=intelValue(g,id,item.kind,target);
   if(item.kind==='move'&&target!==undefined)value+=intelValue(g,id,item.kind,target);
   if(item.kind==='swap'){
    const a=g.companies[company],b=g.companies[target];
    // Score both directions: moving a majority stake backwards can erase the minority stake's gain.
    const weight=c=>c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length)*(1+c.position/24);
    value=(b.position-a.position)*(weight(a)-weight(b))-[a,b].reduce((s,c)=>s+(c.down?0:weight(c)*1.5),0);
   }
   if(value>best.value)best={value,card,company,target};
  }
 }
 return best;
}
export function expectedIntelValue(g,id){
 return Object.keys(INTEL_CARDS).reduce((sum,kind)=>{
  const values=intelTargets(g,id,kind).map(cid=>{
   const second=['move','waste'].includes(kind)?Math.max(0,...intelSecondTargets(g,id,kind,cid).map(t=>(kind==='waste'?-1:1)*intelValue(g,id,kind,t))):0;
   return intelValue(g,id,kind,cid)+second;
  });
  return sum+Math.max(0,...values);
 },0)/Object.keys(INTEL_CARDS).length;
}
