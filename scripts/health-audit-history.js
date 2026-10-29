import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const out=process.argv[2]??'docs/v92-health-1000',dir=path.join(out,'bot-audit');
const summaries=JSON.parse(fs.readFileSync(`${dir}/summary.json`));
const {createGame,command,assertGame}=await import(pathToFileURL(path.resolve(out,'study/source/engine.js')));
const rows=[];
for(const {seed,scores} of summaries){
 let presentations=[],lastPresentation;
 const replay=JSON.parse(fs.readFileSync(`${dir}/${seed}-replay.json`)),g=createGame(replay.setup);let ledger=g.log.map((e,i)=>({...structuredClone(e),commandStep:-1,sourceLogIndex:i})),latest=g.log.map((_,i)=>i);let before=g.log.map(e=>({leg:e.leg,cycle:e.cycle,card:e.card?.id,type:e.type}));
 for(const [step,{id,cmd}] of replay.commands.entries()){
  command(g,id,cmd);assertGame(g);
  const presentation={phase:g.phase,leg:g.leg,cycle:g.cycle,positions:g.companies.map(c=>c.position),event:g.lastRevealed,power:g.powerChoice};
  const encoded=JSON.stringify(presentation);
  if(encoded!==lastPresentation){presentations.push({commandStep:step,...JSON.parse(encoded)});lastPresentation=encoded;}
  for(let i=0;i<before.length;i++){const a=before[i],b=g.log[i];if(a.leg!==b.leg||a.cycle!==b.cycle)rows.push({seed,step,event:i,card:a.card,before:a,after:{leg:b.leg,cycle:b.cycle,card:b.card?.id,type:b.type}});}
  for(let i=0;i<g.log.length;i++){
   const e=g.log[i],prior=latest[i]===undefined?null:ledger[latest[i]];
   if(!prior||prior.leg!==e.leg||prior.cycle!==e.cycle){latest[i]=ledger.length;ledger.push({...structuredClone(e),commandStep:step,sourceLogIndex:i});}
   else ledger[latest[i]]={...structuredClone(e),commandStep:prior.commandStep,sourceLogIndex:i};
  }
  before=g.log.map(e=>({leg:e.leg,cycle:e.cycle,card:e.card?.id,type:e.type}));
 }
 assert(g.ended);assert.deepEqual(g.scores,scores);
 fs.writeFileSync(`${dir}/${seed}-chronological-events.json`,JSON.stringify(ledger));
 fs.writeFileSync(`${dir}/${seed}-command-events.json`,JSON.stringify(presentations));
}
fs.writeFileSync(`${dir}/history-anomalies.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
