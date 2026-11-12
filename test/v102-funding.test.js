import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame} from '../src/engine.js';
import {availableCash,minimumBid} from '../src/config.js';

test('a one-dollar fundraise is legal in every leg',()=>{
 for(const position of [1,9,17,24]){
  const g=createGame({players:2,seed:102}),id=currentPlayer(g);
  g.companies[0].position=position;
  assert.equal(minimumBid(g.companies[0],g.rules),1);
  command(g,id,{type:'call',company:0});
  while(g.phase==='bid'){const bidder=currentPlayer(g);command(g,bidder,{type:'bid',amount:bidder===id?1:0});}
  assert.equal(g.auction.paid,1);assert.equal(g.auction.cards,1);assertGame(g);
 }
});
test('winning a second-price fundraise leaves all unpaid money spendable',()=>{
 const g=createGame({players:2,seed:102}),id=currentPlayer(g);
 command(g,id,{type:'call',company:0});
 while(g.phase==='bid'){const bidder=currentPlayer(g);command(g,bidder,{type:'bid',amount:bidder===id?20:1});}
 assert.equal(g.auction.paid,1);assert.equal(g.players[id].cash,19);assert.equal(availableCash(g.players[id]),19);assert.equal(g.players[id].locked,0);
 command(g,id,{type:'continue'});
 command(g,id,{type:'call',company:1});
 while(g.phase==='bid'){const bidder=currentPlayer(g);command(g,bidder,{type:'bid',amount:bidder===id?19:0});}
 assert.equal(g.auction.paid,19);assert.equal(g.players[id].cash,0);assertGame(g);
});
