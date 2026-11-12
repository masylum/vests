import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame} from '../src/live-dice-engine.js';
import {diceBot,diceEvaluations,DICE_BOT_VERSION} from '../src/live-dice-bots.js';
import {pathToFileURL} from 'node:url';
export function simulateLiveDice({seed=42,players=4,policies=['balanced'],dicePolicy='adaptive',trace=false,payoutMode='perShare',perShareMax=20,exitCurve='early5',initialCapital=20,secretBonuses=true,daniloStep=true,supportPolicy='planner',dealCopies,capitalRoundLimit=Infinity,maxRoundsSafety=Infinity,rowSize=5,roundLimit=null,endOnDeckExhaustion=true,maxDecisions=2000}={}){
 const setup={seed,players,rowSize,roundLimit,endOnDeckExhaustion,payoutMode,perShareMax,exitCurve,initialCapital,secretBonuses,daniloStep,...(dealCopies===undefined?{}:{dealCopies})},g=createDiceGame(setup),commands=[],decisions=[];let meaningful=0,steps=0,capitalStreak=0;
 for(let step=0;!g.ended&&!g.stalled&&step<maxDecisions;step++){
  if(g.round>maxRoundsSafety){g.cutoff=`Study safety stop after ${maxRoundsSafety} rounds`;break;}
  const id=currentPlayer(g),view=diceObservation(g,id),policy=policies[id%policies.length],plans=[],cmd=diceBot(view,id,policy,{dicePolicy,supportPolicy,onPlan:plan=>plans.push(plan)});
  steps++;if(!['continue','roll'].includes(cmd.type)||(cmd.type==='roll'&&g.flowStage==='setup'))meaningful++;
  if(trace){
   const entry=g.phase==='chooseDice'?g.pendingGrowth.find(e=>!e.resolved&&!e.dice):null;
   commands.push({id,cmd});decisions.push({step,round:g.round,phase:g.phase,id,policy,cmd,...(plans.length?{plans}:{}),cash:g.players.map(p=>p.cash),positions:g.companies.map(c=>c.position),...(entry?{evaluations:diceEvaluations(view,id,entry.company)}:{})});
  }
  diceCommand(g,id,cmd);
  if(cmd.type==='raiseMoney')capitalStreak++;else if(['call','valueAction','changeFounder'].includes(cmd.type))capitalStreak=0;
  if(capitalStreak>=players*capitalRoundLimit){g.cutoff=`${capitalRoundLimit} consecutive capital-only rounds`;break;}
 }
 if(!g.ended&&!g.stalled){g.censored=true;g.cutoff??=`Decision limit ${maxDecisions}`;}
 if(trace){g.replay={version:g.version,setup,commands};g.decisions=decisions;const replay=replayDiceGame(g.replay);if(JSON.stringify(replay.scores)!==JSON.stringify(g.scores)||JSON.stringify(replay.log)!==JSON.stringify(g.log))throw Error('Replay mismatch');}
 g.simulationStats={meaningful,steps};return g;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const g=simulateLiveDice({seed:Number(process.argv[2]??42),players:Number(process.argv[3]??4),trace:process.argv.includes('--trace')});
 console.log(JSON.stringify({version:g.version,bot:DICE_BOT_VERSION,ended:g.ended,stalled:g.stalled??false,actions:g.metrics.actions,auctions:g.auctionHistory.length,sales:g.auctionHistory.filter(a=>a.winner!==null).length,rolls:g.metrics.rolls,positions:g.companies.map(c=>c.position),scores:g.scores,...(g.replay?{replay:g.replay}:{})},null,2));
}
