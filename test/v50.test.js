// Historical rule expectations run against the preserved v95 engine; current changes are tested in v96.test.js.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,quote,resolveCardBase,assertGame} from '../docs/v96-validation/baseline-v95/engine.js';
import {RULES,companyValue,fundingPrices,minimumBid,growthDeck} from '../docs/v96-validation/baseline-v95/config.js';
import {resolveRevealPhase} from '../docs/v96-validation/baseline-v95/racing.js';
function race(positions){const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.companies.forEach((c,i)=>{c.position=positions[i];c.founder=-1;});return g;}
test('v50 uses scaled money, higher later funding thresholds, and preserves rounded exit ratios',()=>{
 const g=createGame();assert(g.players.every(p=>p.cash===50&&p.obligation===60));
 assert.deepEqual([0,1,2].map(b=>fundingPrices(b)),[[1,4,7],[3,6,9],[5,8,11]]);
 for(let n=1;n<=24;n++){const old=Math.round(50*(Math.max(0,n-8)/16)**2);assert.equal(companyValue(n),old*2);for(let shares=1;shares<=5;shares++){const c={position:n,tokens:Array.from({length:shares},()=>({owner:0})),founder:-1};assert.equal(quote(c),Math.floor(old*2/shares));}}
 assert.equal(minimumBid({position:1,founder:14}),1);
 const c=g.companies[3];g.companies.forEach((x,i)=>x.position=20-i);c.founder=4;c.tokens=[{owner:0}];assert.equal(quote(c,RULES,g.companies),75);
});
test('hiring costs the turn and preserves ready and already-fumbled companies',()=>{
 for(const down of [false,true]){const g=createGame();const id=currentPlayer(g),c=g.companies[0];c.tokens=[{id:1,owner:id,paid:0,boughtLeg:0}];c.lastBuy[id]=1;c.down=down;
 command(g,id,{type:'changeFounder',company:0});const founder=g.founderMarket[0];command(g,id,{type:'founder',choice:0});assert.equal(c.founder,founder);assert.equal(c.down,down);assert(!c.hiringFumble);assert.notEqual(g.phase,'founder');assertGame(g);}
});
test('catch-up advances last place without creating shares or cards',()=>{
 const g=race([10,9,8,7,4,2]),stocks=g.companies.map(c=>[c.supply.length,c.tokens.length,c.reserve]);resolveRevealPhase(g,'catchUp');assert.deepEqual(g.companies.map(c=>c.position),[10,9,8,7,4,3]);assert.deepEqual(g.companies.map(c=>[c.supply.length,c.tokens.length,c.reserve]),stocks);assert.equal(g.lastRevealed.reactions.filter(r=>r.catchUp).length,1);
});
test('tied last gets one each, never stacked; fumbled companies still catch up',()=>{
 const g=race([10,9,8,7,2,2]);g.companies[4].down=true;resolveRevealPhase(g,'catchUp');assert.deepEqual(g.companies.map(c=>c.position),[10,9,8,7,3,3]);assert(g.companies[4].down);
});
test('catch-up triggers landing powers and finishes all grouped movement at IPO',()=>{
 const g=race([10,9,8,7,3,2]);g.companies[5].founder=12;resolveRevealPhase(g,'catchUp');assert.equal(g.companies[5].position,4);
 const h=race([23,23,23,23,23,23]);resolveRevealPhase(h,'catchUp');assert.equal(h.ipoCompany,0);assert.deepEqual(h.companies.map(c=>c.position),[24,24,24,24,24,24]);
});
test('Supply stays finite below original stock, with all three signatures',()=>{
 const old=[24,26,24,22,26,24,23,25];for(let i=0;i<8;i++){const deck=growthDeck(i);assert(deck.length<old[i]&&deck.length>=16);assert.equal(deck.filter(c=>c.signature).length,i===3?2:3);assert.equal(new Set(deck.map(c=>c.id)).size,deck.length);}
});
test('end-of-reveal catch-up IPO enters settlement with no extra draw',()=>{
 const g=race([23,23,23,23,23,23]);g.drawsLeft=1;g.pile=[{id:'unit',kind:'growth',company:0,printed:0}];command(g,currentPlayer(g),{type:'reveal'});assert.equal(g.phase,'afterRevealReady');command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'catchUpReady');assert.equal(g.ipoCompany,undefined);command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'catchUpResult');assert(g.lastRevealed);command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'settle');assert.equal(g.companies.filter(c=>c.position===24).length,6);
});
