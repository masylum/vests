import test from 'node:test';import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame,assertDiceGame} from '../archive/versions/v141/live-dice-engine.js';
import {diceBot} from '../archive/versions/v141/live-dice-bots.js';
import {sampleHiddenState} from '../archive/versions/v141/dice-planner.js';
test('setup spends one distinct matching card per investor from the finite supply',()=>{
 for(const players of [2,3,4])for(const seed of [1,42,8301]){
 const g=createDiceGame({seed,players});assert.equal(g.dealSpent.length,players);assert.equal(new Set(g.dealSpent.map(c=>c.company)).size,players);assert.equal(g.dealDeck.length,54-players);assert.equal(g.pendingGrowth.length,players);
 for(const p of g.players){const companies=g.companies.filter(c=>c.tokens.some(t=>t.owner===p.id));assert.equal(companies.length,1);assert.ok(g.dealSpent.some(d=>d.company===companies[0].id));}
 const commands=[];while(g.round===0){const id=currentPlayer(g),cmd=diceBot(diceObservation(g,id),id);diceCommand(g,id,cmd);commands.push({id,cmd});}
 assert.equal(g.dealDeck.length,54-players*6);assert.ok(g.players.every(p=>p.dealFlow.length===5));assert.deepEqual(replayDiceGame({version:g.version,setup:{seed,players},commands}).log,g.log);
 const sampled=sampleHiddenState(diceObservation(g,0),0,123);assertDiceGame(sampled);
 }
});
test('public market stays distinct through legal play, replacements and leg refreshes',()=>{
 const g=createDiceGame({seed:42});let n=0;while(!g.ended&&n++<1200){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));assert.equal(new Set(g.valueMarket.map(c=>c.kind)).size,4);}
 assert.ok(g.ended);assert.ok(g.log.some(e=>e.type==='valueResolved'));assert.ok(g.log.some(e=>e.type==='marketsRefreshed'&&e.round>0));
});
