import fs from'node:fs';import path from'node:path';import{pathToFileURL}from'node:url';import{parallel}from'./parallel.js';import{inject}from'./card-outcome-game.js';
const out=path.resolve(process.argv[2]??'docs/v108-card-study'),source=out+'/source',E=await import(pathToFileURL(source+'/engine.js')),I=await import(pathToFileURL(source+'/intel.js')),jobs=[];
for(let i=6;i<10;i++){
 const game=`game-${String(i+1).padStart(2,'0')}`,sample=out+'/samples/'+game+'.json',t=JSON.parse(fs.readFileSync(sample)),g=E.createGame(t.setup),chosen=new Map(),preferred=i%3;
 for(let step=0;step<t.commands.length;step++){
  if(g.phase==='call'&&g.players[E.currentPlayer(g)].intel.length){const id=E.currentPlayer(g),m=Math.max(...g.companies.map(c=>c.position)),band=m<=8?0:m<=16?1:2;
   for(const card of Object.keys(I.INTEL_CARDS))if(!chosen.has(card)||chosen.get(card).band!==preferred&&band===preferred){const w=E.clone(g);inject(w,id,card);if(I.intelTargets(w,id,card).length)chosen.set(card,{card,step,band});}
  }const x=t.commands[step];E.command(g,x.id,x.cmd);
 }
 for(const c of chosen.values())jobs.push({kind:'pair',...c,game,sample,id:`extra-${c.card}-${i}`,samples:20,source,out});
}
fs.writeFileSync(out+'/extra-protocol.json',JSON.stringify({reason:'Exploratory expansion: primary six-context confidence intervals are broad. Add all four remaining preselected review games, without inspecting or excluding their card outcomes.',selection:'Same preferred early/mid/late rule, one legal context per card per remaining game.',jobs},null,2));
const file=out+'/extra-pairs.jsonl',old=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],seen=new Set(old.map(x=>x.id));
await parallel(jobs.filter(j=>!seen.has(j.id)),{workers:4,moduleURL:new URL('./card-outcome-game.js',import.meta.url),onResult:r=>{fs.appendFileSync(file,JSON.stringify(r)+'\n');console.log(r.id,r.status,r.scoreDelta,r.error??'');}});
