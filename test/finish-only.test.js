import test from 'node:test';import assert from 'node:assert/strict';
import {simulateLiveDice} from '../scripts/live-dice-simulate.js';
import {createDiceGame} from '../src/live-dice-engine.js';
test('five-card row and reaching-24-only option survive replay and deck exhaustion',()=>{
 const g=simulateLiveDice({seed:8101,players:2,dealCopies:1,rowSize:5,roundLimit:null,endOnDeckExhaustion:false,supportPolicy:'legacy',maxDecisions:6000,trace:true});
 assert.equal(g.endReason,'finish');assert.ok(g.round>7);assert.ok(g.log.some(e=>e.type==='dealFlowRow'&&!e.cards.length));assert.ok(g.crossedLegs.includes(2));
});
test('row size and round limit are explicit, defaults use five cards and no round cap',()=>{
 const g=createDiceGame({players:2});assert.equal(g.rowSize,5);assert.equal(g.roundLimit,null);assert.equal(g.endOnDeckExhaustion,true);
 const five=simulateLiveDice({seed:8102,players:2,rowSize:5,roundLimit:1,supportPolicy:'legacy',trace:true});assert.equal(five.endReason,'roundLimit');assert.equal(five.log.find(e=>e.type==='dealFlowRow').cards.length,5);
});

test('default ending settles every company after the exhausted final row',()=>{
 for(const players of [2,3,4]){
  const g=simulateLiveDice({seed:8102,players,dealCopies:1,supportPolicy:'legacy',trace:true});
  assert.equal(g.endReason,'deckExhausted');assert.equal(g.roundLimit,null);
  assert.equal(g.dealDeck.length,0);assert.equal(g.dealRow.length,0);
  assert.equal(g.log.filter(e=>e.type==='roundEnd').length,g.round);
  assert.ok(g.log.filter(e=>e.type==='dealFlowRow').every(e=>e.cards.length>0));
  assert.equal(g.accounts.length,players);
  for(const a of g.accounts){assert.equal(a.companies.length,players+2);assert.equal(g.scores[a.player],a.cash+a.payout-a.capitalCalled);}
 }
});
