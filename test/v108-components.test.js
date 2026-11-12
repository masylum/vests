import test from 'node:test';import assert from 'node:assert/strict';
import {DECK_PROFILES,growthDeck}from '../src/config.js';import{expectedTokenMovement}from '../src/balance.js';
import{portfolioUtility,forecasts}from '../src/bots.js';import{createGame,observation}from '../src/engine.js';import{portfolioWealth,portfolioOptions}from '../src/valuation.js';
test('recovery-compensated company mixes cluster around twenty-six movement',()=>{
 const values=DECK_PROFILES.map(expectedTokenMovement);for(const value of values)assert.ok(Math.abs(value-26)<.5);
 assert.ok(Math.max(...values)-Math.min(...values)<.7);
 assert.ok(new Set(DECK_PROFILES.map((_,i)=>growthDeck(i).reduce((s,t)=>s+t.printed,0))).size>1,'fumble compensation requires unequal printed totals');
 for(let i=0;i<6;i++)assert.equal(growthDeck(i).length,15);
});
test('report instrumentation exposes the exact production portfolio utility',()=>{
 const g=createGame({players:2,seed:108}),v=observation(g,0),values=forecasts(v,0,{samples:4,sampler:'independent'}),avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
 const wealth=(id,i)=>{const discount=.95**values[0].roundsToExit[i],proceeds=v.companies.reduce((s,c)=>s+(c.tokens.filter(t=>t.owner===id).length+values[c.id].futureShares[id][i])*values[c.id].finalPrices[i],0);return portfolioWealth(v,id,values,i)-(1-discount)*proceeds;};
 const outcomes=values[0].prices.map((_,i)=>wealth(0,i)-.5*wealth(1,i)),mean=avg(outcomes),expected=mean-.25*Math.sqrt(avg(outcomes.map(x=>(x-mean)**2)))+portfolioOptions(v,0);
 assert.ok(Math.abs(portfolioUtility(v,0,values)-expected)<1e-10);
});
