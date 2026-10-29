import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,clone} from './legacy-engine.js';
import {availableCash} from './legacy-config.js';
const act=(g,c)=>{command(g,currentPlayer(g),c);assertGame(g);};
const bid=(g,amounts)=>{while(g.phase==='bid')act(g,{type:'bid',amount:amounts[currentPlayer(g)]});};
test('winner locks the unpaid part of the full bid, losers lock nothing; release after reveal',()=>{
 const g=createGame();act(g,{type:'call',company:0});bid(g,[10,3,0,0]);
 assert.equal(g.auction.paid,3);assert.equal(g.players[0].cash,37);assert.equal(g.players[0].locked,7);assert.equal(availableCash(g.players[0]),30);assert(g.players.slice(1).every(p=>p.locked===0));
 act(g,{type:'continue'});act(g,{type:'call',company:1});
 while(currentPlayer(g)!==0)act(g,{type:'bid',amount:0});
 const before=clone(g);assert.throws(()=>act(g,{type:'bid',amount:31}));assert.deepEqual(g,before);act(g,{type:'bid',amount:30});while(g.phase==='bid')act(g,{type:'bid',amount:0});
 assert.equal(g.players[0].cash,7);assert.equal(availableCash(g.players[0]),0);
 for(let i=0;g.phase!=='cycleResult'&&i<100;i++)act(g,g.phase==='call'?{type:'call',company:null}:g.phase==='power'?{type:'power',choice:0}:g.phase==='reveal'?{type:'reveal'}:{type:'continue'});
 assert.equal(g.phase,'cycleResult');assert.equal(g.players[0].locked,0);assert.equal(availableCash(g.players[0]),7);
});
test('minimum follows company growth, not global leg, and accepts pass',()=>{
 for(const [growth,min] of [[8,1],[9,2],[16,2],[17,3]]){
  const g=createGame();g.companies[0].position=growth;act(g,{type:'call',company:0});assert.equal(g.auction.reserve,min);
  const before=clone(g);assert.throws(()=>act(g,{type:'bid',amount:min>1?min-1:.5}));assert.deepEqual(g,before);
  bid(g,[min,0,0,0]);assert.equal(g.auction.paid,min);assert.equal(g.companies[0].reserve,1);assert.equal(g.players[0].locked,0);
 }
});

import {fundingRate} from '../src/bots.js';
test('future issuance follows successful observed auctions, not fixed aggressive dilution',()=>{
 const g=createGame();assert.equal(fundingRate(g),.25);g.metrics.cycles=4;g.auctionHistory=Array.from({length:8},(_,i)=>({winner:i<4?0:null}));assert.equal(fundingRate(g),.25);
 g.auctionHistory.forEach(a=>a.winner=null);assert.equal(fundingRate(g),.1);
});

import {portfolioWealth} from '../src/valuation.js';
test('locked money limits spending but remains owned cash for valuation',()=>{
 const g=createGame();g.players[0].locked=39;
 const values=g.companies.map(()=>({finalPrices:[0]}));
 assert.equal(availableCash(g.players[0]),1);
 assert.equal(portfolioWealth(g,0,values,0),-6);
});
