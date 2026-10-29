import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createGame,command,currentPlayer,eligibleCompanies,deployReserves,assertGame,observation} from '../src/engine.js';
import {botCommand,forecasts} from '../src/bots.js';import {INTEL_CARDS,intelTargets} from '../src/intel.js';
test('a fumbled led company can raise, deploy, and keep its fumble until a card recovers it',()=>{
 const g=createGame({rules:{intelMode:'mixed'}}),id=currentPlayer(g),c=g.companies[0];c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;c.down=true;c.hiringFumble=true;
 assert(eligibleCompanies(g,id).includes(0));command(g,id,{type:'call',company:0});while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===id?15:0});assert.equal(c.reserve,3);assert(c.down);const before=c.supply.length;deployReserves(g);assert(c.supply.length<before);assert(c.down);assertGame(g);
});
test('removed value cards cannot target companies, and every available target belongs to the portfolio',()=>{
 const g=createGame({rules:{intelMode:'mixed'}});g.companies[0].tokens=[{owner:0},{owner:1},{owner:1}];g.companies[0].reserve=1;g.companies[0].position=7;
 assert(!INTEL_CARDS.back&&!INTEL_CARDS.scout);
 for(const kind of Object.keys(INTEL_CARDS))for(const cid of intelTargets(g,0,kind))assert(g.companies[cid].tokens.some(t=>t.owner===0));
 assert.deepEqual(intelTargets(g,0,'back'),[]);assert.deepEqual(intelTargets(g,0,'scout'),[]);assert(intelTargets(g,0,'conflict').includes(0));assert(intelTargets(g,0,'recover').includes(0));
});
test('short-term action forecasts do not invent funding during the waiting window',()=>{
 const g=createGame();g.companies.forEach(c=>c.reserve=0);const v=observation(g,0),f=forecasts(v,0,{samples:3,fundingDelay:1000});assert(f[0].futureSpending.every(a=>a.every(x=>x===0)));assert(f.every(c=>c.futureShares.every(a=>a.every(x=>x===0))));
});
test('bots sustain cash-rich stalled portfolios through funding or value cards instead of replacing founders',()=>{
 const cases=JSON.parse(fs.readFileSync(new URL('./fixtures/funding-stall-observations.json',import.meta.url)));
 // Stronger funding cards and Melania now make the help action a valid alternative to an auction.
 for(const v of cases){const cmd=botCommand(v,v.playerId,{samples:32});assert(['call','changeFounder'].includes(cmd.type));if(cmd.type==='call'&&cmd.company!==null)assert(v.companies[cmd.company].reserve===0,'Fund a company with an empty treasury');}
});
