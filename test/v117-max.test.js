import test from 'node:test';import assert from 'node:assert/strict';
import{createGame,resolveCard}from'../src/engine.js';
import{resolveIntelActions,resolveRevealPhase}from'../src/racing.js';
import{blockedDestination}from'../src/movement.js';
import{FOUNDERS,ACTIVE_FOUNDERS}from'../src/config.js';import{INTEL_CARDS}from'../src/intel.js';
import{FOUNDER_EMPHASIS,VALUE_EMPHASIS}from'../src/card-copy.js';
function fixture(){const g=createGame({players:4,seed:117});g.companies.forEach((c,i)=>{c.founder=-1;c.position=10+i*2;c.down=false;});g.companies[0].founder=12;return g;}
const move=(g,amount)=>resolveIntelActions(g,[{kind:'move',company:0,amount}],null,{interactive:false});
test('Max skips occupied spaces without spending movement, including intermediate spaces',()=>{const g=fixture();g.companies[1].position=11;g.companies[2].position=12;move(g,2);assert.equal(g.companies[0].position,14);});
test('Max skips backwards too',()=>{const g=fixture();g.companies[1].position=9;g.companies[2].position=8;move(g,-2);assert.equal(g.companies[0].position,6);});
test('a crowd occupies one space; zero movement stays put',()=>{const g=fixture();g.companies.slice(1).forEach(c=>c.position=11);move(g,0);assert.equal(g.companies[0].position,10);move(g,1);assert.equal(g.companies[0].position,12);});
test('Max stops at track boundaries',()=>{const g=fixture();g.companies[0].position=23;g.companies[1].position=24;move(g,2);assert.equal(g.companies[0].position,24);g.companies[0].position=1;g.companies[1].position=0;move(g,-2);assert.equal(g.companies[0].position,0);});
test('fumbled Max has no skip power; named relocations stay on their destination',()=>{const g=fixture();g.companies[1].position=11;g.companies[0].down=true;move(g,1);assert.equal(g.companies[0].position,11);g.companies[0].down=false;assert.equal(blockedDestination(g.companies,0,10,11,true),11);});
test('Danilo travels with Max without generating another landing move',()=>{const g=fixture();g.companies[1].founder=24;g.companies[1].position=10;g.companies[2].position=11;move(g,1);assert.equal(g.companies[0].position,12);assert.equal(g.companies[1].position,12);});
test('growth tokens use Max skipping',()=>{const g=fixture();g.companies[1].position=11;resolveCard(g,{...g.companies[0].supply.shift(),printed:1,effect:undefined});assert.equal(g.companies[0].position,12);});
test('catch-up with Max and Danilo terminates at the next space',()=>{const g=fixture();g.companies[1].founder=24;g.companies[1].position=10;g.companies.slice(2).forEach(c=>c.position=16);resolveRevealPhase(g,'catchUp');assert.equal(g.companies[0].position,11);assert.equal(g.companies[1].position,11);assert.ok(g.ipoTrigger==null);});
test('each active card has matching short emphasis cues',()=>{for(const id of ACTIVE_FOUNDERS){const cue=FOUNDER_EMPHASIS[id];assert.ok(cue&&FOUNDERS[id].action.toLowerCase().includes(cue.toLowerCase()),FOUNDERS[id].name);}for(const[k,c]of Object.entries(INTEL_CARDS)){const cues=VALUE_EMPHASIS[k];assert.ok(cues?.length,k);for(const cue of cues)assert.ok(c.text.toLowerCase().includes(cue.toLowerCase()),k);}});
