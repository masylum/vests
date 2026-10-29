import {createGame as currentGame} from '../src/engine.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {availableCash} from './legacy-config.js';
import {simulate} from '../simulate.js';
import {createGame,command,currentPlayer,assertGame} from './legacy-engine.js';
test('mixed policies dispatch per seat without revealing opponent policy to bots',()=>{
 const policies=['normal','allIn','normal','allIn'];
 const g=simulate({seed:20288000,policies,samples:2,trace:true});
 const replay=currentGame(g.replay.setup);
 let checked=0;
 for(const {id,cmd} of g.replay.commands){
  assert.equal(currentPlayer(replay),id);
  if(policies[id]==='allIn'&&cmd.type==='bid'){assert.equal(cmd.amount,availableCash(replay.players[id])>=replay.auction.reserve?availableCash(replay.players[id]):0);checked++;}
  command(replay,id,cmd);
 }
 assert.ok(checked>0);assert.deepEqual(replay.scores,g.scores);assertGame(replay);
 assert.throws(()=>simulate({policies:['allIn']}));
 assert.throws(()=>simulate({policies:['normal','normal','normal','typo']}));
});

test('concentrated policy bids only for one fixed company and commits its cash there',()=>{
 const g=simulate({seed:20288003,policy:'concentrated',seat:0,samples:2,trace:true});
 const r=currentGame(g.replay.setup);let targeted=0,passed=0;
 for(const {id,cmd} of g.replay.commands){
  if(id===0&&cmd.type==='bid') {
   const target=r.auction.company===0;
   assert.equal(cmd.amount,target&&availableCash(r.players[0])>=r.auction.reserve?availableCash(r.players[0]):0);
   if(target)targeted++;else passed++;
  }
  command(r,id,cmd);
 }
 assert.ok(targeted>0&&passed>0);assert.deepEqual(r.scores,g.scores);
});

test('adaptive opponents learn revealed bids without reading current sealed offers',async()=>{
 const {opponentBids,adaptiveBid}=await import('../src/adaptive.js');
 const g=createGame();command(g,currentPlayer(g),{type:'call',company:0});
 const {observation}=await import('./legacy-engine.js');
 const id=currentPlayer(g),v=observation(g,id);
 const rng=()=>{let n=73;return()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296)};
 const average=rows=>rows.flat().reduce((a,b)=>a+b,0)/rows.flat().length;
 const cautious=structuredClone(v),aggressive=structuredClone(v);
 cautious.auctionHistory=Array.from({length:10},()=>({company:0,bids:g.players.map(p=>({player:p.id,amount:8}))}));
 aggressive.auctionHistory=Array.from({length:10},()=>({company:0,bids:g.players.map(p=>({player:p.id,amount:180}))}));
 assert(average(opponentBids(aggressive,id,0,25,rng()))>average(opponentBids(cautious,id,0,25,rng()))*3);
 const values=g.companies.map(c=>({expected:40,value:30,prices:[20,30,40,50]}));
 const before=adaptiveBid(aggressive,id,values,rng());
 aggressive.auction.bids=g.players.map(p=>({player:p.id,amount:999}));
 assert.equal(adaptiveBid(aggressive,id,values,rng()),before);
 assert(before>=0&&before<=v.players[id].cash);
});

test('adaptive games replay exactly and retain only revealed auction history',()=>{
 const g=simulate({seed:172001,policies:Array(4).fill('adaptive'),samples:3,trace:true});
 const r=currentGame(g.replay.setup);
 for(const {id,cmd} of g.replay.commands)command(r,id,cmd);
 assert.deepEqual(r.scores,g.scores);assert.equal(r.auctionHistory.length,g.metrics.auctions);
 assertGame(r);
});

test('normal bidding never exceeds its own risk-adjusted marginal investment value',async()=>{
 const {adaptiveBid,investmentCeiling}=await import('../src/adaptive.js');
 const {observation}=await import('./legacy-engine.js');
 const g=createGame();command(g,currentPlayer(g),{type:'call',company:0});const id=currentPlayer(g),v=observation(g,id);
 const values=g.companies.map(()=>({expected:50,value:50,prices:[50,50],finalPrices:[50,50]}));
 const forecast=()=>values;
 assert.equal(investmentCeiling(v,id,values,forecast),Math.min(v.players[id].cash,50));
 // Even an expensive rival creates no licence to pay more than our own $50 return.
 v.auctionHistory=Array.from({length:12},()=>({company:0,bids:g.players.map(p=>({player:p.id,amount:400}))}));
 assert(adaptiveBid(v,id,values,()=>.9,forecast)<=50);
});

test('founder planning retains a trailing Liza when replacements do not justify spending the turn',async()=>{
 const {botCommand}=await import('../src/bots.js');
 for(const position of [2]){
  const g=createGame({seed:42});g.first=0;g.active=0;g.queue=[0];
  g.companies.forEach((c,i)=>{c.position=i?10+i:position;c.founder=-1;c.reserve=3;});
  const c=g.companies[0];c.founder=8;c.tokens=[{owner:0}];c.lastBuy[0]=1;c.reserve=3;g.founderMarket=[11,9,15];
  const action=botCommand(g,0,{samples:24});
  assert.notEqual(action.type,'changeFounder');
 }
});
