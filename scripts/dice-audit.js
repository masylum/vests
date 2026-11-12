// Replay frozen samples with observational instrumentation; assert every chosen
// command matches the original trace before saving candidate evaluations.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=process.argv[2]??'docs/dice-study';
let source=await readFile(out+'/source/src/dice-bots.js','utf8');
source=source.replace("policy='balanced'){","policy='balanced',audit={}){");
source=source.replace("if(view.phase==='rights')", "audit.bid={company:c.id,expectedExit:expected(c),ceiling:worth(c),affordableCeiling:budget};\n  if(view.phase==='rights')");
source=source.replace("if(policy==='random')return choose([capital", "audit.action={deals,discard,value:value?{command:value,score:cardScore(value)}:null,funding:fund,capitalThreshold:worth(view.companies[fund.company]),cash:p.cash};\n  if(policy==='random')return choose([capital");
source=source.replace("const choices=valueChoices(view,id);return", "const choices=valueChoices(view,id);audit.values=choices.map(command=>({command,score:cardScore(command)}));return");
const file=out+'/source/src/dice-bots-audit.js';await writeFile(file,source);
const {diceBot}=await import(pathToFileURL(resolve(file)));
const {createDiceGame,diceCommand,diceObservation,currentPlayer}=await import(pathToFileURL(resolve(out+'/source/src/dice-engine.js')));
for(let i=1;i<=10;i++){
 const sample=JSON.parse(await readFile(`${out}/samples/game-${i}.json`)),g=createDiceGame(sample.replay.setup),rows=[];
 for(const [step,{id,cmd}] of sample.replay.commands.entries()){
  const audit={},view=diceObservation(g,id),chosen=diceBot(view,id,sample.config.policies[id],audit);
  if(currentPlayer(g)!==id||JSON.stringify(chosen)!==JSON.stringify(cmd))throw Error(`Audit changed command ${i}/${step}`);
  if(Object.keys(audit).length)rows.push({step,round:g.round,player:id,chosen,...audit});
  diceCommand(g,id,cmd);
 }
 await writeFile(`${out}/samples/game-${i}-valuations.json`,JSON.stringify(rows,null,2));
 await writeFile(`${out}/samples/game-${i}-review-trace.txt`,[JSON.stringify({config:sample.config,accounts:sample.accounts,scores:sample.scores}),...sample.decisions.map(d=>'D'+d.step+' '+JSON.stringify(d)),...sample.events.map((e,index)=>'E'+index+' '+JSON.stringify(e))].join('\n'));
}
console.log('Ten frozen traces re-evaluated; all instrumented commands match.');
