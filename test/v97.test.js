import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,observation,resolveCardBase,resolveCard} from '../src/engine.js';
import {RULES} from '../src/config.js';
import {resolveRevealPhase,resolveIntelActions} from '../src/racing.js';
import {forecasts,setForecastBackend,nativeForecastAvailable} from '../src/bots.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function revealFixture(players=4){
 const g=createGame({players,rules:{intelMode:'mixed'}});g.companies.forEach(c=>c.hiringFumble=true);
 for(const card of g.pile.splice(0))g.companies[card.company].supply.push(card);
 const supply=g.companies[0].supply,i=supply.findIndex(c=>!c.signature&&!c.effect&&c.printed>0);
 g.pile=[...supply.splice(i,1),...supply.splice(0,6)];g.burnEligible=g.pile.map(c=>c.id);g.phase='reveal';g.queue=[];g.active=0;g.drawsLeft=1;return g;
}
function install(g,cid,founder){const c=g.companies[cid],other=g.companies.find(x=>x.founder===founder);if(other){[c.founder,other.founder]=[other.founder,c.founder];return;}const pool=g.founderMarket.includes(founder)?g.founderMarket:g.founderSupply;pool[pool.indexOf(founder)]=c.founder;c.founder=founder;}
test('v97 supports 2 to 5 investors, with players plus 2 companies and half rounded down eligible exits',()=>{
 for(const players of [2,3,4,5]){const g=createGame({players});assert.equal(g.version,97);assert.equal(g.companies.length,players+2);assert.equal(g.rules.payoutPlaces,Math.floor((players+2)/2));assert.equal(g.rules.burnPerRound,players-1);assert(g.players.every(p=>p.cash===50&&p.obligation===55));assertGame(g);}
 assert.throws(()=>createGame({players:1}));assert.throws(()=>createGame({players:6}));assert.equal(RULES.obligation,55);
});
test('new LPs add 50 cash and 55 obligation without consuming a turn',()=>{
 const g=createGame(),id=currentPlayer(g),phase=g.phase;act(g,{type:'raiseMoney'});assert.equal(g.players[id].cash,100);assert.equal(g.players[id].obligation,110);assert.equal(g.players[id].lpObligations,2);assert.equal(g.phase,phase);assertGame(g);
});
test('a fumble recovery uses a draw, does not resolve printed effects, and draws no replacement',()=>{
 const g=revealFixture(),card=g.pile[0];g.companies[0].down=true;const before=g.pile.length;act(g,{type:'reveal'});
 assert.equal(g.drawsLeft,0);assert.equal(g.pendingRedraw,false);assert.equal(g.metrics.wasted,1);assert.equal(g.metrics.revealed,0);assert.equal(g.companies[0].down,false);assert.equal(g.companies[0].position,1);assert.equal(g.lastRevealed.type,'deferred');assert.equal(g.lastRevealed.card.id,card.id);assert.equal(g.pile.length,before-1-g.rules.burnPerRound);assertGame(g);
});
test('the after reveal prompt is skipped without an active, controlled after reveal founder',()=>{
 for(const players of [2,3,4,5]){const g=revealFixture(players);act(g,{type:'reveal'});assert.equal(g.phase,'catchUpReady');assert.equal(g.metrics.burned,players-1);assert(!g.race);assertGame(g);}
});
test('Gill retains his after reveal choice; inactive or unowned Gill does not add a step',()=>{
 for(const active of [false,true]){const g=revealFixture();install(g,1,3);const c=g.companies[1];c.hiringFumble=false;c.tokens=active?[{id:1,owner:0,paid:0}]:[];c.lastBuy[0]=1;act(g,{type:'reveal'});assert.equal(g.phase,active?'afterRevealReady':'catchUpReady');if(active){act(g,{type:'continue'});assert.equal(g.phase,'power');assert.equal(g.powerChoice.founder,3);}assertGame(g);}
});
test('two-player Rust forecasts match JavaScript on the new draw and exit rules',{skip:!nativeForecastAvailable},()=>{
 try{for(const seed of [9710,9711,9712]){const g=createGame({seed,players:2,rules:{intelMode:'mixed'}}),v=observation(g,0);setForecastBackend('js');const expected=forecasts(v,0,{samples:4});setForecastBackend('native');assert.deepEqual(forecasts(v,0,{samples:4}),expected);}}finally{setForecastBackend('auto');}
});
test('final settlement pays only the top half of the companies in two and three player games',()=>{
 for(const players of [2,3]){
  const g=createGame({players});g.companies.forEach((c,i)=>{c.position=24-i*2;c.hiringFumble=true;c.tokens=[{id:1,owner:0,paid:0}];});
  g.phase='cycleResult';g.cycleEnd='ipo';g.ipoCompany=0;g.active=g.first;g.queue=[];act(g,{type:'continue'});
  assert.equal(g.settlement.final,true);assert.equal(g.settlement.podium.length,2);assert(g.settlement.prices.slice(0,2).every(p=>p>0));assert(g.settlement.prices.slice(2).every(p=>p===0));assertGame(g);
 }
});

