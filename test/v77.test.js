import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,observation,lead} from '../src/engine.js';
import {RULES,companyValue,sharePayout,growthDeck,DECK_PROFILES} from '../src/config.js';
import {RULES as oldRules,companyValue as oldValue,sharePayout as oldPayout,growthDeck as oldDeck} from '../docs/v77-health/baselines/v76/config.js';
import {intelDeck,intelTargets} from '../src/intel.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function fixture(kind){const g=createGame({seed:123,rules:{intelMode:'mixed'}}),id=currentPlayer(g);for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));const i=g.intelDeck.findIndex(c=>c.kind===kind);g.players[id].intel.push(...g.intelDeck.splice(i,1));const c=g.companies[0];c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;act(g,{type:'call',company:null});return{g,id,c};}
test('monetary defaults halve, odd funding thresholds round up, and all money is whole dollars',()=>{
 for(const key of ['startingCash','wangExit','moneyScale','muraMinimum','purchaseStep','defaultFee','exitScale','purchaseBase','exitLinear','ipoValue'])assert.equal(RULES[key],oldRules[key]/2,key);
 assert.deepEqual(RULES.projectPrices,[[1,4,7],[3,6,9],[5,8,11]]);
 for(let space=0;space<=24;space++){assert.equal(companyValue(space),oldValue(space)/2);for(let shares=1;shares<=5;shares++)assert.equal(sharePayout(companyValue(space),shares),oldPayout(oldValue(space),shares)/2);}
 assert.equal(RULES.currencyUnit,1);assert.equal(RULES.burnPerRound,3);
});
test('growth decks retain three signatures, fumbles and only nonnegative movement',()=>{
 for(let cid=0;cid<8;cid++){const deck=growthDeck(cid);assert.equal(deck.filter(c=>c.signature).length,cid===3?2:3);assert(!deck.some(c=>c.effect==='setback'));assert.equal(deck.filter(c=>!c.effect&&c.printed===0).length,DECK_PROFILES[cid][0]);assert.equal(DECK_PROFILES[cid][4],[1,0,3,2,2,2,1,1][cid]);}
});
test('14 unique cards include Secondary Market and Sell position',()=>{const cards=intelDeck();assert.equal(cards.length,14);assert.equal(new Set(cards.map(c=>c.kind)).size,14);assert(cards.some(c=>c.kind==='secondary'));assert(cards.some(c=>c.kind==='sell'));});
test('Secondary Market spends exactly one treasury, issues an acting-investor share and respects control and share limit',()=>{
 const {g,c,id}=fixture('secondary');c.reserve=2;const cash=g.players[id].cash;assert(intelTargets(g,id,'secondary').includes(0));assert(intelTargets(observation(g,id),id,'secondary').includes(0));
 act(g,{type:'playIntel',card:0,company:0});assert.equal(c.reserve,1);assert.equal(c.tokens.length,2);assert.equal(c.tokens[1].owner,id);assert.equal(c.tokens[1].paid,0);assert.equal(g.players[id].cash,cash-5);assert.equal(lead(c),id);assertGame(g);
 const {g:h,c:d,id:j}=fixture('secondary');d.reserve=0;assert(!intelTargets(h,j,'secondary').includes(0));d.reserve=3;d.tokens.push({id:2,owner:(j+1)%4},{id:3,owner:(j+1)%4});assert(intelTargets(h,j,'secondary').includes(0));
 const {g:k,c:e,id:l}=fixture('secondary');e.reserve=3;while(e.tokens.length<5)e.tokens.push({id:e.tokens.length+1,owner:l});assert(!intelTargets(k,l,'secondary').includes(0));
});
test('Sell position pays by game leg, retires only one owned share, updates control and conserves cash',()=>{
 for(const leg of [0,1,2]){const {g,c,id}=fixture('sell'),rival=(id+1)%4;g.leg=leg;c.position=1;c.tokens.push({id:2,owner:rival},{id:3,owner:rival});c.lastBuy[rival]=2;const cash=g.players[id].cash;
 act(g,{type:'playIntel',card:0,company:0});assert.equal(g.players[id].cash,cash+[6,12,18][leg]);assert.equal(c.tokens.length,2);assert(c.tokens.every(t=>t.owner===rival));assert.deepEqual(c.tokens.map(t=>t.id),[1,2]);assert.equal(c.lastBuy[id],0);assert.equal(lead(c),rival);assertGame(g);}
});

test('Bridge and Portfolio conflict use whole-dollar amounts after rescaling',()=>{
 const {g,c,id}=fixture('bridge');c.reserve=0;act(g,{type:'playIntel',card:0,company:0});assert.equal(g.players[id].cash,47);assert.equal(g.bank.burn,3);assertGame(g);
 const {g:h,c:d,id:j}=fixture('conflict');d.position=5;act(h,{type:'playIntel',card:0,company:0});assert.equal(h.players[j].cash,55);assert.equal(d.position,3);assertGame(h);
});
test('only whole-dollar bids and open raises are legal; fractional bids leave state unchanged',()=>{
 const g=createGame(),id=currentPlayer(g);g.companies[0].tokens=[{owner:id,id:1}];g.companies[0].lastBuy[id]=1;act(g,{type:'call',company:0});const before=structuredClone(g);assert.throws(()=>act(g,{type:'bid',amount:2.5}));assert.deepEqual(g,before);
 while(g.phase==='bid')act(g,{type:'bid',amount:currentPlayer(g)===id?0:3});assert.equal(g.phase,'tie');act(g,{type:'tie',amount:4});assert.equal(g.auction.price,4);assertGame(g);
});
