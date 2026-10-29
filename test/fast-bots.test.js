import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,currentPlayer,command,observation,clone} from '../src/engine.js';
import {botCommand} from '../src/bots.js';
import * as frozenV92 from '../docs/v92-health-1000/study/source/engine.js';
import {botCommand as optimizedV92} from '../docs/v92-health-1000/study/source/bots.js';
import {botCommand as reference} from '../docs/bot-performance/source/bots.js';

test('frozen v92 full-search fallback preserves the previous v92 bot decisions',()=>{
 const {createGame,currentPlayer,command,observation}=frozenV92;
 const replay=JSON.parse(fs.readFileSync(new URL('../docs/v92-health/bot-audit/925000-replay.json',import.meta.url))),g=createGame(replay.setup);
 let checked=0;
 for(let i=0;i<replay.commands.length;i++){
  if(i%17===0){const id=currentPlayer(g),v=observation(g,id),before=clone(v);assert.deepEqual(optimizedV92(v,id,{samples:2,sampler:'legacy'}),reference(v,id,{samples:2}));assert.deepEqual(v,before);checked++;}
  const {id,cmd}=replay.commands[i];command(g,id,cmd);
 }
 assert(checked>15);
});

test('fast bots remain blind to hidden bids and do not mutate observations',()=>{
 const g=createGame({seed:444,rules:{intelMode:'mixed'}});command(g,currentPlayer(g),{type:'call',company:0});
 const first=currentPlayer(g);command(g,first,{type:'bid',amount:10});const id=currentPlayer(g),other=clone(g);other.auction.bids[0].amount=20;
 const v=observation(g,id),before=clone(v);assert.deepEqual(v,observation(other,id));assert.deepEqual(botCommand(g,id),botCommand(other,id));assert.deepEqual(botCommand(v,id),botCommand(v,id,{sampler:'independent',samples:20}));assert.deepEqual(v,before);
 assert.throws(()=>botCommand(v,id,{sampler:'typo'}),/legacy or independent/);
});
