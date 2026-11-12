import fs from 'node:fs';const dir=process.argv[2];
for(const file of fs.readdirSync(dir+'/samples').filter(x=>x.endsWith('.json'))){const g=JSON.parse(fs.readFileSync(dir+'/samples/'+file));let lines=[file+' '+JSON.stringify({rounds:g.row.rounds,positions:g.row.positions,scores:g.row.scores,shares:g.row.shares})];
for(const [i,e] of g.events.entries()){
 const rx=(e.reactions??e.value?.reactions??[]).map(r=>`f${r.founder}/c${r.company}:${r.text??''}${JSON.stringify(r.moves??[])}`).join('|');let v;
 if(e.type==='dealFlowRow')v='ROW '+e.cards.map(c=>c.company);
 if(e.type==='action')v=`p${e.player} ${JSON.stringify(e.command)}`;
 if(e.type==='auction')v=`c${e.company} caller${e.host} bids${e.bids.map(b=>b.player+':'+b.amount)} winner${e.winner} $${e.paid}`;
 if(e.type==='bankFunding')v='BANK c'+e.company;
 if(e.type==='die')v=`DIE c${e.company} ${e.kind} ${e.fumble?'x':e.printed}`;
 if(['reveal','deferred'].includes(e.type))v=`${e.type} c${e.card?.company} ${e.effect?.before}>${e.effect?.after} ${rx}`;
 if(e.type==='founderPhase'&&rx)v=e.stage+' '+rx;
 if(e.type==='valueResolved')v=`VALUE ${e.value.kind} p${e.value.player} c${e.value.company} target${e.value.target} ${rx}`;
 if(e.type==='founder')v=`HIRE c${e.company} ${e.old}>${e.founder}`;
 if(e.type==='roundEnd')v='END '+e.positions;
 if(v)lines.push(`e${i}/r${e.round} ${v}`);
}
lines.push('POWERS '+g.decisions.filter(d=>d.cmd.type==='power').map(d=>`d${d.step} r${d.round} p${d.id} choice${d.cmd.choice}`).join('; '));fs.writeFileSync(dir+'/samples/'+file.replace('.json','.compact.txt'),lines.join('\n'));}
