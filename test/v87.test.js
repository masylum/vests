import test from 'node:test';import assert from 'node:assert/strict';
import{createGame,command,currentPlayer,observation,assertGame}from'../src/engine.js';
import{companyOrder,growthDeck,COMPANIES}from'../src/config.js';
import{resolveRevealPhase}from'../src/racing.js';
const act=(g,c)=>command(g,currentPlayer(g),c);
test('opening auction uses private sealed second-price bids, including a lower subsequent bid',()=>{
 const g=createGame(),host=currentPlayer(g);act(g,{type:'call',company:0});assert.equal(g.auction.mode,'sealed');assert.equal(currentPlayer(g),g.first);
 act(g,{type:'bid',amount:9});assert.equal(observation(g,currentPlayer(g)).auction.bids[0].amount,undefined);
 act(g,{type:'bid',amount:3});act(g,{type:'bid',amount:2});act(g,{type:'bid',amount:0});assert.equal(g.phase,'auctionResult');assert.equal(g.auction.winner,host);assert.equal(g.auction.paid,3);assert.equal(g.auction.locked,6);assertGame(g);
});
test('established companies retain sealed second-price bidding and private submissions',()=>{
 const g=createGame(),host=currentPlayer(g),c=g.companies[0];c.tokens=[{id:1,owner:host}];c.lastBuy[host]=1;act(g,{type:'call',company:0});assert.equal(g.auction.mode,'sealed');act(g,{type:'bid',amount:9});assert.equal(observation(g,currentPlayer(g)).auction.bids[0].amount,undefined);while(g.phase==='bid')act(g,{type:'bid',amount:4});assert.equal(g.auction.paid,4);assertGame(g);
});
test('a first-turn auction winner can immediately use a portfolio value card, then the turn ends',()=>{
 const g=createGame({rules:{intelMode:'mixed'}}),id=currentPlayer(g);for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));const i=g.intelDeck.findIndex(c=>c.kind==='bridge');g.players[id].intel.push(...g.intelDeck.splice(i,1));
 assert.equal(g.phase,'call');assert.throws(()=>act(g,{type:'drawValue'}));act(g,{type:'call',company:0});while(g.phase==='bid')act(g,{type:'bid',amount:currentPlayer(g)===id?1:0});act(g,{type:'continue'});assert.equal(g.phase,'intelPlay');assert.equal(currentPlayer(g),id);const treasury=g.companies[0].reserve;
 act(g,{type:'playIntel',card:0,company:0});assert.equal(g.companies[0].reserve,treasury+1);act(g,{type:'continue'});assert.equal(g.phase,'call');assert.notEqual(currentPlayer(g),id);assertGame(g);
});
test('clockwise phase steps expose Zack movement before Bazos computes his swap targets',()=>{
 const g=createGame();g.fast=true;g.companies.forEach((c,i)=>{c.founder=-1;c.position=[16,10,20,5,13,8][i];c.tokens=[{owner:0}];c.lastBuy[0]=1;});g.companies[0].founder=13;g.companies[4].founder=2;
 g.removed.push({...g.companies[1].supply.shift(),revealed:true});resolveRevealPhase(g,'start',true);assert.equal(g.phase,'phaseResult');assert.equal(g.companies[0].position,17);assert(g.lastRevealed.reactions.some(r=>r.text.includes('16 → 17')));
 act(g,{type:'continue'});assert.equal(g.phase,'power');assert.equal(g.powerChoice.company,4);assert(!g.powerChoice.options.some(o=>o.actions.some(a=>a.moves?.some(m=>m.company===0))));assert.equal(g.race.startPositions[0],17);
 assert.deepEqual(companyOrder(createGame().companies),[0,1,2,5,4,3]);
});
test('all supply cards cap their printed growth at two while deck sizes and thematic risks remain distinct',()=>{assert.deepEqual(COMPANIES.slice(0,6).map(c=>growthDeck(c.id).length),[20,21,19,16,18,19]);assert(growthDeck(2).filter(c=>c.effect==='fumble').length===3);assert(growthDeck(1).every(c=>c.effect!=='fumble'));for(let id=0;id<8;id++)assert(growthDeck(id).every(c=>c.printed<=2));});
