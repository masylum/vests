import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clone} from '../src/clone.js';
import {createGame} from '../src/engine.js';
import {createGame as optimizedGame,command,observation} from '../docs/v71-health/source/engine.js';
import {forecasts} from '../docs/v71-health/source/bots.js';
import {FOUNDERS,RULES} from '../src/config.js';
import {parallel} from '../scripts/parallel.js';
import {createGame as oldGame,command as oldCommand,observation as oldObservation} from '../docs/v70-health/source/engine.js';
import {forecasts as oldForecasts} from '../docs/v70-health/source/bots.js';

test('plain game copying matches native values, aliases and mutation isolation',()=>{
 const a={n:NaN,infinity:Infinity,u:undefined,array:[1,,3],nested:{x:2}};a.alias=a.nested;a.circular=a;
 const b=clone(a);assert.deepEqual(b,structuredClone(a));assert.equal(b.alias,b.nested);assert.equal(b.circular,b);b.nested.x=5;assert.equal(a.nested.x,2);
 const g=createGame({rules:{intelMode:'mixed'}}),copy=clone(g);assert.deepEqual(copy,structuredClone(g));copy.companies[0].supply.pop();assert.notDeepEqual(copy,g);
});
test('copy optimization preserves historical replay states and forecasts',()=>{
 const replay=JSON.parse(fs.readFileSync(new URL('../docs/v70-health/sample.json',import.meta.url))),g=optimizedGame({...replay.setup,rules:{...replay.setup.rules,wangExit:140}}),old=oldGame(replay.setup);
 let checks=0;
 for(const {id,cmd} of replay.commands){if(g.phase==='bid'&&checks++<2)assert.deepEqual(forecasts(g,id,{samples:3}),oldForecasts(old,id,{samples:3}));command(g,id,cmd);oldCommand(old,id,cmd);const {version,...a}=g,{version:ignored,...b}=old;assert.deepEqual(a,b);}
 const v=observation(g,0),oldV=oldObservation(old,0);assert.deepEqual(forecasts(v,0,{samples:3}),oldForecasts(oldV,0,{samples:3}));
});
test('pool preserves job order and reuses workers across jobs',async()=>{
 const rows=await parallel(Array.from({length:12},(_,value)=>({value})),{moduleURL:new URL('./fixtures/pool-task.js',import.meta.url),workers:2});
 assert.deepEqual(rows.map(r=>r.value),Array.from({length:12},(_,i)=>i*2));assert(rows.some(r=>r.calls>1));assert(new Set(rows.map(r=>r.threadId)).size<=2);
});
test('pool propagates worker failures and handles empty batches',async()=>{
 assert.deepEqual(await parallel([],{moduleURL:new URL('./fixtures/pool-task.js',import.meta.url),workers:2}),[]);
 await assert.rejects(parallel([{fail:true}],{moduleURL:new URL('./fixtures/pool-task.js',import.meta.url),workers:1}),/Expected pool failure/);
 await assert.rejects(parallel([{exit:true}],{moduleURL:new URL('./fixtures/pool-task.js',import.meta.url),workers:1}),/Worker exited 0/);
 await assert.rejects(parallel([],{moduleURL:new URL('./fixtures/pool-task.js',import.meta.url),workers:0}),/positive/);
});
test('roster labels and Jenkins payout agree',()=>{assert.equal(RULES.wangExit,75);assert.match(FOUNDERS[4].action,/\$75/);assert.equal(FOUNDERS[16].name,'Julie Hearts');});
