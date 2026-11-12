import fs from 'node:fs';import path from 'node:path';import {createHash}from 'node:crypto';
import {parallel}from './parallel.js';import{inject}from './card-outcome-game.js';
import{VERSION}from '../src/config.js';import{createGame,command,currentPlayer,clone}from '../src/engine.js';import{INTEL_CARDS,intelTargets}from '../src/intel.js';
const out=path.resolve(process.argv[2]??`docs/v${VERSION}-card-study`),samples=20,workers=4;
fs.mkdirSync(out+'/source',{recursive:true});fs.mkdirSync(out+'/samples',{recursive:true});fs.mkdirSync(out+'/pairs',{recursive:true});
const source=out+'/source',hashes={};
if(fs.existsSync(source+'/config.js')){
 const prior=await import(new URL('file://'+source+'/config.js')),live=await import('../src/config.js');
 for(const key of ['VERSION','RULES','DECK_PROFILES','ACTIVE_FOUNDERS'])if(JSON.stringify(prior[key])!==JSON.stringify(live[key]))throw Error('Frozen game definitions differ: '+key);
}
for(const name of fs.readdirSync('src').filter(x=>x.endsWith('.js'))){const data=fs.readFileSync('src/'+name),file=source+'/'+name;if(fs.existsSync(file)&&!['app.js','config.js'].includes(name)&&!fs.readFileSync(file).equals(data)&&!(name==='bots.js'&&fs.readFileSync(file,'utf8')===data.toString().replace('export function portfolioUtility','function portfolioUtility')))throw Error('Frozen source differs: '+name);if(!fs.existsSync(file))fs.writeFileSync(file,data);hashes[name]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
fs.copyFileSync('package-lock.json',out+'/package-lock.json');
const playerCounts=[2,3,4,5,2,3,4,5,4,4];
const jobs=Array.from({length:50},(_,i)=>({kind:'game',id:`game-${String(i+1).padStart(2,'0')}`,seed:108000+i,players:i<10?playerCounts[i]:2+(i%4),samples,source,out,trace:i<10}));
for(let i=0;i<16;i++)jobs.push({kind:'game',id:`random-${i}`,seed:108100+i,players:2+i%4,samples,source,out,trace:false,policy:'simpleRandom',seat:i% (2+i%4)});
const protocol={version:VERSION,study:'card-outcomes-1',date:'2026-11-03',samples,workers,games:jobs.map(({id,seed,players,policy,seat})=>({id,seed,players,policy:policy??'normal',seat})),sampleSelection:'First ten games fixed before execution; first six legal game contexts per card, preferred band early/mid/late cycling by game index.',pairsPerCard:6,confirmation:'First legal pair per card at 64 forecast samples.',comparison:'Force production bot target/choices to play versus discard the same injected card; both branches spend one action, then normal bots finish. Real engine effects, no flat effect-price formula.',metrics:{scoreDelta:'Final actor score(play) minus score(discard), coins',relativeDelta:'Actor delta minus 0.2 × mean rival delta, coins',winDelta:'Split-tie win credit difference',classification:'Strong: mean above deck upper quartile and 95% interval above zero; weak: upper interval <= zero; others require context or more evidence.'},limits:'Current strongest available normal policy, not proven optimal hyperparameters. Same seed couples branches only until decisions diverge. Conditional eligible positions differ by card. No human time/enjoyment inference.',sourceHashes:hashes,node:process.version};
protocol.runnerHashes=Object.fromEntries(['card-outcome-study.js','card-outcome-game.js','health-game.js'].map(f=>[f,createHash('sha256').update(fs.readFileSync(new URL(f,import.meta.url))).digest('hex')]));protocol.runnerCorrection='Attempt 1 stopped at mandate-1: the forced-card audit also considered a different Working Weekend. Other Weekend cards are now masked only in the temporary forced-card planner observation. Completed intended-card branches are unchanged; the failed attempt log is retained. Attempt 2 found six Paid Advice harness failures: the forced command omitted the production fallback extra-discard option. It now uses the same expansionChoices fallback; failed rows/files are preserved separately.';fs.writeFileSync(out+'/manifest.json',JSON.stringify(protocol,null,2));
async function batch(jobs,file){const old=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],seen=new Set(old.map(x=>x.id));const fresh=await parallel(jobs.filter(j=>!seen.has(j.id)),{moduleURL:new URL('./card-outcome-game.js',import.meta.url),workers,onResult:r=>{fs.appendFileSync(file,JSON.stringify(r)+'\n');console.log(r.id,r.status,r.roundCount??r.scoreDelta??'',r.error??'');}});return [...old,...fresh];}
const games=await batch(jobs,out+'/games.jsonl');if(games.some(g=>g.status!=='completed'))throw Error('Game failures retained; resolve before card study');
const contexts=new Map(Object.keys(INTEL_CARDS).map(k=>[k,[]]));
for(let i=0;i<10;i++){
 const game=jobs[i],sample=out+'/samples/'+game.id+'.json',trace=JSON.parse(fs.readFileSync(sample)),g=createGame(trace.setup),choices=new Map(),preferred=i%3;
 for(let step=0;step<trace.commands.length;step++){
  if(g.phase==='call'&&g.players[currentPlayer(g)].intel.length){
   const id=currentPlayer(g),max=Math.max(...g.companies.map(c=>c.position)),band=max<=8?0:max<=16?1:2;
   for(const card of contexts.keys())if(!choices.has(card)||choices.get(card).band!==preferred&&band===preferred){
    const w=clone(g);inject(w,id,card);if(intelTargets(w,id,card).length)choices.set(card,{game:game.id,sample,step,band});
   }
  }
  const x=trace.commands[step];command(g,x.id,x.cmd);
 }
 for(const [card,c]of choices)if(contexts.get(card).length<6)contexts.get(card).push(c);
}
const pairs=[];for(const [card,list]of contexts)for(const [i,c]of list.entries())pairs.push({kind:'pair',...c,card,id:`${card}-${i}`,samples,source,out});
fs.writeFileSync(out+'/contexts.json',JSON.stringify(Object.fromEntries(contexts),null,2));
const results=await batch(pairs,out+'/pairs.jsonl');if(results.some(r=>r.status!=='completed'))throw Error('Pair failures retained');
const confirmation=pairs.filter(j=>j.id.endsWith('-0')).map(j=>({...j,id:j.id+'-64',samples:64}));await batch(confirmation,out+'/confirmation.jsonl');
console.log('Complete',out);
