// Preserve effect order, including a company moving twice in one reaction chain.
export function movementSteps(events, before, after) {
 const positions=[...before],steps=[];
 const add=(company,to)=>{const from=positions[company];if(from===to)return;steps.push({company,from,to});positions[company]=to;};
 for(const e of events){
  if(e.moves)for(const m of e.moves)add(m.company,m.after);
  else if(e.effect&&e.card)add(e.effect.company??e.card.company,e.effect.after);
  for(const r of e.reactions??[]){const m=r.text.match(/^(\d+): (\d+) → (\d+)$/);if(m)add(Number(m[1]),Number(m[3]));}
 }
 after.forEach((position,id)=>add(id,position));
 return steps;
}

// First actual arrival ranks first. Groups retain their prior internal order.
export const compareRace=(a,b)=>b.position-a.position||(a.arrivalOrder??0)-(b.arrivalOrder??0)||a.id-b.id;
export function recordArrivals(g,moves){
 if(g.liveDice&&!g.forecast){
  for(const m of moves)for(let leg=0;leg<g.rules.checkpoints.length;leg++){
   const boundary=g.rules.checkpoints[leg];
   if(m.before<boundary&&m.after>=boundary&&!g.crossedLegs.includes(leg)){
    g.crossedLegs.push(leg);g.log.push({type:'legCrossed',round:g.round,leg,company:m.company,before:m.before,after:m.after});
   }
  }
 }
 const changed=moves.filter(m=>m.after!==m.before).sort((a,b)=>(g.companies[a.company].arrivalOrder??0)-(g.companies[b.company].arrivalOrder??0)||b.company-a.company);
 g.arrivalSerial??=Math.max(0,...g.companies.map(c=>c.arrivalOrder??0));
 for(const m of changed)g.companies[m.company].arrivalOrder=++g.arrivalSerial;
}

// Occupied spaces cost Max no movement. Relocations retain their named destination.
export function blockedDestination(companies,id,from,to,relocation=false,finish=24){
 const c=companies[id];
 if(relocation||c.founder!==12||c.down||c.hiringFumble||from===to)return to;
 const direction=Math.sign(to-from),occupied=new Set(companies.filter(x=>x.id!==id).map(x=>x.position));
 let remaining=Math.abs(to-from),position=from;
 while(remaining>0&&position+direction>=0&&position+direction<=finish){
  position+=direction;
  if(!occupied.has(position))remaining--;
 }
 return position;
}
