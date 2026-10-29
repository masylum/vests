// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame as baseGame,command,currentPlayer,assertGame,clone} from '../docs/v96-validation/baseline-v95/engine.js';
import {resolveRevealPhase} from '../docs/v96-validation/baseline-v95/racing.js';
const createGame=(setup={})=>baseGame({...setup,rules:{intelMode:'mixed',...setup.rules}});
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function own(g,cid,id=0){const c=g.companies[cid];c.tokens=[{id:1,owner:id,paid:0,boughtLeg:0}];c.lastBuy[id]=1;return c;}
function value(g,kind){if(g.phase==='call')act(g,{type:'call',company:null});const id=currentPlayer(g);for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));const i=g.intelDeck.findIndex(c=>c.kind===kind);g.players[id].intel.push(...g.intelDeck.splice(i,1));return id;}
test('value choice follows the auction receipt exactly once',()=>{const g=createGame({seed:42}),host=currentPlayer(g);act(g,{type:'call',company:0});while(g.phase==='bid')act(g,{type:'bid',amount:0});act(g,{type:'continue'});assert.equal(g.phase,'intelPlay');assert.equal(currentPlayer(g),host);act(g,{type:'drawValue'});assert.equal(g.phase,'call');assert.notEqual(currentPlayer(g),host);assert.equal(g.players[host].intel.length,2);assertGame(g);});
test('the old help action is unavailable',()=>{const g=createGame(),before=clone(g);assert.throws(()=>act(g,{type:'getIntel'}));assert.deepEqual(g,before);});
test('Illicit capital removes the top two cards and adds one treasury, capped at three',()=>{
 for(const reserve of [0,2,3]){const g=createGame(),c=own(g,0,currentPlayer(g));c.reserve=reserve;const id=value(g,'learn'),top=c.supply.slice(0,2).map(c=>c.id);
 act(g,{type:'playIntel',card:0,company:0});assert.equal(c.reserve,Math.min(3,reserve+1));assert(top.every(id=>g.removed.some(c=>c.id===id&&c.burned)));
 assert.equal(g.phase,'valueResult');assert.equal(currentPlayer(g),id);assert.equal(g.valueResult.before[0].reserve,reserve);assert.equal(g.valueResult.after[0].reserve,c.reserve);assert.equal(g.lastRevealed.value.kind,'learn');assertGame(g);}
});
test('catch-up moves the tied last group together, without an extra Melania follow',()=>{
 const g=createGame();g.companies.forEach((c,i)=>{c.position=i<2?4:10+i;c.founder=-1;});g.companies[0].founder=17;
 resolveRevealPhase(g,'catchUp');assert.deepEqual(g.companies.slice(0,2).map(c=>c.position),[5,5]);
 assert.equal(g.lastRevealed.reactions.filter(r=>r.catchUp).length,2);assert(!g.lastRevealed.reactions.some(r=>r.founder===17));
});
test('after-reveal founder actions get a separate event from the final growth card',()=>{
 const g=createGame();g.companies.forEach((c,i)=>{c.position=10+i;c.founder=-1;});g.companies[0].founder=1;own(g,0);
 g.revealEnded=true;g.lastRevealed={card:{id:'old-card',company:4},reactions:[]};resolveRevealPhase(g,'end',true);
 assert.equal(g.phase,'power');assert.equal(g.lastRevealed.card,undefined);act(g,{type:'power',choice:1});
 assert.equal(g.lastRevealed.stage,'end');assert.equal(g.lastRevealed.card,undefined);assert(g.lastRevealed.reactions.some(r=>r.text==='0: 10 → 12'));
});
test('a founder IPO lets remaining growth cards resolve before settlement',()=>{
 const g=createGame();g.companies.forEach(c=>{c.position=23;c.founder=-1;});g.companies[0].position=23;g.companies[0].founder=13;own(g,0);
 resolveRevealPhase(g,'start',true);while(g.phase==='phaseResult')act(g,{type:'continue'});g.phase='reveal';g.queue=[];act(g,{type:'reveal'});
 assert(g.ipoCompany!=null);assert(!g.settlement);while(g.phase==='reveal')act(g,{type:'reveal'});while(['afterRevealReady','catchUpReady','catchUpResult','cycleResult'].includes(g.phase))act(g,{type:'continue'});assert.equal(g.phase,'settle');assert(g.finalExit);
});

test('the final growth card remains visible until after-reveal powers are requested',()=>{
 const g=createGame();g.companies.forEach(c=>c.founder=-1);g.phase='reveal';g.queue=[];g.drawsLeft=1;g.pile=[{id:'last',kind:'growth',company:0,printed:1}];
 act(g,{type:'reveal'});assert.equal(g.phase,'afterRevealReady');assert.equal(g.lastRevealed.card.id,'last');assert.equal(g.companies[0].position,2);
 act(g,{type:'continue'});assert.equal(g.phase,'catchUpReady');assert.equal(g.lastRevealed.stage,'end');assert.equal(g.lastRevealed.card,undefined);
});
