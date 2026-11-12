import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,currentPlayer,command,assertGame} from '../src/engine.js';
import {ACTIVE_FOUNDERS} from '../src/config.js';import {INTEL_CARDS,INTEL_ART} from '../src/intel.js';
for(const players of [2,3,4])test(`Fresh Perspectives refreshes the public market without cash (${players} investors)`,()=>{
 const g=createGame({players,seed:110}),id=currentPlayer(g),p=g.players[id];
 if(!p.intel.some(c=>c.kind==='fresh')){const zone=[g.intelDeck,...g.players.filter(x=>x.id!==id).map(x=>x.intel)].find(a=>a.some(c=>c.kind==='fresh')),i=zone.findIndex(c=>c.kind==='fresh');[zone[i],p.intel[0]]=[p.intel[0],zone[i]];}
 const before=[...g.founderMarket],next=g.founderSupply.slice(0,3),hired=g.companies.map(c=>c.founder),cash=p.cash,hand=p.intel.length;
 command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card:p.intel.findIndex(c=>c.kind==='fresh'),company:-1});
 assert.deepEqual(g.founderMarket,next);assert.ok(g.founderMarket.every(f=>!before.includes(f)));assert.deepEqual(g.founderSupply.slice(-3),before);
 assert.deepEqual(g.companies.map(c=>c.founder),hired);assert.equal(p.cash,cash);assert.equal(p.intel.length,hand+1);
 assert.deepEqual(g.valueResult.marketBefore,before);assert.deepEqual(g.valueResult.marketAfter,next);
 assert.equal(new Set([...g.founderMarket,...g.founderSupply,...hired]).size,ACTIVE_FOUNDERS.length);assertGame(g);
});
test('Fresh Perspectives has its new artwork and no cash promise',()=>{assert.equal(INTEL_ART.fresh,'fresh');assert.ok(!INTEL_CARDS.fresh.text.includes('$2'));assert.match(INTEL_CARDS.fresh.text,/3 public-market founders/);});
