import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,holdings,assertGame} from './legacy-engine.js';
import {podium,fundingBand,fundingPrices} from './legacy-config.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
test('founder replacement uses the turn, respects leadership, and exposes three choices',()=>{
 const g=createGame(),id=currentPlayer(g),c=g.companies[0];
 assert.equal(g.founderMarket.length,3);
 assert.throws(()=>act(g,{type:'changeFounder',company:0}),/lead/);
 c.tokens.push({id:1,owner:id,paid:0});c.lastBuy[id]=1;
 act(g,{type:'changeFounder',company:0});assert.equal(g.phase,'founder');
 act(g,{type:'founder',choice:-1});assert.equal(g.phase,'call');assert.equal(currentPlayer(g),id);
 const replacement=g.founderMarket[2];act(g,{type:'changeFounder',company:0});act(g,{type:'founder',choice:2});
 assert.equal(c.founder,replacement);assert.notEqual(currentPlayer(g),id);assert.equal(g.metrics.auctions,0);assertGame(g);
});
test('top three have distinct ranks, resolving shared spaces by arrival',()=>{
 const cs=[1,4,4,4,4,0].map((position,id)=>({id,position}));
 assert.deepEqual(podium(cs,3),[1,2,3]);
 assert.deepEqual([8,9,16,17,24].map(fundingBand),[0,1,1,2,2]);
 assert.deepEqual(fundingPrices(fundingBand(9)),[2,4,8]);
});
test('one IPO closes early, pays scoring companies, and repays only received LPs',()=>{
 const g=createGame();const wang=g.companies.find(c=>c.founder===4);if(wang){const old=wang.founder;wang.founder=g.founderSupply[0];g.founderSupply[0]=old;}g.companies.forEach((c,i)=>{c.position=[24,20,18,17,10,2][i];c.tokens=[{id:1,owner:i%4,paid:0}];});
 g.phase='cycleResult';g.queue=[];g.active=g.first;g.cycleEnd='checkpoint';
 act(g,{type:'continue'});assert(g.finalExit);assert.equal(g.phase,'settle');
 assert(g.settlement.prices.slice(0,3).every(x=>x>0));assert.deepEqual(g.settlement.prices.slice(3),[0,0,0]);
 while(g.phase==='settle')act(g,{type:'sell',shares:g.companies.map(c=>holdings(c,currentPlayer(g)))});
 act(g,{type:'continue'});assert(g.ended);assert.equal(g.bank.issued,4*40);assert(g.settlements[0].accounts.every(a=>a.due===46));assertGame(g);
});
