import {NEW_CARDS,expansionTargets,expansionSeconds} from './card-expansion.js';
import {shareLeader} from './ownership.js';
import {companyValue,dilution,slotCards} from './config.js';
export const INTEL_MODES={off:'Classic · no value cards',mixed:'Value cards',support:'Value cards',scouting:'Value cards'};
export const INTEL_CARDS={
 recover:{name:'Resolve Crisis',timing:'turn',text:"Move a portfolio company 1 space and recover it if fumbled."},
 inside:{name:'Inside Information',timing:'turn',text:"Choose a portfolio company. Return 1 of its discarded growth tokens to the growth bag."},
 move:{name:'Warm Introduction',timing:'turn',text:"Move up to 2 portfolio companies 1 space each, in your chosen order."},
 launch:{name:'Launch Campaign',timing:'turn',text:"Look at a portfolio company’s top 2 supply tokens. Deploy 1 and leave the other on top."},
 smear:{name:'Executive Hire',timing:'turn',text:"Fumble an unfumbled portfolio company, then deploy 2 of its supply tokens."},
 swap:{name:'Portfolio Rebalance',timing:'turn',text:"Swap the spaces of 2 portfolio companies within 3 spaces of each other."},
 headhunt:{name:'Headhunting',timing:'turn',text:"Swap the founders of 2 portfolio companies."},
 advisor:{name:'Financial Advisor',timing:'turn',text:"Choose a portfolio company. Return 2 of its discarded growth tokens to its supply, then move it 1 space."},
 conflict:{name:'Portfolio Conflict',timing:'turn',text:"Move a portfolio company back 2 spaces. Gain $5."},
};
export const INTEL_ART={...Object.fromEntries(['recover','inside','move','launch','smear','swap','headhunt','advisor','conflict','focused','sweat','matching','tender','coup','mandate','rights','underwritten','weekend','insurance','consolidation','clearance','session'].map(kind=>[kind,kind])),dividend:'sell',advice:'waste',financing:'bridge',restructure:'learn',transfer:'secondary',fresh:'fresh',stake:'stake',public:'public'};
export const intelScope=kind=>['weekend','fresh'].includes(kind)?'Your investor': ['move','swap','headhunt','insurance','transfer'].includes(kind)?'Portfolio companies':'Portfolio company';
Object.assign(INTEL_CARDS,Object.fromEntries(Object.entries(NEW_CARDS).map(([kind,[name,text]])=>[kind,{name,text,timing:'turn'}])));
export const MAX_VALUE_HAND=60;
export function intelDeck(){return Array.from({length:2},(_,copy)=>Object.keys(INTEL_CARDS).map((kind,index)=>({id:copy*Object.keys(INTEL_CARDS).length+index,kind}))).flat();}
export const discardedCount=(g,cid)=>g.removed?g.removed.filter(c=>c.company===cid&&!c.burned).length:(g.companies[cid].discardCount??0);
export const canExchangeIntel=(g,id)=>g.players[id].intel.length>0&&g.players.reduce((n,p)=>n+(p.intelCount??p.intel?.length??0),0)<intelDeck().length;
export const canDrawIntel=(g,id)=>g.players[id].intel.length<MAX_VALUE_HAND&&g.players.reduce((n,p)=>n+(p.intelCount??p.intel?.length??0),0)<intelDeck().length;
export const invested=(g,id)=>g.companies.filter(c=>c.tokens.some(t=>t.owner===id));
export const intelLead=shareLeader;
export function intelTargets(g,id,kind){
 if(!INTEL_CARDS[kind])return [];
 if(NEW_CARDS[kind])return expansionTargets(g,id,kind);
 const own=invested(g,id),supply=c=>c.supplyCount??c.supply?.length??0;
 if(g.diceRevision>=145){
  if(['inside','advisor'].includes(kind))return own.filter(c=>g.dealSpent.some(d=>d.company===c.id)&&(kind!=='inside'||g.dealRow.some(d=>own.some(x=>x.id===d.company)))).map(c=>c.id);
  if(kind==='launch')return own.filter(c=>g.dealRow.some(d=>d.company===c.id)).map(c=>c.id);
  if(kind==='smear')return own.map(c=>c.id);
 }
 if(kind==='advisor')return own.filter(c=>discardedCount(g,c.id)>=2).map(c=>c.id);
 if(kind==='conflict')return own.filter(c=>c.position>0).map(c=>c.id);
 if(kind==='inside')return own.filter(c=>discardedCount(g,c.id)>=1).map(c=>c.id);
 if(kind==='headhunt')return own.length>=2?own.map(c=>c.id):[];
 if(kind==='smear')return own.filter(c=>!c.down&&!c.hiringFumble&&supply(c)>=2).map(c=>c.id);
 if(kind==='swap')return own.filter(c=>intelSecondTargets(g,id,kind,c.id).length).map(c=>c.id);
 if(kind==='move')return own.filter(c=>c.position<24).map(c=>c.id);
 return own.filter(c=>kind==='recover'?c.position<24||c.down||c.hiringFumble:kind==='launch'?supply(c)>=2:kind==='scout'?supply(c)>0:true).map(c=>c.id);
}
export const playableIntel=(g,card)=>g.phase==='call'||g.phase==='intelPlay';
export function intelValue(g,id,kind,cid,target){
 if(kind==='weekend')return 0; // Extra actions require a reachable productive plan.
 if(kind==='fresh')return 2; // Extra value card; market refresh is not guaranteed to improve available founders.
 const c=g.companies[cid],fraction=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),weight=fraction*(1+c.position/24);
 if(NEW_CARDS[kind]){
  if(kind==='clearance')return 5/3-weight*2*.25*26/20;
  if(['consolidation','restructure'].includes(kind))return 3.3-(kind==='consolidation'?companyValue(c.position,g.rules)/Math.max(1,c.tokens.length)/3:weight*1.5);
  if(kind==='financing')return weight*(2+.8*26/20)-10/3;
  if(kind==='matching')return weight*2*.8*26/20-3/3;
  if(kind==='focused'){const other=g.companies[target];if(!other)return 0;const owned=other.tokens.filter(t=>t.owner===id).length/Math.max(1,other.tokens.length);return 2*owned*(1+other.position/24)-2*weight;}
  if(kind==='advice')return weight+3/3-1;
  if(kind==='dividend')return c.tokens.filter(t=>t.owner===id).length-weight;
  if(kind==='stake')return companyValue(c.position,g.rules)/Math.max(1,c.tokens.length)/3-[6,12,18][Math.min(2,Math.floor(Math.max(0,c.position-1)/8))]/3+1;
  if(kind==='sweat')return companyValue(Math.max(0,c.position-2),g.rules)/(c.tokens.length+1)/3+1;
  return weight*(c.position>=22?5:1.5);
 }
 if(kind==='conflict')return g.rules.conflictPayout/3+(1-2*fraction)*Math.min(2,c.position);
 if(kind==='smear')return (1-2*fraction)*2+weight*Math.min(2,c.supplyCount??c.supply?.length??0)*.8*26/20;
 if(g.diceRevision>=145){
  if(['inside','advisor'].includes(kind))return own.filter(c=>g.dealSpent.some(d=>d.company===c.id)&&(kind!=='inside'||g.dealRow.some(d=>own.some(x=>x.id===d.company)))).map(c=>c.id);
  if(kind==='launch')return own.filter(c=>g.dealRow.some(d=>d.company===c.id)).map(c=>c.id);
  if(kind==='smear')return own.map(c=>c.id);
 }
 if(kind==='advisor')return weight*(c.position>=23?10:2);
 if(kind==='headhunt')return 0; // Bot swap choices use paired portfolio forecasts.
 if(kind==='inside'){const cards=(g.discarded??g.removed??[]).filter(t=>t.company===cid&&!t.burned).map(t=>t.effect==='fumble'?-2:t.printed).sort((a,b)=>b-a);return weight*.8*(cards[0]??0);}
 return weight*(kind==='move'?(c.position>=23?10:1):kind==='recover'?(c.position>=23?10:1)+(c.down?2.5:0):kind==='learn'?Math.min(5,c.discardCount??g.removed?.filter(x=>x.company===cid&&!x.burned).length??0):kind==='bridge'?1.2:kind==='founder'?.6:kind==='swap'?.5:1.5);
}
export function discardValue(g,id,card){
 const c=g.companies[card.company],own=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),leading=c.position===Math.max(...g.companies.map(c=>c.position));
 const movement=c.down&&card.signature!=='recover'?.5:card.effect==='fumble'?(c.founder===11?2:-3):card.signature==='breakthrough'?(leading?1:3):(card.printed??0)+(card.signature?.5:0);
 return movement*(own-.3*(1-own));
}
export function intelSecondTargets(g,id,kind,cid){
 if(g.diceRevision>=156&&kind==='consolidation')return invested(g,id).filter(c=>c.id!==cid||c.tokens.filter(t=>t.owner===id).length>=2).map(c=>c.id);
 if(['insurance','transfer','focused'].includes(kind))return expansionSeconds(g,id,kind,cid);
 if(kind==='headhunt')return invested(g,id).filter(c=>c.id!==cid).map(c=>c.id);
 if(kind==='move')return intelTargets(g,id,kind).filter(x=>x!==cid);
 if(kind==='swap')return g.companies.filter(c=>c.id!==cid&&c.tokens.some(t=>t.owner===id)&&c.position!==g.companies[cid].position&&Math.abs(c.position-g.companies[cid].position)<=3).map(c=>c.id);
 return [];
}
export function bestIntelPlay(g,id,score=(kind,cid,target)=>intelValue(g,id,kind,cid,target)){
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
   if(kind==='focused')return Math.max(0,...intelSecondTargets(g,id,kind,cid).map(target=>intelValue(g,id,kind,cid,target)));
   const second=['move','waste'].includes(kind)?Math.max(0,...intelSecondTargets(g,id,kind,cid).map(t=>(kind==='waste'?-1:1)*intelValue(g,id,kind,t))):0;
   return intelValue(g,id,kind,cid)+second;
  });
  return sum+Math.max(0,...values);
 },0)/Object.keys(INTEL_CARDS).length;
}
