import {createGame,command,currentPlayer,assertGame,replayGame} from '../src/engine.js';
import {botCommand} from '../src/bots.js';
export function run({replay,step,company,player,baseline}){
 const g=createGame(replay.setup),commands=replay.commands.slice(0,step);
 for(const {id,cmd} of commands)command(g,id,cmd);
 if(g.phase!=='call'||currentPlayer(g)!==player)throw Error('Pass prefix differs');
 const round=g.metrics.cycles,c=g.companies[company],before={cash:g.players[player].cash,position:c.position,treasury:c.reserve,supply:c.supply.length,held:c.tokens.filter(t=>t.owner===player).length,issued:c.tokens.length};
 const forced={id:player,cmd:{type:'call',company}};commands.push(forced);command(g,player,forced.cmd);assertGame(g);
 for(let i=0;!g.ended&&i<12000;i++){const id=currentPlayer(g),cmd=botCommand(g,id,{samples:24});commands.push({id,cmd});command(g,id,cmd);assertGame(g);}
 if(!g.ended)throw Error('Pass check stalled');
 if(JSON.stringify(replayGame({version:g.version,setup:replay.setup,commands}).scores)!==JSON.stringify(g.scores))throw Error('Pass check replay differs');
 return{seed:replay.setup.seed,step,round,player,company,before,baseline,forcedScore:g.scores[player],difference:g.scores[player]-baseline,scores:g.scores,rounds:g.metrics.cycles};
}
