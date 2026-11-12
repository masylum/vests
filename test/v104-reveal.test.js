import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer} from '../src/engine.js';

test('a fumbled company discards one revealed token to recover, with no replacement draw',()=>{
 const g=createGame({players:2,seed:42});
 // Isolate recovery from optional founder reactions.
 g.companies.forEach(c=>{c.founder=13;});
 const c=g.companies[0];c.down=true;c.hiringFumble=true;
 const first=c.supply.findIndex(t=>!t.effect),token=c.supply.splice(first,1)[0];
 g.pile.unshift(token);g.phase='reveal';g.drawsLeft=6;g.revealEnded=false;
 const n=g.pile.length,pos=c.position,removed=g.removed.length;
 command(g,currentPlayer(g),{type:'reveal'});
 assert.equal(c.down,false);assert.equal(c.hiringFumble,false);assert.equal(c.position,pos);
 assert.equal(g.drawsLeft,5);assert.equal(g.pile.length,n-1);assert.equal(g.removed.length,removed+1);
 assert.equal(g.lastRevealed.type,'deferred');assert.equal(g.lastRevealed.card.id,token.id);
});
