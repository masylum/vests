import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {DICE,rollDie,DEAL_COPIES} from '../archive/versions/v136/live-dice-rules.js';
import {createDiceGame,diceCommand,diceObservation,currentPlayer} from '../archive/versions/v136/live-dice-engine.js';
import {diceBot,diceEvaluations,auctionBudget} from '../archive/versions/v136/live-dice-bots.js';
import {createDiceGame as oldCreate,diceCommand as oldCommand} from '../archive/versions/v135/live-dice-engine.js';
import {random} from '../archive/versions/v136/engine.js';
import {grantGrowth} from '../archive/versions/v136/deal-flow.js';
const step=g=>{const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));};
function opening(){const g=createDiceGame({seed:42});while(!g.round)step(g);return g;}
test('new dice distributions preserve zero versus fumble',()=>{
 assert.equal(DEAL_COPIES,9);assert.deepEqual(DICE.bland,[0,1,1,1,2,2]);
 assert.equal(rollDie(()=>0,'bland').fumble,false);assert.equal(rollDie(()=>0,'mild').fumble,true);assert.equal(rollDie(()=>1/6,'mild').fumble,false);
 assert.equal(DICE.spicy.filter(x=>x==='x').length,2);
});
test('zero-zero purchase resolves without fumble and does not stall',()=>{
 const g=opening();for(const c of g.companies){c.down=false;c.hiringFumble=false;}
 const cid=g.companies.find(c=>![8,24,25].includes(c.founder)).id,e=grantGrowth(g,currentPlayer(g),cid);e.dice=['bland','bland'];
 g.windowEntry=e.id;g.rollActor=e.player;g.flowActor=e.player;g.flowStage='purchaseDice';g.phase='flowRoll';
 // Find a deterministic RNG state with two zero faces.
 for(let seed=0;seed<10000;seed++){const r={rng:seed};if(random(r)<1/6&&random(r)<1/6){g.rng=seed;break;}}
 diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.lastRoll.printed,0);assert.equal(g.lastRoll.fumbles,0);assert.equal(g.phase,'flowReceipt');assert.equal(g.companies[cid].down,false);
});
test('spending a private card does not immediately replace it',()=>{
 const g=opening(),id=currentPlayer(g),n=g.players[id].dealFlow.length,deck=g.dealDeck.length;
 diceCommand(g,id,{type:'raiseMoney',deal:0});assert.equal(g.players[id].dealFlow.length,n-1);assert.equal(g.dealDeck.length,deck);
});
test('bot no longer offers the opponent a winning terminal purchase from sample 8207',()=>{
 const replay=JSON.parse(fs.readFileSync(new URL('../docs/dice-activation-v135/timing-01/samples/8207-replay.json',import.meta.url)));const g=oldCreate(replay.setup);
 for(const c of replay.commands.slice(0,100))oldCommand(g,c.id,c.cmd);
 const view=diceObservation(g,0),before=structuredClone(view),cmd=diceBot(view,0);
 assert.notDeepEqual(cmd,{type:'call',deal:18,company:1});assert.ok(cmd.type!=='call'||cmd.company!==1);assert.deepEqual(view,before);
});
test('auction budget never buys a terminal share that leaves the buyer losing when abstaining is better',()=>{
 const g=opening();for(const c of g.companies){c.position=1;c.down=false;c.hiringFumble=false;}g.companies[0].position=23;
 g.companies[0].tokens=Array.from({length:8},()=>({owner:1}));g.players[0].cash=20;g.players[1].cash=20;
 assert.equal(auctionBudget(diceObservation(g,0),0,0),0);
});
test('forecast distinguishes zero, is deterministic, and does not modify observations',()=>{
 const g=opening(),view=diceObservation(g,0),before=structuredClone(view),a=diceEvaluations(view,0,0);
 assert.equal(a.length,9);assert.ok(a.every(x=>Number.isFinite(x.score)));assert.deepEqual(a,diceEvaluations(view,0,0));assert.deepEqual(view,before);
});
test('round boundaries never draw; a leg boundary draws three and keeps the hand',()=>{
 const g=opening();for(const c of g.companies)c.position=1;const deck=g.dealDeck.length;
 for(let n=0;n<4;n++)diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});
 assert.equal(g.round,2);assert.equal(g.dealDeck.length,deck);assert.deepEqual(g.players.map(p=>p.dealFlow.length),[4,4,4,4]);
 g.companies.slice(0,3).forEach(c=>c.position=8);diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});assert.equal(g.phase,'roundResult');
 const hand=g.players.map(p=>p.dealFlow.length);diceCommand(g,currentPlayer(g),{type:'continue'});
 assert.deepEqual(g.players.map(p=>p.dealFlow.length),hand.map(n=>n+3));assert.equal(g.dealDeck.length,deck-12);assert.equal(g.round,2);
});
test('empty hands before a leg stall explicitly instead of secretly replenishing',()=>{
 const g=opening();for(const c of g.companies)c.position=1;
 for(let n=0;n<20;n++)diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});
 assert.equal(g.stalled,true);assert.equal(g.phase,'flowStalled');assert.equal(g.dealDeck.length,34);assert.equal(g.ended,false);
});
test('cached funding outcomes agree with the original price-specific resolver',async()=>{
 const {fundingForecast:old}=await import('../docs/dice-mild-v136/run-01/source/src/live-dice-bots.js');
 const {fundingForecast:current}=await import('../archive/versions/v136/live-dice-bots.js');const g=opening(),view=diceObservation(g,0),before=structuredClone(view);
 for(const company of [0,1,2,3,4,5])for(const buyer of [0,1])for(const price of [0,7])assert.ok(Math.abs(current(view,0,company,{buyer,price})-old(view,0,company,{buyer,price}))<1e-9);
 assert.deepEqual(view,before);
});
