import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {availableParallelism,cpus} from 'node:os';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {parallel} from './parallel.js';
import {VERSION} from '../src/config.js';
import {nativeForecastAvailable} from '../src/bots.js';
const {values:a}=parseArgs({options:{out:{type:'string',default:`docs/v${VERSION}-health`},games:{type:'string',default:'1440'},workers:{type:'string',default:String(availableParallelism())},samples:{type:'string',default:'8'},compare:{type:'string',default:'68,70'},players:{type:'string',default:'mixed'},seed:{type:'string',default:'650000'},traces:{type:'string',default:'1'},'ablation-seeds':{type:'string',default:'0'},'historical-games':{type:'string',default:'96'}}});
const count=Number(a.games),workers=Number(a.workers),samples=Number(a.samples),out=path.resolve(a.out);
if(!Number.isInteger(workers)||workers<1)throw Error('Workers must be positive.');
const fixedPlayers=a.players==='mixed'?null:Number(a.players),seed=Number(a.seed),traces=Number(a.traces);
if(fixedPlayers!==null&&![3,4,5].includes(fixedPlayers))throw Error('Players must be mixed, 3, 4 or 5.');
if(!Number.isInteger(count)||count<2||fixedPlayers===null&&(count<6||count%6)||!Number.isInteger(samples)||samples<1||!Number.isSafeInteger(seed)||seed<0||!Number.isInteger(traces)||traces<0||traces>count)throw Error('Invalid study count, budget, seed or traces. Mixed cohorts require multiples of six.');
fs.mkdirSync(out,{recursive:true});
const versions=[...new Set([VERSION,...a.compare.split(',').filter(Boolean).map(Number)])];
const sources=new Map();
for(const version of versions){
 const source=path.join(out,version===VERSION?'source':`baselines/v${version}`);
 if(!fs.existsSync(source)){
  fs.mkdirSync(source,{recursive:true});
  const original=version===VERSION?'src':`docs/v${version}-health/source`;
  for(const name of fs.readdirSync(original).filter(n=>n.endsWith('.js')))fs.copyFileSync(path.join(original,name),path.join(source,name));
  if(version!==VERSION){
   // The same verified copy optimization, with historical rules and bots unchanged.
   fs.copyFileSync('src/clone.js',path.join(source,'clone.js'));
   for(const [name,before,after] of [['engine.js','export const clone = (x) => structuredClone(x);',"import {clone} from './clone.js';\nexport {clone};"],['racing.js','const copy = x => structuredClone(x);',"import {clone as copy} from './clone.js';"]]){
    const file=path.join(source,name),text=fs.readFileSync(file,'utf8');if(!text.includes(before))throw Error(`Historical copy function changed: ${file}`);fs.writeFileSync(file,text.replace(before,after));
   }
  }
 }
 // app.js is not imported by simulations; UI fixes do not change frozen decisions.
 if(version===VERSION)for(const name of fs.readdirSync('src').filter(n=>n.endsWith('.js')&&n!=='app.js'))if(!fs.existsSync(path.join(source,name))||!fs.readFileSync(path.join(source,name)).equals(fs.readFileSync(path.join('src',name))))throw Error('Current source differs from the frozen study. Use a new output directory.');
 sources.set(version,source);
}
// Freeze native code alongside JS so resumed studies cannot silently change engines.
let nativeBuild=null;
if(fs.existsSync('native/build/build.json')){
 const native=path.join(out,'native');
 const files=['forecast.rs','build/forecast.node','build/build.json'];
 if(!fs.existsSync(native)){
  fs.mkdirSync(path.join(native,'build'),{recursive:true});
  for(const file of files)fs.copyFileSync(path.join('native',file),path.join(native,file));
 }
 for(const file of files)if(!fs.readFileSync(path.join(native,file)).equals(fs.readFileSync(path.join('native',file))))throw Error('Native source or build changed. Use a new output directory.');
 nativeBuild=JSON.parse(fs.readFileSync(path.join(native,'build/build.json')));
}
const jobs=[];
if(fixedPlayers!==null){
 for(let i=0;i<count;i++)for(const version of versions)jobs.push({variant:`v${version}`,seed:seed+i,players:fixedPlayers,samples,source:sources.get(version),trace:i<traces&&version===VERSION});
}else{
 for(let i=0;i<count*2/3;i++)for(const version of versions)if(version>=VERSION-1||i<Number(a['historical-games']))jobs.push({variant:`v${version}`,seed:seed+i,players:4,samples,source:sources.get(version),trace:i<traces&&version===VERSION});
 for(const players of [3,5])for(let i=0;i<count/6;i++)jobs.push({variant:`v${VERSION}`,seed:seed+1000+i,players,samples,source:sources.get(VERSION)});
}
const ablationSeeds=Number(a['ablation-seeds']),policies=['adaptive','randomBid','randomCall','randomValue','randomFounder','randomPower'];
if(!Number.isInteger(ablationSeeds)||ablationSeeds<0)throw Error('Invalid ablation seed count.');
for(let i=0;i<ablationSeeds;i++)for(const policy of policies)jobs.push({variant:`strategy:${policy}`,policy,actor:i%4,seed:790000+i,players:4,samples,source:sources.get(VERSION),trace:i===0});
for(const job of jobs)if(job.variant===`v${VERSION}`||job.variant.startsWith('strategy:'))job.requireNative=nativeForecastAvailable;
const hashes=Object.fromEntries([...sources].map(([v,source])=>[v,Object.fromEntries(fs.readdirSync(source).filter(n=>n.endsWith('.js')).sort().map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(source,name))).digest('hex')]))]));
const signature=createHash('sha256').update(JSON.stringify({hashes,samples,versions,nativeBuild,count,fixedPlayers,seed,traces})).digest('hex'),manifestFile=path.join(out,'study.json'),rawFile=path.join(out,'games.jsonl');
if(fs.existsSync(manifestFile)&&JSON.parse(fs.readFileSync(manifestFile)).signature!==signature)throw Error('Source or study setup changed. Use a new output directory.');
const runnerHashes=Object.fromEntries(['balance-study.js','study-game.js','random-policy.js','exit-revenue.js','audit-game.js','audit-bots.js','statistics.js'].map(name=>[name,createHash('sha256').update(fs.readFileSync(new URL(name,import.meta.url))).digest('hex')]));
if(fs.existsSync(manifestFile)){const prior=JSON.parse(fs.readFileSync(manifestFile));if(prior.runnerHashes&&JSON.stringify(prior.runnerHashes)!==JSON.stringify(runnerHashes))throw Error('Study runner changed. Use a new output directory.');}
const previous=fs.existsSync(rawFile)?fs.readFileSync(rawFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const key=j=>`${j.variant}:${j.players}:${j.seed}`,scheduledKeys=new Set(jobs.map(key)),completed=new Map(previous.map(r=>[key(r),r]));
if(previous.some(r=>!scheduledKeys.has(key(r))))throw Error('Saved games fall outside the requested study.');
if(completed.size!==previous.length||previous.some(r=>!r.ok))throw Error('Invalid or duplicate saved results.');
const pending=jobs.filter(j=>!completed.has(key(j)));
if(!pending.length&&fs.existsSync(manifestFile)&&JSON.parse(fs.readFileSync(manifestFile)).finished){console.log(`Already complete: ${completed.size} games; original timing retained.`);process.exit(0);}
const started=performance.now(),cpu=process.cpuUsage();let lastPrint=0;
const metadata={signature,playerCount:fixedPlayers??'mixed',seed,traces,nativeBuild,forecastBackend:nativeForecastAvailable?'rust':'javascript',sampler:'independent',version:VERSION,games:count,versions,samples,workers:Math.min(workers,pending.length),availableCpus:availableParallelism(),cpu:cpus()[0]?.model,node:process.version,hashes,scheduled:jobs.length,ablationProtocol:'Public legal choices; independent seeded policy RNG; random bids use affordable funding thresholds and pass',runnerHashes,ablationSeeds,policies:ablationSeeds?policies:[],resumed:previous.length,started:new Date().toISOString()};
fs.writeFileSync(manifestFile,JSON.stringify(metadata,null,2));
console.log(JSON.stringify({backend:metadata.forecastBackend,sampler:metadata.sampler,workers:metadata.workers,availableCpus:metadata.availableCpus,scheduled:jobs.length,pending:pending.length,samples}));
await parallel(pending,{moduleURL:new URL('./study-game.js',import.meta.url),workers,onResult:row=>{
 if(!row.ok||completed.has(key(row)))throw Error('Invalid game result.');
 if(row.replay){const file=row.variant.startsWith('strategy:')?`sample-${row.policy}.json`:`replays/${row.players}p-${row.seed}.json`;fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.writeFileSync(path.join(out,file),JSON.stringify(row.replay));if(row.seed===seed)fs.writeFileSync(path.join(out,'sample.json'),JSON.stringify(row.replay));delete row.replay;}
 fs.appendFileSync(rawFile,JSON.stringify(row)+'\n');completed.set(key(row),row);
 if(completed.size%20===0||performance.now()-lastPrint>30000){lastPrint=performance.now();const used=process.cpuUsage(cpu),wall=(performance.now()-started)/1000;console.log(JSON.stringify({completed:completed.size,total:jobs.length,elapsedSeconds:Math.round(wall),averageCpuCores:(used.user+used.system)/1e6/Math.max(.001,wall)}));}
}});
if(completed.size!==jobs.length)throw Error('Missing games.');
const rows=[...completed.values()].sort((a,b)=>a.version-b.version||a.players-b.players||a.seed-b.seed);
for(const version of versions)fs.writeFileSync(path.join(out,version===VERSION?'raw.json':`v${version}-raw.json`),JSON.stringify(rows.filter(r=>r.variant===`v${version}`)));
if(ablationSeeds)fs.writeFileSync(path.join(out,'ablation-raw.json'),JSON.stringify(rows.filter(r=>r.variant.startsWith('strategy:'))));
const used=process.cpuUsage(cpu),elapsedSeconds=(performance.now()-started)/1000;
fs.writeFileSync(manifestFile,JSON.stringify({...metadata,finished:new Date().toISOString(),elapsedSeconds,cpuSeconds:(used.user+used.system)/1e6,averageCpuCores:(used.user+used.system)/1e6/Math.max(.001,elapsedSeconds),completed:completed.size},null,2));
console.log(`Complete: ${rows.length} games.`);
