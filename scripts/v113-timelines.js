import fs from'node:fs';import{createGame,command}from'../docs/v113-health/source/engine.js';import{FOUNDERS}from'../docs/v113-health/source/config.js';import{INTEL_CARDS}from'../docs/v113-health/source/intel.js';
for(let n=1;n<=10;n++){
 const file=`docs/v113-health/samples/sample-${n}`;if(!fs.existsSync(file+'.json'))continue;const s=JSON.parse(fs.readFileSync(file+'.json')),g=createGame(s.setup),lines=[`GAME ${n} seed=${s.setup.seed} players=${s.setup.players} first=${g.first}; initial founders=${g.companies.map(c=>c.id+':'+FOUNDERS[c.founder].name).join(', ')}; market=${g.founderMarket.map(f=>FOUNDERS[f].name).join(', ')}`];
 for(const d of s.decisions){
  const c=d.cmd,start=g.log.length,positions=g.companies.map(c=>c.position).join('/');
  let what=c.type;
  if(c.type==='playIntel')what=INTEL_CARDS[g.players[d.id].intel[c.card].kind].name+` company=${c.company}${c.target!==undefined?' target='+c.target:''}${c.founder!==undefined?' founder='+FOUNDERS[g.founderMarket[c.founder]].name:''}${c.price!==undefined?' price='+c.price:''}${c.seller!==undefined?' seller='+c.seller:''}`;
  if(c.type==='exchangeValue')what='discard '+INTEL_CARDS[g.players[d.id].intel[c.card].kind].name;
  if(c.type==='founder')what='hire '+(c.choice<0?'none':FOUNDERS[g.founderMarket[c.choice]].name)+' company='+g.company;
  if(c.type==='power')what=FOUNDERS[g.powerChoice.founder].name+' '+g.powerChoice.options[c.choice].label;
  if(['call','sellShare','changeFounder'].includes(c.type))what+=' company='+c.company;
  if(['bid','tie','openBid'].includes(c.type))what+=' $'+c.amount;
  if(c.type==='rights')what+=' '+c.accept;
  command(g,d.id,c);
  const events=g.log.slice(start),after=g.companies.map(c=>c.position).join('/');
  if(!['continue','valueAction','finalSale','finalObligation','reveal','passValue','powerDone'].includes(c.type)){
   const ranking=d.evaluations.filter(e=>Number.isFinite(e.gain)).sort((a,b)=>b.gain-a.gain).slice(0,2).map(e=>`${e.action.type}${e.action.company??''}=${e.gain.toFixed(1)}`).join(',');
   lines.push(`r${d.round} p${d.id} $${d.cash} cap${d.capital} actions${d.actionsLeft}: ${what}${positions!==after?' @'+positions+' → '+after:''}${ranking?' [best '+ranking+']':''}`);
  }
  for(const e of events){
   if(e.type==='auction')lines.push(` AUCTION co${e.company} winner=${e.winner} paid=${e.paid}`);
   if(e.type==='reveal'||e.type==='deferred')lines.push(` TOKEN co${e.card.company} ${e.type==='deferred'?'discard/recover':e.card.effect??'+'+e.card.printed} @${positions} → ${after}`);
   if(e.type==='burn')lines.push(` BAG DISCARD ${e.cards.map(t=>'co'+t.company+':'+(t.effect??'+'+t.printed)).join(',')}`);
   if(e.type==='carry')lines.push(` END ROUND ${d.round}: @${after} owners=${g.companies.map(c=>c.tokens.map(t=>t.owner??'B').join('')).join('/')} cash=${g.players.map(p=>p.cash)} capital=${g.players.map(p=>p.capital)}`);
  }
 }
 lines.push(`FINAL scores=${g.scores}; winners=${g.winners}; companies=${g.companies.map(c=>c.id+'@'+c.position+':'+FOUNDERS[c.founder].name).join(',')}`);
 fs.writeFileSync(file+'-timeline.txt',lines.join('\n'));
}
