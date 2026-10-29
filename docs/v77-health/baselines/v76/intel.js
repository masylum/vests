import {canHireFounder} from './config.js';
export const INTEL_MODES={off:'Classic · no value cards',mixed:'Value cards',support:'Value cards',scouting:'Value cards'};
export const INTEL_CARDS={
 recover:{name:'Resolve crisis',timing:'turn',text:'Move a portfolio company **1 space**. **Recover** it if fumbled.'},
 inside:{name:'Inside information',timing:'turn',text:'Look at a portfolio company’s **top 3** supply cards. **Remove 1** face down, then shuffle its supply.'},
 move:{name:'Warm introduction',timing:'turn',text:'Move **up to 2** portfolio companies **1 space each**. Choose the order.'},
 bridge:{name:'Bridge financing',timing:'turn',text:'Pay **$3** to add **1 treasury slot** to a portfolio company.'},
 launch:{name:'Launch campaign',timing:'turn',text:'Look at a portfolio company’s **top 2** supply cards. **Deploy 1** face down. Keep the other on top.'},
 learn:{name:'Illicit capital',timing:'turn',text:'Remove the **top 2** supply cards from a portfolio company, then add **1 treasury slot** (**maximum 3**).'},
 smear:{name:'Executive hire',timing:'turn',text:'**Fumble** a portfolio company, then **deploy 2** of its cards.'},
 swap:{name:'Portfolio rebalance',timing:'turn',text:'**Swap** the spaces of **2** portfolio companies.'},
 waste:{name:'Wasteful advice',timing:'turn',text:'Transfer **1 treasury slot** between **2** portfolio companies.'},
 headhunt:{name:'Headhunting',timing:'turn',text:'**Change the founder** of a portfolio company, then **draw 1 value card**.'},
 advisor:{name:'Financial advisor',timing:'turn',text:'Return **2 discarded cards** from a portfolio company to its supply, then **move 1**.'},
 conflict:{name:'Portfolio conflict',timing:'turn',text:'Move a portfolio company **2 spaces back**. Get **$6** from the bank.'},
};
export const MAX_VALUE_HAND=3;
export function intelDeck(){return Object.keys(INTEL_CARDS).map((kind,id)=>({id,kind}));}
export const discardedCount=(g,cid)=>g.removed?g.removed.filter(c=>c.company===cid&&!c.burned).length:(g.companies[cid].discardCount??0);
export const canDrawIntel=(g,id)=>g.players[id].intel.length<MAX_VALUE_HAND&&g.players.reduce((n,p)=>n+(p.intelCount??p.intel?.length??0),0)<Object.keys(INTEL_CARDS).length;
export const invested=(g,id)=>g.companies.filter(c=>c.tokens.some(t=>t.owner===id));
export function intelLead(c){return [...new Set(c.tokens.map(t=>t.owner).filter(x=>x!==null))].sort((a,b)=>c.tokens.filter(t=>t.owner===b).length-c.tokens.filter(t=>t.owner===a).length||(c.lastBuy[b]??0)-(c.lastBuy[a]??0))[0];}
export function intelTargets(g,id,kind){
 if(!INTEL_CARDS[kind])return [];
 if(kind==='headhunt'&&!g.founderMarket.some(f=>canHireFounder(f,g.leg)))return [];
 const own=invested(g,id),led=own.filter(c=>intelLead(c)===id),supply=c=>c.supplyCount??c.supply?.length??0;
 if(kind==='advisor')return own.filter(c=>discardedCount(g,c.id)>=2).map(c=>c.id);
 if(kind==='waste')return own.filter(c=>c.reserve>0&&own.some(x=>x.id!==c.id&&x.reserve<3)).map(c=>c.id);
 if(kind==='conflict')return own.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='inside')return own.filter(c=>supply(c)>0).map(c=>c.id);
 if(kind==='smear')return own.map(c=>c.id);
 if(kind==='swap')return own.filter(c=>own.some(x=>x.position!==c.position)).map(c=>c.id);
 if(kind==='back')return g.companies.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='move')return own.filter(c=>c.position<24).map(c=>c.id);
 return (kind==='founder'?led:own).filter(c=>kind==='recover'?c.position<24:kind==='bridge'?c.reserve<3&&supply(c)>0&&g.players[id].cash-(g.players[id].locked??0)>=3:kind==='learn'?supply(c)>0:['scout','launch'].includes(kind)?supply(c)>0:kind==='move'?c.position<24:true).map(c=>c.id);
}
export const playableIntel=(g,card)=>g.phase==='call'||g.phase==='intelPlay';
export function intelValue(g,id,kind,cid){
 const c=g.companies[cid],fraction=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),weight=fraction*(1+c.position/24);
 if(kind==='waste')return -weight*((c.supplyCount??c.supply?.length??0)>0?1.2:0);
 if(kind==='conflict')return 1.5+(1-2*fraction)*Math.min(2,c.position);
 if(kind==='smear')return (1-2*fraction)*2+(c.founder===11?4*fraction:0)+weight*Math.min(2,c.supplyCount??c.supply?.length??0)*.6;
 if(kind==='learn')return (1-2*fraction)*1.5+(c.reserve<3?weight*1.8:0);
 if(kind==='advisor')return weight*(c.position>=23?10:2);
 if(kind==='headhunt')return .5;
 if(kind==='inside')return invested(g,id).length?1.8:0;
 if(kind==='back')return (1-2*fraction)*Math.min(2,c.position)*(1+c.position/24);
 return weight*(kind==='move'?(c.position>=23?10:1):kind==='recover'?(c.position>=23?10:1)+(c.down?2.5:0):kind==='learn'?Math.min(5,c.discardCount??g.removed?.filter(x=>x.company===cid&&!x.burned).length??0):kind==='bridge'?1.2:kind==='founder'?.6:kind==='swap'?.5:1.5);
}
export function intelSecondTargets(g,id,kind,cid){
 if(kind==='waste')return invested(g,id).filter(c=>c.id!==cid&&c.reserve<3).map(c=>c.id);
 if(kind==='move')return intelTargets(g,id,kind).filter(x=>x!==cid);
 if(kind==='swap')return g.companies.filter(c=>c.id!==cid&&c.tokens.some(t=>t.owner===id)&&c.position!==g.companies[cid].position).map(c=>c.id);
 return [];
}
export function bestIntelPlay(g,id){
 let best={value:-Infinity,card:-1};
 for(const [card,item] of (g.players[id].intel??[]).entries())if(!item.disabled&&playableIntel(g,item))for(const company of intelTargets(g,id,item.kind)){
  const seconds=intelSecondTargets(g,id,item.kind,company);
  const targets=item.kind==='move'?[undefined,...seconds]:seconds.length?seconds:[undefined];
  for(const target of targets){
   let value=intelValue(g,id,item.kind,company);
   if(item.kind==='waste')value-=intelValue(g,id,item.kind,target);
   if(item.kind==='move'&&target!==undefined)value+=intelValue(g,id,item.kind,target);
   if(item.kind==='swap'){
    const a=g.companies[company],b=g.companies[target];
    // Score both directions: moving a majority stake backwards can erase the minority stake's gain.
    const weight=c=>c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length)*(1+c.position/24);
    value=(b.position-a.position)*(weight(a)-weight(b));
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
