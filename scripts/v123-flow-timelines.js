import fs from'node:fs';import{createGame,command}from'../docs/v123-balanced-flow/source/engine.js';import{FOUNDERS}from'../docs/v123-balanced-flow/source/config.js';
for(let n=1;n<=10;n++){
 const file=`docs/v123-flow-validation/samples/sample-${n}`;if(!fs.existsSync(file+'.json'))continue;const s=JSON.parse(fs.readFileSync(file+'.json')),g=createGame(s.setup),out=[`GAME ${n}; seed ${s.setup.seed}; 4 players; first P${g.first}; founders ${g.companies.map(c=>`C${c.id}=${FOUNDERS[c.founder].name}`).join('; ')}; market ${g.founderMarket.map(id=>id+' '+FOUNDERS[id].name).join(', ')}`];let round=0;
 for(const d of s.decisions){
  if(d.round!==round){round=d.round;out.push(`ROUND ${round}`);}const c=d.cmd,phase=g.phase,begin=g.log.length,before=g.companies.map(c=>c.position);let action='';
  if(c.type==='playIntel')action=`${g.players[d.id].intel[c.card].kind}@C${c.company}${c.target!==undefined?'/C'+c.target:''}${c.seller!==undefined?' sellerP'+c.seller:''}${c.price!==undefined?' price$'+c.price:''}${c.founder!==undefined?' founder='+FOUNDERS[g.founderMarket[c.founder]].name:''}`;
  if(c.type==='exchangeValue')action='discard '+g.players[d.id].intel[c.card].kind;
  if(c.type==='founder')action='hire '+(c.choice<0?'none':FOUNDERS[g.founderMarket[c.choice]].name)+'@C'+g.company;
  if(['call','sellShare','changeFounder'].includes(c.type))action=c.type+'@C'+c.company;
  if(['raiseMoney','drawValue'].includes(c.type))action=c.type;
  if(c.type==='power')action=`C${g.powerChoice.company} ${g.race?.stage??'token'}: ${g.powerChoice.options[c.choice].label}`;
  if(c.type==='scoutIntel')action='scout '+JSON.stringify(c);
  if(c.type==='rights')action='rights '+c.accept;
  command(g,d.id,c);
  if(action){const moves=g.companies.flatMap((x,i)=>x.position===before[i]?[]:[`C${i}:${before[i]}>${x.position}`]);out.push(`s${d.step} P${d.id} $${d.cash}/cap${d.capital} ${action}${moves.length?' ['+moves.join(',')+']':''}`);}
  for(const e of g.log.slice(begin)){
   if(e.type==='auction')out.push(`A C${e.company} P${e.winner??'-'} pays${e.paid}; bids ${e.bids.map(b=>'P'+b.player+':'+b.amount).join(',')}${e.open?.length?'; open '+e.open.map(b=>'P'+b.player+':'+b.amount).join(','):''}`);
   if(['reveal','deferred'].includes(e.type)){const moves=g.companies.flatMap((x,i)=>x.position===before[i]?[]:[`C${i}:${before[i]}>${x.position}`]);out.push(`T C${e.card.company} ${e.type==='deferred'?'recover-discard':e.card.effect??'+'+e.card.printed} ${moves.join(',')}`);}
   if(e.type==='burn')out.push('D '+e.cards.map(t=>'C'+t.company+':'+(t.effect??'+'+t.printed)).join(','));
   if(e.type==='cardCash'&&e.founder===22)out.push(`Mack P${e.player} gains${e.amount}`);
   if(e.type==='founderMarketRefresh')out.push('market '+g.founderMarket.map(id=>FOUNDERS[id].name).join(','));
   if(e.type==='carry')out.push(`END bag=${g.pile.length}; pos=${g.companies.map(c=>c.position)}; cash=${g.players.map(p=>p.cash)}; cap=${g.players.map(p=>p.capital)}; owners=${g.companies.map(c=>c.tokens.map(t=>t.owner??'B').join('')).join('/')}; fumbled=${g.companies.filter(c=>c.down).map(c=>c.id)}`);
  }
 }
 out.push(`FINAL scores=${g.scores}; winners=${g.winners}; founders=${g.companies.map(c=>'C'+c.id+' '+FOUNDERS[c.founder].name).join('; ')}`);fs.writeFileSync(file+'-timeline.txt',out.join('\n'));
}
