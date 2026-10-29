import {exitRevenue} from './exit-revenue.js';
import {randomizedCommand} from './random-policy.js';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const modules=new Map();
export async function run(job){
 const root=pathToFileURL(path.resolve(job.source)+'/').href;
 if(!modules.has(root))modules.set(root,Promise.all(['engine','bots','config','intel'].map(name=>import(root+name+'.js'))));
 const [engine,bots,config,intel]=await modules.get(root);
 const {createGame,command,currentPlayer,assertGame,replayGame}=engine,{botCommand}=bots,{fundingBand,podium}=config,{intelTargets}=intel;
 const nativeBefore=bots.nativeForecastStats?.(),started=performance.now(),cpu=process.threadCpuUsage?.();
 const setup={seed:job.seed,players:job.players,rules:{intelMode:'mixed',...(job.rules??{})}},g=createGame(setup),commands=[];
 const policyRng={rng:(job.seed^Math.imul((job.actor??0)+1,0x9e3779b9))>>>0};
 const policyRandom=()=>engine.random(policyRng);
 const history=g.companies.map(c=>new Set([c.founder])),everOwned=g.players.map(()=>new Set()),concurrent=g.players.map(()=>new Set()),played=g.players.map(()=>new Set());
 const snap=()=>({leg:g.leg,round:g.metrics.cycles,positions:g.companies.map(c=>c.position),ranks:g.companies.map(c=>podium(g.companies,g.companies.length).indexOf(c.id)+1),arrivalOrders:g.companies.map(c=>c.arrivalOrder),ipoReached:g.ipoCompany!=null,cash:g.players.map(p=>p.cash),supply:g.companies.map(c=>c.supply.length),treasury:g.companies.map(c=>c.reserve),pile:g.pile.length});
 const pileFlows=[];let activeFlow;
 const rounds=[],entries=[snap()],bids=[],auctions=[],cards=[],choices=[],exposure={},powers={},hires={};let key='',finalPortfolio=null,dryRounds=0,ipoEvent=null,afterIPOCommands=0;
 const actions={auction:0,hire:0,raise:0,pass:0,passWithActions:0,drawValue:0,playValue:0,exchangeValue:0,unavailableValue:0,powerUse:0,powerPass:0,bids:0,bidPass:0,tieRaises:0,tiePass:0};
 const observe=()=>{for(const c of g.companies){history[c.id].add(c.founder);for(const t of c.tokens)if(t.owner!==null){everOwned[t.owner].add(c.id);concurrent[t.owner].add(c.founder);}}};observe();
 let steps=0;while(!g.ended&&steps++<12000){
  if(g.metrics.cycles>100)throw Error('Round limit');
  if(key!==`${g.leg}-${g.cycle}`){activeFlow={round:g.metrics.cycles,leg:g.leg,start:g.pile.length,added:0,treasuryAdded:0,drawn:0,discarded:0,burned:0,peak:g.pile.length};pileFlows.push(activeFlow);key=`${g.leg}-${g.cycle}`;for(const c of g.companies){const row=exposure[c.founder]??={rounds:0,ready:0};row.rounds++;row.ready+=+(!c.down&&!c.hiringFumble);}}
  const id=currentPlayer(g),cmd=(id===job.actor?randomizedCommand(engine.observation(g,id),id,job.policy,policyRandom,{engine,config,intel}):null)??botCommand(g,id,{samples:job.samples??8,policy:'adaptive',sampler:job.sampler??'independent'}),oldLog=g.log.length,oldLeg=g.leg;
  if(cmd.type==='raiseMoney')actions.raise++;
  if(g.phase==='call'&&cmd.type!=='raiseMoney'){if(cmd.type==='changeFounder')actions.hire++;else if(cmd.company===null){actions.pass++;actions.passWithActions+=+engine.hasTurnAction(g,id);}else actions.auction++;}
  if(g.phase==='intelPlay'&&cmd.type!=='raiseMoney')actions[cmd.type==='drawValue'?'drawValue':cmd.type==='playIntel'?'playValue':cmd.type==='exchangeValue'?'exchangeValue':'unavailableValue']++;
  if(g.phase==='bid'&&cmd.type!=='raiseMoney'){actions.bids++;actions.bidPass+=+(cmd.amount===0);}
  if(g.phase==='tie'&&cmd.type!=='raiseMoney')actions[cmd.amount?'tieRaises':'tiePass']++;
  if(g.phase==='power'){actions[g.powerChoice.mandatory||cmd.choice>0?'powerUse':'powerPass']++;}
  if(g.phase==='power'){const f=g.powerChoice.founder,row=powers[f]??={offered:0,used:0};row.offered++;row.used+=+(g.powerChoice.mandatory||cmd.choice>0);}
  if(g.phase==='founder'&&cmd.choice>=0){const f=g.founderMarket[cmd.choice];hires[f]=(hires[f]??0)+1;}
  if(g.phase==='bid'&&cmd.type!=='raiseMoney'){const c=g.companies[g.auction.company],band=fundingBand(c.position),need=3-c.reserve;bids.push({mode:g.auction.mode??'sealed',player:id,company:c.id,leg:g.leg,band,amount:cmd.amount,cash:g.players[id].cash,available:g.players[id].cash-(g.players[id].locked??0),space:c.position,shares:c.tokens.length,leading:c.position===Math.max(...g.companies.map(x=>x.position)),useful:need?g.rules.projectPrices[band][need-1]:0});}
  if(g.phase==='intelPlay'&&cmd.type!=='raiseMoney')choices.push({command:cmd.type,player:id,round:g.metrics.cycles,portfolio:g.companies.filter(c=>c.tokens.some(t=>t.owner===id)).length,leg:g.leg,optional:g.intelOptional,kept:cmd.type==='keepValue'||cmd.type==='passValue',selected:(g.intelMarket??g.players[id].intel)[cmd.card]?.kind,cards:(g.intelMarket??g.players[id].intel).map(c=>({kind:c.kind,eligible:intelTargets(g,id,c.kind).length>0}))});
  if(g.phase==='purchaseResult')dryRounds+=+!g.pile.length;
  if(['ipoResult','settle'].includes(g.phase)&&!finalPortfolio)finalPortfolio=g.players.map(p=>g.companies.filter(c=>c.tokens.some(t=>t.owner===p.id)).map(c=>c.id));
  const flowBefore={entered:g.metrics.entered,drawn:g.metrics.revealed+g.metrics.wasted};
  if(job.trace)commands.push({id,cmd});command(g,id,cmd);assertGame(g);observe();
  if(!activeFlow.closed){activeFlow.added+=g.metrics.entered-flowBefore.entered;activeFlow.drawn+=g.metrics.revealed+g.metrics.wasted-flowBefore.drawn;activeFlow.discarded+=g.log.slice(oldLog).filter(e=>e.type==='intelDiscardGrowth').reduce((n,e)=>n+e.cards.length,0);activeFlow.burned+=g.log.slice(oldLog).filter(e=>e.type==='burn').reduce((n,e)=>n+e.count,0);activeFlow.peak=Math.max(activeFlow.peak,g.pile.length);}

  if(!ipoEvent&&g.ipoCompany!=null)ipoEvent={...snap(),company:g.ipoTrigger??g.ipoCompany};
  else if(ipoEvent&&!g.settlement?.final)afterIPOCommands++;
  for(const e of g.log.slice(oldLog)){
   if(e.type==='auction')auctions.push({...e,band:fundingBand(g.companies[e.company].position)});
   if(e.type==='purchases')activeFlow.treasuryAdded+=e.companies.reduce((n,c)=>n+c.count,0);
   if(e.type==='carry'){rounds.push(snap());activeFlow.end=g.pile.length;activeFlow.final=g.ipoCompany!=null;activeFlow.closed=true;if(activeFlow.start+activeFlow.added-activeFlow.drawn-activeFlow.discarded-activeFlow.burned!==activeFlow.end)throw Error('Pile flow does not reconcile '+JSON.stringify({seed:job.seed,activeFlow,phase:g.phase,metrics:g.metrics,events:g.log.slice(oldLog)}));}

   if(e.type==='valueResolved'&&!e.value.draw){cards.push({...e.value,leg:e.leg,round:g.metrics.cycles});played[e.value.player].add(e.value.kind);}
  }
  if(g.leg!==oldLeg)entries.push(snap());
 }
 if(!g.ended)throw Error('Command limit');
 let replay;
 if(job.trace){replay={version:g.version,setup,commands};if(JSON.stringify(replayGame(replay).scores)!==JSON.stringify(g.scores))throw Error('Replay mismatch');}
 const exit=exitRevenue(g.settlement,history.map(x=>[...x]));
 const nativeAfter=bots.nativeForecastStats?.(),native=nativeAfter?{calls:nativeAfter.calls-nativeBefore.calls,fallbacks:nativeAfter.fallbacks-nativeBefore.fallbacks,available:nativeAfter.available}:null;
 if(job.requireNative&&(!native?.available||native.calls<1||native.fallbacks))throw Error('Rust backend required without fallbacks');
 const max=Math.max(...g.scores),winners=g.scores.flatMap((s,i)=>s===max?[i]:[]);
 return {...job,native,source:undefined,version:g.version,ok:true,elapsedMs:performance.now()-started,cpuMicros:cpu?process.threadCpuUsage(cpu):null,steps,replay,exit,settlement:g.settlement,actions,ipoEvent,afterIPOCommands,roundCount:g.metrics.cycles,ipo:g.ipoCompany,scores:g.scores,winners,winnerRepays:winners.every(i=>!g.players[i].debt),defaults:g.metrics.defaults,dryRounds,pileFlows,rounds,entries,final:snap(),history:history.map(x=>[...x]),everOwned:everOwned.map(x=>[...x]),concurrent:concurrent.map(x=>[...x]),finalPortfolio,played:played.map(x=>[...x]),exposure,powers,hires,movement:g.metrics.founderMovement??{},bids,auctions,cards,choices,metrics:g.metrics,companies:g.companies.map(c=>({id:c.id,position:c.position,arrivalOrder:c.arrivalOrder,supply:c.supply.length,shares:g.settlement.outstanding[c.id],price:g.settlement.prices[c.id]}))};
}
