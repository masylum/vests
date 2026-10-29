import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,resolveCard,eligibleCompanies} from './legacy-engine.js';
import {resolveRevealPhase} from '../src/racing.js';
const act=(g,cmd)=>{command(g,currentPlayer(g),cmd);assertGame(g);};
const own=(g,cid,id)=>{const c=g.companies[cid];c.tokens=[{id:1,owner:id}];c.lastBuy[id]=1;return c;};
test('all funded companies deploy their printed slots automatically after turns, including newly funded reserves',()=>{
 const g=createGame(),id=currentPlayer(g),c=own(g,0,id);c.reserve=3;
 own(g,1,id).reserve=1;
 const before=g.pile.length;
 while(g.phase==='call')act(g,{type:'call',company:null});
 assert.equal(g.phase,'purchaseResult');assert.equal(c.reserve,2);assert.equal(g.companies[1].reserve,0);
 assert.equal(c.purchased,2);assert.equal(g.pile.length,before+5);assert.equal(g.metrics.purchased,5);
 assert.equal(g.bank.burn,0);assert.equal(g.drawsLeft,5);
});
test('manual deployment is no longer an action',()=>{
 const g=createGame(),id=currentPlayer(g),c=own(g,0,id);c.reserve=1;
 const before=structuredClone(g);assert.throws(()=>command(g,id,{type:'deploy',company:0}));assert.deepEqual(g,before);
});
test('a full reserve blocks funding, without mutation',()=>{
 for(const reserve of [3]){
  const g=createGame(),id=currentPlayer(g),c=own(g,0,id);c.reserve=reserve;
  assert(!eligibleCompanies(g,id).includes(0));const before=structuredClone(g);
  assert.throws(()=>act(g,{type:'call',company:0}));assert.deepEqual(g,before);
 }
});
test('hiring fumble consumes a card without Saltman recovery bonus or Darcy immunity',()=>{
 for(const founder of [11,13]){
  const g=createGame();g.companies.forEach(c=>c.founder=-1);const c=g.companies[0];c.founder=founder;c.down=true;c.hiringFumble=true;c.position=5;
  resolveRevealPhase(g,'start');assert(c.down);assert.equal(c.position,5);
  const card=c.supply.shift();resolveCard(g,card);assert(!c.down);assert(!c.hiringFumble);assert.equal(c.position,5);
 }
});
test('Chelsea does not activate when everyone is tied for the lead and stays inactive while hiring',()=>{
 const g=createGame();g.companies.forEach(c=>{c.founder=-1;c.position=3;});const c=g.companies[0];c.founder=6;
 resolveRevealPhase(g,'start');assert.equal(c.position,3);
 g.companies[1].position=8;g.founderUsed=[];c.hiringFumble=true;resolveRevealPhase(g,'start');assert.equal(c.position,3);
});
