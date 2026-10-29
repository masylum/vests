import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,eligibleCompanies,assertGame} from './legacy-engine.js';
import {COMPANIES,REVEALS_PER_ROUND} from './legacy-config.js';
test('partial reserves can raise, add charges up to three, and dilute normally',()=>{
 for(const reserve of [1,2])for(const payment of [1,3,6]){
  const g=createGame(),id=currentPlayer(g),c=g.companies[0];c.reserve=reserve;c.tokens=[{id:1,owner:id}];c.lastBuy[id]=1;
  assert(eligibleCompanies(g,id).includes(0));command(g,id,{type:'call',company:0});
  while(g.phase==='bid'){const who=currentPlayer(g);command(g,who,{type:'bid',amount:who===id?payment:0});}
  assert.equal(c.reserve,Math.min(3,reserve+([1,3,6].indexOf(payment)+1)));assert.equal(c.tokens.length,2);assert.equal(g.players[id].cash,40-payment);assertGame(g);
 }
});
test('funding profiles vary while keeping four or five cards and valuable cheap slots',()=>{
 assert(new Set(COMPANIES.slice(0,6).map(c=>c.slots.join(','))).size>=4);
 for(const c of COMPANIES){const sum=c.slots.reduce((a,b)=>a+b,0);assert(sum>=4&&sum<=5);assert(c.slots.every(n=>n>=1&&n<=3));}
 assert.equal(REVEALS_PER_ROUND,5);
});
