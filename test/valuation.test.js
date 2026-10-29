import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,observation} from './legacy-engine.js';
import {forecasts,botCommand} from '../src/bots.js';
import {opponentBids,settlementWealth} from '../src/adaptive.js';
test('old debt lowers score without creating another LP default',()=>{
 assert.equal(settlementWealth(30,{obligation:20,debt:200,fees:0},2,100),-190);
 assert.equal(settlementWealth(10,{obligation:20,debt:200,fees:0},2,100),-510);
});
test('forecasts still simulate future growth after cycle twelve',()=>{
 const v=observation(createGame(),0);v.cycle=13;
 assert(forecasts(v,0,{samples:4}).some((f,i)=>f.position>v.companies[i].position));
});
test('opponent learning does not invent larger bids when pockets grow',()=>{
 const v=observation(createGame(),0);v.players.forEach(p=>p.cash=400);
 v.auctionHistory=Array.from({length:16},()=>({company:0,cash:[100,100,100,100],bids:v.players.map(p=>({player:p.id,amount:100}))}));
 assert(opponentBids(v,0,0,20,()=>.9,4).every(row=>row.slice(1).every(x=>x===100)));
});

import {portfolioWealth} from '../src/valuation.js';
import {checkpointReached} from './legacy-config.js';
test('portfolio valuation retains shares across legs and never collects the same share twice',()=>{
 const v=observation(createGame(),0);v.players[0].cash=200;v.players[0].obligation=200;
 v.companies.forEach(c=>c.tokens=[]);v.companies[0].tokens=[{owner:0}];
 const values=v.companies.map(()=>({prices:[0],legPrices:[[0],[0],[0]],legMeans:[0,0,0]}));
 values[0]={prices:[10],legPrices:[[10],[100],[400]],legMeans:[10,100,400]};
 // Retain until the final $400 exit; no later grants or obligations.
 assert.equal(portfolioWealth(v,0,values,0),400);
 v.players[0].cash=190; // Ten fewer chips lowers final wealth by ten, with no forced sale.
 assert.equal(portfolioWealth(v,0,values,0),390);
});
test('obligations wait for the final exit even when current cash is insufficient',()=>{
 const v=observation(createGame(),0);v.companies.forEach(c=>c.tokens=[]);v.companies[0].tokens=[{owner:0}];
 const values=v.companies.map(()=>({prices:[0],legPrices:[[0],[0],[0]],legMeans:[0,0,0]}));
 values[0]={prices:[7],legPrices:[[7],[400],[700]],legMeans:[7,400,700]};
 assert.equal(portfolioWealth(v,0,values,0),694);
});
test('forecasts expose a complete remaining-leg path including future dilution',()=>{
 const g=createGame();const f=forecasts(g,0,{samples:3});
 assert(f.every(x=>x.legPrices.length===3&&x.legPrices.every(p=>p.length===3)));
 assert(f.some(x=>x.legMeans[2]>x.legMeans[0]));
});
test('intermediate checkpoints need two companies; IPO needs only one',()=>{
 const g=createGame();g.companies.forEach(c=>c.position=1);g.companies[0].position=24;
 for (g.leg=0;g.leg<3;g.leg++) {
  assert.equal(checkpointReached(g),g.leg===2);g.companies[1].position=g.rules.checkpoints[g.leg];
  assert(checkpointReached(g));g.companies[1].position=1;
 }
});
