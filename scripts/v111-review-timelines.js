import fs from 'node:fs';import {createGame,command,currentPlayer}from '../docs/v111-health/source/engine.js';import{FOUNDERS}from '../docs/v111-health/source/config.js';import{INTEL_CARDS}from '../docs/v111-health/source/intel.js';
for(let n=1;n<=10;n++){
 const s=JSON.parse(fs.readFileSync(`docs/v111-health/samples/sample-${n}.json`)),g=createGame(s.setup),lines=[`SAMPLE ${n} seed ${s.setup.seed} players ${s.setup.players} initialFirst ${g.first} founders ${g.companies.map(c=>c.id+':'+FOUNDERS[c.founder].name).join(', ')} market ${g.founderMarket.map(i=>FOUNDERS[i].name).join(', ')} scores ${s.final.scores} finalCompanies ${s.final.companies.map(c=>c.id+'@'+c.position+':'+FOUNDERS[c.founder].name+':'+c.tokens.map(t=>t.owner??'B').join('')).join(', ')}`];
 for(const d of s.decisions){
  const cmd=d.cmd,phase=d.phase,old=g.log.length;
  if(!['continue','finalSale','finalObligation','passValue','powerDone'].includes(cmd.type)){
   let info=cmd.type==='playIntel'?INTEL_CARDS[g.players[d.id].intel[cmd.card].kind].name:cmd.type==='exchangeValue'?'discard '+INTEL_CARDS[g.players[d.id].intel[cmd.card].kind].name:cmd.type==='founder'?cmd.choice<0?'keep founder':FOUNDERS[g.founderMarket[cmd.choice]].name:phase==='power'?FOUNDERS[g.powerChoice.founder].name+' / '+g.powerChoice.options[cmd.choice].label:'';
   const ev=d.evaluations.filter(e=>e.gain!==undefined&&e.gain!==null&&Number.isFinite(e.gain)).sort((a,b)=>b.gain-a.gain).slice(0,3).map(e=>`${e.action.type}${e.action.company??''}:${e.gain.toFixed(2)}${e.ownBid!==undefined?'/bid'+e.ownBid:''}`).join(' ');
   lines.push(`${d.step} r${d.round} p${d.id} $${d.cash} cap${d.capital} pf${d.portfolio.join('/')} @${d.positions.join('/')} ${JSON.stringify(cmd)} ${info}${ev?' TOP '+ev:''}`);
  }
  command(g,d.id,cmd);
  const events=g.log.slice(old);for(const e of events){if(e.type==='auction')lines.push(` -> auction co${e.company} winner${e.winner} paid${e.paid}`);if(e.type==='carry')lines.push(` -> END ROUND @${g.companies.map(c=>c.position).join('/')} cash${g.players.map(p=>p.cash).join('/')} capital${g.players.map(p=>p.capital).join('/')} down${g.companies.filter(c=>c.down).map(c=>c.id).join('/')}`);}
 }
 fs.writeFileSync(`docs/v111-health/samples/sample-${n}-timeline.txt`,lines.join('\n'));
}
