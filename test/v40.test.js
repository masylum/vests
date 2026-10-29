// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {companyValue,FOUNDERS} from '../docs/v96-validation/baseline-v95/legacy-config.js';
import {createGame,command,currentPlayer,observation} from '../docs/v96-validation/baseline-v95/legacy-engine.js';
test('nonlinear exit curve is zero through leg one, monotone, and reaches 50',()=>{
 const values=Array.from({length:25},(_,g)=>companyValue(g));assert(values.slice(0,9).every(x=>x===0));assert(values.every((x,i)=>i===0||x>=values[i-1]));assert.deepEqual([8,12,16,20,24].map(g=>companyValue(g)),[0,3,13,28,50]);
 assert.equal(companyValue(24,{exitCurve:'linear',exitLinear:25}),500);
 assert.throws(()=>createGame({rules:{exitCurve:'oops'}}));
});
test('Jerry funding no longer adds supply cards',()=>{
 for(const mode of ['sold','unsold','hiring']){
  const g=createGame({seed:72}),id=currentPlayer(g),c=g.companies[0];c.founder=7;c.hiringFumble=mode==='hiring';c.tokens=[{owner:id}];c.lastBuy[id]=1;const supply=c.supply.length,pile=g.pile.length;
  command(g,id,{type:'call',company:0});while(g.phase==='bid'){let p=currentPlayer(g);command(g,p,{type:'bid',amount:mode!=='unsold'&&p===id?10:0});}
  const bonus=0;assert.equal(c.supply.length,supply-bonus);assert.equal(g.pile.length,pile+bonus);
 }
});
test('renamed founders remain keyed by the same power IDs',()=>{
 assert.equal(FOUNDERS[2].name,'Jess Bazos');assert.equal(FOUNDERS[4].name,'Jenkins Wang');assert.equal(FOUNDERS[8].name,'Liza Helms');assert.equal(FOUNDERS[9].name,'Harry Cage');assert.equal(FOUNDERS[10].name,'Leon Mask');assert.equal(FOUNDERS[12].name,'Max Bahnhof');
});
