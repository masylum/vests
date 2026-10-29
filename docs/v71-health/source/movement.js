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
