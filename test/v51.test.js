import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,burnPile,observation,assertGame,resolveCardBase} from '../src/engine.js';
import {resolveRevealPhase,resumeRace} from '../src/racing.js';
import {forecasts} from '../src/bots.js';
test('round burn reveals the removed cards and preserves exact pile counts',()=>{
 const g=createGame({rules:{burnPerRound:2}}),before=g.pile.length,history=g.companies.map(c=>c.history.length);burnPile(g);assert.equal(g.pile.length,before-2);assert.equal(g.removed.filter(c=>c.burned).length,2);assert.deepEqual(g.companies.map(c=>c.history.length),history);assertGame(g);
 const v=observation(g,0);assert.equal(v.poolWeightsAreUpperBounds,false);assert.equal(v.publicBurns.length,2);assert.equal(v.poolWeights.reduce((a,b)=>a+b),before-2);assert.equal(v.pileCount,before-2);assert(!v.removed&&!v.pile&&!v.log);assert.deepEqual(Object.keys(g.log.at(-1)).sort(),['cards','count','cycle','leg','type']);
});
test('burn handles small piles and never runs after IPO',()=>{
 const g=createGame({rules:{burnPerRound:2}});burnPile(g);assert.equal(g.pile.length,4);burnPile(g);assert.equal(g.pile.length,2);burnPile(g);assert.equal(g.pile.length,0);burnPile(g);assert.equal(g.metrics.burned,6);assertGame(g);
 const h=createGame();h.ipoCompany=0;burnPile(h);assert.equal(h.pile.length,6);
});
test('different hidden supply removals preserve private identities and identical forecasts',()=>{
 const g=createGame(),h=structuredClone(g);g.removed.push({...g.companies[0].supply.shift(),burned:true});h.removed.push({...h.companies[0].supply.pop(),burned:true});g.metrics.burned=h.metrics.burned=1;
 const a=observation(g,0),b=observation(h,0);assert.deepEqual(a,b);assert.deepEqual(forecasts(a,0,{samples:2}),forecasts(b,0,{samples:2}));assertGame(g);assertGame(h);
});
test('Brittney fumbles herself and every company at her destination',()=>{
 const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.companies.forEach((c,i)=>{c.position=[2,5,5,9,10,11][i];c.founder=-1;c.tokens=[{owner:0}];c.lastBuy=[1,0,0,0];});g.companies[0].founder=19;
 resolveRevealPhase(g,'start',true);resumeRace(g,1,resolveCardBase);assert.equal(g.companies[0].position,5);assert(g.companies.slice(0,3).every(c=>c.down));assert(g.companies.slice(3).every(c=>!c.down));
});
