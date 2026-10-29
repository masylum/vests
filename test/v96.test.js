// Historical v96 rules. Current changes are tested in v97.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,resolveCard,resolveCardBase,command,currentPlayer,observation,assertGame,clone,burnPile} from './reference-v96/engine.js';
import {resolveRevealPhase,resumeRace,resolveSharePurchase,resolveIntelActions,choosePower} from './reference-v96/racing.js';
import {FOUNDERS,canExit,settlementValue,growthDeck} from './reference-v96/config.js';
import {botCommand} from './reference-v96/bots.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function setup(assign={}){
 const g=createGame({seed:96123,rules:{intelMode:'mixed'}}),chosen=new Set(Object.values(assign));
 const rest=[4,7,8,13,14,15,...FOUNDERS.map(f=>f.id)].filter((v,i,a)=>a.indexOf(v)===i&&!chosen.has(v));
 g.companies.forEach((c,i)=>{c.founder=assign[i]??rest.shift();c.position=10;c.tokens=[{id:1,owner:0,paid:0}];c.lastBuy[0]=1;});
 g.founderMarket=rest.splice(0,3);g.founderSupply=rest;return g;
}
function take(g,cid,predicate){let cards=g.companies[cid].supply,index=cards.findIndex(predicate);if(index<0){cards=g.pile;index=cards.findIndex(c=>c.company===cid&&predicate(c));}assert(index>=0);return cards.splice(index,1)[0];}
function finish(g){while(g.race){if(g.powerChoice)resumeRace(g,choosePower(g),resolveCardBase);else if(g.phase==='phaseResult')act(g,{type:'continue'});else throw Error('Unfinished race');}}
const choose=(g,n=1)=>resumeRace(g,n,resolveCardBase);

