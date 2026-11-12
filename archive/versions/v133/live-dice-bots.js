import {valueChoices,pendingFor,holdings,shareLeader,exitPrice} from './live-dice-engine.js';
import {resolveCard} from './engine.js';
import {choosePower,resolveRevealPhase} from './racing.js';
import {DICE} from './live-dice-rules.js';
export const DICE_BOT_VERSION='round-dice-heuristic-3';
export const DICE_POLICIES=['balanced','growth','saver','random'];
const kinds=Object.keys(DICE);
const exposure=(g,id,c)=>holdings(c,id)-.3*g.players.filter(p=>p.id!==id).reduce((n,p)=>n+holdings(c,p.id),0);
function forecast(view){
 const g=structuredClone(view);g.forecast=true;g.forecastOwners={};delete g.forecastOrder;g.log=[];g.removed=[];g.pile=[];
 for(const p of g.players)p.intel??=[];
 for(const c of g.companies){c.supply=[];c.history=[];}
 return g;
}
function utility(g,id){
 return g.players.reduce((n,p)=>n+(p.id===id?1:-.3)*p.cash,0)+g.companies.reduce((n,c)=>n+exposure(g,id,c)*(exitPrice(c.position)+.18*c.position-(c.down?.35:0)),0);
}
// Sixteen numeric outcomes cover all nine ordered pairs. Founder effects use
// the production resolver; no deck order or engine RNG enters this forecast.
export function diceEvaluations(view,id,company,count=2){
 const start=forecast(view);
 if(count===2){
  start.intelMovementStarted=false;resolveRevealPhase(start,'start');
 }
 const applyFace=(state,face)=>{const g=structuredClone(state);delete g.forecastOrder;resolveCard(g,{kind:'growth',company,printed:face,signature:false,...(face===0?{effect:'fumble',diceFumble:true}:{})});return g;};
 const scores=Array.from({length:4},(_,a)=>{
  const first=applyFace(start,a);
  if(count===1)return utility(first,id);
  return Array.from({length:4},(_,b)=>{let g=structuredClone(start);if(a+b)g=applyFace(g,a+b);for(let i=0;i<Number(a===0)+Number(b===0);i++)g=applyFace(g,0);resolveRevealPhase(g,'end');return utility(g,id);});
 });
 return kinds.flatMap(a=>(count===1?[null]:kinds).map(b=>({dice:b?[a,b]:[a],score:DICE[a].reduce((sum,x)=>sum+(b?DICE[b].reduce((n,y)=>n+scores[x][y],0)/6:scores[x]),0)/6}))).sort((a,b)=>b.score-a.score);
}
export function diceBot(view,id,policy='balanced',options={}){
 const p=view.players[id],leader=Math.max(...view.companies.map(c=>c.position));
 const expected=c=>exitPrice(Math.min(24,c.position+(24-leader)*.55+2.5));
 const worth=c=>Math.max(1,Math.floor(expected(c)*(policy==='growth'?.95:policy==='saver'?.5:.75)+Math.max(0,exposure(view,id,c))*.6));
 let seed=(view.metrics.actions*7919+view.metrics.rolls*104729+id*101+p.cash*17+view.round*47)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const choose=items=>items[Math.floor(random()*items.length)];
 const values=view.publicValues?view.valueMarket:p.intel;
 if(view.phase==='chooseDice'||view.phase==='flowRoll'){
  if(view.phase==='flowRoll'&&view.flowStage!=='setup')return {type:'roll'};
  const entry=view.phase==='chooseDice'?view.pendingGrowth.find(e=>!e.resolved):[...pendingFor(view,id)].sort((a,b)=>exposure(view,id,view.companies[b.company])-exposure(view,id,view.companies[a.company]))[0];
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
 const movement=(cid,amount)=>{const c=view.companies[cid],to=Math.max(0,Math.min(24,c.position+amount));return exposure(view,id,c)*(exitPrice(to)-exitPrice(c.position)+amount*.18);};
 const cardScore=cmd=>{
  const kind=values[cmd.card].kind,c=view.companies[cmd.company],own=c?holdings(c,id):0;
  if(kind==='recover')return movement(c.id,1)+(c.down?Math.max(0,exposure(view,id,c))*.7:0);
  if(kind==='move')return movement(c.id,1)+(cmd.target==null?0:movement(cmd.target,1));
  if(kind==='conflict')return 5+movement(c.id,-2);
  if(kind==='dividend')return 3*own+movement(c.id,-2);
  if(kind==='sweat')return expected(c)+movement(c.id,-2);
  if(kind==='focused')return movement(cmd.target,2)+movement(c.id,-2);
  if(kind==='swap')return movement(c.id,view.companies[cmd.target].position-c.position)+movement(cmd.target,c.position-view.companies[cmd.target].position);
  if(kind==='insurance')return Math.max(0,exposure(view,id,c))*.7-Math.max(0,exposure(view,id,view.companies[cmd.target]))*.7;
  if(['rights','public','tender'].includes(kind))return 1;
  return .15;
 };
 if(view.phase==='intelPlay'){const choices=valueChoices(view,id);return policy==='random'?choose(choices):choices.sort((a,b)=>cardScore(b)-cardScore(a))[0];}
 const founderScore=f=>({3:3,6:2.8,8:2.5,11:3,18:2,20:1.5,24:3,25:2.5}[f]??1);
 if(view.phase==='founder')return {type:'founder',choice:policy==='random'?Math.floor(random()*view.founderMarket.length):view.founderMarket.map((f,i)=>({i,score:founderScore(f)})).sort((a,b)=>b.score-a.score)[0].i};
 if(view.phase==='flowAction'){
  const deals=p.dealFlow.map((card,deal)=>({deal,company:card.company,quality:expected(view.companies[card.company])+exposure(view,id,view.companies[card.company])}));
  const discard=[...deals].sort((a,b)=>a.quality-b.quality)[0].deal;
  const value=valueChoices({...view,phase:'call'},id).sort((a,b)=>cardScore(b)-cardScore(a))[0];
  const funding=[...deals].sort((a,b)=>b.quality-a.quality)[0];
  const capital={type:'raiseMoney',deal:discard},fund={type:'call',deal:funding.deal,company:funding.company};
  const hires=view.companies.filter(c=>shareLeader(c)===id).map(c=>({company:c.id,score:(Math.max(...view.founderMarket.map(founderScore))-founderScore(c.founder))*Math.max(0,exposure(view,id,c))*(24-leader)/24})).sort((a,b)=>b.score-a.score);
  if(policy==='random')return choose([capital,...deals.map(d=>({type:'call',deal:d.deal,company:d.company})),...(value?[{type:'valueAction',deal:discard}]:[]),...hires.map(c=>({type:'changeFounder',deal:discard,company:c.company}))]);
  if(value&&cardScore(value)>(policy==='growth'?3:1.5))return {type:'valueAction',deal:discard};
  if(hires[0]?.score>2)return {type:'changeFounder',deal:discard,company:hires[0].company};
  if(p.cash<worth(view.companies[fund.company])&&policy!=='saver')return capital;
  if(p.cash===0)return capital;
  return fund;
 }
 return {type:'continue'};
}
