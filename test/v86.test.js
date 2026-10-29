import test from 'node:test';import assert from 'node:assert/strict';
import{createGame,command,currentPlayer,observation,assertGame}from'../src/engine.js';
import{FOUNDERS}from'../src/config.js';
function reveal(){const g=createGame();g.companies.forEach(c=>c.hiringFumble=true);for(const card of g.pile.splice(0))g.companies[card.company].supply.push(card);const supply=g.companies[0].supply,regular=supply.findIndex(c=>!c.effect&&!c.signature&&c.printed>0);g.pile=[...supply.splice(regular,1),...supply.splice(0,5)];g.burnEligible=g.pile.map(c=>c.id);g.phase='reveal';g.drawsLeft=1;g.active=0;g.queue=[];return g;}
test('burn occurs after draws, preserves newly added cards, and does not repeat after powers or catch-up',()=>{
 const g=reveal(),fresh=g.companies[1].supply.shift();g.pile.push(fresh);const start=g.pile.length;
 assert(!('burnEligible' in observation(g,0)),'hidden pile identities must not leak to bots');
 command(g,0,{type:'reveal'});assert.equal(g.phase,'afterRevealReady');assert.equal(g.metrics.burned,3);assert.equal(g.pile.length,start-4);assert(g.pile.some(c=>c.id===fresh.id));assert.equal(g.log.filter(e=>e.type==='burn').length,1);assertGame(g);
 for(let i=0;i<10&&g.phase!=='cycleResult';i++)command(g,currentPlayer(g),{type:'continue'});
 assert.equal(g.phase,'cycleResult');assert.equal(g.metrics.burned,3);assert.equal(g.log.filter(e=>e.type==='burn').length,1);assertGame(g);
});
test('burn caps at eligible cards rather than burning protected additions',()=>{
 const g=reveal();g.burnEligible=[g.pile[0].id];command(g,0,{type:'reveal'});assert.equal(g.metrics.burned??0,0);assert.equal(g.pile.length,5);assertGame(g);
});
test('a growth-draw IPO skips the subsequent burn',()=>{
 const g=reveal();g.companies[0].position=23;command(g,0,{type:'reveal'});assert.notEqual(g.ipoCompany,null);assert.equal(g.metrics.burned??0,0);assert.equal(g.pile.length,5);assertGame(g);
});
test('updated founder wording matches the effects',()=>{assert.match(FOUNDERS[9].action,/deploy 2/);assert.match(FOUNDERS[17].trigger,/value card on my company/);});
