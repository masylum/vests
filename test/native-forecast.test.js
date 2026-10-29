import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGame,command,currentPlayer,observation,clone} from '../src/engine.js';
import {forecasts,setForecastBackend,nativeForecastAvailable,nativeForecastStats} from '../src/bots.js';
import {createGame as historicalGame,command as historicalCommand,currentPlayer as historicalPlayer,observation as historicalObservation} from '../docs/v92-health/study/source/engine.js';
if(process.env.VESTS_NATIVE_ADDON)assert(nativeForecastAvailable,'The candidate native binary must load for build verification.');
const compare=(v,id,options)=>{
 const before=clone(v);setForecastBackend('js');const expected=forecasts(v,id,options);
 setForecastBackend('native');assert.deepEqual(forecasts(v,id,options),expected);assert.deepEqual(v,before);
};
test('compiled forecasts match JavaScript across all ten audited legal histories',{skip:!nativeForecastAvailable},()=>{
 let cases=0;
 try{for(let seed=925000;seed<925010;seed++){
  const replay=JSON.parse(fs.readFileSync(new URL(`../docs/v92-health/bot-audit/${seed}-replay.json`,import.meta.url))),g=historicalGame(replay.setup);
  for(let i=0;i<replay.commands.length;i++){
   if(i%11===0&&['call','bid','founder','intelPlay','settle'].includes(g.phase)){
    const id=historicalPlayer(g),v=historicalObservation(g,id);
    for(const variant of [{},{fundingDelay:2},...(g.auction?[{auctionOutcome:{winner:id,paid:7}}]:[])]){compare(v,id,{samples:5,...variant});cases++;}
   }
   const {id,cmd}=replay.commands[i];historicalCommand(g,id,cmd);
  }
 }assert(cases>200);}finally{setForecastBackend('auto');}
});
test('compiled forecasts match varied public states, known supply and experimental money scales',{skip:!nativeForecastAvailable},()=>{
 let rng=88731;const random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296),integer=n=>Math.floor(random()*n);
 try{for(let seed=0;seed<120;seed++){
  const players=3+seed%3,g=createGame({seed:70000+seed,players,rules:{intelMode:'mixed'}}),id=seed%players;
  g.leg=seed%3;g.cycle=1+integer(8);g.metrics.cycles=g.cycle+1;
  for(const p of g.players)p.cash=integer(101);
  for(const c of g.companies){
   const discarded=c.supply.splice(0,integer(c.supply.length+1));c.history.push(...discarded);g.removed.push(...discarded.map(card=>({...card,revealed:true})));
   c.position=integer(24);c.reserve=integer(4);c.down=random()<.25;c.hiringFumble=random()<.1;const n=integer(6);c.tokens=Array.from({length:n},(_,i)=>({id:i+1,owner:random()<.1?null:integer(players)}));c.lastBuy=g.players.map(()=>integer(20));
  }
  if(seed%4===0){const c=g.companies[id];if(c.supply.length)g.players[id].intelKnowledge={company:c.id,count:c.supply.length,top:clone(c.supply.slice(0,Math.min(2,c.supply.length-1))),bottom:clone(c.supply.at(-1))};}
  if(seed%7===0)g.rules={...g.rules,exitCurve:'linear',exitLinear:2.5};
  if(seed%11===0)g.rules={...g.rules,moneyScale:2,currencyUnit:2};
  const v=observation(g,id);v.auction={company:integer(v.companies.length)};
  for(const options of [{samples:4},{samples:3,blindDeck:true,blindFounders:true},{samples:4,fundingDelay:2,auctionOutcome:{winner:id,paid:seed%2?7:15}}])compare(v,id,options);
 }}finally{setForecastBackend('auto');}
 assert(nativeForecastStats().calls>300);
});

test('empty-supply Ad revenue still shuffles the existing growth pile',{skip:!nativeForecastAvailable},()=>{
 const replay=JSON.parse(fs.readFileSync(new URL('../docs/v92-health/bot-audit/925000-replay.json',import.meta.url))),g=historicalGame(replay.setup);
 for(const {id,cmd} of replay.commands.slice(0,238))historicalCommand(g,id,cmd);
 const id=historicalPlayer(g),v=historicalObservation(g,id);
 try{compare(v,id,{samples:2,auctionOutcome:{winner:id,paid:3}});}finally{setForecastBackend('auto');}
});

test('independent sparse forecasts preserve exactly the requested full-budget samples',{skip:!nativeForecastAvailable},()=>{
 try{for(let seed=0;seed<24;seed++){
  const g=createGame({seed:81200+seed,rules:{intelMode:'mixed'}}),id=currentPlayer(g),v=observation(g,id);v.auction={company:seed%6};
  const options={samples:8,sampler:'independent',auctionOutcome:{winner:id,paid:7}};
  compare(v,id,options);compare(v,id,{...options,sampleMask:0b10100101});
  const full=forecasts(v,id,options),partial=forecasts(v,id,{...options,sampleMask:0b10100101});
  for(let c=0;c<6;c++)for(const sample of [0,2,5,7]){
   assert.equal(partial[c].finalPrices[sample],full[c].finalPrices[sample]);assert.equal(partial[c].roundsToExit[sample],full[c].roundsToExit[sample]);
   for(let p=0;p<4;p++){assert.equal(partial[c].futureSpending[p][sample],full[c].futureSpending[p][sample]);assert.equal(partial[c].futureShares[p][sample],full[c].futureShares[p][sample]);}
  }
 }}finally{setForecastBackend('auto');}
});

 test('native boundary rejects malformed or oversized inputs',{skip:!nativeForecastAvailable},()=>{
 const require=createRequire(import.meta.url),native=require(process.env.VESTS_NATIVE_ADDON??'../native/build/forecast.node');
 for(const value of [undefined,{},new Uint8Array(16),new Float64Array(),new Float64Array([NaN]),new Float64Array(100001)])assert.throws(()=>native.run(value));
 assert.throws(()=>native.run());
 assert.throws(()=>native.run(new Float64Array(new SharedArrayBuffer(128))),/Shared forecast buffers/);
 });
