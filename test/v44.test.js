// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,quote,resolveCard,command,currentPlayer} from '../docs/v96-validation/baseline-v95/legacy-engine.js';
import {canExit,podium,slotCards} from '../docs/v96-validation/baseline-v95/legacy-config.js';
import {resolveRevealPhase} from '../docs/v96-validation/baseline-v95/racing.js';
const setup=()=>{const g=createGame();g.fast=true;g.priority=0;g.companies.forEach((c,i)=>{c.founder=-1;c.position=24-i;c.down=false;c.hiringFumble=false;c.tokens=[{owner:0},{owner:1}];c.lastBuy=[1,1,0,0];});return g;};
test('Wang pays 40 only in fourth/fifth; normal podium values still apply',()=>{
 for(const rank of [1,2,3,4,5,6]){
  const g=setup(),c=g.companies[rank-1];c.founder=4;
  assert.equal(canExit(c,podium(g.companies),g.companies),rank<=5);
  if(rank===4||rank===5){assert.equal(quote(c,g.rules,g.companies),20);c.down=true;assert(!canExit(c,podium(g.companies),g.companies));}
 }
});
test('Wang uses arrival order to distinguish ranks on a shared space',()=>{
 const g=setup();g.companies.forEach((c,i)=>{c.position=20;c.arrivalOrder=i+1;});const c=g.companies[0];c.founder=4;
 assert(canExit(c,podium(g.companies),g.companies));assert.equal(quote(c,g.rules,g.companies),14);
 g.companies.slice(1,4).forEach(c=>c.position=21);assert.equal(quote(c,g.rules,g.companies),20);
});
test('Jerry uses ordinary exit dilution, including non-player shares',()=>{
 const g=setup(),c=g.companies[0];c.founder=7;
 assert.equal(quote(c,g.rules,g.companies),25);
 c.tokens.push({owner:null});assert.equal(quote(c,g.rules,g.companies),16);
 c.down=true;assert.equal(quote(c,g.rules,g.companies),16);
 c.down=false;c.tokens=[{owner:0}];assert.equal(quote(c,g.rules,g.companies),50);
 g.phase='cycleResult';g.cycleEnd='checkpoint';command(g,currentPlayer(g),{type:'continue'});assert.equal(g.settlement.prices[0],50);
});
test('all already-fumbled founders discard their draw and cannot use phase powers',()=>{
 for(let founder=0;founder<20;founder++){
  const g=setup(),c=g.companies[0];c.founder=founder;c.position=1;c.down=true;
  resolveRevealPhase(g,'start',true);assert(!g.powerChoice);resolveRevealPhase(g,'end',true);assert(!g.powerChoice);assert.equal(c.position,1);
  resolveCard(g,{id:'unit',company:0,kind:'growth',printed:2});assert.equal(c.position,1);assert(!c.down);assert(g.lastRevealed.deferred);
 }
});
test('fumbled reactive founders do not respond to other companies',()=>{
 for(const founder of [0,5,9,10,12]){
  const g=setup(),c=g.companies[0];c.founder=founder;c.position=2;c.down=true;g.companies[1].position=1;const supply=c.supply.length;
  resolveCard(g,{id:'unit',company:1,kind:'growth',printed:3});resolveCard(g,{id:'hazard',company:1,kind:'growth',effect:'fumble',printed:0},{interactive:true});
  assert.equal(c.position,2);assert.equal(c.supply.length,supply);assert(!g.powerChoice);
 }
});
test('Darcy zero-slot power is disabled by any fumble',()=>{const g=setup(),c=g.companies[0];c.founder=13;assert.equal(slotCards(c,0),0);c.down=true;assert.equal(slotCards(c,0),0);});
test('Ryan moves once when not leading',()=>{
 const g=setup(),c=g.companies[0];g.companies.forEach((c,i)=>c.position=[20,19,23,22,21,18][i]);c.founder=6;
 resolveRevealPhase(g,'start');assert.equal(c.position,21);resolveRevealPhase(g,'start');assert.equal(c.position,21);
});
