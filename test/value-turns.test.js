import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,observation,assertGame,clone,replayGame} from '../src/engine.js';
import {botCommand} from '../src/bots.js';
const make=players=>createGame({seed:42,players,rules:{intelMode:'mixed'}});
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function hand(g,id,kinds){for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));for(const kind of kinds){const i=g.intelDeck.findIndex(c=>c.kind===kind);g.players[id].intel.push(...g.intelDeck.splice(i,1));}}
function nextRound(g){for(let n=0;n<300&&g.metrics.cycles===1;n++){
 const cmd=g.phase==='call'?{type:'call',company:null}:g.phase==='intelPlay'?{type:'drawValue'}:botCommand(g,currentPlayer(g),{samples:1});act(g,cmd);assertGame(g);
 }assert.equal(g.metrics.cycles,2);}
test('3–5 players start with one private card and exactly 3 public founders',()=>{
 for(const n of [3,4,5]){const g=make(n);assert.equal(g.founderMarket.length,3);assert(!g.intelMarket);assert(g.players.every(p=>p.intel.length===1));
 for(const p of g.players){const v=observation(g,p.id);assert.deepEqual(v.players[p.id].intel,g.players[p.id].intel);assert(!v.intelDeck);assert(v.players.filter(x=>x.id!==p.id).every(p=>!p.intel&&p.intelCount===1));}assertGame(g);}
});
test('one value action follows the main action; draws cannot be played immediately',()=>{
 const g=make(4),id=currentPlayer(g),cash=g.players[id].cash;let before=clone(g);assert.throws(()=>act(g,{type:'drawValue'}));assert.deepEqual(g,before);
 act(g,{type:'call',company:0});while(g.phase==='bid')act(g,{type:'bid',amount:0});act(g,{type:'continue'});assert.equal(g.phase,'intelPlay');assert.equal(currentPlayer(g),id);
 act(g,{type:'drawValue'});assert.equal(g.phase,'call');assert.notEqual(currentPlayer(g),id);assert.equal(g.players[id].intel.length,2);assert.equal(g.players[id].cash,cash);
 before=clone(g);assert.throws(()=>act(g,{type:'playIntel',card:0,company:0}));assert.deepEqual(g,before);assertGame(g);
});
test('play resolves after the main action and does not draw a replacement',()=>{
 const g=make(4),id=currentPlayer(g),c=g.companies[0];hand(g,id,['bridge']);c.tokens=[{id:1,owner:id,paid:0,boughtLeg:0}];c.lastBuy[id]=1;c.reserve=0;g.companies.forEach(c=>c.down=true);
 act(g,{type:'call',company:null});act(g,{type:'playIntel',card:0,company:0});assert.equal(c.reserve,1);assert.equal(g.players[id].intel.length,0);assert.equal(g.phase,'valueResult');assert.equal(currentPlayer(g),id);
 act(g,{type:'continue'});assert.equal(g.phase,'call');assert.notEqual(currentPlayer(g),id);assertGame(g);
});
test('hands carry between rounds up to the hand limit, and first player rotates normally',()=>{
 const g=make(4),first=g.first,initial=g.players.map(p=>p.intel[0].id);nextRound(g);
 assert.equal(g.first,(first+1)%4);assert(!g.nextFirst);assert.deepEqual(g.valueUsed,[]);assert(g.players.every((p,i)=>p.intel.length===2&&p.intel.some(c=>c.id===initial[i])));assertGame(g);
});
test('hiring from the three-founder market immediately exposes a new replacement',()=>{
 const g=make(4),id=currentPlayer(g),c=g.companies[0];c.tokens=[{id:1,owner:id,paid:0,boughtLeg:0}];c.lastBuy[id]=1;const hired=g.founderMarket[1],next=g.founderSupply[0],old=c.founder;
 act(g,{type:'changeFounder',company:0});act(g,{type:'founder',choice:1});assert.equal(c.founder,hired);assert.equal(g.founderMarket.length,3);assert.equal(g.founderMarket[1],next);assert(g.founderSupply.includes(old));assert(!c.down);assert.equal(currentPlayer(g),id);assert.equal(g.phase,'intelPlay');assertGame(g);
});
test('a depleted draw deck recycles discards without duplicating cards or revealing the draw',()=>{
 const g=make(4),id=currentPlayer(g),kind=g.intelDeck[0].kind;g.intelDiscard.push(...g.intelDeck.splice(0));act(g,{type:'call',company:null});act(g,{type:'drawValue'});assert.equal(g.players[id].intel.length,2);const event=g.log.findLast(e=>e.type==='intelDraw');assert.equal(event.player,id);assert(!event.kind&&!event.card);assertGame(g);
});
test('when all cards are held and none are playable, the unavailable value action cannot deadlock the main action',()=>{
 const g=make(5),id=currentPlayer(g);act(g,{type:'call',company:null});for(const p of g.players)while(p.intel.length<3&&g.intelDeck.length)p.intel.push(...g.intelDeck.splice(0,1));const before=clone(g);assert.throws(()=>act(g,{type:'drawValue'}));assert.deepEqual(g,before);act(g,{type:'passValue'});assert.equal(g.phase,'call');assertGame(g);
 const h=make(4);assert.throws(()=>act(h,{type:'passValue'}));
});
test('private draw/play sequencing replays deterministically',()=>{
 const setup={seed:76,rules:{intelMode:'mixed'}},g=createGame(setup),commands=[];
 for(let n=0;n<200&&g.metrics.cycles===1;n++){const cmd=g.phase==='call'?{type:'call',company:null}:g.phase==='intelPlay'?{type:'drawValue'}:botCommand(g,currentPlayer(g),{samples:1}),id=currentPlayer(g);commands.push({id,cmd});command(g,id,cmd);}
 assert.deepEqual(replayGame({version:g.version,setup,commands}),g);assertGame(g);
});
