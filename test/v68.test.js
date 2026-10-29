import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,resolveCard,assertGame} from '../src/engine.js';
import {growthDeck,slotCards} from '../src/config.js';
import {growthDeck as previousDeck} from '../docs/v68-health/baseline-v67/src/config.js';
import {resolveRevealPhase} from '../src/racing.js';
function race(positions){const g=createGame();g.fast=true;g.companies.forEach((c,i)=>{c.position=positions[i]??0;c.founder=-1;});return g;}
test('Liza bonuses second and trailing, but never a leading or tied-leading company',()=>{
 for(const [positions,expected] of [[[5,8,7],7],[[7,8,7],9],[[8,8,7],9],[[9,8,7],10]]){
  const g=race(positions);g.companies[0].founder=8;resolveCard(g,{id:'unit',kind:'growth',company:0,printed:1});assert.equal(g.companies[0].position,expected);
 }
});
test('Mura deploys one finite card before reveal with zero treasury and does not repeat',()=>{
 const g=createGame(),c=g.companies.find(c=>c.founder===14)??g.companies[0];
 // Keep the founder inventory valid when moving Mura from the public pool.
 if(c.founder!==14){const pool=g.founderMarket.includes(14)?g.founderMarket:g.founderSupply;pool[pool.indexOf(14)]=c.founder;c.founder=14;}
 g.companies.forEach(x=>{if(x!==c)x.down=true;});c.reserve=0;const top=c.supply[0],count=c.supply.length,pile=g.pile.length;
 resolveRevealPhase(g,'start');assert.equal(c.supply.length,count-1);assert(g.pile.some(x=>x.id===top.id));assert.equal(g.pile.length,pile+1);assert.equal(c.reserve,0);assert.equal(slotCards(c,1),[2,3,2,2,2,2][c.id]);
 resolveRevealPhase(g,'start');assert.equal(c.supply.length,count-1);assertGame(g);
 for(const down of [false,true]){const h=race([3,4,5]);h.companies[0].founder=14;h.companies[0].down=down;h.companies[0].supply=[];const n=h.pile.length;resolveRevealPhase(h,'start');assert.equal(h.pile.length,n);}
});
test('expanded supplies retain stock sizes and signatures, keeping fumbles while removing setbacks',()=>{
 for(let id=0;id<8;id++){const a=previousDeck(id),b=growthDeck(id);assert.equal(b.length,[20,21,19,16,18,19,18,20][id]);assert.equal(b.filter(c=>c.signature).length,id===3?2:3);
 assert.deepEqual(b.filter(c=>c.effect).map(c=>c.effect),Array([1,0,3,2,2,2,1,1][id]).fill('fumble'));}

});
