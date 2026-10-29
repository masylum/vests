import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANIES,DECK_PROFILES,slotCards,reserveCards,growthDeck} from './legacy-config.js';
import {resolveRevealPhase} from '../src/racing.js';
import {createGame,deployReserves,assertGame} from './legacy-engine.js';
test('company slots deploy right to left, preserving finite card stocks',()=>{
 const g=createGame();const expected=[];
 for(const c of g.companies){c.reserve=3;expected.push([3,2,1].map(n=>slotCards(c,n)));}
 g.purchaseSummary=[];
 for(let step=0;step<3;step++){
  const before=g.companies.map(c=>c.purchased);deployReserves(g);
  for(const c of g.companies){assert.equal(c.purchased-before[c.id],expected[c.id][step]);assert.equal(c.reserve,2-step);}
  assertGame(g);
 }
});
test('partial final slot deploys only remaining supply and clears reserve',()=>{
 const g=createGame(),c=g.companies[0];c.reserve=3;g.removed.push(...c.supply.splice(1));g.purchaseSummary=[];
 deployReserves(g);assert.equal(c.purchased,1);assert.equal(c.reserve,0);assertGame(g);
});
test('every deck has three signatures and a finite distinct company profile',()=>{
 assert.equal(new Set(COMPANIES.map(c=>growthDeck(c.id).length)).size,5);
 for(const c of COMPANIES){const deck=growthDeck(c.id);assert.equal(deck.length,DECK_PROFILES[c.id].reduce((a,b)=>a+b,0));assert.equal(deck.filter(x=>x.signature).length,c.id===3?2:3);assert.equal(reserveCards({...c,reserve:3,founder:-1}),c.slots.reduce((a,b)=>a+b,0));}
});

test('funded slots stay fixed; Frugalism never adds cards',()=>{
 for(const c of COMPANIES)for(const founder of [-1,11,13]){
  const company={...c,founder,reserve:3,position:1};const yields=[1,2,3].map(n=>slotCards(company,n));
  assert.equal(slotCards(company,0,[company,{position:2}]),0);assert.equal(reserveCards(company),c.slots.reduce((a,b)=>a+b,0));
  assert.deepEqual(yields,c.slots);
  assert(yields.every(n=>n>=1&&n<=3));
 }
});

test('Frugalism leaves supply and paid cards untouched',()=>{
 let g;for(let seed=0;seed<100;seed++){const x=createGame({seed});if(x.companies.some(c=>c.founder===13)){g=x;break;}}
 const c=g.companies.find(c=>c.founder===13);g.purchaseSummary=[];g.companies.forEach(x=>{if(x!==c)x.down=true;});
 c.position=0;g.companies.find(x=>x.id!==c.id).position=5;
 const before=c.supply.length;deployReserves(g);resolveRevealPhase(g,'start');assert.equal(c.supply.length,before);assert.equal(c.reserve,0);assert.equal(c.purchased,0);assert.equal(g.metrics.purchased,0);assertGame(g);
 c.hiringFumble=true;g.founderUsed=[];deployReserves(g);resolveRevealPhase(g,'start');assert.equal(c.supply.length,before);
 c.hiringFumble=false;g.founderUsed=[];g.removed.push(...c.supply.splice(0));deployReserves(g);assertGame(g);
});

test('Darcy moves at zero regardless of race position',()=>{
 const g=createGame(),c=g.companies[0];c.founder=13;c.position=10;g.companies.forEach(x=>{if(x!==c){x.position=9;x.founder=-1;}});
 g.purchaseSummary=[];const n=c.supply.length;
 g.founderUsed=[];resolveRevealPhase(g,'start');assert.equal(c.supply.length,n);
 g.companies[1].position=10;g.founderUsed=[];resolveRevealPhase(g,'start');assert.equal(c.supply.length,n);
 g.companies[1].position=11;g.founderUsed=[];resolveRevealPhase(g,'start');assert.equal(c.supply.length,n);
});

test('deployment summary records actual reserve movement, including exhausted supply',()=>{
 const g=createGame();const c=g.companies[0];c.reserve=3;
 deployReserves(g);
 assert.equal(g.purchaseSummary[0].fromReserve,3);
 assert.equal(g.purchaseSummary[0].toReserve,2);
 assert.equal(g.purchaseSummary[0].count,slotCards(c,3,g.companies));
 c.reserve=3;c.supply=c.supply.slice(0,1);g.purchaseSummary=[];
 deployReserves(g);
 assert.equal(g.purchaseSummary[0].fromReserve,3);
 assert.equal(g.purchaseSummary[0].toReserve,0);
 assert.equal(g.purchaseSummary[0].count,1);
});
