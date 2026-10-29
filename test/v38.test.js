import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,hedgeFundInvest,assertGame,command,currentPlayer} from './legacy-engine.js';
import {canExit,podium,settlementValue} from './legacy-config.js';
test('hedge funds the last empty company once, dilutes, and conserves cash/cards',()=>{
 const g=createGame();g.companies.forEach((c,i)=>c.position=i+2);const c=g.companies[0];
 hedgeFundInvest(g);assert.equal(c.reserve,3);assert.equal(c.tokens.length,1);assert.equal(c.tokens[0].owner,null);assert.equal(g.metrics.hedgeInvestments,1);assertGame(g);
 hedgeFundInvest(g);assert.equal(c.tokens.length,1);
});
test('hedge skips nonempty reserves, exhausted supply, share cap, disabled rule and final IPO',()=>{
 for(const block of ['reserve','supply','cap','disabled','ipo']){
  const g=createGame();g.companies.forEach((c,i)=>c.position=i+2);const c=g.companies[0];
  if(block==='reserve')c.reserve=1;if(block==='supply')c.supply=[];if(block==='cap')c.tokens=Array.from({length:5},(_,i)=>({id:i+1,owner:null}));if(block==='disabled')g.rules.hedgeFund=false;if(block==='ipo')g.companies[1].position=24;
  const before=structuredClone(g);hedgeFundInvest(g);assert.deepEqual(g,before);
 }
});
test('hedge supports every eligible tied last company',()=>{
 const g=createGame();g.companies.forEach(c=>c.position=2);g.priority=3;hedgeFundInvest(g);assert.equal(g.companies[3].reserve,3);hedgeFundInvest(g);assert.equal(g.metrics.hedgeInvestments,6);
});
test('Wang in fifth exits at 40 with dilution during final settlement',()=>{
 const g=createGame();g.companies.forEach((c,i)=>{c.position=20-i;c.founder=-1;});
 const c=g.companies[4];c.founder=4;c.tokens=[{id:1,owner:0},{id:2,owner:null}];g.companies[0].position=24;
 const top=podium(g.companies,2);assert(!top.includes(c.id));assert(canExit(c,top,g.companies,g.priority));assert(!canExit(g.companies[5],top,g.companies,g.priority));
 g.phase='cycleResult';g.cycleEnd='checkpoint';command(g,currentPlayer(g),{type:'continue'});
 assert.equal(g.settlement.prices[4],20);assert.equal(g.settlement.prices[5],0);
});
