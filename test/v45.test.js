// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,resolveCard,resolveCardBase,command,currentPlayer,deployReserves,assertGame,observation} from '../docs/v96-validation/baseline-v95/legacy-engine.js';
import {resolveRevealPhase,resumeRace} from '../docs/v96-validation/baseline-v95/racing.js';
import {slotCards,minimumBid} from '../docs/v96-validation/baseline-v95/legacy-config.js';
const card=(company,printed)=>({id:'unit',company,kind:'growth',printed});
function race(positions){const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.priority=0;g.companies=g.companies.slice(0,positions.length);g.companies.forEach((c,i)=>{c.founder=-1;c.position=positions[i];c.reserve=0;c.tokens=[{owner:i%4}];c.lastBuy=[1,1,1,1];});return g;}
test('Mura adds one before reveal, independently of funded treasury slots',()=>{
 const g=createGame(),c=g.companies[0],old=c.founder;
 const other=g.companies.find(x=>x.founder===14);if(other)other.founder=old;else{const pool=g.founderMarket.includes(14)?g.founderMarket:g.founderSupply;pool[pool.indexOf(14)]=old;}c.founder=14;
 assert.equal(minimumBid(c),1);assert.deepEqual([0,1,2,3].map(n=>slotCards(c,n)),[0,2,1,2]);
 command(g,currentPlayer(g),{type:'call',company:0});assert.equal(g.auction.reserve,1);
 assert.throws(()=>command(g,currentPlayer(g),{type:'bid',amount:.5}));
 while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===g.auction.host?6:0});
 assert.equal(c.reserve,3);const n=c.supply.length;g.purchaseSummary=[];deployReserves(g);assert.equal(c.supply.length,n-2);assertGame(g);
 const before=c.supply.length;resolveRevealPhase(g,'start');assert.equal(c.supply.length,before-1);resolveRevealPhase(g,'start');assert.equal(c.supply.length,before-1);assertGame(g);
 c.down=true;assert.equal(minimumBid(c),1);assert.equal(slotCards(c,3),2);
});
test('Spatial Intelligence pulls from either side, excluding shared and distant spaces',()=>{
 const g=race([5,2,8,5,9]);g.companies[0].founder=15;resolveRevealPhase(g,'start',true);
 assert.equal(g.powerChoice.options.length,3);resumeRace(g,1,resolveCardBase);assert.equal(g.companies[1].position,5);
 const h=race([5,7]);h.companies[0].founder=15;resolveRevealPhase(h,'start',true);resumeRace(h,1,resolveCardBase);assert.equal(h.companies[1].position,5);
});

test('Melania does not follow neighboring movement',()=>{
 const g=race([5,5,8]);g.companies[0].founder=17;resolveCard(g,card(1,2));assert.equal(g.companies[0].position,5);
 resolveCard(g,{...card(1,0),effect:'setback'});assert.equal(g.companies[0].position,5);
 g.companies[2].position=6;resolveCard(g,card(1,2));assert.equal(g.companies[0].position,5);
});
test('Max chain resolves without moving neighboring Melania',()=>{
 const g=race([3,3,5]);g.companies[0].founder=17;g.companies[1].founder=12;resolveCard(g,card(1,2));assert.equal(g.companies[1].position,6);assert.equal(g.companies[0].position,3);
});
test('Merchant Network transfers a slot to nonempty reserves and moves two without adding cards',()=>{
 const g=race([2,4,8]);g.companies[0].founder=18;g.companies[0].reserve=2;g.companies[1].reserve=1;g.companies[2].reserve=3;const n=g.pile.length;
 resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.options.length,2);resumeRace(g,1,resolveCardBase);assert.deepEqual(g.companies.map(c=>c.reserve),[1,2,3]);assert.equal(g.pile.length,n);assert.equal(g.companies[0].position,4);
});
test('First Move stops at nearest occupied space and fumbles without adding cards',()=>{
 const g=race([2,5,5,8]);g.companies[0].founder=19;const n=g.pile.length;resolveRevealPhase(g,'start',true);resumeRace(g,1,resolveCardBase);
 assert.equal(g.companies[0].position,5);assert(g.companies[0].down);assert(!g.powerChoice);assert.equal(g.pile.length,n);
});
test('new founders cannot activate while fumbled, and edge cases do nothing',()=>{
 for(let f=14;f<20;f++){const g=race([2,2,4]);g.companies[0].founder=f;g.companies[0].down=true;g.companies[0].reserve=1;const n=g.pile.length;resolveRevealPhase(g,'start',true);resolveRevealPhase(g,'end',true);assert(!g.powerChoice);assert.equal(g.pile.length,n);resolveCard(g,card(1,1));assert.equal(g.companies[0].position,2);}
 for(const f of [18,19]){const g=race([10,5]);g.companies[0].founder=f;resolveRevealPhase(g,'start',true);assert(!g.powerChoice);}
});
test('Brittney pass reports no action and leaves her ready on the same space',()=>{
 const g=race([2,3,5]);g.companies[0].founder=19;
 resolveRevealPhase(g,'start',true);const result=resumeRace(g,0,resolveCardBase)??g.lastRevealed;
 assert.equal(g.companies[0].position,2);assert.equal(g.companies[0].down,false);
 assert.deepEqual(result.reactions.map(r=>r.text),['Passed — power not used.']);
});
