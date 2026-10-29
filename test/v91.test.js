// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,clone,observation,replayGame,canRaiseMoney,resolveCardBase} from '../docs/v96-validation/baseline-v95/engine.js';
import {resolveRevealPhase} from '../docs/v96-validation/baseline-v95/racing.js';
import {intelTargets,intelSecondTargets} from '../docs/v96-validation/baseline-v95/intel.js';import {growthDeck} from '../docs/v96-validation/baseline-v95/config.js';
import {botCommand} from '../docs/v96-validation/baseline-v95/bots.js';
function value(kind){const g=createGame({seed:123,rules:{intelMode:'mixed'}}),id=currentPlayer(g);for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));g.players[id].intel.push(...g.intelDeck.splice(g.intelDeck.findIndex(c=>c.kind===kind),1));for(const c of g.companies.slice(0,2)){c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;}command(g,id,{type:'call',company:null});return {g,id,c:g.companies[0],other:g.companies[1]};}
const play=(g,id,target)=>command(g,id,{type:'playIntel',card:0,company:0,target});
function discard(g,c,n=1,burned=false){const cards=c.supply.splice(0,n);g.removed.push(...cards.map(c=>({...c,burned})));if(!burned)c.history.push(...cards);return cards;}
test('new LPs use no action, may be taken out of turn and during sealed bids, and replay exactly',()=>{
 const g=createGame({seed:42}),first=currentPlayer(g),other=(first+1)%4,commands=[];const act=(id,cmd)=>{commands.push({id,cmd});command(g,id,cmd);assertGame(g);};
 const phase=g.phase,queue=[...g.queue];act(other,{type:'raiseMoney'});assert.equal(currentPlayer(g),first);assert.equal(g.phase,phase);assert.deepEqual(g.queue,queue);assert.equal(g.players[other].cash,100);assert.equal(g.players[other].obligation,120);
 act(first,{type:'call',company:0});const before=clone(g.auction),bidder=currentPlayer(g);act(bidder,{type:'raiseMoney'});assert.equal(g.phase,'bid');assert.deepEqual(g.auction,before);assert.equal(currentPlayer(g),bidder);
 act(bidder,{type:'bid',amount:60});assert.equal(g.auction.bids.at(-1).amount,60);assert.deepEqual(replayGame({version:g.version,setup:{seed:42},commands}),g);
});
test('LPs leave value choices and pending founder reactions untouched, and close at settlement',()=>{
 const{g,id}=value('bridge');const state={phase:g.phase,queue:[...g.queue],used:[...g.valueUsed],hand:clone(g.players[id].intel)};command(g,id,{type:'raiseMoney'});assert.equal(g.phase,state.phase);assert.deepEqual(g.queue,state.queue);assert.deepEqual(g.valueUsed,state.used);assert.deepEqual(g.players[id].intel,state.hand);
 g.race={queue:[{kind:'move',company:0,amount:1}]};g.powerChoice={player:id,options:[]};g.phase='power';const pending=clone(g.race);command(g,(id+1)%4,{type:'raiseMoney'});assert.deepEqual(g.race,pending);
 delete g.race;delete g.powerChoice;g.phase='settle';const before=clone(g);assert(!canRaiseMoney(g));assert.throws(()=>command(g,id,{type:'raiseMoney'}));assert.deepEqual(g,before);
});
test('Headhunting swaps two minority portfolio founders without moving, deploying or fumbling',()=>{
 const{g,id,c,other}=value('headhunt');c.tokens.push({id:2,owner:(id+1)%4},{id:3,owner:(id+1)%4});c.down=true;other.hiringFumble=true;const founders=[c.founder,other.founder],market=clone(g.founderMarket),supply=clone(g.founderSupply),pile=g.pile.length;
 assert(intelTargets(observation(g,id),id,'headhunt').includes(0));assert.deepEqual(intelSecondTargets(g,id,'headhunt',0),[1]);const before=clone(g);assert.throws(()=>play(g,id,0));assert.deepEqual(g,before);assert.throws(()=>play(g,id,2));assert.deepEqual(g,before);
 play(g,id,1);assert.deepEqual([c.founder,other.founder],founders.reverse());assert.deepEqual(g.founderMarket,market);assert.deepEqual(g.founderSupply,supply);assert.equal(g.pile.length,pile);assert(c.down&&other.hiringFumble);assert.equal(g.phase,'valueResult');assertGame(g);
});
test('Headhunting needs two portfolio companies and bots select a legal swap',()=>{
 const{g,id,other}=value('headhunt');other.tokens=[];assert.deepEqual(intelTargets(g,id,'headhunt'),[]);other.tokens=[{id:1,owner:id}];const cmd=botCommand(g,id,{samples:2,policy:'randomValue'});if(cmd.type==='playIntel'){assert.equal(cmd.target===0||cmd.target===1,true);assert.notEqual(cmd.company,cmd.target);}
});
test('Inside information can return another company’s discard, never an unseen burn or supply card',()=>{
 const{g,id,c,other}=value('inside');other.tokens=[];discard(g,c,1,true);const cards=discard(g,other,2);assert(intelTargets(observation(g,id),id,'inside').includes(1));command(g,id,{type:'playIntel',card:0,company:1});assert.deepEqual(g.intelScout.cards.map(c=>c.id),cards.map(c=>c.id));const before=clone(g);assert.throws(()=>command(g,id,{type:'scoutIntel',choice:2}));assert.deepEqual(g,before);
 const choice=botCommand(g,id,{samples:2});assert.equal(choice.type,'scoutIntel');command(g,id,{type:'scoutIntel',choice:1});assert.equal(g.pile.at(-1).id,cards[1].id);assert(!other.history.some(c=>c.id===cards[1].id));assert(g.removed.some(c=>c.burned));assertGame(g);
});

test('Research moves 3 from behind and 1 when leading, including ties',()=>{
 for(const [pos,expected] of [[1,3],[10,1]]){const g=createGame();g.companies.forEach(c=>{c.position=10;c.founder=-1;});g.companies[5].position=pos;const event=resolveCardBase(g,growthDeck(5).find(c=>c.signature==='breakthrough'));assert.equal(event.effect.printed,expected);assert.equal(g.companies[5].position,pos+expected);}
});
test('Secondary Market allows minority stakes, charges $5 and spends only that company’s treasury',()=>{
 const{g,id,c,other}=value('secondary');c.reserve=1;other.reserve=2;c.tokens.push({id:2,owner:(id+1)%4},{id:3,owner:(id+1)%4});const cash=g.players[id].cash;play(g,id);assert.equal(c.tokens.length,4);assert.equal(c.tokens.at(-1).owner,id);assert.equal(c.reserve,0);assert.equal(other.reserve,2);assert.equal(g.players[id].cash,cash-5);assertGame(g);
});
test('Illicit capital burns up to 3 supply cards and Executive hire deploys up to 3 after fumbling',()=>{
 for(const n of [1,2,3,4])for(const kind of ['learn','smear']){
  const{g,id,c}=value(kind);c.down=kind==='learn';g.removed.push(...c.supply.splice(n).map(c=>({...c,burned:true})));const stock=c.supply.length,pile=g.pile.length,burned=g.metrics.burned??0;play(g,id);
  assert.equal(c.supply.length,stock-Math.min(3,n));
  if(kind==='learn'){assert.equal(g.metrics.burned,burned+Math.min(3,n));assert.equal(c.reserve,1);assert.equal(g.pile.length,pile);}else{assert(c.down);assert.equal(g.pile.length,pile+Math.min(3,n));}
  assertGame(g);
 }
});
