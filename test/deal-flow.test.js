import test from 'node:test';
import assert from 'node:assert/strict';
import {rollGrowthDie,grantGrowth,pendingFor,nextGrowthPlayer,consumeGrowth,dealFlowScore} from '../src/deal-flow.js';

test('six equiprobable die faces have expected base movement 1.5', () => {
  const rolls = Array.from({length:6}, (_,i) => rollGrowthDie(() => (i+.5)/6));
  assert.deepEqual(rolls.map(r=>r.printed), [0,1,1,2,2,3]);
  assert.equal(rolls.reduce((n,r)=>n+r.printed,0)/6, 1.5);
  assert.equal(rolls.filter(r=>r.fumble).length, 1);
});

test('duplicate shares grant separate rolls; resolving growth preserves ownership', () => {
  const state={round:0,players:[{}, {}, {}, {}],companies:[{tokens:[{owner:0},{owner:0}]}]};
  const first=grantGrowth(state,0,0),second=grantGrowth(state,0,0);
  grantGrowth(state,2,0);
  consumeGrowth(state,0,first.id);
  assert.deepEqual(pendingFor(state,0),[second]);
  assert.equal(nextGrowthPlayer(state,0),2);
  assert.equal(state.companies[0].tokens.length,2);
  assert.throws(()=>consumeGrowth(state,0,first.id));
  assert.throws(()=>consumeGrowth(state,1,second.id));
});

test('capital calls are not profit and unpaid capital permits negative scores', () => {
  assert.equal(dealFlowScore(30,0,10),20);
  assert.equal(dealFlowScore(0,3*10,40),-10);
});

import {consumeDealFlow,revealCentreCards} from '../src/deal-flow.js';
test('four players take twenty actions and deliberately retain four centre cards', () => {
  const players=Array.from({length:4},()=>({actionsTaken:0,dealFlow:Array.from({length:6},(_,company)=>({company}))}));
  for(let turn=0;turn<5;turn++)for(const player of players)consumeDealFlow(player,0);
  assert.equal(players.reduce((n,p)=>n+p.actionsTaken,0),20);
  assert.throws(()=>consumeDealFlow(players[0],0));
  const centre=revealCentreCards(players,2);
  assert.deepEqual(centre.map(c=>c.player),[2,3,0,1]);
  assert.deepEqual(centre.map(c=>c.company),[5,5,5,5]);
});

test('wrong-company funding rejects without consuming the card or action', () => {
  const player={actionsTaken:0,dealFlow:[{company:0},{company:1}]};
  const before=structuredClone(player);
  assert.throws(()=>consumeDealFlow(player,0,{fundingCompany:1}));
  assert.deepEqual(player,before);
});
