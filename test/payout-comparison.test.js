import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiceGame,diceObservation} from '../src/live-dice-engine.js';
import {diceSharePrice,trackExitPrice} from '../src/live-dice-rules.js';
import {roughPrice} from '../src/dice-planner.js';
import {auctionBudget,projectedScores} from '../src/live-dice-bots.js';
import {simulateLiveDice} from '../scripts/live-dice-simulate.js';
test('per-share payouts do not dilute; total-company payouts do',()=>{
 for(const payoutMode of ['dilution','perShare']){const g=createDiceGame({payoutMode,perShareMax:24,exitCurve:'late'}),c=g.companies[0];c.position=24;c.founder=22;c.tokens=[{owner:0},{owner:1}];assert.equal(diceSharePrice(g,c),payoutMode==='perShare'?24:50);c.tokens.push({owner:1},{owner:1});assert.equal(diceSharePrice(g,c),payoutMode==='perShare'?24:25);assert.equal(trackExitPrice(g,24),payoutMode==='perShare'?24:100);}
});
test('bid, portfolio and terminal valuations respect the payout mode',()=>{
 for(const payoutMode of ['dilution','perShare']){const g=createDiceGame({payoutMode,perShareMax:24,exitCurve:'late'}),c=g.companies[0];g.round=6;c.position=22;c.founder=22;c.tokens=[{owner:0},{owner:1}];const before=roughPrice(g,0,0);c.tokens.push({owner:1},{owner:1},{owner:1});const after=roughPrice(g,0,0);assert.ok(payoutMode==='perShare'?before===after:after<before);assert.equal(auctionBudget(diceObservation(g,0),0,0),Math.min(g.players[0].cash,after));c.position=24;const scores=projectedScores(g);assert.ok(Number.isFinite(scores[0]));}
});
test('both modes settle actual shares and reproduce complete games',()=>{
 for(const payoutMode of ['dilution','perShare']){const g=simulateLiveDice({players:2,seed:5101,payoutMode,trace:true});assert.ok(g.ended);for(const a of g.accounts){const payout=a.companies.reduce((s,c)=>s+c.shares*c.price,0);assert.equal(a.payout,payout);assert.equal(g.scores[a.player],a.cash+payout-a.capitalCalled);}assert.equal(g.replay.setup.payoutMode,payoutMode);}
});
