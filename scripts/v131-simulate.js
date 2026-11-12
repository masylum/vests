import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame} from '../archive/versions/v131/live-dice-engine.js';
import {diceBot,diceEvaluations,DICE_BOT_VERSION} from '../archive/versions/v131/live-dice-bots.js';
import {pathToFileURL} from 'node:url';
export function simulateLiveDice({seed=42,players=4,policies=['balanced'],dicePolicy='adaptive',trace=false}={}){
 const setup={seed,players},g=createDiceGame(setup),commands=[],decisions=[];let meaningful=0,steps=0;
 for(let step=0;!g.ended&&!g.stalled&&step<2000;step++){
  const id=currentPlayer(g),view=diceObservation(g,id),policy=policies[id%policies.length],cmd=diceBot(view,id,policy,{dicePolicy});
  steps++;if(!['continue','roll'].includes(cmd.type)||(cmd.type==='roll'&&g.flowStage==='setup'))meaningful++;
  if(trace){
   const entry=g.phase==='chooseDice'?g.pendingGrowth.find(e=>!e.resolved):null;
   commands.push({id,cmd});decisions.push({step,round:g.round,phase:g.phase,id,policy,cmd,cash:g.players.map(p=>p.cash),positions:g.companies.map(c=>c.position),...(entry?{evaluations:diceEvaluations(view,id,entry.company)}:{})});
  }
  diceCommand(g,id,cmd);
 }
 if(!g.ended&&!g.stalled){g.censored=true;g.cutoff='Decision limit 2000';}
 if(trace){g.replay={version:g.version,setup,commands};g.decisions=decisions;const replay=replayDiceGame(g.replay);if(JSON.stringify(replay.scores)!==JSON.stringify(g.scores)||JSON.stringify(replay.log)!==JSON.stringify(g.log))throw Error('Replay mismatch');}
 g.simulationStats={meaningful,steps};return g;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const g=simulateLiveDice({seed:Number(process.argv[2]??42),players:Number(process.argv[3]??4),trace:process.argv.includes('--trace')});
 console.log(JSON.stringify({version:g.version,bot:DICE_BOT_VERSION,ended:g.ended,stalled:g.stalled??false,actions:g.metrics.actions,auctions:g.auctionHistory.length,sales:g.auctionHistory.filter(a=>a.winner!==null).length,rolls:g.metrics.rolls,positions:g.companies.map(c=>c.position),scores:g.scores,...(g.replay?{replay:g.replay}:{})},null,2));
}
