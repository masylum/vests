import assert from 'node:assert/strict';

// An investor uses a founder while holding equity in that founder's company.
// Each investor/game credits their final net money once per distinct founder.
export function founderCredits(scores, concurrent) {
 assert.equal(scores.length,concurrent.length);
 return scores.flatMap((money,player)=>{
  assert(Number.isFinite(money));
  return [...new Set(concurrent[player])].map(founder=>{
   assert(Number.isInteger(founder)&&founder>=0);
   return {player,founder,money};
  });
 });
}
export function founderCluster(run,id) {
 const users=run.scores.flatMap((money,p)=>run.concurrent[p].includes(id)?[money]:[]);
 return [users.length,users.reduce((n,x)=>n+x,0)];
}
