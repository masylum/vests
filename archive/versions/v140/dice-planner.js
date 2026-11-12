// Information-set rollouts. Every transition uses the playable rules engine.
import {diceCommand,diceObservation,currentPlayer,valueChoices,holdings,shareLeader,DICE_FOUNDERS,DICE_VALUES,exitPrice} from './live-dice-engine.js';
import {intelDeck} from './intel.js';
import {choosePower} from './racing.js';
export const PLANNER={version:'information-set-1',samples:4,rounds:4,maxCommands:320,maxCandidates:12};
function generator(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function sampleHiddenState(view,id,seed){
 const g=structuredClone(view),r=generator(seed);g.rng=seed;g.seed=seed;g.log=[];g.pile=[];g.removed=[];g.destroyed=[];delete g.race;g.forecast=false;g.fast=true;g.auctionHistory=[];
 const known=new Set([...g.dealSpent,...g.players[id].dealFlow].map(c=>c.id));
 const pool=shuffle(Array.from({length:g.dealCopies*6},(_,i)=>({id:`d${i+1}`,company:i%6})).filter(c=>!known.has(c.id)),r);
 for(const p of g.players){p.intel=[];if(p.id!==id)p.dealFlow=pool.splice(0,p.dealFlowCount);}
 g.dealDeck=pool;g.intelDiscard=structuredClone(view.publicValueDiscard??[]);
 const visible=new Set([...g.valueMarket,...g.intelDiscard].map(c=>c.id));
 g.intelDeck=shuffle(intelDeck().filter(c=>DICE_VALUES.includes(c.kind)&&!visible.has(c.id)),r);
 g.founderSupply=shuffle(DICE_FOUNDERS.filter(f=>!g.founderMarket.includes(f)&&!g.companies.some(c=>c.founder===f)),r);
 for(const c of g.companies)c.supply=[];
 // Previously submitted sealed bids are unknown, never read from the real game.
 if(g.auction?.bids)g.auction.bids=g.auction.bids.map(b=>b.amount!==undefined?b:{player:b.player,amount:Math.floor(r()*(Math.min(g.players[b.player].cash,roughPrice(g,b.player,g.auction.company))+1))});
 return g;
}
function roughPrice(g,id,cid){
 const c=g.companies[cid],available=g.players.flatMap(p=>p.dealFlow??[]).filter(d=>d.company===cid).length;
 // Horizon is bounded by actual sampled accessible cards; no undealt-card omniscience.
 const growth=Math.min(4,available+1)*1.8+(c.position===Math.min(...g.companies.map(c=>c.position))?2:0);
 return Math.max(1,exitPrice(Math.min(24,c.position+growth))+(holdings(c,id)>0?1:0));
}
function positionValue(g,id,cid,policy){
 const c=g.companies[cid],own=holdings(c,id),price=roughPrice(g,id,cid);
 return policy==='concentration'?price*(1+own*.6):price/(1+own*.65)+(own===0?3:0);
}
function valueScore(g,id,cmd,policy){
 const kind=g.valueMarket[cmd.card].kind,c=g.companies[cmd.company],own=c?holdings(c,id):0;
 const delta=(cid,n)=>{const x=g.companies[cid];return (exitPrice(Math.min(24,x.position+n+4))-exitPrice(Math.min(24,x.position+4)))*(holdings(x,id)-.3*(x.tokens.length-holdings(x,id)));};
 if(['rights','public','tender'].includes(kind))return positionValue(g,id,c.id,policy)*.55;
 if(kind==='sweat')return roughPrice(g,id,c.id)+delta(c.id,-2);
 if(kind==='focused')return delta(c.id,-2)+delta(cmd.target,2);
 if(kind==='move')return delta(c.id,1)+(cmd.target==null?0:delta(cmd.target,1));
 if(kind==='recover')return delta(c.id,1)+(c.down?own*3:0);
 if(kind==='dividend')return own*3+delta(c.id,-2);
 if(kind==='conflict')return 5+delta(c.id,-2);
 if(kind==='swap')return delta(c.id,g.companies[cmd.target].position-c.position)+delta(cmd.target,c.position-g.companies[cmd.target].position);
 if(kind==='insurance')return 2*(own-holdings(g.companies[cmd.target],id));
 return .1;
}
function candidates(g,id,policy){
 const entries=[{commands:[{type:'raiseMoney'}],score:g.players[id].cash<5?5:0}];
 for(const [deal,c] of (g.players[id].dealFlow??[]).entries())if(!g.roundFunded.includes(c.company)&&!entries.some(e=>e.commands[0].company===c.company))entries.push({commands:[{type:'call',deal,company:c.company}],score:positionValue(g,id,c.company,policy)});
 const values=valueChoices(g,id).map(cmd=>({commands:g.phase==='intelPlay'?[cmd]:[{type:'valueAction'},cmd],score:valueScore(g,id,cmd,policy)})).sort((a,b)=>b.score-a.score);
 // Preserve all legal funding destinations, plus distinct value-card/target options.
 const selected=entries.concat(values.slice(0,Math.max(4,PLANNER.maxCandidates-entries.length)));
 for(const c of g.companies)if(shareLeader(c)===id)selected.push({commands:[{type:'changeFounder',company:c.id}],score:.1});
 return g.phase==='intelPlay'?values.slice(0,PLANNER.maxCandidates):selected;
}
export function rolloutCommand(g,id,policy='diversification'){
 if(g.phase==='flowAction'||g.phase==='intelPlay')return candidates(g,id,policy).sort((a,b)=>b.score-a.score)[0].commands[0];
 if(['bid','tie','openBid','rights'].includes(g.phase)){
  const a=g.auction,budget=Math.min(g.players[id].cash,roughPrice(g,id,a.company));
  if(g.phase==='rights')return {type:'rights',accept:a.price<=budget};
  const minimum=g.phase==='bid'?a.reserve:g.phase==='tie'?a.price+1:a.highBidder==null?a.reserve:a.price+1;
  return {type:g.phase,amount:budget>=minimum?budget:0};
 }
 if(g.phase==='chooseDice')return {type:'chooseDice',dice:['bland','bland']};
 if(g.phase==='flowRoll')return g.flowStage==='setup'?{type:'roll',entitlement:g.pendingGrowth.find(e=>!e.resolved&&e.player===id).id,dice:['bland']}:{type:'roll'};
 if(g.phase==='power')return {type:'power',choice:choosePower(g)};
 if(g.phase==='founder')return {type:'founder',choice:g.founderMarket.map((f,i)=>({i,s:({3:3,6:2,11:3,13:3,24:3}[f]??1)})).sort((a,b)=>b.s-a.s)[0].i};
 return {type:'continue'};
}
function utility(g,id){
 const scores=g.ended?g.scores:g.players.map(p=>p.cash-p.capitalCalled+g.companies.reduce((n,c)=>n+holdings(c,p.id)*exitPrice(c.position),0));
 const margin=scores[id]-Math.max(...scores.filter((_,i)=>i!==id));
 return margin+(g.ended?Math.sign(margin)*40:0);
}
export function planDecision(view,id,policy='diversification',config=PLANNER){
 if(!['flowAction','intelPlay','bid','openBid','tie','rights'].includes(view.phase))return null;
 let choices;
 if(['bid','openBid','tie'].includes(view.phase)){
  const a=view.auction,min=view.phase==='bid'?a.reserve:view.phase==='tie'?a.price+1:a.highBidder==null?a.reserve:a.price+1,cash=view.players[id].cash;
  const estimate=roughPrice(view,id,a.company);
  choices=[...new Set([0,min,Math.ceil(estimate*.5),estimate,Math.min(cash,estimate*2)])].filter(n=>n===0||(n>=min&&n<=cash)).map(amount=>({commands:[{type:view.phase,amount}]}));
 }else if(view.phase==='rights')choices=[false,...(view.auction.price<=view.players[id].cash?[true]:[])].map(accept=>({commands:[{type:'rights',accept}]}));
 else choices=candidates(view,id,policy);
 const seed=(view.round*2654435761+view.turnNumber*7919+id*101+(view.auction?.company??0)*17)>>>0;
 const evaluated=choices.map(choice=>{
  const outcomes=[];let censored=0;
  for(let sample=0;sample<config.samples;sample++){
   const g=sampleHiddenState(view,id,(seed+sample*104729)>>>0),stop=g.round+config.rounds;
   for(const cmd of choice.commands)diceCommand(g,id,cmd);
   let steps=0;
   while(!g.ended&&g.round<stop&&steps++<config.maxCommands){const actor=currentPlayer(g);diceCommand(g,actor,rolloutCommand(g,actor,actor===id?policy:'diversification'));g.log=[];g.auctionHistory=[];}
   if(!g.ended&&g.round<stop)censored++;
   outcomes.push(utility(g,id));
  }
  return {...choice,mean:outcomes.reduce((a,b)=>a+b,0)/outcomes.length,outcomes,censored};
 }).sort((a,b)=>b.mean-a.mean);
 return {command:evaluated[0].commands[0],evaluations:evaluated,policy,budget:config};
}
