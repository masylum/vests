// Historical v96 rule expectations.
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,resolveCard} from './reference-v96/engine.js';
import {growthDeck,podium,RULES} from './reference-v96/config.js';
import {saleValue} from './reference-v96/bots.js';
const act=(g,c)=>command(g,currentPlayer(g),c);
test('three to five investors only',()=>{for(const players of [3,4,5])assert.equal(createGame({players}).players.length,players);assert.throws(()=>createGame({players:6}),/3–5/);});
test('decks vary from 16 to 21, with distinct blank growth counts and three signatures',()=>{const decks=Array.from({length:7},(_,i)=>growthDeck(i));assert.equal(Math.min(...decks.map(x=>x.length)),16);assert.equal(Math.max(...decks.map(x=>x.length)),21);for(const d of decks){assert.equal(d.filter(c=>!c.effect&&c.printed===0).length,[0,3,0,0,0,0,2][decks.indexOf(d)]);assert.equal(d.filter(c=>c.signature).length,decks.indexOf(d)===3?2:3);}});
test('Amazin has more runway and Testra overtakes the nearest company within two spaces',()=>{assert.equal(growthDeck(1).length,21);assert.equal(growthDeck(4).length,18);const g=createGame();g.fast=true;g.companies.forEach(c=>{c.founder=-1;c.position=15;});g.companies[4].position=5;g.companies[0].position=9;resolveCard(g,{kind:'growth',id:'test',company:4,printed:2,signature:'swap'});assert.equal(g.companies[4].position,9);assert.equal(g.companies[0].position,7);});
test('normal hiring preserves existing fumble status and never adds one',()=>{for(const down of [false,true]){const g=createGame(),id=currentPlayer(g),c=g.companies[0];c.tokens=[{owner:id,id:1}];c.lastBuy[id]=1;c.down=down;act(g,{type:'changeFounder',company:0});act(g,{type:'founder',choice:0});assert.equal(c.down,down);assert(!c.hiringFumble);assertGame(g);}});

test('Sell position pays 6/12/18; bots preserve valuable stakes and sell forecast losers',()=>{assert.deepEqual(RULES.sellPayouts,[6,12,18]);const g=createGame(),id=currentPlayer(g),c=g.companies[0];c.tokens=[{owner:id,id:1}];c.lastBuy[id]=1;const values=g.companies.map(()=>({finalPrices:[30,30]}));assert(saleValue(g,id,0,values)<0);values[0].finalPrices=[0,0];assert(saleValue(g,id,0,values)>0);});
