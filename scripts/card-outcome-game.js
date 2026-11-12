import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {run as healthGame} from './health-game.js';
export function inject(g,id,kind){
 let index=g.players[id].intel.findIndex(c=>c.kind===kind);if(index>=0)return index;
 if(!g.players[id].intel.length)return -1;
 const zone=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)].find(z=>z.some(c=>c.kind===kind));
 if(!zone)throw Error('Missing physical value card '+kind);
 const n=zone.findIndex(c=>c.kind===kind);[zone[n],g.players[id].intel[0]]=[g.players[id].intel[0],zone[n]];return 0;
}
export async function run(job){
 if(job.kind==='game')return healthGame(job);
 const E=await import(pathToFileURL(job.source+'/engine.js')),B=await import(pathToFileURL(job.source+'/bots.js')),X=await import(pathToFileURL(job.source+'/card-expansion.js'));
 const trace=JSON.parse(fs.readFileSync(job.sample)),g=E.createGame(trace.setup);
 for(const {id,cmd}of trace.commands.slice(0,job.step))E.command(g,id,cmd);
 const actor=E.currentPlayer(g),card=inject(g,actor,job.card);E.assertGame(g);
 const v=E.observation(g,actor);v.phase='intelPlay';v.players[actor].intel.forEach((c,i)=>{c.disabled=i!==card;if(i!==card&&c.kind==='weekend')c.kind='recover';});
 const audit=[];B.botCommand(v,actor,{samples:job.samples,audit});
 const plan=audit.find(x=>x.card)?.card;
 if(!plan||plan.card!==card||!Number.isFinite(plan.value))throw Error(`No forced plan ${job.card} in ${job.id}`);
 const cmd={type:'playIntel',card,company:plan.company,target:plan.target,...(plan.extra??(X.NEW_CARDS[job.card]?X.expansionChoices(g,actor,card,plan.company)[0]:{}))};
 const outcomes=[];
 for(const mode of ['play','discard']){
  const w=E.clone(g),commands=[],events=[];let steps=0,error=null;
  const apply=(id,cmd)=>{const start=w.log.length;E.command(w,id,cmd);E.assertGame(w);commands.push({id,cmd});events.push(...w.log.slice(start));};
  try{
   apply(actor,{type:'valueAction'});apply(actor,mode==='play'?cmd:{type:'exchangeValue',card});
   for(;!w.ended&&steps<6000&&w.metrics.cycles<=80;steps++){
    const id=E.currentPlayer(w);apply(id,B.botCommand(w,id,{samples:job.samples}));
   }
   if(!w.ended)throw Error('Continuation censored');
   const replay=E.clone(g);for(const x of commands)E.command(replay,x.id,x.cmd);
   if(JSON.stringify(replay.scores)!==JSON.stringify(w.scores))throw Error('Continuation replay mismatch');
  }catch(e){error=e.stack;}
  outcomes.push({mode,error,steps,scores:w.scores,winners:w.winners,round:w.metrics.cycles,commands,events});
 }
 const [play,discard]=outcomes;
 const result={id:job.id,game:job.game,step:job.step,card:job.card,samples:job.samples,actor,band:job.band,round:g.metrics.cycles,positions:g.companies.map(c=>c.position),cash:g.players[actor].cash,capital:g.players[actor].capital,plan:cmd,botEstimate:plan.value,status:outcomes.every(x=>!x.error)?'completed':'failed',error:outcomes.find(x=>x.error)?.error};
 if(result.status==='completed'){
  const score=x=>x.scores[actor],relative=x=>score(x)-.2*x.scores.filter((_,i)=>i!==actor).reduce((s,n)=>s+n,0)/(x.scores.length-1),win=x=>x.winners.includes(actor)?1/x.winners.length:0;
  result.scoreDelta=score(play)-score(discard);result.relativeDelta=relative(play)-relative(discard);result.winDelta=win(play)-win(discard);result.playScore=score(play);result.discardScore=score(discard);result.playRound=play.round;result.discardRound=discard.round;
 }
 fs.writeFileSync(job.out+'/pairs/'+job.id+'.json',JSON.stringify({version:g.version,setup:trace.setup,prefix:trace.commands.slice(0,job.step),injection:{actor,kind:job.card},result,outcomes}));
 return result;
}
