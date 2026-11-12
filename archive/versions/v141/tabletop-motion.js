// Shared classic and dice pawn animation.
export function createPawnMotion(){
let motionCleanup=()=>{};
async function animatePawns(steps, oldPawns) {
 if(!steps.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const scroller=document.querySelector('.tabletop'),scrollBefore=scroller?.scrollTop??0;
 const firstPawn=document.querySelector(`.pawn[data-company="${steps[0].company}"]`);
 if(firstPawn){const r=firstPawn.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)firstPawn.scrollIntoView({block:'center',behavior:'instant'});}
 const scrollDelta=(scroller?.scrollTop??0)-scrollBefore;
 const ghosts=new Map(),hidden=[];
 for(const {company} of steps){
  if(ghosts.has(company))continue;
  const pawn=document.querySelector(`.pawn[data-company="${company}"]`),old=oldPawns.find(p=>p.id===company);
  if(!pawn||!old)continue;
  const ghost=pawn.cloneNode(true);ghost.removeAttribute('data-company');ghost.classList.add('moving-pawn');
  Object.assign(ghost.style,{left:`${old.rect.x}px`,top:`${old.rect.y-scrollDelta}px`,width:`${old.rect.width}px`,height:`${old.rect.height}px`});
  document.body.append(ghost);pawn.style.visibility='hidden';hidden.push(pawn);ghosts.set(company,ghost);
 }
 let cancelled=false;
 motionCleanup=()=>{cancelled=true;ghosts.forEach(g=>g.remove());hidden.forEach(p=>p.style.visibility='');};

 for(const step of steps){
  if(cancelled)break;
  const ghost=ghosts.get(step.company);if(!ghost)continue;
  const rect=ghost.getBoundingClientRect(),points=[{left:`${rect.x}px`,top:`${rect.y}px`}];
  const direction=Math.sign(step.to-step.from);
  for(let n=step.from+direction;n!==step.to+direction;n+=direction){
   const cell=document.querySelector(`[data-space="${n}"] .space-pawns`);if(!cell)continue;
   const r=cell.getBoundingClientRect();points.push({left:`${r.x}px`,top:`${r.y}px`});
  }
  const final=document.querySelector(`.pawn[data-company="${step.company}"]`);
  if(final&&step===steps.findLast(s=>s.company===step.company)){const r=final.getBoundingClientRect();points.push({left:`${r.x}px`,top:`${r.y}px`});}
  if(points.length<2)continue;
  const animation=ghost.animate(points,{duration:Math.min(700,180+Math.abs(step.to-step.from)*60),easing:'ease-in-out',fill:'forwards'});
  await animation.finished.catch(()=>{});
  if(cancelled)break;
  Object.assign(ghost.style,points.at(-1));animation.cancel();
 }
 if(!cancelled)motionCleanup();
}
return {animatePawns,cancel:()=>motionCleanup()};
}
