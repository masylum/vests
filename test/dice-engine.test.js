import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,holdings,shareLeader,replayDiceGame,valueChoices,exitPrice} from '../archive/legacy-dice/dice-engine.js';
import {diceBot} from '../archive/legacy-dice/dice-bots.js';
import {simulateDice} from '../scripts/dice-simulate.js';
const step=g=>{const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));};
const actionRound=g=>{for(let i=0;g.phase!=='flowAction'&&i<100;i++)step(g);assert.equal(g.phase,'flowAction');};

test('six companies and exactly two starting shares/dice for every player count',()=>{
 for(const players of [2,3,4]){const g=createDiceGame({players});assert.equal(g.companies.length,6);assert.equal(g.pendingGrowth.length,players*2);for(const p of g.players){assert.equal(g.companies.reduce((n,c)=>n+holdings(c,p.id),0),2);assert.equal(p.cash,20);assert.equal(p.intel.length,3);}actionRound(g);assert.equal(g.metrics.rolls,players*2);assert.equal(g.round,1);assert.equal(g.players.flatMap(p=>p.dealFlow).length,players*6);}
});

test('wrong actor and wrong card reject atomically',()=>{
 const g=createDiceGame();actionRound(g);const id=currentPlayer(g),before=structuredClone(g);
 assert.throws(()=>diceCommand(g,(id+1)%4,{type:'raiseMoney',deal:0}));assert.deepEqual(g,before);
 assert.throws(()=>diceCommand(g,id,{type:'call',deal:0,company:(g.players[id].dealFlow[0].company+1)%6}));assert.deepEqual(g,before);
});

test('funding needs no lead, grants one die for any price, latest investor leads',()=>{
 const g=createDiceGame();actionRound(g);const host=currentPlayer(g),company=g.players[host].dealFlow[0].company,c=g.companies[company];
 const winner=(host+1)%4;c.tokens.push({id:c.tokens.length+1,owner:host,paid:0});c.tokens.push({id:c.tokens.length+1,owner:host,paid:0});c.lastBuy[host]=++g.serial;
 const owned=c.tokens.length,rolls=g.pendingGrowth.length;
 diceCommand(g,host,{type:'call',company,deal:0});
 while(g.phase==='bid')diceCommand(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===winner?19:0});
 assert.equal(g.auction.paid,19);assert.equal(g.pendingGrowth.length,rolls+1);assert.equal(g.companies[company].tokens.length,owned+1);assert.equal(shareLeader(g.companies[company]),winner);assert.equal(g.players[winner].actionsTaken,0);assert.equal(g.players[winner].dealFlow.length,6);
});

test('separate private hands and sealed bids never expose another player cards or amount',()=>{
 const g=createDiceGame();actionRound(g);const id=currentPlayer(g);diceCommand(g,id,{type:'call',company:g.players[id].dealFlow[0].company,deal:0});diceCommand(g,currentPlayer(g),{type:'bid',amount:7});
 const other=currentPlayer(g),view=diceObservation(g,other);
 assert.equal(view.rng,undefined);assert.equal(view.seed,undefined);assert.equal(view.intelDeck,undefined);
 for(const p of view.players)if(p.id!==other){assert.equal(p.dealFlow,undefined);assert.equal(p.intel,undefined);}
 assert.equal(view.auction.bids[0].amount,undefined);
});

test('four rounds always finish and accounting/replay agree for all player counts',()=>{
 for(const players of [2,3,4]){
  const g=simulateDice({seed:101+players,players,trace:true});assert.equal(g.round,4);assert.equal(g.metrics.actions,players*20);assert.deepEqual(replayDiceGame(g.replay).scores,g.scores);
  assert.equal(g.metrics.rolls,g.companies.reduce((n,c)=>n+c.tokens.length,0)+players*4);
  for(const p of g.players)assert.equal(g.scores[p.id],p.cash+g.companies.reduce((n,c)=>n+holdings(c,p.id)*exitPrice(c.position),0)-p.capitalCalled);
 }
});

test('unlimited capital remains a liability; no automatic income; centre cards are selected',()=>{
 const g=createDiceGame();actionRound(g);const kept=g.players.map(p=>p.dealFlow[5].company);
 for(let turn=0;turn<20;turn++){const id=currentPlayer(g);diceCommand(g,id,{type:'raiseMoney',deal:0});}
 assert.deepEqual(g.centre.map(c=>c.company),g.players.map((_,i)=>kept[(g.first+i)%4]));
 assert.equal(g.metrics.actions,20);assert.equal(g.players[0].cash,70);assert.equal(g.players[0].capitalCalled,50);
 for(let i=0;g.round<2&&i<100;i++)step(g);
 for(let turn=0;turn<20;turn++){const id=currentPlayer(g);diceCommand(g,id,{type:'raiseMoney',deal:0});}
 assert.equal(g.players[0].capitalCalled,100);
});

