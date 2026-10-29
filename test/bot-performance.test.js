import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,command,currentPlayer,observation,clone} from '../src/engine.js';
import {forecasts,clearForecastCache,forecastCacheStats} from '../src/bots.js';
import {forecasts as oldForecasts} from '../docs/v92-health/study/source/bots.js';
import {forecasts as optimizedV92} from '../docs/v92-health-1000/study/source/bots.js';
import * as frozenV92 from '../docs/v92-health-1000/study/source/engine.js';
import {shareLeader} from '../src/ownership.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;};
test('frozen optimized v92 forecasts preserve v92 decisions across legal histories',()=>{
 const {createGame,command,currentPlayer,observation}=frozenV92;
 let comparisons=0;
 for(const seed of [925000,925001,925002,925009]){
  const replay=JSON.parse(fs.readFileSync(new URL(`../docs/v92-health/bot-audit/${seed}-replay.json`,import.meta.url))),g=createGame(replay.setup);
  for(let i=0;i<replay.commands.length;i++){
   if(i%29===0&&['call','bid','founder','intelPlay','settle'].includes(g.phase)){
    const id=currentPlayer(g),v=freeze(observation(g,id));
    const variants=[{}, {fundingDelay:2}, {blindDeck:true}, {blindFounders:true}];
    if(g.auction)variants.push({auctionOutcome:{winner:id,paid:7}},{auctionOutcome:{winner:(id+1)%4,paid:3}});
    for(const variant of variants){const options={samples:3,...variant};assert.deepEqual(optimizedV92(v,id,options),oldForecasts(v,id,options),`${seed}:${i}:${JSON.stringify(variant)}`);comparisons++;}
   }
   const {id,cmd}=replay.commands[i];command(g,id,cmd);
  }
 }
 assert(comparisons>=100);
});

test('forecast cache reuses exact inputs, isolates results and invalidates mutable inputs',()=>{
 clearForecastCache();const v=observation(createGame({seed:812,rules:{intelMode:'mixed'}}),0),original=clone(v),options={samples:2};
 const a=forecasts(v,0,options);a[0].finalPrices[0]=-999;
 const b=forecasts(v,0,options);assert.notEqual(b[0].finalPrices[0],-999);assert.deepEqual(v,original);assert.equal(forecastCacheStats().hits,1);
 for(const edit of [w=>w.players[0].cash++,w=>w.companies[0].founder=6,w=>w.companies[0].reserve++,w=>w.called=[0],w=>w.rules.burnPerRound++,w=>w.players[0].intelKnowledge={company:0,count:w.companies[0].supplyCount,top:[],bottom:{id:'known',company:0,kind:'growth',printed:1}}]){
  const next=clone(v);edit(next);assert.deepEqual(forecasts(next,0,options),forecasts(next,0,{...options,cache:false}));
 }
 for(let i=0;i<forecastCacheStats().limit+4;i++){const w=clone(v);w.players[0].cash+=i+100;forecasts(w,0,{samples:1});}
 assert.equal(forecastCacheStats().size,forecastCacheStats().limit);
 assert.deepEqual(forecasts(v,0,{samples:2,cache:false}),b);
});

test('share leader matches stable count and latest-purchase ordering',()=>{
 for(let mask=0;mask<1024;mask++)for(const lastBuy of [[0,0,0],[2,3,1],[3,3,1]]){
  let n=mask;const tokens=Array.from({length:5},()=>{const owner=n%4;n=Math.floor(n/4);return {owner:owner===3?null:owner};});
  const c={tokens,lastBuy},held=id=>tokens.filter(t=>t.owner===id).length;
  const expected=[0,1,2].filter(id=>held(id)).sort((a,b)=>held(b)-held(a)||lastBuy[b]-lastBuy[a])[0]??null;
  assert.equal(shareLeader(c),expected);
 }
});
