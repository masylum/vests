// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,resolveCard,resolveCardBase,observation,clone,command,currentPlayer,replayGame,assertGame,quote,deployReserves} from '../docs/v96-validation/baseline-v95/legacy-engine.js';
import {resumeRace as rawResume,resolveRevealPhase as rawPhase} from '../docs/v96-validation/baseline-v95/racing.js';
const drain=g=>{while(g.phase==='phaseResult')command(g,currentPlayer(g),{type:'continue'});};
const resumeRace=(g,...args)=>{const result=rawResume(g,...args);drain(g);return result;};
const resolveRevealPhase=(g,...args)=>{const result=rawPhase(g,...args);drain(g);return result;};
import {FOUNDERS} from '../docs/v96-validation/baseline-v95/legacy-config.js';
// Isolate reactions from unrelated founders. Full-game tests check legal founder/card stock conservation.
function race(positions=[0,2,8]) {
 const g=createGame({players:3,seed:42,rules:{exitLinear:35,exitCurve:"linear"}});g.fast=true;g.priority=0;g.companies=g.companies.slice(0,positions.length);g.phase='reveal';g.queue=[];
 g.companies.forEach((c,i)=>{c.position=positions[i]??8;c.founder=-1;c.tokens=[{id:1,owner:0}];c.lastBuy=[1,0,0];c.down=false;c.revealedCycle=0;});
 g.pending=[];g.previous=null;g.revealedMarketCount=0;return g;
}
const card=(company,printed=1)=>({id:'unit',kind:'growth',company,printed,signature:false});
test('twenty distinct readable founder placards have names, powers and icons',()=>{
 assert.equal(FOUNDERS.length,20);assert.equal(new Set(FOUNDERS.map(f=>f.name)).size,20);
 assert.ok(FOUNDERS.every(f=>f.name&&f.trigger&&f.action&&f.text&&f.icon));
});
test('Hobbes advances two when another company lands, including backwards landings',()=>{
 const g=race([2,1,8]);g.companies[0].founder=0;resolveCard(g,card(1,1));assert.equal(g.companies[0].position,4);
 const h=race([2,3,8]);h.companies[0].founder=0;resolveCard(h,{...card(1,0),effect:'setback'});assert.equal(h.companies[0].position,4);
});
test('Sikaberg acts after reveal only when trailing and burns his next card',()=>{
 const g=race([1,8]);g.companies[0].founder=1;
 resolveRevealPhase(g,'start',true);assert(!g.powerChoice);
 resolveRevealPhase(g,'end',true);assert.equal(g.phase,'power');
 resumeRace(g,1,resolveCardBase);assert.equal(g.companies[0].position,3);assert(g.companies[0].down);
 resolveRevealPhase(g,'end',true);assert(!g.powerChoice);
 resolveCard(g,card(0,2));assert.equal(g.companies[0].position,3);assert(!g.companies[0].down);
 g.founderUsed=[];g.companies[0].position=9;resolveRevealPhase(g,'end',true);assert(!g.powerChoice);
});
test('Bazos swaps adjacent spaces at phase start and cannot choose distant companies',()=>{
 const g=race([4,5,8]);g.companies[0].founder=2;resolveRevealPhase(g,'start',true);
 assert.equal(g.powerChoice.options.length,2);resumeRace(g,1,resolveCardBase);
 assert.deepEqual(g.companies.map(c=>c.position),[5,4,8]);assert(!g.powerChoice);
});

test('Bates offers a stationary company a partnership only after reveals',()=>{
 const g=race([0,2,5]);g.companies[0].founder=3;g.companies[1].tokens[0].owner=1;
 resolveRevealPhase(g,'start');resolveCard(g,card(1,0));resolveCard(g,card(2,1));assert(!g.powerChoice);
 resolveRevealPhase(g,'end',true);assert.equal(g.powerChoice.player,0);assert.equal(g.powerChoice.options.length,2);
 resumeRace(g,1,resolveCardBase);assert(!g.powerChoice);assert.equal(g.companies[1].position,3);assert.equal(g.companies[0].position,1);
 const h=race([0,2]);h.companies[0].founder=3;resolveRevealPhase(h,'start');resolveCard(h,{...card(1),effect:'setback'});resolveRevealPhase(h,'end',true);assert(!h.powerChoice);
});

test('Wang uses his own growth valuation and dilution',()=>{
 const g=race([6,9,14]);g.companies[0].founder=4;g.companies[0].tokens.push({id:2,owner:1});
 assert.equal(quote(g.companies[0],g.rules,g.companies),35);
 g.companies[0].position=15;assert.equal(quote(g.companies[0],g.rules,g.companies),192);
});

