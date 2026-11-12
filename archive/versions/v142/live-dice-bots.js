import {planDecision,roughPrice} from './dice-planner.js';
import {valueChoices,pendingFor,holdings,shareLeader,exitPrice,shareExitPrice} from './live-dice-engine.js';
import {resolveCard} from './engine.js';
import {choosePower,resolveRevealPhase,resolveSharePurchase} from './racing.js';
import {DICE} from './live-dice-rules.js';
export const DICE_BOT_VERSION='public-flow-dilution-1';
export const DICE_POLICIES=['balanced','growth','saver','random','diversification','concentration'];
const kinds=Object.keys(DICE);
const exposure=(g,id,c)=>holdings(c,id)-.3*g.players.filter(p=>p.id!==id).reduce((n,p)=>n+holdings(c,p.id),0);
function forecast(view){
 const g=structuredClone(view);g.forecast=true;g.forecastOwners={};delete g.forecastOrder;g.log=[];g.removed=[];g.pile=[];
 for(const p of g.players)p.intel??=[];
 for(const c of g.companies){c.supply=[];c.history=[];}
 return g;
}
export function projectedScores(g){
 const leader=Math.max(...g.companies.map(c=>c.position)),terminal=leader>=24||g.finishOrder?.length>0;
 return g.players.map(p=>p.cash-(p.capitalCalled??0)+g.companies.reduce((n,c)=>n+holdings(c,p.id)*(terminal?shareExitPrice(c):roughPrice(g,p.id,c.id)),0));
}
function utility(g,id){
 const scores=projectedScores(g),margin=scores[id]-Math.max(...scores.filter((_,i)=>i!==id));
 const terminal=g.companies.some(c=>c.position>=24)||g.finishOrder?.length>0;
 return margin+(terminal?(margin>0?80:margin<0?-80:0):0);
}
function activate(state,company,a,b=undefined){
 const g=structuredClone(state);delete g.forecastOrder;
 const faces=b===undefined?[a]:[a,b];
 for(const face of faces)resolveCard(g,{kind:'growth',company,printed:face==='x'?0:face,signature:false,...(face==='x'?{effect:'fumble'}:{})});
 if(b!==undefined){resolveRevealPhase(g,'end',false);resolveRevealPhase(g,'catchUp',false);}
 return g;
}
// Numeric zero is a numbered result, distinct from the fumble face.
export function diceEvaluations(view,id,company,count=2){
 const start=forecast(view);
 if(count===2){start.intelMovementStarted=false;resolveRevealPhase(start,'start',false);}
 const scores=new Map();
 const score=(a,b)=>{const key=JSON.stringify([a,b]);if(!scores.has(key))scores.set(key,utility(activate(start,company,a,b),id));return scores.get(key);};
 return kinds.flatMap(a=>(count===1?[null]:kinds).map(b=>({dice:b?[a,b]:[a],score:DICE[a].reduce((sum,x)=>sum+(b?DICE[b].reduce((n,y)=>n+score(x,y),0)/6:score(x)),0)/6}))).sort((a,b)=>b.score-a.score);
}
// Auction forecasts use only public state. Opponents' bids are estimates, never read
// from sealed bids or hidden hands. The same model evaluates winning and losing.
const purchaseCache=new WeakMap();
export function fundingForecast(view,id,company,{buyer=id,price=0}={}){
 let cache=purchaseCache.get(view);if(!cache){cache=new Map();purchaseCache.set(view,cache);}
 const key=company+':'+buyer;
 if(!cache.has(key)){
  const start=forecast(view),previousLead=shareLeader(start.companies[company]);
  start.companies[company].tokens.push({owner:buyer});
  start.companies[company].lastBuy[buyer]=Math.max(...start.companies.flatMap(c=>c.lastBuy))+1;
  resolveSharePurchase(start,company,buyer,{previousLead,auction:true});
  start.intelMovementStarted=false;resolveRevealPhase(start,'start',false);
  const sums=new Map();for(const a of DICE.bland)for(const b of DICE.bland)sums.set(a+b,(sums.get(a+b)??0)+1);
  cache.set(key,[...sums].map(([sum,n])=>({g:activate(start,company,sum,0),weight:n/36})));
 }
 // The compatible founder pool has no cash-cost activation. Auction price cannot
 // change these movement outcomes; apply it when evaluating settlement instead.
 let score=0;for(const {g,weight} of cache.get(key)){g.players[buyer].cash-=price;score+=weight*utility(g,id);g.players[buyer].cash+=price;}
 return score;
}
export function auctionBudget(view,id,company){
 // Expected terminal value after this issue and later dilution, using public supply.
 // Reserve cash for another opportunity; never read opponents' sealed bids.
 return Math.min(view.players[id].cash,roughPrice(view,id,company));
}
export function diceBot(view,id,policy='balanced',options={}){
 if(policy==='rollout'){const plan=planDecision(view,id,policy);if(plan){options.onPlan?.(plan);return plan.command;}}
 const p=view.players[id],leader=Math.max(...view.companies.map(c=>c.position));
 const expected=c=>exitPrice(Math.min(24,c.position+(24-leader)*.55+2.5));
 const budgets=new Map();
 const budget=(pid,cid)=>{const key=pid+':'+cid;if(!budgets.has(key))budgets.set(key,auctionBudget(view,pid,cid));return budgets.get(key);};
 const worth=c=>budget(id,c.id);
 let seed=(view.metrics.actions*7919+view.metrics.rolls*104729+id*101+p.cash*17+view.round*47)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const choose=items=>items[Math.floor(random()*items.length)];
 const values=view.publicValues?view.valueMarket:p.intel;
 if(view.phase==='chooseDice'||view.phase==='flowRoll'){
  if(view.phase==='flowRoll'&&view.flowStage!=='setup')return {type:'roll'};
  const entry=view.phase==='chooseDice'?view.pendingGrowth.find(e=>!e.resolved&&!e.dice):[...pendingFor(view,id)].sort((a,b)=>exposure(view,id,view.companies[b.company])-exposure(view,id,view.companies[a.company]))[0];
  const count=view.phase==='chooseDice'?2:1;
  const dice=options.dicePolicy&&options.dicePolicy!=='adaptive'?Array(count).fill(options.dicePolicy):policy==='random'?Array.from({length:count},()=>choose(kinds)):diceEvaluations(view,id,entry.company,count)[0].dice;
  return view.phase==='chooseDice'?{type:'chooseDice',dice}:{type:'roll',entitlement:entry.id,dice};
 }
 if(view.phase==='power')return {type:'power',choice:policy==='random'?Math.floor(random()*view.powerChoice.options.length):choosePower(view)};
 if(view.phase==='retainFlow')return {type:'retainFlow',cards:p.dealFlow.map((c,i)=>({i,score:expected(view.companies[c.company])})).sort((a,b)=>b.score-a.score).slice(0,5).map(c=>c.i)};
 if(['bid','tie','openBid','rights'].includes(view.phase)){
  const a=view.auction,c=view.companies[a.company],budget=Math.min(p.cash,worth(c));
  if(view.phase==='rights')return {type:'rights',accept:a.price<=budget};
  const min=view.phase==='bid'?a.reserve:view.phase==='tie'?a.price+1:a.highBidder==null?a.reserve:a.price+1;
  const bid=policy==='random'?Math.floor(random()*(p.cash+1)):budget;
  return {type:view.phase,amount:bid>=min?bid:0};
 }
 const movement=(cid,amount)=>{const next=structuredClone(view);next.companies[cid].position=Math.max(0,Math.min(24,next.companies[cid].position+amount));return utility(next,id)-utility(view,id);};
 const valueScores=new Map();
 const cardScore=cmd=>{const key=JSON.stringify(cmd);if(!valueScores.has(key))valueScores.set(key,scoreCard(cmd));return valueScores.get(key);};
 const scoreCard=cmd=>{
  const kind=values[cmd.card].kind,c=view.companies[cmd.company],own=c?holdings(c,id):0;
  if(kind==='recover')return movement(c.id,1)+(c.down?Math.max(0,exposure(view,id,c))*.7:0);
  if(kind==='move'){const next=structuredClone(view);for(const cid of [c.id,...(cmd.target==null?[]:[cmd.target])])next.companies[cid].position=Math.min(24,next.companies[cid].position+1);return utility(next,id)-utility(view,id);}
  if(kind==='conflict')return movement(c.id,-2);
  if(kind==='dividend'){const next=structuredClone(view);for(const player of next.players)player.cash+=3*holdings(c,player.id);next.companies[c.id].position=Math.max(0,c.position-2);return utility(next,id)-utility(view,id);}
  if(kind==='sweat'){const next=structuredClone(view);next.companies[c.id].position=Math.max(0,c.position-2);next.companies[c.id].tokens.push({owner:id});return utility(next,id)-utility(view,id);}
  if(kind==='focused'){const next=structuredClone(view);next.companies[c.id].position=Math.max(0,c.position-2);next.companies[cmd.target].position=Math.min(24,next.companies[cmd.target].position+2);return utility(next,id)-utility(view,id);}
  if(kind==='swap')return movement(c.id,view.companies[cmd.target].position-c.position)+movement(cmd.target,c.position-view.companies[cmd.target].position);
  if(kind==='insurance')return Math.max(0,exposure(view,id,c))*.7-Math.max(0,exposure(view,id,view.companies[cmd.target]))*.7;
  if(['rights','public','tender'].includes(kind))return 1;
  return .15;
 };
 if(view.phase==='intelPlay'){const choices=valueChoices(view,id);return policy==='random'?choose(choices):choices.sort((a,b)=>cardScore(b)-cardScore(a))[0];}
 const founderScore=f=>({3:3,6:2.8,8:2.5,11:3,18:2,20:1.5,24:3,25:2.5}[f]??1);
 if(view.phase==='founder')return {type:'founder',choice:policy==='random'?Math.floor(random()*view.founderMarket.length):view.founderMarket.map((f,i)=>({i,score:founderScore(f)})).sort((a,b)=>b.score-a.score)[0].i};
 if(view.phase==='pickFlow'){
  const choices=view.dealRow.map((card,deal)=>({deal,company:card.company,score:roughPrice(view,id,card.company)*(policy==='concentration'?1+holdings(view.companies[card.company],id)*.5:1/(1+holdings(view.companies[card.company],id)*.3))}));
  const best=policy==='random'?choose(choices):choices.sort((a,b)=>b.score-a.score)[0];
  return {type:'call',deal:best.deal,company:best.company};
 }
 if(view.phase==='flowAction'){
  const value=valueChoices(view,id).sort((a,b)=>cardScore(b)-cardScore(a))[0];
  if(p.cash<8)return {type:'raiseMoney'};
  if(value&&cardScore(value)>0)return {type:'valueAction'};
  const hires=view.companies.filter(c=>shareLeader(c)===id).map(c=>({company:c.id,score:Math.max(...view.founderMarket.map(founderScore))-founderScore(c.founder)})).sort((a,b)=>b.score-a.score);
  if(hires[0]?.score>1)return {type:'changeFounder',company:hires[0].company};
  return {type:'passAction'};
 }
 return {type:'continue'};
}
