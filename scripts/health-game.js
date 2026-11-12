import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export async function run(job){
 const E=await import(pathToFileURL(job.source+'/engine.js')),B=await import(pathToFileURL(job.source+'/bots.js')),I=await import(pathToFileURL(job.source+'/intel.js')),C=await import(pathToFileURL(job.source+'/config.js'));
 const baseline=job.botSource?await import(pathToFileURL(job.botSource+'/bots.js')):null;
 const setup={seed:job.seed,players:job.players,rules:job.rules??{}},g=E.createGame(setup),commands=[],decisions=[],actions={},rounds=[],latencies=[],initialFirst=g.first;
 let leadChanges=0,lastStakeSales=0;
 const counters=()=>({
  entered:g.metrics.entered, draws:(g.metrics.revealed??0)+(g.metrics.deferred??0),
  recovery:(g.metrics.deferred??0), fumbles:(g.metrics.founderFumbles??0),
  converted:(g.metrics.fumbleConversions??0), discarded:(g.metrics.burned??0),
  growth:(g.metrics.growthMovement??0), founderMovement:(g.metrics.founderBonus??0)
 });
 let roundStart=job.flow?counters():null, turnEntries=[], actionPhase=true, preRevealBag=null;
 const flowRounds=[];
 let rng=(job.seed^0x9e3779b9)>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32;},pick=a=>a[Math.floor(rand()*a.length)];
 const portfolios=()=>g.players.map(p=>g.companies.filter(c=>E.holdings(c,p.id)>0).length);
 const agency=[],cardExposure={},cardEligible={},founderExposure={},powerOffers={},powerUses={};let steps=0,error=null,phase='';
 try{
 for(;!g.ended&&steps<6000&&g.metrics.cycles<=80;steps++){
  const id=E.currentPlayer(g),v=E.observation(g,id),p=g.players[id];phase=g.phase;
  const turn=phase==='call';
  if(turn&&job.health){
   const companies=g.companies.filter(c=>E.holdings(c,id)>0),funding=E.eligibleCompanies(g,id).length,hires=g.companies.filter(c=>E.lead(c)===id).length,sales=companies.length;
   const playable=p.intel.filter(c=>I.intelTargets(v,id,c.kind).length>0),targets=playable.reduce((n,c)=>n+I.intelTargets(v,id,c.kind).length,0);
   const choices={funding,hires,sales,playableCards:playable.length,cardTargets:targets,discard:p.intel.length?1:0,capital:p.capital<6?1:0,draw:p.intel.length?0:1};
   agency.push({id,round:g.metrics.cycles,portfolio:companies.length,cash:p.cash,capital:p.capital,...choices,families:[funding,hires,sales,playable.length,choices.discard,choices.capital,choices.draw].filter(Boolean).length});
  }
  if(turn)for(const card of p.intel??[]){cardExposure[card.kind]=(cardExposure[card.kind]??0)+1;if(I.intelTargets(v,id,card.kind).length)cardEligible[card.kind]=(cardEligible[card.kind]??0)+1;}const portfolio=portfolios(),cash=p.cash,capital=p.capital,start=g.log.length;
  let cmd;const evaluations=[];
  if(job.policy==='passive'&&id===job.seat&&['call','bid','tie'].includes(phase))cmd=phase==='call'?(p.capital<6?{type:'raiseMoney'}:undefined):{type:phase,amount:0};
  if(job.policy==='simpleRandom'&&id===job.seat){
   if(phase==='call')cmd=pick([...(p.capital<6?[{type:'raiseMoney'}]:[]),...E.eligibleCompanies(g,id).map(company=>({type:'call',company})),...g.companies.filter(c=>E.lead(c)===id).map(c=>({type:'changeFounder',company:c.id})),...g.companies.filter(c=>E.holdings(c,id)).map(c=>({type:'sellShare',company:c.id})),...(p.intel.length?[{type:'valueAction'}]:[])]);
   if(['bid','tie'].includes(phase)){const min=phase==='bid'?g.auction.reserve:g.auction.price+1;cmd={type:phase,amount:pick([0,...new Set([min,4,8,12].filter(n=>n>=min&&n<=C.availableCash(p)))])};}
   if(phase==='power')cmd={type:'power',choice:Math.floor(rand()*g.powerChoice.options.length)};
  }
  const priorLeads=job.health?g.companies.map(c=>E.lead(c)):[];
  const t=performance.now();cmd??=(baseline&&(job.botAll||job.baselineSeats?.includes(id)||id===job.seat)?baseline:B).botCommand(g,id,{samples:job.samples,policy:job.flow?'adaptive':undefined,audit:job.trace?evaluations:null});latencies.push(performance.now()-t);
  if(phase==='power'){const f=g.powerChoice.founder;powerOffers[f]=(powerOffers[f]??0)+1;if(g.powerChoice.options[cmd.choice]?.actions?.length)powerUses[f]=(powerUses[f]??0)+1;}
  const detail=job.trace?{step:steps,round:g.metrics.cycles,phase,id,cmd,cash,capital,portfolio,evaluations,positions:g.companies.map(c=>c.position),actionsLeft:g.actionsLeft,eligible:turn?{funding:E.eligibleCompanies(g,id),founders:g.companies.filter(c=>E.lead(c)===id).map(c=>c.id),sales:g.companies.filter(c=>E.holdings(c,id)).map(c=>c.id),cards:I.bestIntelPlay(v,id)}:undefined}:null;
  if(turn&&cmd.type!=='valueAction'||phase==='intelPlay'&&['playIntel','exchangeValue'].includes(cmd.type))actions[cmd.type]=(actions[cmd.type]??0)+1;
  if(job.health&&cmd.type==='sellShare'&&portfolio[id]===1&&E.holdings(g.companies[cmd.company],id)===1)lastStakeSales++;
  const enteredBefore=job.flow?g.metrics.entered:0, turnIndex=g.callIndex-1;
  commands.push({id,cmd});E.command(g,id,cmd);E.assertGame(g);
  if(job.flow){
   const newEvents=g.log.slice(start);
   if(actionPhase){
    turnEntries[turnIndex]=(turnEntries[turnIndex]??0)+g.metrics.entered-enteredBefore;
    if(newEvents.some(e=>e.type==='purchases'))actionPhase=false;
   }
   if(phase==='reveal'&&cmd.type==='reveal'&&preRevealBag===null)preRevealBag=g.pile.length+1;
   if(newEvents.some(e=>e.type==='carry')){
    const now=counters();
    const flow=Object.fromEntries(Object.keys(now).map(key=>[key,now[key]-roundStart[key]]));
    flowRounds.push({...flow, round:detail?.round??g.metrics.cycles, turns:[...turnEntries],
     preRevealBag:preRevealBag??0, bag:g.pile.length, down:g.companies.filter(c=>c.down||c.hiringFumble).length});
    roundStart=now;turnEntries=[];actionPhase=true;preRevealBag=null;
   }else if(phase==='cycleResult'||phase==='legResult'||phase==='settle'||phase==='exitResult'||phase==='finalResult'){
    // Settlement acknowledgements do not start investor turns.
    if(g.phase!=='call')turnEntries=[];
   }
  }
  if(job.health)leadChanges+=g.companies.filter((c,i)=>priorLeads[i]!==null&&E.lead(c)!==null&&priorLeads[i]!==E.lead(c)).length;
  if(detail){detail.events=g.log.slice(start);detail.afterCash=g.players.map(p=>p.cash);decisions.push(detail);}
  for(const event of g.log.slice(start))if(event.type==='carry'){for(const c of g.companies)founderExposure[c.founder]=(founderExposure[c.founder]??0)+1;rounds.push({round:g.metrics.cycles,positions:g.companies.map(c=>c.position),supply:g.companies.map(c=>c.supply.length),issued:g.companies.map(c=>c.tokens.length),portfolio:portfolios(),down:g.companies.filter(c=>c.down||c.hiringFumble).length,bag:g.pile.length,capital:g.players.map(p=>p.capital),cash:g.players.map(p=>p.cash),auctions:g.metrics.auctions});}
 }
 if(!g.ended)error='censored: 80 rounds or 6000 commands';
 if(g.ended){
  const replay=E.replayGame({version:g.version,setup,commands});if(JSON.stringify(replay.scores)!==JSON.stringify(g.scores))throw Error('Replay scores differ');
  for(const p of g.players){
   const events=g.log,invested=g.auctionHistory.filter(a=>a.winner===p.id).reduce((n,a)=>n+a.paid,0),sales=events.filter(e=>e.type==='sellShare'&&e.player===p.id).reduce((n,e)=>n+e.payout,0),conflicts=events.filter(e=>e.type==='intelPlay'&&e.player===p.id&&e.kind==='conflict').length*g.rules.conflictPayout,exit=g.settlement.holdings[p.id].reduce((n,count,cid)=>n+count*g.settlement.prices[cid],0);
   const cardCash=events.filter(e=>e.type==='cardCash'&&e.player===p.id).reduce((n,e)=>n+e.amount,0),transfer=events.filter(e=>e.type==='shareTransfer').reduce((n,e)=>n+(e.seller===p.id?e.amount:0)-(e.player===p.id?e.amount:0),0),capitalCash=events.filter(e=>e.type==='raiseMoney'&&e.player===p.id).reduce((n,e)=>n+e.cash,0);
   if(g.scores[p.id]!==g.rules.startingCash-invested+sales+conflicts+exit+cardCash+transfer+capitalCash-p.capital*10)throw Error('Independent score accounting failed for '+p.id);
  }
 }
 }catch(e){error=e.stack;}
 const row={...job,source:undefined,version:g.version,cardExposure,cardEligible,powerOffers,powerUses,founderExposure,cardPlays:Object.fromEntries(Object.keys(I.INTEL_CARDS).map(k=>[k,g.log.filter(e=>e.type==='intelPlay'&&e.kind===k).length])),founderActivations:Object.fromEntries(C.ACTIVE_FOUNDERS.map(f=>[f,g.log.flatMap(e=>e.reactions??[]).filter(r=>r.founder===f).length])),status:error?(error.startsWith('censored')?'censored':'failed'):'completed',error,phase,steps,roundCount:g.metrics.cycles,scores:g.scores,winners:g.winners,actions,rounds,capital:g.players.map(p=>p.capital),metrics:g.metrics,bank:g.bank,settlement:g.settlement,latency:{mean:latencies.reduce((a,b)=>a+b,0)/latencies.length,max:Math.max(...latencies)},founders:g.companies.map(c=>c.founder)};
 if(job.health){
  const auctions=g.auctionHistory??[],events=g.log,plays=events.filter(e=>e.type==='intelPlay');
  row.health={first:initialFirst,leadChanges,lastStakeSales,agency,auctionCount:auctions.length,noBid:auctions.filter(a=>a.winner===null).length,contested:auctions.filter(a=>(a.bids??[]).filter(b=>b.amount>0).length>1).length,
   payments:auctions.filter(a=>a.winner!==null).map(a=>a.paid),sales:events.filter(e=>e.type==='sellShare').map(e=>({player:e.player,company:e.company,payout:e.payout})),
   hires:events.filter(e=>e.type==='founder').length,hiresByPlayer:g.players.map(p=>commands.filter(x=>x.id===p.id&&x.cmd.type==='founder'&&x.cmd.choice>=0).length),exchangesByPlayer:g.players.map(p=>commands.filter(x=>x.id===p.id&&x.cmd.type==='exchangeValue').length),exchanges:events.filter(e=>e.type==='intelExchange').length,draws:events.filter(e=>e.type==='intelDraw').length,
   cardPlays:plays.map(e=>({kind:e.kind,player:e.player,company:e.company})),marketRefreshes:events.filter(e=>e.type==='founderMarketRefresh').length,
   finalPositions:g.companies.map(c=>c.position),finalPortfolios:portfolios(),auctionDetails:auctions.map(a=>({company:a.company,host:a.host,winner:a.winner,paid:a.paid,mode:a.context?.mode??'sealed',hostHeld:a.context?.owners?.[a.company]?.includes(a.host)??false})),
   capitalCash:events.filter(e=>e.type==='raiseMoney').length,leadOverrides:plays.filter(e=>['coup','mandate'].includes(e.kind)).length};
 }
 if(job.flow){
  row.flow={rounds:flowRounds, initialTokens:g.companies.length, requestedDraws:g.rules.revealsPerRound,
   debt:g.players.map(p=>p.debt??0), capitalDeduction:g.players.map(p=>C.capitalPenalty(p)),
   endingCash:g.players.map(p=>p.cash), finalHands:g.players.map(p=>p.intel.length),
   valueDraws:g.metrics.intelDraws??0, ordinaryHires:actions.changeFounder??0,
   founderSwaps:g.log.filter(e=>e.type==='founderSwap').length,
   replacements:g.log.filter(e=>e.type==='founder').length,
   tokenFumbles:g.log.filter(e=>['reveal','deferred'].includes(e.type)&&e.card?.effect==='fumble').length,
   cardDiscards:Object.fromEntries(Object.keys(I.INTEL_CARDS).map(kind=>[kind,g.log.filter(e=>e.type==='intelExchange'&&e.discard===kind).length])),
   founderMovement:g.metrics.founderMovement??{},
   firstGrowthRound:flowRounds.find(r=>r.growth>0)?.round??null
  };
 }
 if(job.trace){row.traceFile=`samples/${job.id}.json`;fs.writeFileSync(job.out+'/'+row.traceFile,JSON.stringify({version:g.version,setup,commands,decisions,log:g.log,final:g},null,2));}
 return row;
}
