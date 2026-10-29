// Diagnose sampling noise without running another expensive bot cohort.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createGame,command,assertGame} from '../src/engine.js';
import {COMPANIES} from '../src/config.js';
import {mean,contrast} from './statistics.js';

const read=p=>JSON.parse(fs.readFileSync(p));
const previous=read('docs/v91-health/study/raw.json').filter(r=>r.players===4).sort((a,b)=>a.seed-b.seed);
const current=read('docs/v92-health/study/raw.json').filter(r=>r.players===4).sort((a,b)=>a.seed-b.seed);
const bySeed=new Map(previous.map(r=>[r.seed,r]));
assert.equal(current.length,64);
assert.equal(previous.length,192);
const companies=COMPANIES.slice(0,6).map(c=>{
 const value=r=>r.exit.companies[c.id].revenue;
 const a=current.map(value),b=current.map(r=>value(bySeed.get(r.seed)));
 const difference=a.map((v,i)=>v-b[i]),m=mean(difference);
 const variance=difference.reduce((s,v)=>s+(v-m)**2,0)/(difference.length-1);
 return {company:c.name,v91All192:mean(previous.map(value)),v91First64:mean(previous.slice(0,64).map(value)),v91Next64:mean(previous.slice(64,128).map(value)),v92Matched64:mean(a),change:contrast(a.map(v=>[1,v]),b.map(v=>[1,v])),
  // Normal approximation for one comparison, not a guaranteed stopping rule.
  estimatedPairsFor95PercentHalfWidth5:Math.ceil(1.96**2*variance/5**2),
  estimatedPairsFor80PercentPowerAtChange5:Math.ceil((1.96+.84)**2*variance/5**2)};
});
const replay=read('docs/v92-health/bot-audit/925000-replay.json');
const expected=read('docs/v92-health/bot-audit/summary.json').find(r=>r.seed===replay.setup.seed).scores;
const benchmark=[];
for(const checks of [false,true]){
 const cpu=process.cpuUsage(),start=performance.now();
 for(let i=0;i<100;i++){
  const g=createGame(replay.setup);
  for(const c of replay.commands){command(g,c.id,c.cmd);if(checks)assertGame(g);}
  assert(g.ended);assert.deepEqual(g.scores,expected);
 }
 const used=process.cpuUsage(cpu);
 benchmark.push({checks,repeats:100,commands:replay.commands.length,wallMsPerGame:(performance.now()-start)/100,cpuMsPerGame:(used.user+used.system)/100000});
}
const result={versions:[91,92],companies,benchmark,note:'Replay timings execute fixed legal decisions; they do not measure a new intelligent bot game. Planning counts use noisy pilot variances, one two-sided comparison and a $5 company-revenue effect; multiple comparisons require more evidence.'};
fs.mkdirSync('docs/testing-diagnostics',{recursive:true});
fs.writeFileSync('docs/testing-diagnostics/noise-and-speed.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
