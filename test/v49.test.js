// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,resolveCard,hedgeFundInvest,command,currentPlayer} from '../docs/v96-validation/baseline-v95/legacy-engine.js';
import {raceRank,podium} from '../docs/v96-validation/baseline-v95/legacy-config.js';import {resolveRevealPhase} from '../docs/v96-validation/baseline-v95/racing.js';
function race(positions){const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.companies.forEach((c,i)=>{c.position=positions[i];c.founder=-1;c.tokens=[{owner:0}];c.lastBuy=[1,0,0,0];});return g;}
test('shared third pays only the first arrival',()=>{
 const g=race([24,22,20,20,18,17]);g.companies.forEach((c,i)=>c.arrivalOrder=i+1);assert.deepEqual(g.companies.map(c=>raceRank(c,g.companies)),[1,2,3,4,5,6]);assert.deepEqual(podium(g.companies),[0,1,2]);
 g.phase='cycleResult';g.cycleEnd='checkpoint';command(g,currentPlayer(g),{type:'continue'});assert(g.settlement.prices[2]>0);assert.equal(g.settlement.prices[3],0);assert.equal(g.settlement.prices[4],0);
});
test('Ryan chooses one rival to fumble, never himself',()=>{
 const g=race([1,8,8,5,4,3]);g.companies[0].founder=6;resolveRevealPhase(g,'start',true);command(g,currentPlayer(g),{type:'power',choice:0});assert.equal(g.companies[0].position,2);assert(g.companies[1].down&&!g.companies[2].down);assert(!g.companies[0].down);
});
test('tied leaders block Matt; Liza adds one while tied for second',()=>{
 const g=race([8,8,5,4,3,2]);g.companies[0].founder=1;resolveRevealPhase(g,'end',true);assert(!g.powerChoice);
 const h=race([8,7,7,4,3,2]);h.companies[2].founder=8;resolveCard(h,{id:'unit',company:2,kind:'growth',printed:1});assert.equal(h.companies[2].position,9);
});
test('hedge evaluates each tied trailing company independently',()=>{
 const g=race([1,1,1,4,5,6]);g.companies[0].reserve=1;g.companies[1].reserve=0;g.companies[2].reserve=0;hedgeFundInvest(g);assert.deepEqual(g.companies.slice(0,3).map(c=>c.reserve),[1,3,3]);
});
test('Testra swaps with one adjacent company, not every company tied there',()=>{
 const h=race([4,5,5,9,10,11]);resolveCard(h,{id:'unit',company:0,kind:'growth',printed:0,signature:'swap'});assert.equal(h.companies[0].position,5);assert.equal(h.companies.slice(1,3).filter(c=>c.position===4).length,1);
});
test('IPO card still resolves signatures, reactions, and remaining draws',()=>{
 const g=race([23,23,10,9,8,7]);g.companies[1].founder=17;const c=g.companies[0];const supply=c.supply.length;
 resolveCard(g,{id:'unit',company:0,kind:'growth',printed:1,signature:'add'});
 assert.equal(g.ipoCompany,0);assert.equal(c.position,24);assert.equal(g.companies[1].position,23);assert.equal(c.supply.length,supply-1);
 resolveCard(g,{id:'later',company:1,kind:'growth',printed:3});resolveRevealPhase(g,'end');assert.equal(g.companies[1].position,24);
});
test('Ryan reaches IPO and must still choose a fumble',()=>{
 const g=race([23,24,24,24,24,24]);g.companies[0].founder=6;resolveRevealPhase(g,'start',true);
 assert.equal(g.ipoCompany,0);assert.equal(g.companies[0].position,24);assert(g.powerChoice);
});

test('a winning reveal waits for the remaining draws and after-reveal step',()=>{
 const g=race([23,22,10,9,8,7]);g.drawsLeft=2;g.pile=[{id:'win',company:0,kind:'growth',printed:1},{id:'later',company:1,kind:'growth',printed:3}];
 command(g,currentPlayer(g),{type:'reveal'});assert.equal(g.phase,'reveal');assert.equal(g.pile[0].id,'later');
 command(g,currentPlayer(g),{type:'reveal'});assert.equal(g.phase,'afterRevealReady');assert.equal(g.companies[1].position,24);
 command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'settle');assert(g.finalExit);
});
