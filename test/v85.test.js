import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,resolveCardBase} from '../src/engine.js';
import {growthDeck,RULES} from '../src/config.js';
import {run} from '../scripts/study-game.js';
import {pileStats} from '../scripts/pile-study.js';
test('Research records the conditional movement shown to the player',()=>{
 for(const [positions,expected] of [[[5,4,3,2,1,0],3],[[1,2,3,4,5,6],1],[[6,6,6,6,6,6],1]]){
  const g=createGame();g.companies.forEach((c,i)=>c.position=positions[i]);
  const card=growthDeck(5).find(c=>c.signature==='breakthrough');
  const event=resolveCardBase(g,card);assert.equal(event.effect.printed,expected);assert.equal(event.effect.after-event.effect.before,expected);
 }
});
test('v85 makes the requested two-card Amazin nerf and one-card Novidia buff',()=>{
 assert.deepEqual(RULES.projectPrices,[[1,4,7],[3,6,9],[5,8,11]]);
 const normal=id=>growthDeck(id).filter(c=>!c.effect&&!c.signature);
 assert.equal(normal(1).filter(c=>c.printed===1).length,15);assert.equal(normal(1).filter(c=>c.printed===2).length,0);
 assert.equal(normal(3).filter(c=>c.printed===1).length,1);assert.equal(normal(3).filter(c=>c.printed===2).length,11);
 assert.equal(growthDeck(1).length,21);assert.equal(growthDeck(3).length,16);
});
test('pile study reconciles every round and excludes supply burns',async()=>{
 const g=await run({source:'src',seed:650000,players:4,samples:1});
 assert(g.pileFlows.length===g.roundCount);const stats=pileStats([g]);assert(stats.rounds>1);
 assert(Math.abs(stats.start+stats.added-stats.drawn-stats.discarded-stats.burned-stats.carry)<1e-9);
 assert(g.metrics.burned>=g.pileFlows.reduce((n,f)=>n+f.burned,0),'pile burns exclude any extra supply removal');
});