test('IPO is checked after the full round, using the final position and fumble state',()=>{
 for(const ending of ['up','fumbled','back','recovered']){
  const g=createGame();g.leg=2;g.companies.forEach(c=>{c.hiringFumble=true;c.position=10;});g.companies[0].position=23;
  resolveIntelActions(g,[{kind:'move',company:0,amount:1}],null,{interactive:false});
  assert.equal(g.companies[0].position,24);assert.equal(g.ipoCompany??null,null);assert(!g.settlement);
  if(ending==='fumbled'||ending==='recovered')resolveIntelActions(g,[{kind:'fumble',company:0}],null,{interactive:false});
  if(ending==='back')resolveIntelActions(g,[{kind:'move',company:0,amount:-1}],null,{interactive:false});
  if(ending==='recovered')resolveCard(g,growthCard(g,0));
  g.phase='catchUpResult';g.queue=[];g.active=g.first;act(g,{type:'continue'});
  const qualifies=['up','recovered'].includes(ending);assert.equal(g.cycleEnd,qualifies?'ipo':null);assert.equal(g.ipoCompany,qualifies?0:null);
  act(g,{type:'continue'});assert.equal(g.phase,qualifies?'settle':'call');assertGame(g);
 }
});
function growthCard(g,cid){const c=g.companies[cid],i=c.supply.findIndex(x=>!x.signature&&!x.effect);return c.supply.splice(i,1)[0];}
test('catch-up can reach IPO, with confirmation only after its reactions finish',()=>{
 const g=createGame();g.companies.forEach(c=>{c.hiringFumble=true;c.position=23;});g.phase='catchUpReady';g.queue=[];g.active=g.first;
 act(g,{type:'continue'});assert.equal(g.phase,'catchUpResult');assert(g.companies.every(c=>c.position===24));assert.equal(g.ipoCompany??null,null);
 act(g,{type:'continue'});assert.equal(g.cycleEnd,'ipo');act(g,{type:'continue'});assert.equal(g.phase,'settle');assertGame(g);
});
test('Rust and JavaScript agree on IPO forecasts near the finish, including fumbled finishers',{skip:!nativeForecastAvailable},()=>{
 try{for(const players of [2,4])for(const down of [false,true]){
  const g=createGame({players,seed:9732});g.leg=2;g.companies.forEach((c,i)=>{c.position=i?22:24;c.down=down&&i===0;c.hiringFumble=true;});
  const v=observation(g,0);setForecastBackend('js');const expected=forecasts(v,0,{samples:8});setForecastBackend('native');assert.deepEqual(forecasts(v,0,{samples:8}),expected);
 }}finally{setForecastBackend('auto');}
});
