import test from 'node:test';
import assert from 'node:assert/strict';
import {founderCredits,founderCluster} from '../scripts/founder-credit.js';
import {growthDeck,FOUNDERS} from '../src/config.js';
import {growthDeck as oldDeck} from '../docs/v92-health-1000/study/source/config.js';

test('founders receive full investor final money, once per investor/game, including losses and support roles',()=>{
 const scores=[80,-20,0,10],concurrent=[[9,9,2],[9,3],[3],[]];
 const credits=founderCredits(scores,concurrent);
 assert.deepEqual(credits,[{player:0,founder:9,money:80},{player:0,founder:2,money:80},{player:1,founder:9,money:-20},{player:1,founder:3,money:-20},{player:2,founder:3,money:0}]);
 assert.deepEqual(founderCluster({scores,concurrent},9),[2,60]);
 assert.deepEqual(founderCluster({scores,concurrent},1),[0,0]);
});
test('v93 adjusts exactly six ordinary cards, preserving signatures, risk and supply counts',()=>{
 for(let cid=0;cid<6;cid++){
  const a=oldDeck(cid),b=growthDeck(cid),counts=d=>[0,1,2].map(n=>d.filter(c=>!c.signature&&!c.effect&&c.printed===n).length);
  assert.equal(a.length,b.length);assert.equal(a.filter(c=>c.signature).length,b.filter(c=>c.signature).length);
  assert.equal(a.filter(c=>c.effect).length,b.filter(c=>c.effect).length);
  const delta=counts(b).map((n,i)=>n-counts(a)[i]);
  assert.deepEqual(delta,[[0,0,0],[0,1,-1],[0,0,0],[-1,0,1],[-1,1,0],[-2,2,0]][cid]);
 }
 assert.match(FOUNDERS[9].action,/deploy 2/);
});
