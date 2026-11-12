import {createDiceGame,diceCommand,diceObservation,currentPlayer,replayDiceGame} from '../archive/legacy-dice/dice-engine.js';
import {diceBot,DICE_BOT_VERSION} from '../archive/legacy-dice/dice-bots.js';
import {pathToFileURL} from 'node:url';
export function simulateDice({seed=42,players=4,payoutStep=1,dicePerShare=1,actionsPerRound=5,policies=['balanced','growth','saver','random'],trace=false}={}){
 const setup={seed,players,payoutStep,dicePerShare,actionsPerRound},g=createDiceGame(setup),commands=[],decisions=[];
 for(let step=0;!g.ended&&step<3000;step++){
  const id=currentPlayer(g),view=diceObservation(g,id),policy=policies[id%policies.length];
  const cmd=diceBot(view,id,policy);
  if(!cmd)throw Error(`No bot command: ${g.phase}`);
  if(trace){commands.push({id,cmd});decisions.push({step,round:g.round,phase:g.phase,id,policy,cmd,cash:g.players.map(p=>p.cash),positions:g.companies.map(c=>c.position)});}
  diceCommand(g,id,cmd);
 }
 if(!g.ended)throw Error('Decision cap exceeded');
 if(trace){g.replay={version:g.version,setup,commands};g.decisions=decisions;const replay=replayDiceGame(g.replay);if(JSON.stringify(replay.scores)!==JSON.stringify(g.scores)||JSON.stringify(replay.log)!==JSON.stringify(g.log))throw Error('Replay mismatch');}
 return g;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const option=(name,fallback)=>Number(process.argv.find(arg=>arg.startsWith(`--${name}=`))?.split('=')[1]??fallback);
 const seed=Number(process.argv[2]??42),players=Number(process.argv[3]??4),g=simulateDice({seed,players,payoutStep:option('payout',1),dicePerShare:option('dice',1),actionsPerRound:option('actions',5),trace:process.argv.includes('--trace')});
 console.log(JSON.stringify({version:g.version,bot:DICE_BOT_VERSION,seed,players,payoutStep:g.payoutStep,dicePerShare:g.dicePerShare,actionsPerRound:g.actionsPerRound,auctions:g.auctionHistory.length,sales:g.auctionHistory.filter(a=>a.winner!==null).length,scores:g.scores,rounds:g.round,rolls:g.metrics.rolls,positions:g.companies.map(c=>c.position),...(g.replay?{replay:g.replay}: {})},null,2));
}