test('Newman reacts to each rival fumble but is inactive after his own',()=>{
 const g=race([2,1]);g.companies[0].founder=5;resolveCard(g,{...card(1),effect:'fumble'});assert.equal(g.companies[0].position,3);resolveCard(g,{...card(0),effect:'fumble'});assert.equal(g.companies[0].position,3);g.companies[1].down=false;resolveCard(g,{...card(1),effect:'fumble'});assert.equal(g.companies[0].position,3);
});
test('Chelsea advances one once before reveal when not leading, without modifying cards',()=>{
 const g=race([2,2,9]);g.companies[0].founder=6;
 resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,3);
 resolveRevealPhase(g,'start');assert.equal(g.companies[0].position,3);
 resolveCard(g,card(0,1));assert.equal(g.companies[0].position,4);
});
test('unowned optional founders never delegate to the first player',()=>{
 const g=race([2,5]);g.companies[0].founder=9;g.companies[0].tokens=[];
 resolveCard(g,{...card(1),effect:'fumble'},{interactive:true});assert(!g.powerChoice);assert(g.companies[1].down);
});
test('only the lead shareholder controls Gage',()=>{
 const g=race([2,5]);g.companies[0].founder=9;g.companies[0].tokens=[{owner:0},{owner:1},{owner:1}];
 resolveCard(g,{...card(1),effect:'fumble'},{interactive:true});assert.equal(g.powerChoice.player,1);
});
test('Busk makes a company crossing him fumble, but not one landing on him',()=>{
 const g=race([2,1,0]);g.companies[0].founder=10;
 resolveCard(g,card(1,1));assert(!g.companies[1].down);
 resolveCard(g,card(2,3));assert(g.companies[2].down);assert.equal(g.companies[0].position,3);assert(!g.powerChoice);
});
test('Helms boosts while second or trailing',()=>{
 const g=race([2,5,6,7]);g.companies[0].founder=8;resolveCard(g,card(0,1));assert.equal(g.companies[0].position,4);g.companies[0].position=6;resolveCard(g,card(0,1));assert.equal(g.companies[0].position,8);
});

test('Cage repairs once in the reveal phase and consumes two supply cards',()=>{
 const g=race([1,1,8]);g.companies[0].founder=9;const supply=g.companies[0].supply.length,pile=g.pile.length;
 resolveCard(g,{...card(1),effect:'fumble'});assert(!g.companies[1].down);assert.equal(g.companies[0].supply.length,supply-2);
 resolveCard(g,{...card(1),effect:'fumble'});assert(g.companies[1].down);assert.equal(g.companies[0].supply.length,supply-2);assert.equal(g.pile.length,pile+2);
});

test('Jerry has no passive race movement',()=>{
 const g=race([2,2]);g.companies[0].founder=7;resolveCard(g,card(1,2));
 assert.equal(g.companies[0].position,2);assert(!g.companies[1].down);
 resolveRevealPhase(g,'end');assert.equal(g.companies[0].position,2);
});
test('Bahnhof moves extra when he lands on an occupied space',()=>{
 const g=race([2,4]);g.companies[0].founder=12;resolveCard(g,card(0,2));assert.equal(g.companies[0].position,5);
});
test('Saltman replaces fumbles with two but setbacks still move backward',()=>{
 const g=race([2]);g.companies[0].founder=11;for(const effect of ['fumble','setback','fumble','setback'])resolveCard(g,{...card(0),effect});assert(!g.companies[0].down);assert.equal(g.companies[0].position,4);
});

test('invalid pre-reveal choices do not mutate state',()=>{
 const g=race([9,10,10]);g.companies[0].founder=1;resolveRevealPhase(g,'end',true);
 const before=clone(g);assert.throws(()=>command(g,currentPlayer(g),{type:'power',choice:-1}));assert.deepEqual(g,before);
});

test('Sikaberg can accelerate without a numbered card, only once per phase',()=>{
 const g=race([1,4]);g.companies[0].founder=1;resolveRevealPhase(g,'end',true);assert(g.powerChoice);
 resumeRace(g,1,resolveCardBase);assert.equal(g.companies[0].position,3);assert(g.companies[0].down);
 resolveRevealPhase(g,'end',true);assert(!g.powerChoice);
});

test('hiring Darcy preserves an existing fumble while preserving founder stocks',()=>{
 let g;
 for(let seed=0;seed<100;seed++){const candidate=createGame({seed});if(candidate.founderMarket.includes(13)){g=candidate;break;}}
 assert(g);g.phase='founder';g.company=0;g.founderQueue=[0];g.queue=[0];g.active=0;g.companies[0].down=true;
 command(g,0,{type:'founder',choice:g.founderMarket.indexOf(13)});
 assert.equal(g.companies[0].founder,13);assert.equal(g.companies[0].down,true);assert(!g.companies[0].hiringFumble);assertGame(g);
});

