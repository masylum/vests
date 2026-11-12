import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=process.argv[2]??'docs/dice-pacing-v130';
let source=fs.readFileSync(out+'/source/src/dice-bots.js','utf8');
source=source.replace("policy='balanced'){","policy='balanced',audit={}){");
source=source.replace("if(view.phase==='rights')","audit.bid={company:c.id,expectedExit:expected(c),ceiling:worth(c),affordableCeiling:budget};if(view.phase==='rights')");
source=source.replace("if(policy==='random')return choose([capital","audit.action={deals,discard,value:value?{command:value,score:cardScore(value)}:null,funding:fund,capitalThreshold:worth(view.companies[fund.company]),cash:p.cash};if(policy==='random')return choose([capital");
source=source.replace("const choices=valueChoices(view,id);return","const choices=valueChoices(view,id);audit.values=choices.map(command=>({command,score:cardScore(command)}));return");
const file=out+'/source/src/dice-bots-audit.js';fs.writeFileSync(file,source);
const {diceBot}=await import(pathToFileURL(resolve(file))),{createDiceGame,diceCommand,diceObservation}=await import(pathToFileURL(resolve(out+'/source/src/dice-engine.js')));
for(let i=0;i<10;i++){
 const sample=JSON.parse(fs.readFileSync(`${out}/sample-${i}.json`)),g=createDiceGame(sample.replay.setup),auditRows=[],timeline=[];
 for(const [index,{id,cmd}] of sample.replay.commands.entries()){
  const audit={},chosen=diceBot(diceObservation(g,id),id,sample.decisions[index].policy,audit);
  if(JSON.stringify(chosen)!==JSON.stringify(cmd))throw Error('Audit mismatch');
  if(Object.keys(audit).length)auditRows.push({decision:index,round:g.round,id,cmd,...audit});
  const before=g.companies.map(c=>c.position),eventStart=g.log.length;diceCommand(g,id,cmd);
  if(!['continue','bid','tie','openBid'].includes(cmd.type)||g.log.length>eventStart)timeline.push({D:index,r:g.round,p:id,c:cmd,before,after:g.companies.map(c=>c.position),events:g.log.slice(eventStart)});
 }
 fs.writeFileSync(`${out}/sample-${i}-valuations.json`,JSON.stringify(auditRows,null,2));
 fs.writeFileSync(`${out}/sample-${i}-review.txt`,JSON.stringify({setup:sample.replay.setup,scores:sample.scores,accounts:sample.accounts})+'\n'+timeline.map(r=>JSON.stringify(r)).join('\n'));
}
