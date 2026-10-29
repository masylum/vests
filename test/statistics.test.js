import test from 'node:test';import assert from 'node:assert/strict';
import {normalP,contrast,interval,holm,founderClusters,ratio} from '../scripts/statistics.js';
test('normal approximation and Holm correction use a two-sided 5% threshold',()=>{
 assert(Math.abs(normalP(0)-1)<1e-6);assert(Math.abs(normalP(1.96)-.05)<.0001);
 const a=holm([{p:.01},{p:.04},{p:.2}]);assert.deepEqual(a.map(x=>x.adjustedP),[.03,.08,.2]);assert.deepEqual(a.map(x=>x.significant),[true,false,false]);
});
test('matched clusters preserve covariance and bootstrap is reproducible',()=>{
 const a=[[2,1],[1,0],[3,1],[1,1]],b=[[2,0],[1,1],[3,1],[1,0]];
 assert.deepEqual(contrast(a,a).ci,[0,0]);assert.equal(contrast(a,a).p,1);assert.deepEqual(interval(a),interval(a));
 assert(Math.abs(contrast(a,b).estimate-(ratio(a)-ratio(b)))<1e-12);assert.throws(()=>contrast(a,b.slice(1)));
});
test('founder history counts each investor once and splits tied wins',()=>{
 const r={ipo:1,players:4,winners:[0,1],everOwned:[[0,1],[0],[],[1]],history:[[9],[0,9]],concurrent:[[0],[9],[],[]]};
 assert.deepEqual(founderClusters([r],9),[[3,1]]);assert.deepEqual(founderClusters([r],9,'concurrent'),[[1,.5]]);
 assert.deepEqual(founderClusters([r],0,'initial'),[[1,1]]);assert.deepEqual(founderClusters([r],9,'initial'),[[1,0]]);
});

test('equal-category test is reproducible, accepts a uniform table and rejects an extreme imbalance',async()=>{
 const {equalCategoryTest}=await import('../scripts/statistics.js');
 assert.equal(equalCategoryTest([10,10,10,10,10,10],{iterations:1000}).p,1);
 const a=equalCategoryTest([60,0,0,0,0,0],{iterations:1000,seed:42});assert(a.p<.01);assert.deepEqual(a,equalCategoryTest([60,0,0,0,0,0],{iterations:1000,seed:42}));
 assert.throws(()=>equalCategoryTest([1,-1]));
});
