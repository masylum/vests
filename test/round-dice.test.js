import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame} from '../archive/versions/v132/live-dice-engine.js';
import {diceBot,diceEvaluations} from '../archive/versions/v132/live-dice-bots.js';
import {simulateLiveDice} from '../scripts/v132-simulate.js';
import {grantGrowth} from '../archive/versions/v132/deal-flow.js';
import {resolveRevealPhase} from '../archive/versions/v132/racing.js';
import {random} from '../archive/versions/v132/engine.js';
const step=g=>{const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));};
function opening(){const g=createDiceGame({seed:42});while(!g.round)step(g);g.companies.forEach(c=>c.position=1);g.crossedLegs=[];return g;}
function assign(g,cid,f){const old=g.companies[cid].founder,c=g.companies.find(c=>c.founder===f);if(c)c.founder=old;else {const pool=g.founderMarket.includes(f)?g.founderMarket:g.founderSupply;pool[pool.indexOf(f)]=old;}g.companies[cid].founder=f;}
function rollFixture(dice,faces){const g=opening();assign(g,0,7);g.companies.forEach(c=>{c.position=c.id===0?4:1;c.down=c.id!==0;});const e=grantGrowth(g,currentPlayer(g),0);e.dice=dice;g.windowEntry=e.id;g.rollActor=e.player;g.flowActor=e.player;g.flowStage='purchaseDice';g.phase='flowRoll';
 for(let seed=0;seed<10000;seed++){const r={rng:seed};if(faces.every(f=>Math.floor(random(r)*6)===f)){g.rng=seed;break;}}
 return g;
}
test('five cards initially; a round is exactly one action per investor, then draw three and keep all',()=>{
 const g=opening(),markets=[...g.founderMarket],values=g.valueMarket.map(c=>c.id),first=currentPlayer(g);assert.ok(g.players.every(p=>p.dealFlow.length===5));
 for(let n=0;n<4;n++){assert.equal(currentPlayer(g),(first+n)%4);diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});assert.equal(g.round,n===3?2:1);}
 assert.deepEqual(g.players.map(p=>p.dealFlow.length),[7,7,7,7]);assert.deepEqual(g.founderMarket,markets);assert.deepEqual(g.valueMarket.map(c=>c.id),values);assert.equal(g.turnNumber,4);assert.deepEqual(g.roundActed,[]);
});
test('three current positions required for a leg, and leg refresh does not reset a round or deal',()=>{
 const g=opening();g.companies[0].position=9;g.companies[1].position=8;g.crossedLegs=[0];diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});assert.equal(g.leg,0);assert.equal(g.phase,'flowAction');
 g.companies[2].position=8;g.danUsed=[0];diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});assert.equal(g.phase,'roundResult');
 const hands=g.players.map(p=>p.dealFlow.length),market=[...g.founderMarket];diceCommand(g,currentPlayer(g),{type:'continue'});
 assert.equal(g.leg,1);assert.equal(g.round,1);assert.equal(g.roundActed.length,2);assert.deepEqual(g.danUsed,[0]);assert.deepEqual(g.players.map(p=>p.dealFlow.length),hands);assert.ok(g.founderMarket.every(f=>!market.includes(f)));
});
test('numbered dice are one movement; Liza adds once, not once per die',()=>{
 const g=rollFixture(['safe','safe'],[0,0]);assign(g,0,8);g.companies[1].position=15;diceCommand(g,currentPlayer(g),{type:'roll'});
 assert.equal(g.companies[0].position,7);assert.equal(g.lastRoll.printed,2);assert.equal(g.lastRoll.dice.length,2);assert.equal(g.pendingGrowth.at(-1).remaining,0);assert.equal(g.phase,'flowReceipt');
});
test('number plus cross moves first and then fumbles; two crosses do not recover',()=>{
 let g=rollFixture(['safe','risky'],[0,0]);diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.companies[0].position,5);assert.equal(g.companies[0].down,true);
 g=rollFixture(['risky','risky'],[0,0]);diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.companies[0].position,4);assert.equal(g.companies[0].down,true);assert.equal(g.lastRoll.fumbles,2);
});
test('Dan converts only one of two fumbles to +1',()=>{
 const g=rollFixture(['risky','risky'],[0,0]);assign(g,0,11);diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.companies[0].position,5);assert.equal(g.companies[0].down,true);assert.deepEqual(g.danUsed,[0]);
});
test('Ryan and Dan cannot repeat across purchases in one round',()=>{
 const g=opening();assign(g,0,6);assign(g,1,11);g.companies.forEach(c=>{c.down=c.id>1;c.position=c.id===0?3:c.id===1?10:1;});
 resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,4);assert.equal(g.companies[1].position,11);
 resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,4);assert.equal(g.companies[1].position,11);
 for(let n=0;n<4;n++)diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});
 resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,5);assert.equal(g.companies[1].position,12);
});
test('first company reaching 24 ends after full reveal, even while still in leg one',()=>{
 const g=rollFixture(['safe','risky'],[0,0]);g.companies[0].position=23;diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.ended,false);assert.equal(g.companies[0].down,true);
 for(let n=0;!g.ended&&n<50;n++)step(g);assert.equal(g.ended,true);assert.equal(g.leg,0);assert.equal(g.prices[0],16);
});
test('dice pair order has identical forecast utility and forecast never mutates live state',()=>{
 const g=opening(),before=structuredClone(g),v=diceEvaluations(diceObservation(g,0),0,0);assert.deepEqual(g,before);
 for(const a of v)assert.ok(Math.abs(a.score-v.find(b=>b.dice.join(',')===[...a.dice].reverse().join(',')).score)<1e-8);
});
test('2–4 player games finish and replay with no duplicate turns or unresolved growth',()=>{
 for(const players of [2,3,4])for(const seed of [1,2,3]){const g=simulateLiveDice({seed,players,trace:true});assert.ok(g.ended);assert.ok(g.pendingGrowth.every(e=>e.resolved));assert.deepEqual(replayDiceGame(g.replay).scores,g.scores);const actions=g.log.filter(e=>e.type==='action');assert.equal(new Set(actions.map(e=>e.round+':'+e.player)).size,actions.length);}
});