test('Bahnhof does not follow departing companies',()=>{
 const g=race([2,2]);g.companies[0].founder=12;resolveCard(g,card(1,1));assert.equal(g.companies[0].position,2);
});

test('Bahnhof chains across consecutive occupied spaces',()=>{const g=race([2,4,5,6]);g.companies[0].founder=12;resolveCard(g,card(0,2));assert.equal(g.companies[0].position,7);});

test('Saltman can be swapped backward by another founder',()=>{
 const g=race([4,5]);g.companies[0].founder=2;g.companies[1].founder=11;resolveRevealPhase(g,'start',true);resumeRace(g,1,resolveCardBase);assert.deepEqual(g.companies.map(c=>c.position),[5,4]);
});

test('Busk catches a company passing from his shared space',()=>{
 const g=race([2,2]);g.companies[0].founder=10;resolveCard(g,card(1,1));assert(g.companies[1].down);
});
test('Bates may help only one stationary company per phase',()=>{
 const g=race([0,2,3]);g.companies[0].founder=3;resolveRevealPhase(g,'start');resolveRevealPhase(g,'end',true);
 assert.equal(g.powerChoice.options.length,3);resumeRace(g,1,resolveCardBase);
 assert.deepEqual(g.companies.map(c=>c.position),[1,3,3]);resolveRevealPhase(g,'end',true);assert(!g.powerChoice);
});

test('Bazos includes distance three but excludes distance four',()=>{const g=race([4,7,8]);g.companies[0].founder=2;resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.options.length,2);resumeRace(g,1,resolveCardBase);assert.deepEqual(g.companies.map(c=>c.position),[7,4,8]);});

test('Frugalism does not retain Saltman’s hazard immunity',()=>{
 const g=race([4]);g.companies[0].founder=13;
 resolveCard(g,{...card(0),effect:'setback'});assert.equal(g.companies[0].position,3);
 resolveCard(g,{...card(0),effect:'fumble'});assert(g.companies[0].down);assert.equal(g.companies[0].position,3);
});

test('Hobbes can advance from the lead and still triggers only once per round',()=>{
 const g=race([5,4,4]);g.companies[0].founder=0;resolveCard(g,card(1,1));assert.equal(g.companies[0].position,7);
 resolveCard(g,card(2,2));assert.equal(g.companies[0].position,7);
});
test('Gage can recover a rival with exhausted supply without inventing a card',()=>{
 const g=race([1,1]);g.companies[0].founder=9;g.companies[0].supply=[];const n=g.pile.length;
 resolveCard(g,{...card(1),effect:'fumble'},{interactive:true});resumeRace(g,1,resolveCardBase);
 assert(!g.companies[1].down);assert.equal(g.pile.length,n);assert.equal(g.companies[0].position,1);
});


test('Cage with one supply card adds only that card',()=>{
 const g=race([1,1]);g.companies[0].founder=9;
 g.companies[0].supply=g.companies[0].supply.slice(0,1);
 const n=g.pile.length;
 resolveCard(g,{...card(1),effect:'fumble'});
 assert.equal(g.companies[0].supply.length,0);
 assert.equal(g.pile.length,n+1);
 assert(!g.companies[1].down);
});

test('Saltman can be swapped backward by a signature',()=>{
 const g=race([4,6]);g.companies[1].founder=11;resolveCard(g,{...card(0,1),signature:'swap'});assert.deepEqual(g.companies.map(c=>c.position),[6,5]);
});


test('Max triggers on separate landings without a round limit',()=>{
 const g=race([2,4,7]);g.companies[0].founder=12;resolveCard(g,card(0,2));assert.equal(g.companies[0].position,5);resolveCard(g,card(0,2));assert.equal(g.companies[0].position,8);
});
test('Max no longer shares another company fumble',()=>{
 const g=race([2,2]);g.companies[0].founder=12;resolveCard(g,{...card(1),effect:'fumble'});assert(!g.companies[0].down);assert(g.companies[1].down);
});
test('Max extra moves stop at the end of the track',()=>{
 const g=race([23,24]);g.companies[0].founder=12;resolveCard(g,card(0,1));assert.equal(g.companies[0].position,24);
});
test('Sikaberg cannot act while fumbled',()=>{
 const g=race([2,8]);g.companies[0].founder=1;g.companies[0].down=true;resolveRevealPhase(g,'end',true);assert(!g.powerChoice);assert.equal(g.companies[0].position,2);
});
