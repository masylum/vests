import test from 'node:test';import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame,assertDiceGame,exitPrice,shareExitPrice} from '../archive/versions/v142/live-dice-engine.js';
import {diceBot} from '../archive/versions/v142/live-dice-bots.js';import {sampleHiddenState} from '../archive/versions/v142/dice-planner.js';
import {resolveCard} from '../archive/versions/v142/engine.js';
const step=g=>{const id=currentPlayer(g),cmd=diceBot(diceObservation(g,id),id);diceCommand(g,id,cmd);return {id,cmd};};
test('public row replaces private hands; sampled decks conserve visible cards',()=>{
 for(const players of [2,3,4]){const g=createDiceGame({seed:42,players});while(g.round===0)step(g);
 assert.equal(g.phase,'pickFlow');assert.equal(g.dealRow.length,players+1);assert.equal(g.dealDeck.length,54-players-(players+1));assert.ok(g.players.every(p=>!p.dealFlow.length));
 const sampled=sampleHiddenState(diceObservation(g,0),0,123);assertDiceGame(sampled);assert.deepEqual(sampled.dealRow,g.dealRow);
 const old=JSON.stringify(g);assert.throws(()=>diceCommand(g,currentPlayer(g),{type:'raiseMoney'}));assert.equal(JSON.stringify(g),old);
 }
});
test('one funding followed by one support action; bank has dice but no share',()=>{
 const g=createDiceGame({seed:42});while(g.round===0)step(g);const caller=currentPlayer(g),card=g.dealRow[0];diceCommand(g,caller,{type:'call',deal:0,company:card.company});
 while(g.phase!=='flowAction')step(g);assert.equal(currentPlayer(g),caller);assert.equal(g.turnPart,'support');
 const before=JSON.stringify(g);assert.throws(()=>diceCommand(g,caller,{type:'call',deal:0,company:g.dealRow[0].company}));assert.equal(JSON.stringify(g),before);
 diceCommand(g,caller,{type:'passAction'});assert.ok(g.roundActed.includes(caller));
 while(!g.log.some(e=>e.type==='bankFunding'))step(g);
 const banks=g.pendingGrowth.filter(e=>e.bank);assert.equal(banks.length,1);assert.deepEqual(banks[0].dice,['bland','bland']);
 assert.equal(g.companies.reduce((n,c)=>n+c.tokens.length,0),4+g.auctionHistory.filter(a=>a.winner!==null).length+g.log.filter(e=>e.type==='valueResolved'&&e.value.kind==='sweat').length);
});
test('classic dilution: $100 total divided among shares',()=>{assert.equal(exitPrice(24),100);assert.equal(shareExitPrice({position:24,tokens:[1,2,3]}),33);assert.equal(exitPrice(10),2);});
test('fumbled company discards numbered and fumble dice, clearing its status',()=>{
 for(const face of [2,'x']){const g=createDiceGame({seed:42}),c=g.companies.find(c=>![20,3].includes(c.founder));c.down=true;const before=c.position;
 resolveCard(g,{kind:'growth',company:c.id,signature:false,printed:face==='x'?0:face,...(face==='x'?{effect:'fumble'}:{})});assert.equal(c.down,false);assert.equal(c.position,before);assert.ok(g.log.some(e=>e.type==='deferred'));}
});
test('legal full games replay, settle diluted payouts, and roll one face per receipt',()=>{
 for(const players of [2,3,4]){const setup={seed:800+players,players},g=createDiceGame(setup),commands=[];
 for(let n=0;!g.ended&&n<2000;n++){commands.push(step(g));if(g.lastRoll)assert.equal(g.lastRoll.dice.length,1);}
 assert.ok(g.ended);assertDiceGame(g);assert.deepEqual(replayDiceGame({version:g.version,setup,commands}).log,g.log);
 assert.deepEqual(g.prices,g.companies.map(c=>shareExitPrice(c)));assert.ok(g.log.some(e=>e.type==='bankFunding'));
 }
});
test('pair uses two separate commands; first fumble discards second die',()=>{
 const g=createDiceGame({seed:42});while(g.phase!=='flowRoll'||g.flowStage==='setup')step(g);
 const entry=g.pendingGrowth.find(e=>e.id===g.windowEntry),c=g.companies[entry.company];assert.notEqual(c.founder,11);entry.dice=['spicy','bland'];c.down=false;
 // Deterministic fixture RNG: engine's first face is ×.
 g.rng=7;diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.lastRoll.dice.length,1);
 assert.equal(g.lastRoll.dice[0].fumble,true);assert.equal(g.pendingGrowth.find(e=>e.id===entry.id).remaining,1);
 while(g.phase!=='flowRoll')step(g);const before=g.companies[c.id].position,start=g.log.length;diceCommand(g,currentPlayer(g),{type:'roll'});
 while(g.phase==='power')step(g);assert.equal(g.lastRoll.ordinal,2);assert.ok(g.log.slice(start).some(e=>e.type==='deferred'&&e.card.company===c.id));assert.equal(g.companies[c.id].down,false);assert.equal(g.companies[c.id].position,before);
});
