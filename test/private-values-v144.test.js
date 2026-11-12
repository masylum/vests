import test from 'node:test';import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame,assertDiceGame,DICE_VALUES} from '../archive/versions/v144/live-dice-engine.js';
import {diceBot} from '../archive/versions/v144/live-dice-bots.js';import {sampleHiddenState} from '../archive/versions/v144/dice-planner.js';
test('unique private values, bottom-deck replacement, unchanged leg hands, exact replay',()=>{
 let plays=0,refreshes=0;
 for(const players of [2,3,4]){const setup={seed:4101,players},g=createDiceGame(setup),commands=[];
 assert.equal(g.intelDeck.length,DICE_VALUES.length-players);assert.ok(g.players.every(p=>p.intel.length===1));
 const view=diceObservation(g,0);assert.equal(view.intelDeck,undefined);assert.ok(!view.players[1].intel?.length);assertDiceGame(sampleHiddenState(view,0,123));
 for(let n=0;!g.ended&&n<2000;n++){
 const id=currentPlayer(g),cmd=diceBot(diceObservation(g,id),id),deck=structuredClone(g.intelDeck),hands=g.players.map(p=>structuredClone(p.intel)),leg=g.leg;
 diceCommand(g,id,cmd);commands.push({id,cmd});assertDiceGame(g);
 if(cmd.type==='playIntel'){plays++;assert.deepEqual(g.players[id].intel,[deck[0]]);assert.deepEqual(g.intelDeck,[...deck.slice(1),hands[id][cmd.card]]);assert.equal(g.intelDiscard.length,0);}
 else {assert.deepEqual(g.players.map(p=>p.intel),hands);assert.deepEqual(g.intelDeck,deck);}
 if(g.leg!==leg)refreshes++;
 }
 assert.ok(g.ended);assert.deepEqual(replayDiceGame({version:g.version,setup,commands}).log,g.log);
 }
 assert.ok(plays>0);assert.ok(refreshes>0);
});
