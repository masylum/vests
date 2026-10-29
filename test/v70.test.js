// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,quote} from '../docs/v96-validation/baseline-v95/engine.js';
import {resolveRevealPhase,resolveIntelActions,choosePower} from '../docs/v96-validation/baseline-v95/racing.js';
import {forecasts} from '../docs/v96-validation/baseline-v95/bots.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function race(positions){const g=createGame();g.companies.forEach((c,i)=>{c.position=positions[i]??1;c.founder=-1;c.tokens=[];});return g;}
function own(g,cid,player=0,count=1){const c=g.companies[cid];c.tokens.push(...Array.from({length:count},(_,i)=>({id:c.tokens.length+i,owner:player})));c.lastBuy[player]=player+1;}
function value(kind,{minority=false,down=false,owns=true}={}){
 const g=race([5,6,7,8,9,10]);g.rules.intelMode='mixed';g.intelDeck=[];g.intelDiscard=[];g.valueUsed=[];g.nextFirst=null;
 // Start a normal value turn with conserved real card identities.
 const h=createGame({rules:{intelMode:'mixed'}});g.intelDeck=[...h.intelDeck,...h.players.flatMap(p=>p.intel)];g.players.forEach(p=>p.intel=[]);
 for(const k of [kind,kind==='waste'?'swap':'inside']){const i=g.intelDeck.findIndex(c=>c.kind===k);g.players[0].intel.push(...g.intelDeck.splice(i,1));}
 g.companies[0].founder=17;g.companies[0].down=down;own(g,0,owns?0:1,minority?1:2);if(minority)own(g,0,1,2);if(kind!=='waste')own(g,1);
 g.phase='intelPlay';g.queue=[0];g.active=0;g.intelOrder=[0];g.callOrder=[0,1,2,3];g.callIndex=1;return g;
}
test('Jenkins fallback is 75, diluted normally, and inactive while fumbled',()=>{
 const g=race([23,22,21,2,1,0]),c=g.companies[3];c.founder=4;own(g,3,0,2);assert.equal(quote(c,g.rules,g.companies),37);c.down=true;assert.equal(quote(c,g.rules,g.companies),0);
});
test('Leon fumbles once per round and moves one',()=>{
 const g=race([5,4,3]);g.companies[0].founder=10;
 resolveIntelActions(g,[{kind:'batch',moves:[{kind:'move',company:1,amount:2},{kind:'move',company:2,amount:3}]}]);assert(g.companies[1].down&&!g.companies[2].down);assert.equal(g.companies[0].position,6);
 g.companies[1].down=false;g.companies[1].position=4;resolveIntelActions(g,[{kind:'move',company:1,amount:2}]);assert(!g.companies[1].down);assert.equal(g.companies[0].position,6);
});
test('Leon passing fumble fumbles Dan outside the reveal',()=>{
 const g=race([5,4,2]);g.companies[0].founder=10;g.companies[1].founder=11;resolveIntelActions(g,[{kind:'move',company:1,amount:2}]);assert.equal(g.companies[1].position,6);assert(g.companies[1].down);assert.equal(g.companies[0].position,6);
});
test('Ryan triggers when not leading, moves one first, and lets the controller protect a portfolio leader',()=>{
 const g=race([1,10,2,7]);g.companies[0].founder=6;g.companies[2].founder=11;own(g,0);own(g,1);own(g,2);
 resolveRevealPhase(g,'start',true);assert.equal(g.companies[0].position,2);assert(g.powerChoice.mandatory);assert(g.powerChoice.options.every(o=>o.label!=='Pass'));const choice=g.powerChoice.options.findIndex(o=>o.actions[0].company===2);
 act(g,{type:'power',choice});assert(!g.companies[1].down);assert.equal(g.companies[2].position,2);assert(g.companies[2].down);
 const h=race([10,10,9]);h.companies[0].founder=6;own(h,0);resolveRevealPhase(h,'start',true);assert.equal(h.companies[0].position,10);assert(!h.powerChoice);
});
test('Ryan target fumble triggers Aidan, and unowned Ryan uses a deterministic rival',()=>{
 const g=race([2,9,4,5,6,7]);g.companies[0].founder=6;g.companies[2].founder=5;own(g,0);resolveRevealPhase(g,'start',true);act(g,{type:'power',choice:0});assert(g.companies[1].down);assert.equal(g.companies[2].position,5);
 const h=race([2,9,4,5,6,7]);h.companies[0].founder=6;resolveRevealPhase(h,'start',true);assert(!h.powerChoice);assert(h.companies[1].down);
});
test('Melania moves two automatically when a minority shareholder targets her company',()=>{
 const g=value('bridge',{minority:true});g.companies[0].reserve=0;act(g,{type:'playIntel',card:0,company:0});assert.equal(g.companies[0].reserve,1);assert.equal(g.companies[0].position,7);assert.equal(g.phase,'valueResult');assert.equal(g.valueResult.reactions.filter(r=>r.kind==='move'&&r.founder===17).length,1);
});
test('unrelated targets, non-shareholders and fumbled Melania do not activate her',()=>{
 const g=value('bridge');act(g,{type:'playIntel',card:0,company:1});assert.equal(g.companies[0].position,5);
 const h=value('bridge',{down:true});act(h,{type:'playIntel',card:0,company:0});assert.equal(h.companies[0].position,5);
});
test('drawing a private value card never activates Melania',()=>{
 const h=value('waste');act(h,{type:'drawValue'});assert.equal(h.companies[0].position,5);assert(!h.powerChoice);assert.equal(h.phase,'call');
});
test('Resolve crisis recovers Melania before her targeted reaction, and she can reach IPO',()=>{
 const g=value('recover',{down:true});act(g,{type:'playIntel',card:0,company:0});assert(!g.companies[0].down);assert.equal(g.companies[0].position,8);assert.equal(g.phase,'valueResult');
 const h=value('bridge');h.companies[0].position=22;h.companies[0].reserve=0;act(h,{type:'playIntel',card:0,company:0});assert.equal(h.phase,'valueResult');assert.equal(h.ipoCompany,0);assert.equal(h.lastRevealed.value.after[0].position,24);
});
test('a value-card IPO keeps the turn alive without making Melania follow neighboring movement or fumbles',()=>{
 const g=value('recover');g.companies[1].position=23;act(g,{type:'playIntel',card:0,company:1});assert.equal(g.phase,'valueResult');assert.equal(g.companies[0].position,5);
 const h=race([5,5,9]);h.companies[0].founder=17;resolveIntelActions(h,[{kind:'move',company:1,amount:2},{kind:'fumble',company:1}]);assert.equal(h.companies[0].position,5);assert(!h.companies[0].down);
});
test('Melania forecasts include shareholder value-card movement',()=>{
 const g=value('bridge');g.companies.forEach(c=>{g.removed.push(...c.supply.splice(0));c.reserve=0;c.position=c.id===0?10:1;});g.removed.push(...g.pile.splice(0));g.phase='call';g.queue=[0];g.intelOrder=undefined;
 const f=forecasts(g,0,{samples:40});assert(f[0].position>10);
});

test('Melania can react to different shareholders in the same round, once per targeting card',()=>{
 const g=value('recover');g.companies[0].tokens.push({owner:1});
 act(g,{type:'playIntel',card:0,company:0});assert.equal(g.companies[0].position,8);
 g.phase='intelPlay';g.queue=[0];g.active=0;const before=g.players[0].intel.length;assert.throws(()=>act(g,{type:'playIntel',card:0,company:0}));assert.equal(g.players[0].intel.length,before);
 const discarded=g.companies[0].supply.shift();g.companies[0].history.push(discarded);g.removed.push({...discarded,revealed:true});g.players[1].intel.push(...g.players[0].intel.splice(0));g.queue=[1];g.active=1;g.intelOrder=[1];act(g,{type:'playIntel',card:0,company:0});act(g,{type:'scoutIntel',choice:0});assert.equal(g.phase,'valueResult');assert.equal(g.companies[0].position,10);assert.equal(g.valueResult.reactions.filter(r=>r.kind==='move'&&r.founder===17).length,1);
});
