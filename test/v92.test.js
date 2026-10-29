// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,resolveCard,observation,clone} from '../docs/v96-validation/baseline-v95/engine.js';
import {resolveRevealPhase,choosePower} from '../docs/v96-validation/baseline-v95/racing.js';
import {botCommand} from '../docs/v96-validation/baseline-v95/bots.js';
function setup(){const g=createGame({seed:123});const founders=[16,4,7,9,14,15],rest=Array.from({length:20},(_,id)=>id).filter(id=>!founders.includes(id));g.founderMarket=rest.splice(0,3);g.founderSupply=rest;g.companies.forEach((c,i)=>{c.founder=founders[i];c.position=10;});const j=g.companies[0];j.founder=16;j.tokens=[{owner:0,id:1,paid:0}];j.lastBuy[0]=1;return{g,j,target:g.companies[2]};}
function take(g,c,filter=()=>true){let source=c.supply,index=source.findIndex(filter);if(index<0){source=g.pile;index=source.findIndex(card=>card.company===c.id&&filter(card));}assert(index>=0);return source.splice(index,1)[0];}
const select=(g,choice)=>command(g,currentPlayer(g),{type:'power',choice});
test('Julie shows the revealed card before effects, then returns it to the very top without movement',()=>{
 const{g,j,target}=setup(),card=take(g,target,c=>c.printed===2&&!c.signature);const stock=target.supply.length;
 resolveCard(g,card,{interactive:true});assert.equal(g.phase,'power');assert.equal(g.lastRevealed.pending,true);assert.equal(g.lastRevealed.card.id,card.id);assert.equal(target.position,10);assert.equal(j.position,10);assertGame(g);
 select(g,1);assert.equal(target.supply.length,stock+1);assert.equal(target.supply[0].id,card.id);assert.equal(target.position,10);assert.equal(j.position,10);assert(!target.history.some(c=>c.id===card.id));assert(!g.removed.some(c=>c.id===card.id));assert.equal(g.metrics.julieReturned,1);assert.equal(g.lastRevealed.returned,true);assertGame(g);
 const next=take(g,target,c=>c.printed===2&&!c.signature);resolveCard(g,next,{interactive:true});assert(!g.powerChoice);assert.equal(target.position,12);assertGame(g);
});
test('passing saves Julie’s use, accepting prevents fumbles and their reactive powers',()=>{
 const{g,target}=setup();const first=take(g,target,c=>c.printed===1&&!c.signature);resolveCard(g,first,{interactive:true});select(g,0);assert.equal(g.metrics.julieReturned??0,0);
 const fumbler=g.companies.find(c=>c.supply.some(c=>c.effect==='fumble'));const fumble=take(g,fumbler,c=>c.effect==='fumble');g.founderSupply[g.founderSupply.indexOf(5)]=7;g.companies[2].founder=5;const pos=g.companies[2].position;
 resolveCard(g,fumble,{interactive:true});select(g,1);assert(!fumbler.down);assert.equal(g.companies[2].position,pos);assert.equal(g.metrics.fumbles,0);assertGame(g);
});
test('Julie cancels signatures before their effects and does not reset merely between cards',()=>{
 const{g}=setup(),c=g.companies[1];const card=take(g,c,c=>c.signature==='swapCard');c.reserve=0;resolveCard(g,card,{interactive:true});select(g,1);assert.equal(c.reserve,0);assert.equal(c.position,10);assert.equal(c.supply[0].id,card.id);
 resolveRevealPhase(g,'start');assert.equal(g.julieUsed.length,0);const next=take(g,c,c=>!c.signature&&!c.effect);resolveCard(g,next,{interactive:true});assert(g.powerChoice);select(g,1);assertGame(g);
});
test('Julie return consumes a normal draw and a would-be fumble recovery draw without replacing it',()=>{
 for(const down of [false,true]){const{g,target}=setup();const card=take(g,target,c=>c.printed===2&&!c.signature);g.pile.unshift(card);target.down=down;g.phase='reveal';g.active=g.first;g.queue=[];g.drawsLeft=5;command(g,currentPlayer(g),{type:'reveal'});const pending=g.drawsLeft;assert.equal(pending,down?5:4);select(g,1);assert.equal(g.drawsLeft,4);assert.equal(g.pendingRedraw,false);assert.equal(target.down,down);assert.equal(g.metrics.wasted,1);assertGame(g);}
});
test('passing Julie retains normal fumble recovery and replacement-draw behavior',()=>{
 const{g,target}=setup(),card=take(g,target,c=>c.printed===2&&!c.signature);g.pile.unshift(card);target.down=true;g.phase='reveal';g.active=g.first;g.queue=[];g.drawsLeft=5;command(g,currentPlayer(g),{type:'reveal'});select(g,0);assert(!target.down);assert.equal(g.drawsLeft,5);assert(g.pendingRedraw);assert.equal(g.lastRevealed.type,'deferred');assertGame(g);
});
test('Julie skips while inactive or unowned and paid-card funding remains conserved on return',()=>{
 for(const flag of ['down','hiringFumble','unowned']){const{g,j,target}=setup();if(flag==='unowned')j.tokens=[];else j[flag]=true;const card=take(g,target,c=>c.printed===2&&!c.signature);resolveCard(g,card,{interactive:true});assert(!g.powerChoice);assert.equal(target.position,12);}
 const{g,target}=setup(),card=take(g,target,c=>c.printed===2&&!c.signature);card.paid=true;card.fundingCount=1;g.metrics.purchased++;resolveCard(g,card,{interactive:true});select(g,1);assert.equal(target.supply[0].paid,false);assert.equal(target.supply[0].fundingCount,1);assertGame(g);
});
test('Julie’s bot choice uses the public revealed card, cancels rival growth and saves friendly growth',()=>{
 for(const own of [false,true]){const{g,target}=setup();target.tokens=[{owner:own?0:1,id:1}];target.lastBuy[own?0:1]=1;const card=take(g,target,c=>c.printed===2&&!c.signature);resolveCard(g,card,{interactive:true});const v=observation(g,0),before=clone(v);assert.equal(choosePower(v),own?0:1);assert.equal(botCommand(v,0,{samples:2}).choice,own?0:1);assert.deepEqual(v,before);}
});
test('Ryan moves one and fumbles another company whenever not leading, including middle positions',()=>{
 for(const positions of [[4,7,6,5,3,2],[1,1,3,4,5,6],[10,10,9,8,7,6],[5,5,5,5,5,5]]){const g=createGame();g.fast=true;g.companies.forEach((c,i)=>{c.position=positions[i];c.founder=-1;});g.companies[0].founder=6;const active=positions[0]<Math.max(...positions);resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,positions[0]+Number(active));assert.equal(g.companies.filter(c=>c.down).length,Number(active));}
});
