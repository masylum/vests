import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,observation} from '../src/engine.js';
import {resolveRevealPhase} from '../src/racing.js';
import {growthDeck} from '../src/config.js';
import {growthDeck as previousDeck} from '../docs/v71-health/source/config.js';
import {intelTargets,bestIntelPlay,expectedIntelValue} from '../src/intel.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function value(kind){
 const g=createGame({seed:123,rules:{intelMode:'mixed'}});
 g.companies.forEach(c=>{c.down=true;c.tokens=[];});
 for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));
 for(const k of [kind,'inside']){const i=g.intelDeck.findIndex(c=>c.kind===k);g.players[0].intel.push(...g.intelDeck.splice(i,1));}
 const c=g.companies[0];c.tokens=[{id:1,owner:0,paid:0,boughtLeg:0}];c.lastBuy[0]=1;
 g.phase='intelPlay';g.queue=[0];g.active=0;g.callOrder=[0,1,2,3];g.callIndex=1;g.intelOrder=[0];return {g,c};
}
function julie(){
 const g=createGame({seed:123});g.fast=true;g.companies.forEach((c,i)=>{c.founder=-1;c.position=5+i;c.tokens=[{owner:0}];});
 g.companies[0].founder=16;g.companies[1].position=9;const card=g.companies[1].supply.shift();g.removed.push({...card,revealed:true});g.companies[1].history.push(card);return g;
}


test('expanded companies preserve stock sizes, signature effects and fumbles',()=>{
 for(let id=0;id<8;id++){
  const before=previousDeck(id),after=growthDeck(id);
  assert.equal(after.length,[20,21,19,16,18,19,18,20][id]);assert(after.every(c=>c.printed>=0&&c.printed<=3));
  assert.deepEqual(after.filter(c=>c.signature).map(c=>[c.printed,c.signature]),before.filter(c=>c.signature).slice(0,id===3?2:3).map(c=>[id===3?1:c.printed,id===2?'recover':id===3?'recycle':c.signature]));
  assert.deepEqual(after.filter(c=>c.effect).map(c=>c.effect),Array([1,0,3,2,2,2,1,1][id]).fill('fumble'));
 }
});
test('Warm introduction works with a single portfolio company and remains usable in bot observations',()=>{
 const {g,c}=value('move');c.position=5;assert.deepEqual(intelTargets(g,0,'move'),[0]);
 const v=observation(g,0),best=bestIntelPlay(v,0);assert(Number.isFinite(best.value));assert(Number.isFinite(expectedIntelValue(v,0)));
 act(g,{type:'playIntel',card:0,company:0});assert.equal(c.position,6);assertGame(g);
});
test('Bridge financing costs exactly $3 and respects locked cash',()=>{
 const {g,c}=value('bridge');c.reserve=1;g.players[0].locked=49;assert(!intelTargets(g,0,'bridge').includes(0));g.players[0].locked=47;assert(intelTargets(g,0,'bridge').includes(0));
 act(g,{type:'playIntel',card:0,company:0});assert.equal(g.players[0].cash,47);assert.equal(c.reserve,2);assert.equal(g.bank.burn,3);assertGame(g);
});
test('Executive hire deploys remaining cards from an unfumbled company; deployment is attributed to the value card',()=>{
 for(const remaining of [0,1,2]){
  const {g,c}=value('smear');c.down=false;g.removed.push(...c.supply.splice(remaining).map(x=>({...x,burned:true})));const pile=g.pile.length;
  assert(intelTargets(g,0,'smear').includes(0));act(g,{type:'playIntel',card:0,company:0});assert(c.down);assert.equal(c.supply.length,0);assert.equal(g.pile.length,pile+remaining);
  if(remaining)assert(g.valueResult.reactions.some(r=>r.intel&&r.intelKind==='smear'&&r.founder===-1&&r.text.includes('Deployed')));
  assertGame(g);
 }
});
test('Portfolio conflict pays the acting minority shareholder, and movement clamps at zero',()=>{
 const {g,c}=value('conflict');c.position=1;c.tokens.push({id:2,owner:1},{id:3,owner:1});
 act(g,{type:'playIntel',card:0,company:0});assert.equal(c.position,0);assert.equal(g.players[0].cash,55);assert.equal(g.players[1].cash,50);assertGame(g);
});

test('Executive hire finishes fumbles and Aidan reactions before deploying supply',()=>{
 const {g,c}=value('smear');g.fast=true;c.down=false;c.founder=11;c.position=5;g.companies[1].founder=5;g.companies[1].down=false;g.companies[1].position=3;const pile=g.pile.length;
 act(g,{type:'playIntel',card:0,company:0});assert.equal(c.position,5);assert(c.down);assert.equal(g.companies[1].position,4);assert.equal(g.pile.length,pile+3);
 const {g:h,c:d}=value('smear');h.fast=true;d.down=false;d.founder=-1;h.companies[1].founder=5;h.companies[1].down=false;h.companies[1].position=3;
 act(h,{type:'playIntel',card:0,company:0});assert(d.down);assert.equal(h.companies[1].position,4);
});