test('no incompatible values or founders enter setup, replacement or market',()=>{
 const g=simulateDice({seed:62,trace:true});
 assert.ok(!g.log.some(e=>e.type==='deploy'));
 assert.equal(g.pile.length,0);assert.ok(g.players.every(p=>p.actionsTaken===5));
});

test('specification example: ten funded shares per round yields 48 shares and 64 dice',()=>{
 const g=createDiceGame({seed:51});let guard=0;
 while(!g.ended&&guard++<2000){
  const id=currentPlayer(g);let cmd;
  if(g.phase==='flowAction')cmd=g.players.reduce((n,p)=>n+p.actionsTaken,0)<10?{type:'call',company:g.players[id].dealFlow[0].company,deal:0}:{type:'raiseMoney',deal:0};
  else if(g.phase==='bid')cmd={type:'bid',amount:id===g.auction.host?1:0};
  else if(g.phase==='power')cmd={type:'power',choice:0};
  else cmd=diceBot(diceObservation(g,id),id);
  diceCommand(g,id,cmd);
 }
 assert.ok(g.ended);assert.equal(g.metrics.actions,80);assert.equal(g.metrics.rolls,64);assert.equal(g.companies.reduce((n,c)=>n+c.tokens.length,0),48);
});

test('hidden randomness and opponent hands cannot influence bot decisions',()=>{
 const g=createDiceGame({seed:92});actionRound(g);const id=currentPlayer(g),before=diceObservation(g,id),cmd=diceBot(before,id);
 g.rng^=0xabc;for(const p of g.players)if(p.id!==id){p.intel.reverse();p.dealFlow.reverse();}g.intelDeck.reverse();
 assert.deepEqual(diceObservation(g,id),before);assert.deepEqual(diceBot(diceObservation(g,id),id),cmd);
});

test('two-dice shares finish consecutively, keep ownership, and preserve one-die setup/centre',()=>{
 const g=createDiceGame({seed:43,players:4,dicePerShare:2,actionsPerRound:3,payoutStep:3});
 actionRound(g);assert.equal(g.metrics.rolls,8);assert.ok(g.players.every(p=>p.dealFlow.length===4));
 let doubled=0;
 for(let n=0;!g.ended&&n<3000;n++){
  if(g.phase==='flowRoll'){
   const id=currentPlayer(g),cmd=diceBot(diceObservation(g,id),id),entry=g.pendingGrowth.find(e=>e.id===cmd.entitlement),shares=g.companies[entry.company].tokens.length,before=entry.remaining;
   diceCommand(g,id,cmd);
   assert.equal(g.companies[entry.company].tokens.length,shares);
   if(before===2){doubled++;assert.equal(g.pendingGrowth.find(e=>e.id===entry.id).resolved,false);
    while(g.phase!=='flowRoll')step(g);
    assert.equal(currentPlayer(g),id);const different=g.pendingGrowth.find(e=>!e.resolved&&e.player===id&&e.id!==entry.id);
    if(different){const snapshot=structuredClone(g);assert.throws(()=>diceCommand(g,id,{type:'roll',entitlement:different.id}),/both dice/);assert.deepEqual(g,snapshot);}
    assert.equal(diceBot(diceObservation(g,id),id).entitlement,entry.id);
   }
  }else step(g);
 }
 assert.ok(g.ended&&doubled>0);assert.equal(g.metrics.actions,48);
 assert.equal(g.log.filter(e=>e.type==='die'&&e.source==='setup').length,8);
 assert.equal(g.log.filter(e=>e.type==='die'&&e.source==='centre').length,16);
 assert.equal(g.log.filter(e=>e.type==='die'&&e.source==='share').length,2*doubled);
 assert.deepEqual(g.prices,g.companies.map(c=>exitPrice(c.position,3)));
});

test('all shorter-game player counts complete and replay with experimental settings',()=>{
 for(const players of [2,3,4]){const g=simulateDice({seed:102,players,payoutStep:2,dicePerShare:2,actionsPerRound:3,trace:true});assert.equal(g.metrics.actions,players*12);assert.equal(g.round,4);assert.deepEqual(replayDiceGame(g.replay).scores,g.scores);}
 for(const options of [{dicePerShare:3},{actionsPerRound:4},{payoutStep:0}])assert.throws(()=>createDiceGame(options));
});
