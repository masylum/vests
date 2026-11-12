import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame} from '../src/engine.js';
import {DECK_PROFILES} from '../src/config.js';
import {INTEL_CARDS} from '../src/intel.js';
import {cardBudget,founderBudget,budgetStats,REFERENCE_DEFAULTS,expectedTokenMovement,revealChance} from '../src/balance.js';

test('all recovery-adjusted sets exceed 24 expected movement',()=>{for(const p of DECK_PROFILES)assert.ok(expectedTokenMovement(p)>24);});
test('unrevealed bag tokens persist after the last draw for every player count',()=>{
 for(const players of [2,3,4]){
  const g=createGame({players,rules:{burnPerRound:0}});g.companies.forEach(c=>c.hiringFumble=true);
  assert.equal(g.rules.burnPerRound,0);const before=g.pile.length,drawn=g.pile[0].id;
  g.phase='reveal';g.queue=[];g.active=g.first;g.drawsLeft=1;
  command(g,currentPlayer(g),{type:'reveal'});
  assert.equal(g.pile.length,before-1);assert.ok(!g.pile.some(t=>t.id===drawn));
  assert.equal(g.removed.filter(t=>t.burned).length,0);assert.ok(!g.log.some(e=>e.type==='burn'));assertGame(g);
 }
});
test('every card has a finite decomposed budget, gross average and net action cost',()=>{
 const values=[];for(const kind of Object.keys(INTEL_CARDS)){
  const b=cardBudget(kind);assert.ok(Number.isFinite(b.gross),kind);assert.equal(b.gross,Object.values(b.parts).reduce((s,x)=>s+x,0));assert.ok(Math.abs(b.net-(b.gross-REFERENCE_DEFAULTS.actionOption))<1e-12);values.push(b.gross);
 }
 assert.equal(values.length,30);const s=budgetStats(values);assert.ok(s.min<=s.median&&s.median<=s.max);assert.ok(Math.abs(s.mean-values.reduce((s,x)=>s+x,0)/30)<1e-12);
});
test('deploying, returning to supply, and returning to bag have distinct positive values',()=>{
 const matching=cardBudget('matching'),advisor=cardBudget('advisor'),inside=cardBudget('inside');
 assert.ok(matching.parts.deployment>0);assert.ok(advisor.parts.returnedToSupply>0);assert.ok(inside.parts.returnedToBag>0);
 assert.ok(cardBudget('advisor',{supplyChance:0}).gross<advisor.gross);
 assert.ok(cardBudget('matching',{revealChance:1}).gross>matching.gross);
});
test('Financing and Matching include their new costs; Weekend buys one net action',()=>{
 const token=REFERENCE_DEFAULTS.revealChance*REFERENCE_DEFAULTS.tokenMovement;
 assert.ok(Math.abs(cardBudget('financing').gross-cardBudget('matching').gross-(2-token-7/3))<1e-12);
 assert.ok(Math.abs(cardBudget('weekend').net-(REFERENCE_DEFAULTS.actionOption))<1e-12);
});
test('share packages account for dilution and last-stake option costs',()=>{
 const r={...REFERENCE_DEFAULTS},b=cardBudget('sweat',r),post=(r.ownShares+1)/(r.issuedShares+1);
 assert.ok(Math.abs(b.parts.share-(post-r.ownShares/r.issuedShares)*r.expectedExit*r.payChance/r.coinsPerPoint)<1e-12);
 assert.equal(cardBudget('consolidation',{ownShares:1}).parts.access,-r.retainedAccess);
 assert.ok(Math.abs(cardBudget('consolidation',r).parts.share-((r.ownShares-1)/(r.issuedShares-1)-r.ownShares/r.issuedShares)*r.expectedExit*r.payChance/r.coinsPerPoint)<1e-12);
 assert.ok(cardBudget('stake',{price:6}).gross>cardBudget('stake',{price:18}).gross);
});
test('every active founder has numeric opportunity-weighted value',()=>{
 for(const id of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26]){const b=founderBudget(id);assert.ok(Number.isFinite(b.total));assert.ok(Math.abs(b.total-b.uses*b.perUse)<1e-12);}
 assert.ok(Math.abs(revealChance({bag:20,draws:6,rounds:3})-.9)<1e-12);
 assert.ok(Math.abs(revealChance({bag:20,draws:6,rounds:4})-1)<1e-12);
});

test('Rights Issue all-pass outcomes force a proposer purchase',()=>{const b=cardBudget('rights',{selfWin:0,otherWin:0});assert.equal(b.parts.payment,-REFERENCE_DEFAULTS.fundPrice/REFERENCE_DEFAULTS.coinsPerPoint);assert.ok(b.parts.deployment>0);assert.ok(Math.abs(cardBudget('tender',{selfWin:0,otherWin:0}).parts.payment)<1e-12);});
