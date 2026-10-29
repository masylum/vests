import test from 'node:test';import assert from 'node:assert/strict';
import {createGame} from '../src/engine.js';import {minimumBid,fundingPrices,fundingBand,growthDeck} from '../src/config.js';import {resolveRevealPhase} from '../src/racing.js';
function race(positions){const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.companies=g.companies.slice(0,positions.length);g.companies.forEach((c,i)=>{c.position=positions[i];c.founder=-1;c.reserve=0;c.down=false;c.hiringFumble=false;});return g;}
test('Zack moves one before reveal regardless of treasury and position',()=>{
 for(const positions of [[5,6,3],[5,5,6],[5,5,5],[6,5,5]])for(const reserve of [0,1])for(const down of [false,true]){
 const g=race(positions),c=g.companies[0];c.founder=13;c.reserve=reserve;c.down=down;const expected=positions[0]+Number(!down);
 resolveRevealPhase(g,'start');assert.equal(c.position,expected);resolveRevealPhase(g,'start');assert.equal(c.position,expected);
 }
});
test('Mura has the ordinary company funding minimum in every band even when ready',()=>{
 for(const position of [1,8,9,16,17,24])for(const down of [false,true])assert.equal(minimumBid({position,founder:14,down}),fundingPrices(fundingBand(position))[0]);
});
test('Amazin keeps three cash conversion signatures in its expanded supply',()=>{
 const deck=growthDeck(1);assert.equal(deck.length,21);assert.equal(deck.filter(c=>c.signature==='swapCard').length,3);assert.equal(deck.filter(c=>c.printed===2&&!c.signature).length,0);assert.equal(deck.filter(c=>c.printed===1).length,15);assert.equal(deck.filter(c=>!c.effect).reduce((s,c)=>s+c.printed,0),21);
});
