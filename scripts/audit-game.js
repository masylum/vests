import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const modules=new Map();
export async function run({seed,samples=24,out,source='src'}){
 const root=pathToFileURL(path.resolve(source)+'/').href;
 if(!modules.has(root))modules.set(root,Promise.all(['engine','bots','adaptive','intel','config'].map(name=>import(root+name+'.js'))));
 const [engine,bots,adaptive,intel,config]=await modules.get(root);
 const {createGame,command,currentPlayer,assertGame,observation,replayGame,lead,holdings}=engine;
 const {botCommand,forecasts,saleValue,secondaryValue}=bots,{fundingNeed}=adaptive;
 const {bestIntelPlay,intelValue,INTEL_CARDS,canDrawIntel}=intel,{VERSION,fundingBand,companyValue,sharePayout}=config;
 const setup={seed,players:4,rules:{intelMode:'mixed'}},g=createGame(setup),commands=[],decisions=[];
 const widths=[];let snapshotRound=0;
 for(let step=0;!g.ended&&step<12000;step++){
  const id=currentPlayer(g),v=observation(g,id),cmd=botCommand(v,id,{samples,sampler:'independent',policy:'adaptive'});
  if(g.metrics.cycles>80)throw Error('Audit game stalled');
  if(['call','bid','tie','intelPlay','founder','power'].includes(g.phase)){
   const own=g.companies.filter(c=>holdings(c,id)),row={step,round:g.metrics.cycles,leg:g.leg,phase:g.phase,player:id,cash:v.players[id].cash,locked:v.players[id].locked,command:cmd,portfolio:own.map(c=>({company:c.id,controlled:lead(c)===id,founder:c.founder,shares:holdings(c,id),total:c.tokens.length,position:c.position,treasury:c.reserve,supply:c.supply.length,pending:v.poolWeights[c.id],need:fundingNeed(v,c.id)}))};
   if(g.phase==='bid'||g.phase==='tie'){const c=g.companies[g.auction.company];row.auction={company:c.id,position:c.position,treasury:c.reserve,supply:c.supply.length,own:holdings(c,id),issued:c.tokens.length,minimum:g.auction.reserve,need:fundingNeed(v,c.id)};}
   if(g.phase==='intelPlay'){const values=g.players[id].intel.some(c=>['sell','secondary'].includes(c.kind))?forecasts(v,id,{samples,sampler:'independent'}):null;const best=bestIntelPlay(v,id,(kind,cid)=>kind==='sell'?saleValue(v,id,cid,values):kind==='secondary'?secondaryValue(v,id,cid,values):intelValue(v,id,kind,cid));if(values)row.saleForecasts=own.map(c=>({company:c.id,price:values[c.id].finalPrices.reduce((a,b)=>a+b,0)/samples,value:saleValue(v,id,c.id,values)}));row.hand=g.players[id].intel.map(c=>c.kind);row.canDraw=canDrawIntel(v,id);row.bestValue=best.value;row.card=cmd.type==='playIntel'?g.players[id].intel[cmd.card].kind:null;row.quote=cmd.company===undefined?null:sharePayout(companyValue(g.companies[cmd.company].position,g.rules),g.companies[cmd.company].tokens.length,g.rules);}
   if(g.phase==='founder')row.founders={company:g.company,current:g.companies[g.company].founder,market:[...g.founderMarket],headhunting:g.valueResult?.kind==='headhunt'&&!!g.intelOrder};
   if(g.phase==='power')row.power=structuredClone(g.powerChoice);
   decisions.push(row);
  }
  if(snapshotRound!==g.metrics.cycles){snapshotRound=g.metrics.cycles;widths.push({round:snapshotRound,portfolio:g.players.map(p=>g.companies.filter(c=>holdings(c,p.id)).length)});}
  commands.push({id,cmd});command(g,id,cmd);assertGame(g);
 }
 if(!g.ended)throw Error('Audit game incomplete');
 const replay={version:VERSION,setup,commands};if(JSON.stringify(replayGame(replay).scores)!==JSON.stringify(g.scores))throw Error('Audit replay differs');
 const calls=decisions.filter(d=>d.phase==='call'),plays=decisions.filter(d=>d.card),bids=decisions.filter(d=>d.phase==='bid');
 const summary={seed,samples,rounds:g.metrics.cycles,scores:g.scores,winners:g.winners,finalPortfolio:g.settlement.holdings.map(row=>row.filter(n=>n>0).length),calls:calls.length,auctions:calls.filter(d=>d.command.type==='call'&&d.command.company!=null).length,founderChanges:decisions.filter(d=>d.phase==='founder').length,cardPlays:plays.length,cardKinds:[...new Set(plays.map(d=>d.card))],diversification:widths,
 review:{earlyLargeBids:bids.filter(d=>d.round<=2&&d.command.amount>0&&d.cash>d.locked&&d.command.amount>=.85*(d.cash-d.locked)),dryPasses:calls.filter(d=>d.command.type==='call'&&d.command.company===null&&d.portfolio.some(c=>c.controlled&&c.treasury===0&&c.need>0&&d.cash-d.locked>=g.rules.projectPrices[fundingBand(c.position)][0])),forcedNegativeCards:plays.filter(d=>d.bestValue<0),saleAboveQuote:plays.filter(d=>d.card==='sell'&&d.quote>g.rules.sellPayouts[d.leg]),unneededOwnedRaises:calls.filter(d=>d.command.type==='call'&&d.command.company!=null&&d.portfolio.some(c=>c.company===d.command.company&&c.need===0))}};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/${seed}-events.json`,JSON.stringify(g.log));fs.writeFileSync(`${out}/${seed}-replay.json`,JSON.stringify(replay));fs.writeFileSync(`${out}/${seed}-decisions.json`,JSON.stringify(decisions));return summary;
}
