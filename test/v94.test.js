import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,observation,burnPile,assertGame,clone} from '../src/engine.js';
import {intelTargets,bestIntelPlay} from '../src/intel.js';
import {forecasts,setForecastBackend,nativeForecastAvailable,clearForecastCache,forecastCacheStats} from '../src/bots.js';
function executive(){
 const g=createGame({rules:{intelMode:'mixed'}}),id=currentPlayer(g);
 for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));
 g.players[id].intel.push(...g.intelDeck.splice(g.intelDeck.findIndex(c=>c.kind==='smear'),1));
 command(g,id,{type:'call',company:0});
 while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===id?1:0});
 command(g,id,{type:'continue'});return {g,id,c:g.companies[0]};
}
test('Executive hire rejects fumbled targets atomically, and bots have no eligible play',()=>{
 const {g,id,c}=executive();c.down=true;const before=clone(g);
 assert.deepEqual(intelTargets(g,id,'smear'),[]);assert.deepEqual(intelTargets(observation(g,id),id,'smear'),[]);
 assert.throws(()=>command(g,id,{type:'playIntel',card:0,company:0}));assert.deepEqual(g,before);
 assert.equal(bestIntelPlay(observation(g,id),id).card,-1);
 c.down=false;assert.deepEqual(intelTargets(g,id,'smear'),[0]);
 const stock=c.supply.length;command(g,id,{type:'playIntel',card:0,company:0});assert(c.down);assert.equal(c.supply.length,stock-3);assertGame(g);
});
test('public burns expose every removed card, exact company counts and no remaining deck order',()=>{
 const g=createGame(),before=clone(g.pile);burnPile(g,()=>0);const event=g.log.at(-1);
 assert.equal(event.type,'burn');assert.deepEqual(event.cards.map(c=>c.id),before.slice(0,3).map(c=>c.id));
 for(const p of g.players){const v=observation(g,p.id);assert.deepEqual(v.publicBurns.map(c=>c.id),event.cards.map(c=>c.id));assert.equal(v.poolWeightsAreUpperBounds,false);assert.deepEqual(v.poolWeights,g.companies.map(c=>g.pile.filter(card=>card.company===c.id).length));assert.equal(v.poolWeights.reduce((a,b)=>a+b),v.pileCount);assert(!v.pile&&!v.removed&&!v.log);assert(v.publicBurns.every(c=>c.burned&&c.public));}
 assertGame(g);
});
test('public burn information participates in forecast caches and Rust/JS parity',()=>{
 const g=createGame({seed:9812});burnPile(g,()=>0);const v=observation(g,0);
 try{setForecastBackend('js');const js=forecasts(v,0,{samples:5,sampler:'independent'});if(nativeForecastAvailable){setForecastBackend('native');assert.deepEqual(forecasts(v,0,{samples:5,sampler:'independent'}),js);}
 const alternate=clone(v);alternate.publicBurns[0].id='g0:19';clearForecastCache();forecasts(v,0,{samples:1});forecasts(alternate,0,{samples:1});assert.equal(forecastCacheStats().misses,2);
 }finally{setForecastBackend('auto');}
});
