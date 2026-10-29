import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,clone,assertGame} from './legacy-engine.js';
import {RULES,companyValue,availableCash,fundingPrices} from './legacy-config.js';
test('whole-coin economy has a 40 budget, 46 obligation and 50 IPO',()=>{
 const g=createGame();assert(g.players.every(p=>p.cash===40&&p.obligation===46));
 assert.deepEqual([0,1,2].map(b=>fundingPrices(b)),[[1,3,6],[2,4,8],[3,5,10]]);
 assert.equal(companyValue(24),50);assert(Array.from({length:25},(_,i)=>companyValue(i)).every(Number.isInteger));
 command(g,currentPlayer(g),{type:'call',company:0});const before=clone(g);
 assert.throws(()=>command(g,currentPlayer(g),{type:'bid',amount:1.1}));assert.deepEqual(g,before);
});
test('a 40-coin all-in win paying 3 leaves zero spendable cash until round end',()=>{
 const g=createGame();command(g,currentPlayer(g),{type:'call',company:0});
 while(g.phase==='bid'){const id=currentPlayer(g);command(g,id,{type:'bid',amount:[40,3,0,0][id]});}
 assert.equal(g.auction.winner,0);assert.equal(g.players[0].cash,37);assert.equal(g.players[0].locked,37);assert.equal(availableCash(g.players[0]),0);assertGame(g);
 for(let i=0;g.phase!=='cycleResult'&&i<100;i++){
  const type=g.phase==='call'?'call':g.phase==='reveal'?'reveal':g.phase==='power'?'power':'continue';
  command(g,currentPlayer(g),{type,...(type==='call'?{company:null}:type==='power'?{choice:0}:{})});
 }
 assert.equal(g.phase,'cycleResult');assert.equal(g.players[0].locked,0);assert.equal(availableCash(g.players[0]),37);assertGame(g);
});
