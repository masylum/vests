import test from 'node:test';
import assert from 'node:assert/strict';
import {DICE,rollDie,validateDice,exitPrice} from '../archive/versions/v131/live-dice-rules.js';
test('three dice retain exact faces and identify both risky fumbles',()=>{
 for(const kind of Object.keys(DICE))for(let i=0;i<6;i++){
  const result=rollDie(()=>(i+.5)/6,kind);assert.equal(result.printed,DICE[kind][i]);assert.equal(result.fumble,DICE[kind][i]===0);
 }
 assert.deepEqual(validateDice(['risky','safe']),['risky','safe']);
 for(const dice of [[],['safe'],['safe','invalid'],['safe','safe','safe']])assert.throws(()=>validateDice(dice));
});
test('progressive exits penalize laggards and keep the doubled ceiling',()=>{
 for(let p=0;p<=10;p++)assert.equal(exitPrice(p),0);
 assert.equal(exitPrice(11),1);assert.equal(exitPrice(16),4);assert.equal(exitPrice(24),16);
 for(let p=1;p<=24;p++)assert.ok(exitPrice(p)>=exitPrice(p-1));
});

import {createDiceGame,diceCommand,diceObservation,currentPlayer,valueChoices,replayDiceGame} from '../archive/versions/v131/live-dice-engine.js';
import {diceBot} from '../archive/versions/v131/live-dice-bots.js';
import {simulateLiveDice} from '../scripts/v131-simulate.js';
import {recordArrivals} from '../archive/versions/v131/movement.js';
function opening(seed=42){const g=createDiceGame({seed});for(let n=0;g.round===0&&n<200;n++){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));}return g;}
test('eight private deal-flow cards, four public cards each, hidden opponent hands',()=>{
 const g=opening();assert.ok(g.players.every(p=>p.dealFlow.length===8&&p.intel.length===0));assert.equal(g.founderMarket.length,4);assert.equal(g.valueMarket.length,4);
 const v=diceObservation(g,0);assert.equal(v.players[1].dealFlow,undefined);assert.equal(v.players[1].dealFlowCount,8);assert.equal(v.intelDeck,undefined);
});
test('crossings are latched even after a reverse move',()=>{
 const g=opening();recordArrivals(g,[{company:0,before:7,after:9}]);recordArrivals(g,[{company:0,before:9,after:6}]);assert.ok(g.crossedLegs.includes(0));
});
test('invalid action is atomic and matching card required',()=>{
 const g=opening(),id=currentPlayer(g),snapshot=structuredClone(g);
 assert.throws(()=>diceCommand(g,id,{type:'call',deal:0,company:(g.players[id].dealFlow[0].company+1)%6}));assert.deepEqual(g,snapshot);
});
test('new leg retains all cards, draws three, refreshes both markets',()=>{
 const g=opening();g.crossedLegs.push(g.leg);const id=currentPlayer(g);
 diceCommand(g,id,{type:'raiseMoney',deal:0});assert.equal(g.phase,'roundResult');
 const oldHands=g.players.map(p=>p.dealFlow.map(c=>c.id)),founders=[...g.founderMarket],values=g.valueMarket.map(c=>c.id);
 diceCommand(g,currentPlayer(g),{type:'continue'});
 g.players.forEach((p,i)=>{assert.equal(p.dealFlow.length,oldHands[i].length+3);assert.deepEqual(p.dealFlow.slice(0,-3).map(c=>c.id),oldHands[i]);});
 assert.ok(g.founderMarket.every(f=>!founders.includes(f)));assert.ok(g.valueMarket.every(c=>!values.includes(c.id)));
});
test('public value play refills its slot without a private hand',()=>{
 const g=opening(),id=currentPlayer(g);diceCommand(g,id,{type:'valueAction',deal:0});const choice=valueChoices(g,id).find(c=>!['rights','public','tender'].includes(g.valueMarket[c.card].kind));
 assert.ok(choice);const old=g.valueMarket[choice.card].id;diceCommand(g,id,choice);assert.equal(g.valueMarket.length,4);assert.notEqual(g.valueMarket[choice.card].id,old);assert.ok(g.players.every(p=>!p.intel.length));
});
test('full purchase resolves two dice before final settlement; replay deterministic',()=>{
 const g=simulateLiveDice({seed:42,players:4,trace:true});assert.equal(g.ended,true);assert.ok(g.pendingGrowth.every(e=>e.resolved));assert.ok(g.crossedLegs.includes(2));
 const purchase=g.log.filter(e=>e.type==='dice'&&e.source!=='setup');
 assert.equal(g.metrics.rolls,8+2*g.pendingGrowth.filter(e=>e.source!=='setup').length);
 assert.deepEqual(replayDiceGame(g.replay).scores,g.scores);
 assert.equal(g.prices[0],exitPrice(g.companies[0].position));
});
test('all supported counts run deterministically with accounted stalls',()=>{
 for(const players of [2,3,4])for(const seed of [1,2,3]){const g=simulateLiveDice({seed,players,trace:true});assert.ok(g.ended||g.stalled);assert.ok(!g.censored);}
});
test('crossing 24 on die one cannot cancel die two or settle early',()=>{
 const g=opening();for(let n=0;g.phase!=='chooseDice'&&n<100;n++){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));}
 assert.equal(g.phase,'chooseDice');const entry=g.pendingGrowth.find(e=>!e.resolved),cid=entry.company;
 g.companies.forEach(c=>{c.position=c.id===cid?23:1;c.down=false;});g.round=3;g.leg=2;g.crossedLegs=[0,1];
 diceCommand(g,currentPlayer(g),{type:'chooseDice',dice:['safe','safe']});
 for(let n=0;g.phase!=='flowRoll'&&n<50;n++){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));}
 diceCommand(g,currentPlayer(g),{type:'roll'});assert.ok(g.crossedLegs.includes(2));assert.equal(g.ended,false);assert.equal(g.pendingGrowth.find(e=>e.id===entry.id).remaining,1);
 diceCommand(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'flowRoll');diceCommand(g,currentPlayer(g),{type:'roll'});assert.equal(g.ended,false);
 for(let n=0;!g.ended&&n<50;n++){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));}
 assert.equal(g.ended,true);assert.equal(g.pendingGrowth.find(e=>e.id===entry.id).remaining,0);
});
test('public founder hire refills the fourth slot and conserves founders',()=>{
 const g=opening(),id=currentPlayer(g),company=g.companies.find(c=>c.tokens.some(t=>t.owner===id)&&c.lastBuy[id]===Math.max(...c.lastBuy));assert.ok(company);
 const chosen=g.founderMarket[3];diceCommand(g,id,{type:'changeFounder',deal:0,company:company.id});diceCommand(g,id,{type:'founder',choice:3});
 assert.equal(g.companies[company.id].founder,chosen);assert.equal(g.founderMarket.length,4);assert.notEqual(g.founderMarket[3],chosen);
});
