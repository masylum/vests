import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const modules=new Map();
export async function run(job){
 const root=pathToFileURL(path.resolve(job.source)+'/').href;
 if(!modules.has(root))modules.set(root,Promise.all(['engine','bots'].map(n=>import(root+n+'.js'))));
 const [engine,bots]=await modules.get(root),setup={seed:job.seed,players:job.players,rules:{intelMode:'mixed'}},g=engine.createGame(setup);
 g.fast=true;
 assert(bots.nativeForecastAvailable,"The performance cohort requires the compiled backend");
 const before=bots.nativeForecastStats(),start=performance.now(),cpu=process.threadCpuUsage(),commands=[],actions={fast:{},full:{}};
 for(let step=0;!g.ended&&step<12000;step++){
  if(g.metrics.cycles>80)throw Error('Game stalled');
  const id=engine.currentPlayer(g),search=job.fastSeats.includes(id)?'fast':'full';
  const cmd=bots.botCommand(g,id,{samples:8,sampler:search==='fast'?'independent':'legacy'});
  actions[search][cmd.type]=(actions[search][cmd.type]??0)+1;
  commands.push({id,cmd});engine.command(g,id,cmd);engine.assertGame(g);
 }
 assert(g.ended);
 const elapsedMs=performance.now()-start,used=process.threadCpuUsage(cpu);
 const after=bots.nativeForecastStats(),nativeCalls=after.calls-before.calls,nativeFallbacks=after.fallbacks-before.fallbacks;
 assert(nativeCalls>0);assert.equal(nativeFallbacks,0);
 const replay={version:g.version,setup,commands};
 assert.deepEqual(engine.replayGame(replay).scores,g.scores);
 const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
 const fastMoney=mean(g.scores.filter((_,i)=>job.fastSeats.includes(i))),fullMoney=job.fastSeats.length===job.players?null:mean(g.scores.filter((_,i)=>!job.fastSeats.includes(i)));
 return {seed:job.seed,players:job.players,fastSeats:job.fastSeats,nativeCalls,nativeFallbacks,elapsedMs,cpuMs:(used.user+used.system)/1000,rounds:g.metrics.cycles,scores:g.scores,fastMoney,fullMoney,difference:fullMoney===null?null:fastMoney-fullMoney,defaults:g.metrics.defaults,actions,replay:job.trace?replay:undefined};
}
