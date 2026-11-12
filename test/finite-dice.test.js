import test from 'node:test';import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,currentPlayer,diceObservation,replayDiceGame,assertDiceGame,holdings,exitPrice} from '../archive/versions/v135/live-dice-engine.js';
import {diceBot} from '../archive/versions/v135/live-dice-bots.js';import {simulateLiveDice} from '../scripts/v135-simulate.js';
function opening(players=4,dealCopies=5){const g=createDiceGame({seed:42,players,dealCopies});while(g.round===0&&!g.ended){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));}return g;}
test('finite equal supply, five initial cards, and no hidden deck or opponent hands in observations',()=>{
 const g=opening();assert.equal(g.dealDeck.length,10);assert.ok(g.players.every(p=>p.dealFlow.length===5));assert.equal(g.dealSpent.length,0);assertDiceGame(g);const view=diceObservation(g,0);assert.equal(view.dealDeck,undefined);assert.equal(view.dealDeckCount,10);assert.equal(view.players[1].dealFlow,undefined);
});
test('every card is spent once, no redeal, partial draws and empty hands settle safely for 2–4 players',()=>{
 for(const players of [2,3,4])for(const copies of [4,5,7]){const g=opening(players,copies);assert.ok(!g.ended);const expected=g.players.map(p=>p.cash+g.companies.reduce((n,c)=>n+holdings(c,p.id)*exitPrice(c.position),0));let n=0;while(!g.ended&&n<100){diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});n++;}
 assert.equal(n,copies*6);assert.equal(g.endReason,'deckExhausted');assert.equal(g.dealSpent.length,copies*6);assert.equal(g.dealDeck.length,0);assert.ok(g.players.every(p=>p.dealFlow.length===0));assert.equal(new Set(g.dealSpent.map(c=>c.id)).size,copies*6);assert.deepEqual(g.scores,expected);assert.equal(g.log.filter(e=>e.type==='action').length,copies*6);}
});
test('reject too-small supply and invalid commands atomically',()=>{
 assert.throws(()=>createDiceGame({players:4,dealCopies:3}));const g=opening(),before=structuredClone(g),id=currentPlayer(g);assert.throws(()=>diceCommand(g,id,{type:'call',deal:0,company:(g.players[id].dealFlow[0].company+1)%6}));assert.deepEqual(g,before);
});
test('funding never exceeds the company supply and configured finite games replay exactly',()=>{
 for(const players of [2,3,4]){const g=simulateLiveDice({seed:11,players,dealCopies:4,trace:true});assert.equal(g.ended,true);for(let cid=0;cid<6;cid++)assert.ok(g.log.filter(e=>e.type==='action'&&e.command.type==='call'&&e.command.company===cid).length<=4);assert.deepEqual(replayDiceGame(g.replay).log,g.log);assertDiceGame(g);}
});
