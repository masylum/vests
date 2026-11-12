import test from 'node:test';import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame} from '../archive/versions/v143/live-dice-engine.js';
import {DICE} from '../archive/versions/v143/live-dice-rules.js';import {diceBot} from '../archive/versions/v143/live-dice-bots.js';
const step=g=>{const id=currentPlayer(g),cmd=diceBot(diceObservation(g,id),id);diceCommand(g,id,cmd);return {id,cmd};};
test('support precedes funding, capital calls are $20, public row is N+2',()=>{
 for(const players of [2,3,4]){const g=createDiceGame({seed:42,players});while(g.round===0)step(g);assert.equal(g.phase,'flowAction');assert.equal(g.dealRow.length,players+2);
 const id=currentPlayer(g),cash=g.players[id].cash;diceCommand(g,id,{type:'raiseMoney'});assert.equal(g.players[id].cash,cash+20);assert.equal(g.players[id].capitalCalled,20);assert.equal(g.phase,'pickFlow');assert.equal(currentPlayer(g),id);
 const snapshot=JSON.stringify(g);assert.throws(()=>diceCommand(g,id,{type:'raiseMoney'}));assert.equal(JSON.stringify(g),snapshot);
 while(g.round===1&&!g.log.some(e=>e.type==='bankFunding'))step(g);assert.equal(g.pendingGrowth.filter(e=>e.bank).length,2);
 }
});
test('observations hide opponents balances until settlement and expose only two dice',()=>{
 const g=createDiceGame({seed:7}),v=diceObservation(g,0);assert.equal(v.players[0].cash,20);assert.equal(v.players[1].cash,undefined);assert.equal(v.players[1].capitalCalled,undefined);assert.equal(v.players[1].capital,undefined);assert.equal(v.bank,undefined);assert.deepEqual(v.log,[]);assert.deepEqual(Object.keys(DICE),['bland','mild']);
});
test('catch-up is a visible review phase; payout breakdown reconciles and replay is exact',()=>{
 for(const players of [2,3,4]){const setup={seed:5100+players,players},g=createDiceGame(setup),commands=[];let catchups=0;
 for(let n=0;!g.ended&&n<2000;n++){if(g.phase==='phaseResult'&&g.flowStage==='roundCatchUp'){catchups++;assert.ok(g.lastRevealed.reactions.some(r=>r.catchUp));}commands.push(step(g));}
 assert.ok(g.ended);assert.equal(catchups,g.round);assert.deepEqual(replayDiceGame({version:g.version,setup,commands}).log,g.log);
 for(const a of g.accounts){assert.equal(a.companies.length,6);assert.equal(a.companies.reduce((n,c)=>n+c.payout,0),a.payout);assert.equal(a.cash+a.payout-a.capitalCalled,g.scores[a.player]);}
 assert.equal(diceObservation(g,0).players[1].cash,g.players[1].cash);
 }
});
