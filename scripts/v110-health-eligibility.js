import fs from 'node:fs';import{fileURLToPath}from 'node:url';
export async function run(job){
 const root=job.out, E=await import('file://'+root+'/source/engine.js'),B=await import('file://'+root+'/source/bots.js'),I=await import('file://'+root+'/source/intel.js');
 const g=E.createGame({seed:job.seed,players:job.players,rules:job.rules??{}}),eligible={},offers={},uses={},hires={},noBidCalls=[],primary=[],roundless=[];let lateEmpty=0,lateTurns=0;
 for(let step=0;!g.ended&&step<6000;step++){
  const id=E.currentPlayer(g),phase=g.phase;
  if(phase==='call'){
   if(g.metrics.cycles>1){lateTurns++;if(!g.companies.some(c=>E.holdings(c,id)))lateEmpty++;}
   const v=E.observation(g,id);for(const card of g.players[id].intel)if(I.intelTargets(v,id,card.kind).length)eligible[card.kind]=(eligible[card.kind]??0)+1;
  }
  const cmd=B.botCommand(g,id,{samples:job.samples});
  if(phase==='power'){const f=g.powerChoice.founder;offers[f]=(offers[f]??0)+1;if(g.powerChoice.options[cmd.choice]?.actions?.length)uses[f]=(uses[f]??0)+1;}
  const market=[...g.founderMarket],before=g.companies.map(c=>c.founder);E.command(g,id,cmd);
  for(const c of g.companies)if(c.founder!==before[c.id]&&market.includes(c.founder))hires[c.founder]=(hires[c.founder]??0)+1;
  if(phase==='call')primary.push({step,id,cmd,round:g.metrics.cycles,cash:g.players[id].cash});
  if(phase==='auctionResult'&&g.auctionHistory.at(-1)?.winner===null)noBidCalls.push(g.auctionHistory.at(-1));
 }
 if(JSON.stringify(g.scores)!==JSON.stringify(job.scores)||g.metrics.cycles!==job.roundCount)throw Error('Instrumentation rerun diverged: '+job.id);
 return{id:job.id,eligible,offers,uses,hires,lateEmpty,lateTurns,verifiedIdentical:true};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {parallel}=await import('./parallel.js');
 const out='docs/v110-health',rows=fs.readFileSync(out+'/games.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(r=>r.id.startsWith('self-')),file=out+'/eligibility.jsonl';
 fs.writeFileSync(out+'/eligibility-protocol.json',JSON.stringify({purpose:'Supplementary instrumentation after the completed frozen cohort; same source, seeds, samples and policy. Every rerun must exactly reproduce original scores and round count.',games:72,fields:{eligible:'In-hand call-state exposure with at least one legal target',offers:'actual optional founder decision commands',uses:'chosen option has at least one action, excluding passes',hires:'a company changes to a founder present in the public market',lateEmpty:'portfolio-empty call states after round 1'}},null,2));
 const prior=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],seen=new Set(prior.map(r=>r.id));
 await parallel(rows.filter(r=>!seen.has(r.id)),{moduleURL:import.meta.url,workers:4,onResult:r=>{fs.appendFileSync(file,JSON.stringify(r)+'\n');console.log(r.id,'identical');}});
}
