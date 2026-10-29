import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,currentPlayer,command,assertGame,clone,replayGame} from '../src/engine.js';
import {growthDeck,DECK_PROFILES,RULES,SPECIALS} from '../src/config.js';
import {botCommand} from '../src/bots.js';
test('company supplies and printed distributions exactly match their identities',()=>{
 const expected=[[0,12,7,0,1],[3,15,3,0,0],[0,5,11,0,3],[0,3,11,0,2],[0,5,11,0,2],[0,7,10,0,2]];
 for(let cid=0;cid<6;cid++){const d=growthDeck(cid);assert.deepEqual(DECK_PROFILES[cid].slice(0,5),expected[cid]);assert.equal(d.length,[20,21,19,16,18,19][cid]);assert.equal(d.filter(c=>c.signature).length,cid===3?2:3);for(let n=0;n<4;n++)assert.equal(d.filter(c=>!c.effect&&c.printed===n).length,expected[cid][n]);assert.equal(d.filter(c=>c.effect==='fumble').length,expected[cid][4]);}
 assert.deepEqual(SPECIALS.map(s=>s[0]),['Ad revenue','Reinvest profits','Pivot','Supply chain','Overtake','Research']);
});


test('a cash-poor bot can borrow for useful equity, but cash-rich bots do not',()=>{
 const g=createGame(),id=currentPlayer(g);g.players.forEach(p=>p.cash=0);g.companies.forEach(c=>{c.founder=-1;c.position=1;});g.companies[0].position=19;
 assert.equal(botCommand(g,id,{samples:4}).type,'raiseMoney');
 g.players[id].cash=50;assert.notEqual(botCommand(g,id,{samples:4}).type,'raiseMoney');
 g.players[id].cash=0;g.ipoCompany=0;assert.equal(botCommand(g,id,{samples:4}).type,'raiseMoney');
});
