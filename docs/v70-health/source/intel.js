export const INTEL_MODES={off:'Classic · no value cards',mixed:'Value cards',support:'Value cards',scouting:'Value cards'};
export const INTEL_CARDS={
 recover:{name:'Resolve crisis',timing:'turn',text:'Move a portfolio company 1 space. Recover it if fumbled.'},
 inside:{name:'Inside information',timing:'turn',text:'Look at a portfolio company’s top 3 supply cards. Remove 1 face down, then shuffle its supply.'},
 move:{name:'Warm introduction',timing:'turn',text:'Move 2 portfolio companies 1 space each. Choose the order.'},
 bridge:{name:'Bridge financing',timing:'turn',text:'Pay $6 to add 1 treasury slot to a portfolio company.'},
 launch:{name:'Launch campaign',timing:'turn',text:'Look at a portfolio company’s top 2 supply cards. Add 1 to the growth pile face down. Keep the other on top.'},
 learn:{name:'Illicit capital',timing:'turn',text:'Remove the top 2 supply cards from a portfolio company, then add 1 treasury slot (maximum 3).'},
 smear:{name:'Executive hire',timing:'turn',text:'Fumble a portfolio company.'},
 swap:{name:'Portfolio rebalance',timing:'turn',text:'Swap the spaces of 2 portfolio companies.'},
 waste:{name:'Wasteful advice',timing:'turn',text:'Transfer 1 treasury slot between 2 portfolio companies.'},
 conflict:{name:'Portfolio conflict',timing:'turn',text:'Move a portfolio company 2 spaces back.'},
};
export function intelDeck(){return Array.from({length:4*Object.keys(INTEL_CARDS).length},(_,id)=>({id,kind:Object.keys(INTEL_CARDS)[id%Object.keys(INTEL_CARDS).length]}));}
export const invested=(g,id)=>g.companies.filter(c=>c.tokens.some(t=>t.owner===id));
export function intelLead(c){return [...new Set(c.tokens.map(t=>t.owner).filter(x=>x!==null))].sort((a,b)=>c.tokens.filter(t=>t.owner===b).length-c.tokens.filter(t=>t.owner===a).length||(c.lastBuy[b]??0)-(c.lastBuy[a]??0))[0];}
export function canGetIntel(g,id){return g.rules.intelMode!=='off'&&(g.players[id].intel?.length??0)<2;}
export function intelTargets(g,id,kind){
 if(!INTEL_CARDS[kind])return [];
 const own=invested(g,id),led=own.filter(c=>intelLead(c)===id),supply=c=>c.supplyCount??c.supply?.length??0;
 if(kind==='waste')return own.filter(c=>c.reserve>0&&own.some(x=>x.id!==c.id&&x.reserve<3)).map(c=>c.id);
 if(kind==='conflict')return own.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='inside')return own.filter(c=>supply(c)>0).map(c=>c.id);
 if(kind==='smear')return own.filter(c=>!c.down).map(c=>c.id);
 if(kind==='swap')return own.filter(c=>own.some(x=>x.position!==c.position)).map(c=>c.id);
 if(kind==='back')return g.companies.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='move')return own.filter(c=>c.position<24&&own.some(x=>x.id!==c.id&&x.position<24)).map(c=>c.id);
 return (kind==='founder'?led:own).filter(c=>kind==='recover'?c.position<24:kind==='bridge'?c.reserve<3&&supply(c)>0&&g.players[id].cash-(g.players[id].locked??0)>=6:kind==='learn'?supply(c)>0:['scout','launch'].includes(kind)?supply(c)>0:kind==='move'?c.position<24:true).map(c=>c.id);
}
export const playableIntel=(g,card)=>g.phase==='call'||g.phase==='intelPlay';
export function intelValue(g,id,kind,cid){
 const c=g.companies[cid],fraction=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),weight=fraction*(1+c.position/24);
 if(kind==='waste')return -weight*((c.supplyCount??c.supply?.length??0)>0?1.2:0);
 if(kind==='conflict')return (1-2*fraction)*Math.min(2,c.position);
 if(kind==='smear')return (1-2*fraction)*2+(c.founder===11?4*fraction:0);
 if(kind==='learn')return (1-2*fraction)*1.5+(c.reserve<3?weight*1.8:0);
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
  const seconds=intelSecondTargets(g,id,item.kind,company),target=seconds.sort((a,b)=>(item.kind==='waste'?-1:1)*(intelValue(g,id,item.kind,b)-intelValue(g,id,item.kind,a)))[0];
  const value=intelValue(g,id,item.kind,company)+(item.kind==='waste'?-intelValue(g,id,item.kind,target):item.kind==='move'?intelValue(g,id,item.kind,target):0);
  if(value>best.value)best={value,card,company,target};
 }
 return best;
}
export function expectedIntelValue(g,id){
 return Object.keys(INTEL_CARDS).reduce((sum,kind)=>{
  const values=intelTargets(g,id,kind).map(cid=>{
   const second=['move','waste'].includes(kind)?Math.max(...intelSecondTargets(g,id,kind,cid).map(t=>(kind==='waste'?-1:1)*intelValue(g,id,kind,t))):0;
   return intelValue(g,id,kind,cid)+second;
  });
  return sum+Math.max(0,...values);
 },0)/Object.keys(INTEL_CARDS).length;
}
