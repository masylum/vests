import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,currentPlayer,command,observation,assertGame,replayGame,canDrawEmptyHand} from '../src/engine.js';
import {resolveRevealPhase} from '../src/racing.js';
import {botCommand,exchangePlan,cardScenario} from '../src/bots.js';
import {VERSION} from '../src/config.js';
function founder(g,cid,id){const c=g.companies[cid],old=c.founder,other=g.companies.find(x=>x.founder===id);if(other)other.founder=old;else{const pool=[g.founderMarket,g.founderSupply].find(x=>x.includes(id));pool[pool.indexOf(id)]=old;}c.founder=id;}
function give(g,id,kind){const hand=g.players[id].intel;if(!hand.some(c=>c.kind===kind)){const zone=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)].find(z=>z.some(c=>c.kind===kind)),i=zone.findIndex(c=>c.kind===kind);[zone[i],hand[0]]=[hand[0],zone[i]];}return hand.findIndex(c=>c.kind===kind);}
test('Harry can respond to Matt before reveal and helps only once that round',()=>{
 const g=createGame({players:2,seed:10});founder(g,0,1);founder(g,1,9);
 g.companies.forEach((c,i)=>{c.position=i?12:1;c.tokens=[{owner:0}];});
 resolveRevealPhase(g,'start',true);
 assert.equal(g.powerChoice.founder,1);const before=g.companies[1].supply.length;
 command(g,currentPlayer(g),{type:'power',choice:1});
 assert.equal(g.companies[0].down,true);assert.equal(g.powerChoice.founder,9);
 command(g,currentPlayer(g),{type:'power',choice:1});
 assert.equal(g.companies[0].down,false);assert.equal(g.companies[1].supply.length,before-2);assert.ok(g.harryUsed.includes(1));
});
test('empty-hand draw spends exactly one action, recycles discards, and is rejected for a nonempty hand',()=>{
 const g=createGame({players:2,seed:19}),id=currentPlayer(g);g.intelDiscard.push(...g.players[id].intel.splice(0));
 g.intelDiscard.push(...g.intelDeck.splice(0));assert.ok(canDrawEmptyHand(g,id));
 const left=g.actionsLeft,n=g.intelDiscard.length;command(g,id,{type:'drawValue'});
 assert.equal(g.players[id].intel.length,1);assert.equal(g.actionsLeft,left-1);assert.equal(g.intelDeck.length,n-1);assertGame(g);
 const before=JSON.stringify(g);assert.throws(()=>command(g,id,{type:'drawValue'}),/only when your hand is empty/);assert.equal(JSON.stringify(g),before);
});
test('bot with an empty hand and capital six draws instead of liquidating its final share',()=>{
 const g=createGame({players:2,seed:19}),id=currentPlayer(g);g.intelDiscard.push(...g.players[id].intel.splice(0));g.players[id].capital=6;g.companies[0].tokens=[{owner:id}];
 assert.deepEqual(botCommand(g,id,{samples:4}),{type:'drawValue'});
});
test('Underwritten Round is exchanged when nobody can bid and it has no founder reaction',()=>{
 const g=createGame({players:2,seed:19}),id=currentPlayer(g),card=give(g,id,'underwritten');founder(g,0,13);g.companies[0].tokens=[{owner:id}];g.players.forEach(p=>p.cash=0);
 const v=observation(g,id);v.phase='intelPlay';v.players[id].intel=[v.players[id].intel[card]];
 assert.equal(botCommand(v,id,{samples:4}).type,'exchangeValue');
});
test('Board Mandate pays two in the projected portfolio and is not a free endgame bonus',()=>{
 const g=createGame({players:2,seed:19}),id=currentPlayer(g),card=give(g,id,'mandate');founder(g,0,13);const c=g.companies[0];c.tokens=[{owner:id},{owner:1-id},{owner:1-id}];c.position=24;
 const v=observation(g,id);v.phase='intelPlay';v.players[id].intel=[v.players[id].intel[card]];
 v.companies.forEach(c=>c.supplyCount=0);v.poolWeights=v.poolWeights.map(()=>0);v.pileCount=0;
 const s=cardScenario(v,id,'mandate',0);assert.equal(s.players[id].cash,v.players[id].cash-2);assert.equal(s.companies[0].mandate,id);
 assert.equal(botCommand(v,id,{samples:4}).type,'exchangeValue');
});
test('discard planning values replacing an unusable card without treating it as productive play',()=>{
 const g=createGame({players:2,seed:19}),id=currentPlayer(g);const v=observation(g,id);v.players[id].intel=[{id:0,kind:'underwritten'}];
 const plan=exchangePlan(v,id);assert.equal(plan.card,0);assert.ok(plan.value>=0&&plan.value<.1);
});
test('normal command replay remains deterministic with new action support',()=>{
 const setup={players:2,seed:19},g=createGame(setup),commands=[];
 for(let i=0;i<30&&!g.ended;i++){const id=currentPlayer(g),cmd=botCommand(g,id,{samples:2});command(g,id,cmd);commands.push({id,cmd});assertGame(g);}
 assert.deepEqual(replayGame({version:VERSION,setup,commands}),g);
});
