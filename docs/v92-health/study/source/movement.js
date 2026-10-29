// Preserve effect order, including a company moving twice in one reaction chain.
export function movementSteps(events, before, after) {
 const positions=[...before],steps=[];
 const add=(company,to)=>{const from=positions[company];if(from===to)return;steps.push({company,from,to});positions[company]=to;};
 for(const e of events){
  if(e.moves)for(const m of e.moves)add(m.company,m.after);
  else if(e.effect&&e.card)add(e.card.company,e.effect.after);
  for(const r of e.reactions??[]){const m=r.text.match(/^(\d+): (\d+) → (\d+)$/);if(m)add(Number(m[1]),Number(m[3]));}
 }
 after.forEach((position,id)=>add(id,position));
 return steps;
}

// First actual arrival ranks first. Groups retain their prior internal order.
export const compareRace=(a,b)=>b.position-a.position||(a.arrivalOrder??0)-(b.arrivalOrder??0)||a.id-b.id;
export function recordArrivals(g,moves){
 const changed=moves.filter(m=>m.after!==m.before).sort((a,b)=>(g.companies[a.company].arrivalOrder??0)-(g.companies[b.company].arrivalOrder??0)||b.company-a.company);
 g.arrivalSerial??=Math.max(0,...g.companies.map(c=>c.arrivalOrder??0));
 for(const m of changed)g.companies[m.company].arrivalOrder=++g.arrivalSerial;
}
