// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,deployReserves,resolveCardBase} from '../docs/v96-validation/baseline-v95/legacy-engine.js';
import {resolveRevealPhase,resumeRace} from '../docs/v96-validation/baseline-v95/racing.js';
function race(positions){const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.priority=0;g.pile=[];g.companies=g.companies.slice(0,positions.length);g.companies.forEach((c,i)=>{c.founder=-1;c.position=positions[i];c.reserve=0;c.tokens=[{owner:0}];c.lastBuy=[1,0,0,0];});return g;}
test('Darcy moves once before reveal without deploying cards',()=>{
 const g=race([2,8]);const c=g.companies[0];c.founder=13;const stock=c.supply.length;
 deployReserves(g);assert.equal(g.pile.length,0);
 resolveRevealPhase(g,'start');assert.equal(g.pile.length,0);assert.equal(c.supply.length,stock);assert.equal(c.position,3);assert.equal(g.drawsLeft,0);
 resolveRevealPhase(g,'start');assert.equal(g.pile.length,0);assert.equal(c.position,3);
});
test('Darcy checks after funded deployment, stays inactive while fumbled, and never invents supply',()=>{
 for(const down of [false,true]){const g=race([2,8]);const c=g.companies[0];c.founder=13;c.reserve=1;c.down=down;deployReserves(g);const cards=g.pile.length;assert.equal(c.reserve,0);resolveRevealPhase(g,'start');assert.equal(g.pile.length,cards);assert.equal(c.position,down?2:3);}
 const g=race([2,8]);g.companies[0].founder=13;g.companies[0].supply=[];resolveRevealPhase(g,'start');assert.equal(g.pile.length,0);assert.equal(g.companies[0].position,3);
});
test('Ryan moves one when not leading and fumbles the leading rival, with Dan fumbling before the reveal',()=>{
 for(const dan of [false,true]){const g=race([2,8,6]);g.companies[0].founder=6;if(dan)g.companies[1].founder=11;resolveRevealPhase(g,'start',true);resumeRace(g,0,resolveCardBase);assert.equal(g.companies[0].position,3);assert.equal(g.companies[1].position,8);assert.equal(g.companies[1].down,true);assert.equal(g.metrics.fumbleConversions??0,0);}
 const g=race([2,2]);g.companies[0].founder=6;resolveRevealPhase(g,'start');assert(!g.companies[0].down);assert(!g.companies[1].down);
});
test('Jei-Jei pulls from either direction then fumbles; Dan fumbles after the pull',()=>{
 for(const position of [2,8])for(const dan of [false,true]){const g=race([5,position]);g.companies[0].founder=15;if(dan)g.companies[1].founder=11;resolveRevealPhase(g,'start',true);resumeRace(g,1,resolveCardBase);assert.equal(g.companies[1].position,5);assert.equal(g.companies[1].down,true);}
});
test('A pulled Kitesurfer fumbles without reflecting the fumble onto Jei-Jei',()=>{
 const g=race([5,7]);g.companies[0].founder=15;g.companies[1].founder=17;resolveRevealPhase(g,'start',true);resumeRace(g,1,resolveCardBase);assert(g.companies[1].down);assert(!g.companies[0].down);
});
