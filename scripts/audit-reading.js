import fs from 'node:fs';
const root=process.argv[2]??'docs/v93-health-1000';
const out=root+'/bot-audit';
const summaries=JSON.parse(fs.readFileSync(`${out}/summary.json`));
for(const s of summaries.sort((a,b)=>a.seed-b.seed)){
 const d=JSON.parse(fs.readFileSync(`${out}/${s.seed}-decisions.json`)),e=JSON.parse(fs.readFileSync(`${out}/${s.seed}-events.json`)),replay=JSON.parse(fs.readFileSync(`${out}/${s.seed}-replay.json`));
 const f=await import(process.cwd()+'/'+root+'/study/source/config.js');
 const lines=[`GAME ${s.seed} rounds=${s.rounds} scores=${s.scores}`,`Initial founders ${replay.setup.seed}: ${JSON.stringify((await import(process.cwd()+'/'+root+'/study/source/engine.js')).createGame(replay.setup).companies.map(c=>[c.id,f.FOUNDERS[c.founder].name]))}`];
 for(const x of d){
  let text=`D${x.step} R${x.round} P${x.player} $${x.cash}-${x.locked} ${JSON.stringify(x.command)}`;
  if(x.phase==='call')text+=` held=${x.portfolio.map(c=>`${c.company}:${c.shares}/${c.total}@${c.position},t${c.treasury},need${c.need.toFixed(1)}`).join(';')}`;
  if(x.phase==='intelPlay')text+=` hand=${x.hand} card=${x.card} best=${x.bestValue?.toFixed(1)} sell=${x.saleForecasts?.map(c=>`${c.company}:${c.value.toFixed(1)}`).join(';')??''}`;
  if(x.phase==='founder')text+=` c${x.founders.company} ${f.FOUNDERS[x.founders.current].name} -> ${x.founders.market.map(n=>f.FOUNDERS[n].name).join('/')}`;
  if(x.phase==='power')text+=` ${(f.FOUNDERS[x.power.founder]?.name??'Signature')}: ${x.power.options[x.command.choice]?.label} ALTS=${x.power.options.map(o=>o.label).join('/')}`;
  if(x.phase==='bid'||x.phase==='tie')text+=` c${x.auction.company}@${x.auction.position} own${x.auction.own}/${x.auction.issued} t${x.auction.treasury} need${x.auction.need.toFixed(1)}`;
  lines.push(text);
 }
 lines.push('ORDERED EVENTS:');
 for(const [i,x] of e.entries()){
  let text=`E${i} L${x.leg}C${x.cycle} ${x.type}`;
  if(x.type==='auction')text+=` c${x.company} winnerP${x.winner} paid${x.paid} bids${x.bids.map(b=>`P${b.player}:${b.amount}`).join(',')}`;
  if(x.type==='founder')text+=` c${x.company} ${f.FOUNDERS[x.old]?.name}->${f.FOUNDERS[x.founder]?.name}`;
  if(x.type==='founderSwap')text+=' '+JSON.stringify(x);
  if(x.type==='valueResolved')text+=` P${x.value.player} ${x.value.kind} c${x.value.company} target${x.value.target} cash${x.value.cashChange??0} positions${x.value.after?.map(c=>c.position)} effects:${x.value.reactions.map(t=>t.text).join(';')}`;
  if(x.type==='reveal'||x.type==='deferred')text+=` c${x.card?.company} ${x.card?.signature||x.card?.effect||x.card?.printed} ${x.effect?.before}->${x.effect?.after} positions=${x.finalPositions??x.positions} effects:${x.reactions?.map(t=>t.text).join(';')}`;
  if(x.type==='founderPhase')text+=` ${x.stage} positions=${x.finalPositions} ${x.reactions.map(t=>`F${t.founder}:${t.text}`).join(';')}`;
  if(x.type==='carry')text+=' '+JSON.stringify(x);
  if(x.type==='checkpoint')text+=` positions${x.snapshot.positions}`;
  if(x.type==='settled')text+=` ${x.accounts.map(a=>`P${a.player}:before${a.before},due${a.due},cash${a.cash},unpaid${a.unpaid},fee${a.fee}`).join(';')}`;
  if(x.type==='burn')text+=` ${x.count}`;
  if(!['deploy','intelDraw','pass','purchases','intelPlay'].includes(x.type))lines.push(text);
 }
 fs.writeFileSync(`${out}/${s.seed}-reading.txt`,lines.join('\n'));
}
