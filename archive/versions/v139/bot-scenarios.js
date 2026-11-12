import {clone,command,currentPlayer,observation} from './engine.js';
import {growthDeck,ACTIVE_FOUNDERS} from './config.js';
import {intelDeck,discardValue} from './intel.js';
import {choosePower} from './racing.js';
// A reproducible hypothetical world from public information. Never copy the
// real bag order, founder deck or an opponent's private hand into search.
export function sampledGame(view,id,salt=0){
 const g=clone(view);let n=(view.cycle*1301+id*71+salt+1)>>>0;
 const random=()=>{n=Math.imul(n^(n>>>15),2246822519)>>>0;return n/4294967296;};
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 g.rng=n;g.fast=true;g.log=[];g.pile=[];g.removed=clone(view.discarded??[]);g.destroyed=clone(view.revealedDestroyed??[]);
 g.founderSupply=shuffle(ACTIVE_FOUNDERS.filter(f=>!g.founderMarket.includes(f)&&!g.companies.some(c=>c.founder===f)));
 const seen=new Set([...g.companies.flatMap(c=>c.history),...g.destroyed,...g.removed,...(g.returningCards??[])].map(t=>t.id));
 for(const c of g.companies){
  const note=g.players[id].intelKnowledge?.company===c.id&&g.players[id].intelKnowledge.count===c.supplyCount?g.players[id].intelKnowledge:null;
  const known=note?[...note.top,...(note.bottom?[note.bottom]:[])]:[],ids=new Set(known.map(t=>t.id));
  const unseen=shuffle(growthDeck(c.id).filter(t=>!seen.has(t.id)&&!ids.has(t.id)));
  g.pile.push(...unseen.splice(0,g.poolWeights[c.id]));
  c.supply=note?[...clone(note.top),...unseen.slice(0,c.supplyCount-known.length),...(note.bottom?[clone(note.bottom)]:[])]:unseen.slice(0,c.supplyCount);
 }
 const own=new Set(g.players[id].intel.map(c=>c.id)),deck=shuffle(intelDeck().filter(c=>!own.has(c.id)));
 for(const p of g.players)if(p.id!==id)p.intel=deck.splice(0,p.intelCount??0);
 g.intelDeck=deck;g.intelDiscard=[];delete g.race;delete g.playerId;
 return g;
}
// Use the very same command handlers as a human play, including costs, founder
// chains, ownership changes and the replacement draw. Stop before another turn.
export function resolvedCard(view,id,kind,company,target,extra={}){
 const g=sampledGame(view,id);let card=g.players[id].intel.findIndex(c=>c.kind===kind);
 // Duplicate Advice copies: the fuel index must not also be the played copy.
 if(kind==='advice'&&extra.discard===card)card=g.players[id].intel.findIndex((c,i)=>c.kind===kind&&i!==extra.discard);
 g.phase='intelPlay';g.queue=[id];g.active=id;g.intelOrder=[id];g.intelTiming='turn';delete g.valueResult;
 command(g,id,{type:'playIntel',card,company,target,...extra});
 for(let guard=0;g.phase!=='valueResult'&&guard<100;guard++){
  const player=currentPlayer(g);
  if(g.phase==='power')command(g,player,{type:'power',choice:choosePower(g)});
  else if(g.phase==='intelScout'){
   const scores=g.intelScout.cards.map(t=>discardValue(g,id,t));
   const choice=scores.indexOf(Math.max(...scores));
   command(g,player,g.intelScout.kind==='inside'?{type:'scoutIntel',choices:[choice]}:{type:'scoutIntel',choice});
  }else if(g.phase==='phaseResult')command(g,player,{type:'continue'});
  else throw Error('Unexpected card search phase '+g.phase);
 }
 if(g.phase!=='valueResult')throw Error('Card search did not finish');
 return observation(g,id);
}
