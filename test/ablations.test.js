import test from 'node:test';import assert from 'node:assert/strict';
import * as engine from '../src/engine.js';import * as config from '../src/config.js';import * as intel from '../src/intel.js';
import {randomizedCommand} from '../scripts/random-policy.js';
const helpers={engine,config,intel};
test('delayed bidding suppresses bids and open raises only until its public cutoff',()=>{
 const g=engine.createGame(),id=engine.currentPlayer(g),v=engine.observation(g,id);
 for(const phase of ['bid','tie']){v.phase=phase;v.metrics.cycles=2;v.leg=0;for(const policy of ['delayTwoRounds','delayFirstLeg'])assert.deepEqual(randomizedCommand(v,id,policy,()=>0,helpers),{type:phase,amount:0});v.metrics.cycles=3;assert.equal(randomizedCommand(v,id,'delayTwoRounds',()=>0,helpers),undefined);assert.equal(randomizedCommand(v,id,'delayFirstLeg',()=>0,helpers).amount,0);v.leg=1;assert.equal(randomizedCommand(v,id,'delayFirstLeg',()=>0,helpers),undefined);}
 v.phase='call';v.metrics.cycles=1;v.leg=0;assert.equal(randomizedCommand(v,id,'delayTwoRounds',()=>0,helpers),undefined);
});
function stream(seed){const state={rng:seed};return()=>engine.random(state);}
test('strategy randomization is reproducible per seed, varies across seeds and leaves deck RNG untouched',()=>{
 const g=engine.createGame(),id=engine.currentPlayer(g),v=engine.observation(g,id),before=g.rng;
 const sample=seed=>{const random=stream(seed);return Array.from({length:20},()=>randomizedCommand(v,id,'randomCall',random,helpers));};
 assert.deepEqual(sample(42),sample(42));assert.notDeepEqual(sample(42),sample(43));assert.equal(g.rng,before);
 assert(sample(42).every(c=>c.type==='raiseMoney'||c.type==='call'&&(c.company===null||engine.eligibleCompanies(g,id).includes(c.company))));
});
test('random bids use only affordable remaining funding levels and legal open tie levels',()=>{
 const g=engine.createGame(),id=engine.currentPlayer(g);engine.command(g,id,{type:'call',company:0});const v=engine.observation(g,id),random=stream(780001);
 for(const reserve of [0,1,2]){v.companies[0].reserve=reserve;const allowed=[0,...v.rules.projectPrices[0].slice(0,3-reserve)];for(let i=0;i<40;i++)assert(allowed.includes(randomizedCommand(v,id,'randomBid',random,helpers).amount));}
 v.players[id].locked=50;assert.equal(randomizedCommand(v,id,'randomBid',random,helpers).amount,0);
 v.players[id].locked=0;v.companies[0].reserve=0;v.phase='tie';v.auction.price=4;
 for(let i=0;i<30;i++)assert([0,v.rules.projectPrices[0][2]].includes(randomizedCommand(v,id,'randomBid',random,helpers).amount));
});
