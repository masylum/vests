import test from 'node:test';import assert from 'node:assert/strict';
import {growthDeck} from '../docs/v70-health/source/config.js';import {growthDeck as oldDeck} from '../docs/v68-health/source/config.js';
test('Novidia and Obenay lose one ordinary movement point without losing supply or signature effects',()=>{
 for(let id=0;id<8;id++){
  const before=oldDeck(id),after=growthDeck(id),nerfed=[3,5].includes(id);assert.equal(after.length,before.length);
  assert.deepEqual(after.filter(c=>c.signature),before.filter(c=>c.signature));assert.deepEqual(after.filter(c=>c.effect),before.filter(c=>c.effect));
  const changed=after.filter((c,i)=>JSON.stringify(c)!==JSON.stringify(before[i]));assert.equal(changed.length,nerfed?1:0);
  if(nerfed){const c=changed[0];assert.equal(before.find(x=>x.id===c.id).printed,3);assert.equal(c.printed,2);assert(!c.signature);}
 }
});
