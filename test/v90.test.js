// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,observation} from '../docs/v96-validation/baseline-v95/engine.js';
import {resolveSharePurchase,resolveRevealPhase} from '../docs/v96-validation/baseline-v95/racing.js';
import {forecasts} from '../docs/v96-validation/baseline-v95/bots.js';
function setup(owners=[]){const g=createGame();g.fast=true;g.companies.forEach(c=>{c.founder=-1;c.position=15;});const c=g.companies[0];c.founder=7;c.position=10;c.tokens=owners.map(owner=>({owner}));return{g,c};}
test('Jerry rewards first and repeated sole-investor auction purchases, ignoring non-player shares',()=>{
 for(const owners of [[0],[0,0],[null,0],[null,null,0,0]]){const{g,c}=setup(owners);resolveSharePurchase(g,0,0);assert.equal(c.position,12);resolveSharePurchase(g,0,0);assert.equal(c.position,14);}
 for(const owners of [[],[null],[0,1],[0,0,1],[1]]){const{g,c}=setup(owners);resolveSharePurchase(g,0,0);assert.equal(c.position,10);}
});
test('Jerry has no passive reveal movement and is disabled by either fumble',()=>{
 const{g,c}=setup([0]);resolveRevealPhase(g,'start');resolveRevealPhase(g,'end');assert.equal(c.position,10);
 for(const flag of ['down','hiringFumble']){const{g,c}=setup([0]);c[flag]=true;assert.equal(resolveSharePurchase(g,0,0),null);assert.equal(c.position,10);}
});
test('auction bonus uses normal reactions, fresh positions and IPO commitment',()=>{
 const{g,c}=setup([0]);g.valueResult={before:g.companies.map(c=>({...c,position:1}))};g.companies[1].founder=0;g.companies[1].position=12;
 const event=resolveSharePurchase(g,0,0);assert.equal(c.position,12);assert.equal(g.companies[1].position,14);assert(event.reactions.some(r=>r.founder===7&&r.from===10&&r.to===12));
 c.position=23;resolveSharePurchase(g,0,0);assert.equal(c.position,24);assert.equal(g.ipoCompany,0);
});
test('real auction issuance triggers Jerry, all-pass does not, receipt retains movement',()=>{
 for(const sold of [true,false]){
 let g,c;for(let seed=0;seed<100;seed++){g=createGame({seed});c=g.companies.find(c=>c.founder===7);if(c)break;}
 const host=currentPlayer(g);command(g,host,{type:'call',company:c.id});
 while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:sold&&currentPlayer(g)===host?4:0});
 assert.equal(g.phase,'auctionResult');assert.equal(g.log.filter(e=>e.reactions?.some(r=>r.founder===7)).length,sold?1:0);assert.equal(c.position,sold?3:1);assert.equal(g.active,host);assert.equal(g.auction.reactions?.some(r=>r.founder===7)??false,sold);assertGame(g);
 }
});
test('bot forecasts value the auction trigger without mutating the observed state',()=>{
 const{g}=setup([]);g.auction={company:0};const v=observation(g,0),before=structuredClone(v);
 const boosted=forecasts(v,0,{samples:4,fundingDelay:1000,auctionOutcome:{winner:0,paid:4}});v.companies[0].founder=-1;
 const ordinary=forecasts(v,0,{samples:4,fundingDelay:1000,auctionOutcome:{winner:0,paid:4}});
 assert(boosted[0].roundsToExit.every((n,i)=>n<ordinary[0].roundsToExit[i]));assert(boosted[0].whole>ordinary[0].whole);assert.deepEqual(g.companies[0].tokens,[]);assert.equal(before.companies[0].position,10);
});
test('repeat auctions boost the sole buyer; a rival purchase stops Jerry',()=>{
 for(const rival of [false,true]){
  const{g,c}=setup([0]);c.position=1;c.reserve=0;c.lastBuy[0]=1;g.phase='call';g.queue=[0];g.active=0;
  command(g,0,{type:'call',company:0});const buyer=rival?1:0;
  while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===buyer?4:0});
  assert.equal(c.position,rival?1:3);assert.equal(g.auction.winner,buyer);
 }
});
test('Secondary Market issues a share without Jerry movement',()=>{
 const g=createGame({rules:{intelMode:'mixed'}}),c=g.companies[0];g.companies.forEach(c=>c.founder=-1);c.founder=7;c.position=10;c.tokens=[{owner:0}];g.phase='intelPlay';g.queue=[0];g.active=0;g.intelOrder=[0];g.callOrder=[0,1,2,3];g.callIndex=1;c.lastBuy[0]=1;c.reserve=2;
 g.players[0].intel=[{kind:'secondary'}];command(g,0,{type:'playIntel',card:0,company:0});
 assert.equal(c.tokens.length,2);assert.equal(c.position,10);
});