test('v96 has 22 unique, illustrated founders and preserves all component counts',()=>{
 assert.equal(FOUNDERS.length,22);assert.equal(new Set(FOUNDERS.map(f=>f.name)).size,22);
 assert.equal(FOUNDERS[10].name,'Leon Dusk');assert.equal(FOUNDERS[15].name,'Lei-Lei Fi');assert.equal(FOUNDERS[17].name,'Melania Gherkins');assert.equal(FOUNDERS[18].name,'Mack Ja');
 for(const players of [3,4,5])assertGame(createGame({players}));
});
test('Jerry counts distinct investors after every share purchase, including negative movement',()=>{
 for(const owners of [[0],[0,0,null],[0,1],[0,1,2],[0,1,2,3]]){
  const g=setup({0:7}),c=g.companies[0];c.tokens=owners.map((owner,i)=>({id:i+1,owner}));
  resolveSharePurchase(g,0,0);assert.equal(c.position,13-new Set(owners.filter(x=>x!==null)).size);
 }
 for(const flag of ['down','hiringFumble']){const g=setup({0:7});g.companies[0][flag]=true;assert.equal(resolveSharePurchase(g,0,0),null);}
});
test('Secondary Market pays $5 and its company’s treasury, then triggers Jerry',()=>{
 const g=setup({0:7}),c=g.companies[0];g.players.forEach(p=>g.intelDeck.push(...p.intel.splice(0)));g.players[0].intel.push(...g.intelDeck.splice(g.intelDeck.findIndex(c=>c.kind==='secondary'),1));
 c.reserve=2;g.phase='intelPlay';g.queue=[0];g.intelOrder=[0];g.callOrder=[0,1,2,3];g.callIndex=1;
 act(g,{type:'playIntel',card:0,company:0});finish(g);assert.equal(c.tokens.length,2);assert.equal(c.position,12);assert.equal(c.reserve,1);assert.equal(g.players[0].cash,45);assertGame(g);
});
test('Ryan fumbles all pre-move leaders, does not newly target himself, and offers no target choice',()=>{
 const g=setup({0:6,1:11});g.companies.forEach(c=>c.position=11);g.companies[0].position=10;
 resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,11);assert(!g.companies[0].down);assert(g.companies.slice(1).every(c=>c.down));assert(!g.powerChoice);
 assert.equal(g.companies[1].position,11); // Dan does not convert before the reveal.
});
test('Matt acts before reveal, Gill can help an already moved company, Mack moves 3',()=>{
 const g=setup({0:1,1:3,2:18});g.companies[0].position=8;g.companies[2].reserve=1;
 resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.founder,1);choose(g);finish(g);assert.equal(g.companies[0].position,10);assert(g.companies[0].down);assert.equal(g.companies[2].position,13);
 g.revealMoved=g.companies.map(()=>true);resolveRevealPhase(g,'end',true);assert.equal(g.powerChoice.founder,3);assert.equal(g.powerChoice.options.length,6);choose(g);finish(g);
});
test('Jenkins pays only in penultimate place, with ordinary dilution and inactivity rules',()=>{
 for(const n of [5,6,7]){
  const g=setup({0:4});g.companies=Array.from({length:n},(_,id)=>({...g.companies[id%6],id,position:24-id,founder:id===n-2?4:-1,down:false,hiringFumble:false}));
  const c=g.companies[n-2];assert(canExit(c,[],g.companies));assert.equal(settlementValue(c,g.companies,g.rules),75);c.down=true;assert(!canExit(c,[],g.companies));c.down=false;c.position=25;assert(!canExit(c,[],g.companies));
 }
});
test('Julie borrows growth and printed treasury/deployment/recycling/Research powers, preserving physical ownership',()=>{
 for(const [cid,predicate] of [[2,c=>!c.signature&&!c.effect&&c.printed===2],[0,c=>c.signature==='add'],[1,c=>c.signature==='swapCard'],[3,c=>c.signature==='recycle'],[5,c=>c.signature==='breakthrough']]){
  const g=setup({4:16}),j=g.companies[4],card=take(g,cid,predicate),owner=g.companies[cid],stock=j.supply.length;j.reserve=0;j.position=8;
  resolveCard(g,card,{interactive:true});assert.equal(g.powerChoice.founder,16);assert.equal(j.position,8);choose(g);finish(g);
  assert.equal(owner.position,10);assert.equal(j.position,card.signature==='breakthrough'?11:8+card.printed);
  assert.equal(j.reserve,card.signature==='swapCard'?1:0);assert.equal(j.supply.length,stock-Number(card.signature==='add'));
  assert(owner.history.some(c=>c.id===card.id));assert(!j.history.some(c=>c.id===card.id));
  assert.equal(g.lastRevealed.card.company,cid);assert.equal(g.lastRevealed.effect.company,4);assertGame(g);
 }
});
test('Julie uses Overtake for her company and a fumble triggers Harry/Dan under reveal timing',()=>{
 const g=setup({0:16,1:9}),j=g.companies[0];j.position=7;g.companies[5].position=11;
 const swap=take(g,4,c=>c.signature==='swap');resolveCard(g,swap,{interactive:true});choose(g);assert(g.powerChoice.signature);assert.equal(g.powerChoice.company,0);choose(g,g.powerChoice.options.findIndex(o=>o.actions[0].target===5));finish(g);assert.equal(j.position,11);
 g.julieUsed=[];const fumble=take(g,2,c=>c.effect==='fumble');resolveCard(g,fumble,{interactive:true});choose(g);assert.equal(g.powerChoice.founder,9);choose(g);finish(g);assert(!j.down);assert.equal(g.harryUsed.length,1);assertGame(g);
 const h=setup({0:11});const card=take(h,0,c=>!c.effect&&!c.signature);resolveIntelActions(h,[{kind:'fumble',company:0}],null,{interactive:false});assert(h.companies[0].down);h.companies[0].down=false;resolveCard(h,{...card,effect:'fumble'});assert.equal(h.companies[0].position,12);assert(!h.companies[0].down);
});
test('Julie consumes one draw when borrowing a card originally destined for fumble recovery; passing preserves recovery',()=>{
 for(const accepted of [false,true]){
  const g=setup({0:16}),c=g.companies[2],card=take(g,2,c=>!c.signature&&!c.effect);c.down=true;g.pile.unshift(card);g.phase='reveal';g.queue=[];g.active=0;g.drawsLeft=5;
  act(g,{type:'reveal'});assert(g.pendingRedraw);choose(g,Number(accepted));finish(g);
  assert.equal(g.drawsLeft,accepted?4:5);assert.equal(g.pendingRedraw,!accepted);assert.equal(c.down,accepted);assertGame(g);
 }
});
test('Julie’s public-card bot choice works on a redacted observation without leaking private state',()=>{
 const g=setup({0:16}),card=take(g,2,c=>!c.signature&&!c.effect&&c.printed===2);g.companies[2].tokens=[{id:1,owner:1}];resolveCard(g,card,{interactive:true});
 const v=observation(g,0),before=clone(v);assert(!v.race);assert.equal(choosePower(v),1);assert.equal(botCommand(v,0,{samples:2}).choice,1);assert.deepEqual(v,before);
});
test('Reid returns normal and recovery-discarded growth cards to bottom, without cancelling recovery or creating copies',()=>{
 for(const recovery of [false,true]){
  const g=setup({0:21}),c=g.companies[0],card=take(g,0,x=>!x.effect&&!x.signature);c.down=recovery;const top=c.supply[0].id;
  resolveCard(g,card,{interactive:true});assert.equal(g.powerChoice.founder,21);assert(!c.down);assert.equal(c.position,recovery?10:10+card.printed);choose(g);finish(g);
  assert.equal(c.supply[0].id,top);assert.equal(c.supply.at(-1).id,card.id);assert(!c.history.some(x=>x.id===card.id));assert(!g.removed.some(x=>x.id===card.id));assert.equal(g.companies[1].position,9);assertGame(g);
 }
});
test('Reid can return a recovery-discarded Supply chain card, but does not intercept burns',()=>{
 const g=setup({3:21}),c=g.companies[3],card=take(g,3,x=>x.signature==='recycle');c.down=true;resolveCard(g,card,{interactive:true});assert.equal(g.powerChoice.founder,21);choose(g);finish(g);assert.equal(c.supply.at(-1).id,card.id);assertGame(g);
 g.burnEligible=g.pile.map(c=>c.id);burnPile(g);assert(!g.race&&!g.powerChoice);assert(g.removed.every(c=>c.burned));assertGame(g);
});
test('Mario stops forward passage at his space, including departures; backward moves still work',()=>{
 const g=setup({1:20});g.companies[1].position=11;g.companies[1].down=true;g.companies[0].position=10;
 const card=take(g,0,c=>!c.effect&&!c.signature&&c.printed===2);resolveCard(g,card);assert.equal(g.companies[0].position,11);
 resolveIntelActions(g,[{kind:'move',company:0,amount:3}],null,{interactive:false});assert.equal(g.companies[0].position,11);
 resolveIntelActions(g,[{kind:'move',company:0,amount:-1}],null,{interactive:false});assert.equal(g.companies[0].position,10);
 g.companies[1].down=false;resolveIntelActions(g,[{kind:'move',company:0,amount:3}],null,{interactive:false});assert.equal(g.companies[0].position,13);assertGame(g);
});
test('Mario rewards recovery by a growth discard, Pivot, Harry or Resolve crisis, respecting the hand limit',()=>{
 for(const kind of ['discard','pivot','repair']){
  const g=setup({2:20}),c=g.companies[2];g.players.forEach(p=>g.intelDeck.push(...p.intel.splice(0)));c.down=true;
  if(kind==='repair')resolveIntelActions(g,[{kind:'repair',company:2,source:2,intel:true}],{player:0,kind:'recover'},{interactive:false});
  else resolveCard(g,take(g,2,x=>kind==='pivot'?x.signature==='recover':!x.signature&&!x.effect));
  assert(!c.down);assert.equal(g.players[0].intel.length,1);assertGame(g);
 }
 const g=setup({2:20});while(g.players[0].intel.length<3)g.players[0].intel.push(g.intelDeck.shift());g.companies[2].down=true;resolveIntelActions(g,[{kind:'repair',company:2,source:2,intel:true}],null,{interactive:false});assert.equal(g.players[0].intel.length,3);assertGame(g);
});

