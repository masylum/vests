// Shared classic/dice presentation. No rules are resolved here.
export function createTimeline({getGame,co,esc,cardHTML,intelCardHTML,FOUNDERS,founderCard,founderDescription,COMPANIES,fundingBand}) {
function positionTrack(rows,ids,wide=false) {
 const game=getGame();
 const spaces=rows.flatMap(row=>ids.map(id=>row.positions[id])),min=Math.min(...spaces),max=Math.max(...spaces),count=max-min+1;
 const label=ids.map(id=>`${co(id)} ${rows.map(r=>r.positions[id]).join(' to ')}`).join(', ');
 return `<div class="round-track" role="img" aria-label="${esc(label)}" style="--track-spaces:${count};--mini-size:${count>12?11:16}px;--mini-font:${count>12?6:8}px;width:min(100%,${wide?Math.max(560,Math.min(900,count*60+53)):Math.max(260,Math.min(660,count*60+53))}px)">${rows.map(row=>`<div class="round-track-row"><b>${row.label}</b><div class="mini-spaces">${Array.from({length:count},(_,i)=>{const space=min+i;return `<div class="mini-space band-${fundingBand(Math.max(1,space))}"><small>${space}</small><div>${ids.filter(id=>row.positions[id]===space).sort((a,b)=>(row.orders?.[a]??game.companies[a].arrivalOrder)-(row.orders?.[b]??game.companies[b].arrivalOrder)).map(id=>`<span class="mini-pawn" style="--company:${COMPANIES[id].color}" title="${co(id)}: ${space}">${row.label==='After'&&game.companies[id].down?'×':COMPANIES[id].short.toUpperCase()}</span>`).join('')}</div></div>`;}).join('')}</div></div>`).join('')}</div>`;
}
function roundTrack(before) {const game=getGame();return positionTrack([{label:'Before',positions:before??game.companies.map(c=>c.position),orders:game.revealStartArrivalOrders},{label:'After',positions:game.companies.map(c=>c.position)}],game.companies.map(c=>c.id),true);}
function movementTrack(moves) {
 const grouped=new Map();for(const m of moves){if(grouped.has(m.company))grouped.get(m.company).to=m.to;else grouped.set(m.company,{...m});}
 const ids=[...grouped.keys()];return positionTrack([{label:'Before',positions:Object.fromEntries(ids.map(id=>[id,grouped.get(id).from]))},{label:'After',positions:Object.fromEntries(ids.map(id=>[id,grouped.get(id).to]))}],ids);
}
function movementBox(from,to,company) {return movementTrack([{company,from:Number(from),to:Number(to)}]);}
function reactionTimeline(reactions=[]) {
 const groups=[];
 for(const r of reactions){
  if(r.text.startsWith('Used power:')||r.text.startsWith('Passed —'))continue;
  const match=r.text.match(/^(\d+): (\d+) → (\d+)$/),target=r.target??(match?Number(match[1]):r.company);
  if(match&&match[2]===match[3])continue;
  const key=r.signature?`signature:${r.company}`:r.intel?`value:${r.intelKind}:${r.intelPlayer}`:r.catchUp?'catchUp':`founder:${r.company}:${r.founder}`;
  let group=r.intel?groups.find(g=>g.key===key):groups.at(-1);if(!group||group.key!==key){group={key,r,items:[]};groups.push(group);}
  group.items.push({r,match,target});
 }
 if(!groups.length)return '';
 return `<ol class="reaction-timeline">${groups.map(({r,items})=>{
  const value=r.intel&&r.intelKind,founder=!r.signature&&!r.intel&&!r.catchUp&&FOUNDERS[r.founder];
  const source=r.signature?cardHTML(r.signature,true):value?intelCardHTML({kind:r.intelKind}):founder?founderCard(FOUNDERS[r.founder]):`<b class="effect-label">${r.catchUp?'Catch-up':'Result'}</b>`;
  const moves=items.filter(i=>i.match).map(i=>({company:i.target,from:Number(i.match[2]),to:Number(i.match[3])}));
  return `<li class="${r.intel?'value-effect':r.catchUp?'catch-up-effect':''}" style="--company:${COMPANIES[r.company]?.color??'#fff'}">${source}<div class="effect-results">${moves.length?movementTrack(moves):''}${items.filter(i=>!i.match||i.r.reason).map(({r,match,target},i)=>`<section>${i===0||items[i-1].target!==target?`<b>${co(target)}</b>`:''}${match?'':`<p>${founderDescription(r.text.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</p>`}${r.reason?`<p>${esc(r.reason.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</p>`:''}</section>`).join('')}</div></li>`;
 }).join('')}</ol>`;
}
return {positionTrack,roundTrack,movementTrack,movementBox,reactionTimeline};
}
