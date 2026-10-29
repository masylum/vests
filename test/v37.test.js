import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,observation} from './legacy-engine.js';
import {opponentBids} from '../src/adaptive.js';
function auction(owned=true,hiring=false){
 const g=createGame({seed:72});g.phase='call';g.first=0;g.active=0;g.queue=[0];
 const c=g.companies[0];c.founder=7;c.reserve=0;c.hiringFumble=hiring;
 c.tokens=owned?[{owner:0}]:[];c.lastBuy=[1,0,0,0];
 command(g,0,{type:'call',company:0});return g;
}
test('Jerry uses ordinary sealed bidding without visibility privileges',()=>{
 const g=auction();assert.deepEqual(g.queue,[0,1,2,3]);command(g,0,{type:'bid',amount:7});
 assert.equal(observation(g,1).auction.bids[0].amount,undefined);assert(!g.auction.equityControl);
});
test('Jerry without lead ownership or while hiring gets no bid visibility advantage',()=>{
 for(const g of [auction(false),auction(true,true)]){assert(!g.auction.equityControl);assert.equal(currentPlayer(g),0);}
});