test('Inside information is global, validates both discards atomically, and never triggers Melania',()=>{
 const g=setup({0:17});g.players.forEach(p=>g.intelDeck.push(...p.intel.splice(0)));g.players[0].intel.push(...g.intelDeck.splice(g.intelDeck.findIndex(c=>c.kind==='inside'),1));g.phase='intelPlay';g.queue=[0];g.intelOrder=[0];g.callOrder=[0,1,2,3];g.callIndex=1;
 act(g,{type:'playIntel',card:0,company:0});for(const choices of [[0],[0,0],[0,999]]){const before=clone(g);assert.throws(()=>act(g,{type:'scoutIntel',choices}));assert.deepEqual(g,before);}
 const ids=g.intelScout.cards.slice(0,2).map(c=>c.id);act(g,{type:'scoutIntel',choices:[0,1]});assert.equal(g.companies[0].position,10);assert.equal(g.metrics.pileDiscarded,2);assert.deepEqual(g.valueResult.discardedCards.map(c=>c.id),ids);assertGame(g);
});
test('Harry’s reveal-only recovery rewards Mario’s lead investor and spends his single reveal use',()=>{
 const g=setup({1:9,2:20}),card=take(g,2,x=>x.effect==='fumble');g.players.forEach(p=>g.intelDeck.push(...p.intel.splice(0)));
 resolveCard(g,card,{interactive:true});assert.equal(g.powerChoice.founder,9);choose(g);finish(g);assert(!g.companies[2].down);assert.equal(g.players[0].intel.length,1);assert.deepEqual(g.harryUsed,[1]);assertGame(g);
 const next=take(g,3,x=>x.effect==='fumble');resolveCard(g,next,{interactive:true});assert(!g.powerChoice);assert(g.companies[3].down);assertGame(g);
});
