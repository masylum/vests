// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,observation,assertGame,resolveCard} from '../docs/v96-validation/baseline-v95/engine.js';
import {resolveRevealPhase,resolveIntelActions,resumeRace} from '../docs/v96-validation/baseline-v95/racing.js';
import {fundingNeed} from '../docs/v96-validation/baseline-v95/adaptive.js';
import {portfolioOptions} from '../docs/v96-validation/baseline-v95/valuation.js';
import {bestIntelPlay} from '../docs/v96-validation/baseline-v95/intel.js';
function race(positions){const g=createGame({rules:{intelMode:'mixed'}});g.companies.forEach((c,i)=>{c.founder=-1;c.position=positions[i]??10;c.tokens=[{owner:0}];c.lastBuy[0]=1;});return g;}
test('Ryan activates outside the lead and moves one before the fumble choice',()=>{
 for(const positions of [[7,10,9,8,6,5],[2,2,9,8,7,6],[2,3,9,8,7,6]]){
  const g=race(positions);g.companies[0].founder=6;resolveRevealPhase(g,'start',true);
  const last=positions[0]<Math.max(...positions);
  assert.equal(g.companies[0].position,positions[0]+(last?1:0));assert.equal(!!g.powerChoice,last);
  if(last){assert.deepEqual(g.race.startPositions,positions);assert(g.powerChoice.options.every(o=>o.actions[0].company!==0));}
 }
});
test('Harry can pass without spending his reveal use, but cannot recover twice',()=>{
 const g=race([1,2,3,4,5,6]);g.companies[0].founder=9;const stock=g.companies[0].supply.length;
 const hit=company=>resolveCard(g,{kind:'growth',id:`unit${company}`,company,printed:0,effect:'fumble'},{interactive:true});
 hit(1);resumeRace(g,0);hit(2);assert(g.powerChoice);resumeRace(g,1);hit(3);
 assert(!g.race&&!g.powerChoice);assert(g.companies[1].down);assert(!g.companies[2].down);assert(g.companies[3].down);assert.equal(g.companies[0].supply.length,stock-2);
});
test('Harry resets at the shared reveal, never on an investor turn',()=>{
 const g=createGame({rules:{intelMode:'mixed'}});g.harryUsed=[0];command(g,currentPlayer(g),{type:'call',company:null});command(g,currentPlayer(g),{type:'drawValue'});assert.deepEqual(g.harryUsed,[0]);
 g.companies.forEach(c=>c.founder=-1);resolveRevealPhase(g,'start');assert.deepEqual(g.harryUsed,[]);
});
test('Resolve crisis logs movement and recovery under one consistent card/player identity',()=>{
 const g=race([5,6,7,8,9,10]);g.companies[0].down=true;
 resolveIntelActions(g,[{kind:'move',company:0,amount:1,intel:true},{kind:'repair',company:0,source:0,intel:true}],{player:0,kind:'recover'});
 assert.equal(g.lastRevealed.reactions.length,2);assert(g.lastRevealed.reactions.every(r=>r.intelKind==='recover'&&r.intelPlayer===0));
});
test('funding need counts pending growth cards and treasury, including uncertainty after burns',()=>{
 const v=observation(createGame({rules:{intelMode:'mixed'}}),0),c=v.companies[0];v.poolWeights=v.companies.map(()=>0);
 assert(fundingNeed(v,0)>0);c.reserve=2;assert.equal(fundingNeed(v,0),1);c.reserve=3;assert.equal(fundingNeed(v,0),0);c.reserve=0;v.poolWeights[0]=5;assert.equal(fundingNeed(v,0),0);
 v.poolWeightsAreUpperBounds=true;v.pileCount=1;assert(fundingNeed(v,0)>0);c.supplyCount=0;assert.equal(fundingNeed(v,0),0);
});
test('portfolio flexibility rewards a first useful stake, not duplicate shares or exhausted supply',()=>{
 const v=observation(createGame({rules:{intelMode:'mixed'}}),0);assert.equal(portfolioOptions(v,0),0);assert(portfolioOptions(v,0,0)>0);
 v.companies[0].tokens=[{owner:0}];const first=portfolioOptions(v,0);v.companies[0].tokens.push({owner:0});assert.equal(portfolioOptions(v,0),first);assert.equal(portfolioOptions(v,0,0),first);
 v.companies[0].supplyCount=0;v.poolWeights[0]=0;assert.equal(portfolioOptions(v,0),0);
});
test('Portfolio rebalance scores both directions and avoids sacrificing a majority winner for a minority stake',()=>{
 const g=race([20,5,10,10,10,10]);g.players[0].intel=[{kind:'swap'}];g.companies.forEach(c=>c.tokens=[]);g.companies[0].tokens=[{owner:0},{owner:0}];g.companies[1].tokens=[{owner:0},{owner:1},{owner:1}];
 assert(bestIntelPlay(observation(g,0),0).value<0);
 g.companies[0].tokens=[{owner:0},{owner:1},{owner:1}];g.companies[1].tokens=[{owner:0},{owner:0}];assert(bestIntelPlay(observation(g,0),0).value>0);
});
