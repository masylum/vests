import test from 'node:test';import assert from 'node:assert/strict';
import {growthDeck,COMPANIES} from '../src/config.js';
import {createGame} from '../src/engine.js';
import {resolveIntelActions} from '../src/racing.js';
test('themed decks retain stock sizes, signatures and distinct mixes',()=>{
 const mixes=COMPANIES.map((_,id)=>{const d=growthDeck(id);assert.equal(d.length,[20,21,19,16,18,19,18,20][id]);assert.equal(d.filter(c=>c.signature).length,id===3?2:3);assert.equal(d.some(c=>c.printed===3),false);return JSON.stringify([...Array.from({length:4},(_,n)=>d.filter(c=>!c.effect&&c.printed===n).length),d.filter(c=>c.effect==='fumble').length]);});assert.equal(new Set(mixes).size,8);
});
test('companies start on space 1 without consuming an opening card',()=>{
 const g=createGame();for(const c of g.companies){assert.equal(c.position,1);assert.equal(c.history.length,0);assert.equal(c.supply.length,growthDeck(c.id).length-1);}assert.equal(g.removed.length,0);
});
test('movement telemetry attributes actual clamped movement to the source founder',()=>{
 const g=createGame();g.companies.forEach(c=>c.down=true);const c=g.companies[0];c.position=23;
 resolveIntelActions(g,[{kind:'move',company:0,amount:3,source:1}]);
 assert.deepEqual(g.metrics.founderMovement[g.companies[1].founder],{forward:1,backward:0});assert.equal(g.ipoCompany??null,null);assert.equal(g.ipoTrigger,0);
});
