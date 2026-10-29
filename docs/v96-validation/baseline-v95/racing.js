import {recordArrivals} from './movement.js';
import {shareCount,shareLeader} from './ownership.js';
import { companyValue, slotCards, companyOrder } from './config.js';
import {clone as copy} from './clone.js';
export const duringReveal=g=>!!g.race&&!g.race.stage&&g.race.card.kind==='growth';
const held = shareCount;
const controller = (g,cid) => g.forecast?(g.forecastOwners[cid]??=shareLeader(g.companies[cid])):shareLeader(g.companies[cid]);
const order = g => g.forecast?(g.forecastOrder??=companyOrder(g.companies)):companyOrder(g.companies);
const ahead = (g,cid) => order(g).filter(id=>g.companies[id].position>g.companies[cid].position);
const push = (g,...steps) => g.race.queue.unshift(...steps);
const move = (company,amount,source) => ({kind:'move',company,amount,source});
const down = (company,source) => ({kind:'fumble',company,source});
const option = (label,...actions) => ({label,actions});
function note(g,company,text,target=company,detail={}) {
  if(g.forecast)return;
  g.race.log.push({company,target,founder:g.companies[company].founder,text,...detail});
}
function offer(g,company,text,options,player=controller(g,company),mandatory=false) {
  if(player === null)return;
  g.powerChoice={company,founder:g.companies[company].founder,player,text,
    beforeReveal:!g.race.revealed,mandatory,options:mandatory?options:[option('Pass'),...options]};
}
export function markIPO(g,company) {
 if(g.ipoCompany==null&&g.companies[company].position>=g.rules.checkpoints.at(-1)){g.ipoCompany=company;g.ipoTrigger=company;}
 return g.ipoCompany!=null;
}
function reactions(g,moves) {
  for(const m of moves) {
    const distance=Math.max(0,m.after-m.before);
    g.race.advanced[m.company]+=distance;
    if(m.after!==m.before)(g.revealMoved ??= g.companies.map(()=>false))[m.company]=true;
    (g.revealMovement ??= g.companies.map(()=>0))[m.company]+=distance;
  }
  const steps=[];
  for(const cid of order(g)) {
    if(g.race.used.includes(cid)&&g.companies[cid].founder!==12)continue;
    const c=g.companies[cid]; if(c.hiringFumble||c.down||![0,10,12].includes(c.founder))continue; const other=moves.filter(m=>m.company!==cid), own=moves.find(m=>m.company===cid);
    const landed=other.find(m=>m.after!==m.before&&m.after===c.position);
    let trigger=null;
    switch(c.founder) {
      case 0: if(landed)trigger={power:'jobs'};break;

      case 10: for(const m of other.filter(m=>m.before<=c.position&&m.after>c.position))steps.push({kind:'trigger',company:cid,power:'banana',target:m.company});break;
      case 12: if(own&&own.after!==own.before&&g.companies.some(x=>x.id!==cid&&x.position===own.after))trigger={power:'follow'};break;
    }
    if(trigger)steps.push({kind:'trigger',company:cid,...trigger});
  }
  push(g,...steps);
}
export function recordFounderMovement(g,founder,delta) {
 const rows=g.metrics.founderMovement??={};
 const row=rows[founder]??={forward:0,backward:0};
 row.forward+=Math.max(0,delta);row.backward+=Math.max(0,-delta);
}
function applyMoves(g,actions) {
  const cp=g.rules.checkpoints.at(-1),moves=[];
  for(const a of actions) {
    const c=g.companies[a.company],before=c.position;
    const destination=Math.max(0,Math.min(cp,a.destination ?? (before+a.amount)));
    c.position=destination;
    moves.push({company:c.id,before,after:c.position,source:a.source});
    if(!g.forecast&&a.intel&&before!==c.position)g.race.log.push({company:c.id,founder:-1,text:`${c.id}: ${before} → ${c.position}`,intel:true,intelPlayer:g.race.intelContext?.player,intelKind:g.race.intelContext?.kind});
    if(!g.forecast&&a.catchUp&&before!==c.position)g.race.log.push({company:c.id,founder:-1,text:`${c.id}: ${before} → ${c.position}`,catchUp:true});
    if(a.source!==undefined) {
      g.metrics.founderBonus=(g.metrics.founderBonus??0)+c.position-before;
      recordFounderMovement(g,g.companies[a.source].founder,c.position-before);
      if(before!==c.position)note(g,a.source,`${g.companies[a.company].id}: ${before} → ${c.position}`,c.id,{kind:'move',from:before,to:c.position,reason:a.reason});
    }
    markIPO(g,c.id);
  }
  recordArrivals(g,moves);
  reactions(g,moves);
}
function trigger(g,a) {
  const r=g.race,c=g.companies[a.company];
  if(c.down||c.hiringFumble)return;
  if(a.power!=='follow'){if(r.used.includes(c.id))return;r.used.push(c.id);}
  switch(a.power) {
    case 'jobs': push(g,move(c.id,2,c.id));break;
    case 'banana': push(g,down(a.target,c.id),move(c.id,1,c.id));break;
    case 'follow': push(g,move(c.id,1,c.id));break;
  }
}
function step(g,a,base) {
  const r=g.race,c=g.companies[a.company ?? r.card.company];
  switch(a.kind) {
    case 'phaseStart': {
      if(c.hiringFumble||c.down)break;
      if(c.founder===13&&!r.used.includes(c.id)){
        r.used.push(c.id);push(g,move(c.id,1,c.id));
      }
      if(c.founder===14&&!r.used.includes(c.id)){
        r.used.push(c.id);push(g,{kind:'addSupply',company:c.id,count:1});
      }
      if(c.founder===6&&!r.used.includes(c.id)&&c.position<Math.max(...g.companies.map(x=>x.position))){
        r.used.push(c.id);push(g,move(c.id,1,c.id),{kind:'ryanTarget',company:c.id});
      }
      if([15,18,19].includes(c.founder)&&!r.used.includes(c.id)){
        r.used.push(c.id);
        if(c.founder===15){
          const targets=order(g).filter(id=>id!==c.id&&g.companies[id].position!==c.position&&Math.abs(g.companies[id].position-c.position)<=3);
          if(targets.length)offer(g,c.id,'Pull a nearby company to my space and fumble it?',targets.map(id=>option(`Pull company ${id}`,{kind:'move',company:id,destination:c.position,source:c.id},down(id,c.id))));
        }
        if(c.founder===18&&c.reserve>0){
          const targets=order(g).filter(id=>id!==c.id&&g.companies[id].reserve<3);
          if(targets.length)offer(g,c.id,'Transfer 1 treasury slot and move 2?',targets.map(id=>option(`Transfer to company ${id}`,{kind:'transfer',company:c.id,target:id},move(c.id,2,c.id))));
        }
        if(c.founder===19){
          const positions=g.companies.filter(x=>x.id!==c.id&&x.position>c.position).map(x=>x.position);
          if(positions.length){
            const destination=Math.min(...positions),targets=g.companies.filter(x=>x.id!==c.id&&x.position===destination).map(x=>x.id);
            offer(g,c.id,'Join the next company ahead and fumble all companies there, including me?', [option('Join and fumble',{kind:'move',company:c.id,destination,source:c.id},down(c.id,c.id),...targets.map(id=>down(id,c.id)))]);
          }
        }
      }
      if(c.founder===2&&!r.used.includes(c.id)){
        const targets=order(g).filter(id=>id!==c.id&&Math.abs(g.companies[id].position-c.position)>0&&Math.abs(g.companies[id].position-c.position)<=3);
        r.used.push(c.id);
        if(targets.length)offer(g,c.id,'Swap spaces with a company within 3 spaces?',targets.map(id=>option(`Swap with company ${id}`,{kind:'batch',moves:[{kind:'move',company:c.id,destination:g.companies[id].position,source:c.id},{kind:'move',company:id,destination:c.position,source:c.id}]})));
      }
      break;
    }
    case 'ryanTarget': {
      const targets=order(g).filter(id=>id!==c.id),owner=controller(g,c.id);
      if(owner===null){const target=targets.sort((a,b)=>g.companies[b].position-g.companies[a].position||a-b)[0];if(target!==undefined)push(g,down(target,c.id));}
      else offer(g,c.id,'Choose another company to fumble.',targets.map(id=>option(`Fumble company ${id}`,down(id,c.id))),owner,true);
      break;
    }
    case 'shareholderOffer':
      if(c.founder===17&&!c.down&&!c.hiringFumble&&(a.qualified||held(c,a.player)>0))push(g,move(c.id,2,c.id));
      break;
    case 'catchUp': {
      if(!g.rules.catchUp)break;
      const last=Math.min(...g.companies.map(c=>c.position));
      const bonuses=g.companies.map(c=>({company:c.id,amount:c.position===last?1:0}));
      push(g,{kind:'batch',moves:bonuses.filter(b=>b.amount).map(b=>({...move(b.company,b.amount),catchUp:true}))});
      break;
    }
    case 'phaseEnd': {
      if(c.hiringFumble||c.down)break;
      if(c.founder===1&&ahead(g,c.id).length)push(g,{kind:'accelerate',company:c.id});
      if(c.founder===3&&!r.used.includes(c.id)){
        const targets=order(g).filter(id=>id!==c.id&&!g.revealMoved?.[id]);r.used.push(c.id);
        if(targets.length)offer(g,c.id,'Move a company that has not moved this round 1 space, then move 1 yourself?',targets.map(id=>option(`Help company ${id}`,move(id,1,c.id),move(c.id,1,c.id))));
      }

      break;
    }
    case 'recoverDraw': {
      const before=c.position,hiring=c.hiringFumble;c.down=false;c.hiringFumble=false;r.revealed=true;
      r.event={type:'deferred',card:r.card.original,deferred:true,effect:{before,after:before}};
      break;
    }
    case 'julieOffer': {
      if(c.founder!==16||c.down||c.hiringFumble||(g.julieUsed??[]).includes(c.id)||r.card.kind!=='growth'||controller(g,c.id)===null)break;
      const target=g.companies[r.card.company];
      r.event={type:'reveal',card:g.forecast?r.card:copy(r.card),positions:[...r.startPositions],pending:true,effect:{before:target.position,after:target.position}};
      offer(g,c.id,'Return this growth card to the top of its company’s supply instead of resolving it? It uses this draw.',[option('Return card to supply',{kind:'returnGrowth',company:c.id})]);
      break;
    }
    case 'returnGrowth': {
      const target=g.companies[r.card.company],{revealed,discarded,burned,paid,...card}=r.card;
      target.supply.unshift({...card,paid:false,fundingCount:card.fundingCount??Number(!!paid)});
      (g.julieUsed??=[]).push(c.id);g.metrics.wasted++;g.metrics.wastedPaid+=Number(!!paid);g.metrics.julieReturned=(g.metrics.julieReturned??0)+1;
      if(g.pendingRedraw){g.pendingRedraw=false;g.drawsLeft=Math.max(0,g.drawsLeft-1);}
      r.revealed=true;r.queue=[];
      r.event={type:'returned',card:g.forecast?r.card:copy(r.card),positions:[...r.startPositions],returned:true,effect:{before:target.position,after:target.position}};
      note(g,c.id,`Returned company ${target.id}'s growth card to the top of its supply. This draw is used.`,target.id);
      break;
    }
    case 'base': {
      if(c.down&&r.card.signature!=='recover'){r.revealed=true;r.event=base(g,{kind:'deferred',company:c.id,original:r.card});break;}
      const regular=r.card.kind==='growth'&&!r.card.effect;

      r.skipped=regular&&!!c.down&&r.card.signature!=="recover";
      const leading=c.position===Math.max(...g.companies.map(x=>x.position));
      let modifier=regular&&(!c.down||r.card.signature==="recover")&&!c.hiringFumble&&c.founder===8&&!leading?1:0;
      r.bonus=modifier;
      r.revealed=true;
      r.event=base(g,r.card);
      const movements=r.event.moves??[{company:c.id,before:r.event.effect.before,after:r.event.effect.after}];
      if(regular&&r.bonus>0&&!r.skipped)movements.forEach(m=>m.source=c.id);
      // Finish movement reactions before the revealing founder's after-card opportunity.
      push(g,{kind:'after',company:r.card.company});
      reactions(g,movements,r.event.positions);
      if(r.card.effect==='fumble')push(g,down(c.id));
      break;
    }
    case 'after': {
      if(r.card.signature!=='swap'||r.skipped)return;
      const targets=g.companies.filter(x=>x.id!==c.id&&x.position>c.position&&x.position-c.position<=2);
      if(!targets.length)return;
      const actions=target=>({kind:'signatureSwap',company:c.id,target});
      const owner=controller(g,c.id);
      if(owner===null)push(g,actions(targets.sort((a,b)=>b.position-a.position||a.arrivalOrder-b.arrivalOrder)[0].id));
      else {offer(g,c.id,'Swap with 1 company up to 2 spaces ahead.',targets.map(x=>option(`Swap with company ${x.id}`,actions(x.id))),owner,true);g.powerChoice.founder=-1;g.powerChoice.signature=copy(r.card);}
      break;
    }
    case 'signatureSwap': {
      const target=g.companies[a.target],from=c.position,to=target.position;
      note(g,c.id,`${c.id}: ${from} → ${to}`,c.id,{signature:copy(r.card)});
      note(g,c.id,`${target.id}: ${to} → ${from}`,target.id,{signature:copy(r.card)});
      applyMoves(g,[{kind:'move',company:c.id,destination:to},{kind:'move',company:target.id,destination:from}]);
      break;
    }
    case 'accelerate':
      if(r.used.includes(c.id))break;
      r.used.push(c.id);offer(g,c.id,'Move 2 now and fumble afterward?',[
        option('Move fast',move(c.id,2,c.id),down(c.id,c.id))]);break;
    case 'move': applyMoves(g,[a]);break;
    case 'batch': applyMoves(g,a.moves);break;
    case 'trigger': trigger(g,a);break;
    case 'fumble': {
      if(c.founder===11&&!c.down&&!c.hiringFumble&&duringReveal(g)){g.metrics.fumbleConversions=(g.metrics.fumbleConversions??0)+1;note(g,c.id,'Instead of fumbling, I move 2.');push(g,move(c.id,2,c.id));break;}
      if(c.down)break;
      c.down=true;
      g.metrics.founderFumbles=(g.metrics.founderFumbles??0)+1;
      if(a.source!==undefined)note(g,a.source,`Company ${c.id} suffers a fumble.`,c.id);
      if(a.source===undefined&&r.intelContext)r.log.push({company:c.id,founder:-1,intel:true,intelPlayer:r.intelContext.player,intelKind:r.intelContext.kind,text:`Company ${c.id} fumbled.`});
      const responses=[];
      for(const id of order(g)){
        const other=g.companies[id];if(other.down||other.hiringFumble)continue;
        if(other.founder===5)responses.push(move(id,1,id));
        if(id!==c.id&&other.founder===9&&duringReveal(g))responses.push({kind:'repairOffer',company:id,target:c.id});
      }
      push(g,...responses);
      break;
    }
    case 'crisisOffer': break; // Intel is played only on the investor’s turn.
    case 'repairOffer':
      if(!duringReveal(g)||!g.companies[a.target].down||c.down||c.hiringFumble||(g.harryUsed??=[]).includes(c.id))break;
      offer(g,c.id,`Recover company ${a.target} and deploy 2 cards?`,[
        option('Help it recover',{kind:'repair',company:a.target,source:c.id},{kind:'addSupply',company:c.id,count:2})]);break;
    case 'transfer': {
      const target=g.companies[a.target];
      if(c.down||c.hiringFumble||c.reserve<1||target.reserve>=3)break;
      c.reserve--;target.reserve++;note(g,c.id,`Transferred 1 treasury slot to company ${target.id}.`);break;
    }
    case 'addSupply': {
      const cards=c.supply.splice(0,a.count??1);
      if(cards.length){g.pile.push(...cards);g.metrics.entered+=cards.length;if(a.intel)r.log.push({company:c.id,founder:-1,intel:true,intelPlayer:r.intelContext?.player,intelKind:r.intelContext?.kind,text:`Deployed ${cards.length} ${cards.length===1?'card':'cards'}.`});else note(g,a.source??c.id,`Company ${c.id} deployed ${cards.length} ${cards.length===1?'card':'cards'}.`);}
      break;
    }
    case 'returnSupply': {
      const cards=returnDiscarded(g,c.id,a.count??1);
      if(!cards.length)break;
      if(a.intel)r.log.push({company:c.id,founder:-1,intel:true,intelKind:r.intelContext?.kind,intelPlayer:r.intelContext?.player,text:`Returned ${cards.length} discarded cards to supply.`});
      else note(g,a.source,`Returned ${cards.length} discarded card${cards.length===1?'':'s'} to company ${c.id}'s supply.`,c.id);
      if(a.moveAfter!==undefined)push(g,move(a.moveAfter,1,a.source));
      break;
    }
    case 'repair': {
      if(!a.intel&&a.source!==undefined&&g.companies[a.source].founder===9)(g.harryUsed??=[]).push(a.source);
      c.down=false;c.hiringFumble=false;
      if(a.intel)g.race.log.push({company:c.id,founder:-1,intel:true,intelKind:'recover',intelPlayer:r.intelContext?.player,text:`Company ${c.id} recovered from its fumble.`});
      else note(g,a.source,`Company ${c.id} recovered from its fumble.`);
      break;
    }
    default: throw Error('Unknown racing step '+a.kind);
  }
}
export function choosePower(g) {
  const q=g.powerChoice,id=q.player;
  function value(cid,from,to) {
    const c=g.companies[cid],price=companyValue(to,g.rules)-companyValue(from,g.rules)+(to-from)*companyValue(g.rules.checkpoints.at(-1),g.rules)/g.rules.checkpoints.at(-1)*0.2;
    const own=held(c,id),rival=g.players.filter(p=>p.id!==id).reduce((s,p)=>s+held(c,p.id),0);
    return price*(own-0.3*rival)/Math.max(1,c.tokens.length);
  }
  function score(actions){let sum=0;
    for(const a of actions){const c=g.companies[a.company],p=c?.position??0;
      if(a.kind==='returnGrowth'){
        const card=g.race?.card??g.reviewCard,target=g.companies[card.company],leading=target.position===Math.max(...g.companies.map(c=>c.position));
        if(target.down&&card.signature!=='recover')sum-=.7*value(target.id,target.position,Math.min(24,target.position+1.5));
        else if(card.effect==='fumble')sum+=target.founder===11?-value(target.id,target.position,Math.min(24,target.position+2)):.7*value(target.id,target.position,Math.min(24,target.position+1.5));
        else {const movement=card.signature==='breakthrough'?(leading?1:3):(card.printed??0)+(target.founder===8&&!leading?1:0);sum-=value(target.id,target.position,Math.min(24,target.position+movement));}
        sum-=.2;
      }
      if(a.kind==='move')sum+=value(c.id,p,Math.min(g.rules.checkpoints.at(-1),a.destination??p+a.amount));
      if(a.kind==='transfer'){
        const target=g.companies[a.target];
        // Value future slot output versus the slot sacrificed; immediate supply is scored separately.
        sum+=value(target.id,target.position,Math.min(24,target.position+slotCards(target,target.reserve+1)));
        sum-=value(c.id,p,Math.min(24,p+slotCards(c,c.reserve)));
      }
      if(a.kind==='batch')sum+=score(a.moves);
      if(a.kind==='signatureSwap'){const t=g.companies[a.target];sum+=value(c.id,p,t.position)+value(t.id,t.position,p);}
      if(a.kind==='fumble'&&!c.down){
        if(c.founder===11&&!c.hiringFumble&&duringReveal(g))sum+=value(c.id,p,Math.min(24,p+2));
        else {sum-=0.7*value(c.id,p,Math.min(24,p+1.5));for(const x of g.companies)if(x.id!==c.id&&x.founder===5&&!x.down&&!x.hiringFumble)sum+=value(x.id,x.position,Math.min(24,x.position+1));}
      }
      if(a.kind==='returnSupply'){sum+=.5*value(c.id,p,Math.min(24,p+1.5*(a.count??1)));if(a.moveAfter!==undefined){const mover=g.companies[a.moveAfter];sum+=value(mover.id,mover.position,Math.min(24,mover.position+1));}}
      if(a.kind==='repair'&&c.down)sum+=0.7*value(c.id,p,Math.min(24,p+1.5));
      if(a.kind==='addSupply'&&(c.supplyCount??c.supply?.length))sum+=value(c.id,p,Math.min(24,p+1.5*Math.min(a.count??1,c.supplyCount??c.supply.length)));
    }return sum;
  }
  const scores=q.options.map(o=>score(o.actions));
  return scores.indexOf(Math.max(...scores));
}
function pump(g,base) {
  const r=g.race;
  let steps=0;
  while(r.queue.length) {
    if(++steps>512)throw Error('Founder chain did not terminate.');
    const action=r.queue.shift();
    if(action.kind==='phaseResult'){
      if(g.forecast)continue;
      const reactions=r.log.slice(r.lastPhaseLogIndex??0);r.lastPhaseLogIndex=r.log.length;
      if(r.interactive&&reactions.some(r=>!r.text.startsWith('Passed —')&&!r.text.startsWith('Used power:'))){g.lastRevealed={type:'founderStep',stage:r.stage,company:action.company,reactions,positions:[...r.startPositions],finalPositions:g.companies.map(c=>c.position)};g.phase='phaseResult';g.queue=[];g.active=g.first;return null;}
      r.startPositions=g.companies.map(c=>c.position);r.startArrivalOrders=g.companies.map(c=>c.arrivalOrder);
      continue;
    }
    step(g,action,base);
    if(g.crisisChoice){g.phase='intelCrisis';g.queue=[g.crisisChoice.players[0]];return null;}
    if(g.powerChoice){
      if(r.interactive){g.lastRevealed=copy({...r.event,type:r.event?.type??'founderPhase',stage:r.stage,reactions:r.log});g.phase='power';g.queue=[g.powerChoice.player];return null;}
      const choice=choosePower(g),q=g.powerChoice;delete g.powerChoice;
      if(!q.signature)note(g,q.company,choice===0&&!q.mandatory?'Passed — power not used.':`Used power: ${q.options[choice].label}.`);push(g,...q.options[choice].actions);
    }
  }
  const event=r.event ?? {type:'founderPhase', stage:r.stage};
  // Search needs card outcomes, not a rendered timeline. Real play and replays
  // retain the complete events, including in ordinary fast simulation mode.
  if(g.forecast){
    if(r.stage==='start'){g.drawsLeft=Math.min(g.rules.revealsPerRound,g.pile.length);g.poolSize=g.pile.length;}
    g.lastRevealed=event;delete g.race;delete g.powerChoice;return event;
  }
  event.leg=g.leg;event.cycle=g.cycle;
  event.reactions=copy(r.log);
  event.reviewed=!!(r.interactive&&r.stage&&r.lastPhaseLogIndex);
  event.finalPositions=g.companies.map(c=>c.position);
  if(r.stage==='start'){g.drawsLeft=Math.min(g.rules.revealsPerRound,g.pile.length);g.poolSize=g.pile.length;}
  if(r.stage==='catchUp')g.catchUpResult=copy(event);
  if(event.returned&&!g.fast)g.log.push(copy(event));
  if(r.stage){
    g.lastRevealed=copy(event);
    if(!g.fast&&r.stage!=='auction')g.log.push(copy(event));
  } else g.lastRevealed=event;
  if(!g.fast){const logged=g.log?.findLast(e=>e.type==='reveal'&&e.card.id===r.card.id);if(logged)Object.assign(logged,copy(event));}
  delete g.race;delete g.powerChoice;
  if(r.interactive){g.phase='reveal';g.queue=[];g.active=g.first;}
  return event;
}
export function beginRace(g,card,base,interactive=false) {
  if(g.race)throw Error('Finish the current card first.');
  g.race={startPositions:g.companies.map(c=>c.position),startArrivalOrders:g.companies.map(c=>c.arrivalOrder),card:g.forecast?card:copy(card),revealed:false,interactive,used:(g.founderUsed ??= []),bonus:0,advanced:g.companies.map(()=>0),queue:card.kind==='deferred'?[{kind:'recoverDraw',company:card.company}]:[...order(g).filter(id=>g.companies[id].founder===16).map(company=>({kind:'julieOffer',company})),{kind:'base',company:card.company}],log:[]};
  return pump(g,base);
}
export function resumeRace(g,choice,base) {
  const q=g.powerChoice;
  if(!g.race||!q)throw Error('No founder decision is waiting.');
  delete g.powerChoice;
  if(!q.signature)note(g,q.company,choice===0&&!q.mandatory?'Passed — power not used.':`Used power: ${q.options[choice].label}.`);
  push(g,...q.options[choice].actions);
  return pump(g,base);
}

export function resolveRevealPhase(g,stage,interactive=false) {
  if(g.race)throw Error('Finish the current founder decision first.');
  if(stage==='start'&&!g.intelMovementStarted){g.revealMovement=g.companies.map(()=>0);g.revealMoved=g.companies.map(()=>false);}
  if(stage==='start'){g.harryUsed=[];g.julieUsed=[];}
  g.race={startPositions:g.companies.map(c=>c.position),startArrivalOrders:g.companies.map(c=>c.arrivalOrder),stage,card:{kind:'phase'},revealed:stage==='end',interactive,
    used:(g.founderUsed??=[]),advanced:g.companies.map(()=>0),log:[],
    queue:stage==='catchUp'?[{kind:'catchUp'}]:order(g).flatMap(company=>[{kind:stage==='start'?'phaseStart':'phaseEnd',company},{kind:'phaseResult',company}])};
  return pump(g,()=>{throw Error('Phase powers do not draw cards.');});
}

export function resolveIntelActions(g,actions,intelContext=null,{log=[],interactive=true,stage='intel'}={}) {
 if(g.race)throw Error('Finish the current effect first.');
 const before=stage==='intel'?g.valueResult?.before:null;
 g.race={startPositions:before?.map(c=>c.position)??g.companies.map(c=>c.position),startArrivalOrders:before?.map(c=>c.arrivalOrder)??g.companies.map(c=>c.arrivalOrder),stage,intelContext,card:{kind:'phase'},revealed:false,interactive,
 used:(g.founderUsed??=[]),advanced:g.companies.map(()=>0),log:copy(log),
 queue:actions};
 return pump(g,()=>{throw Error('Intel does not draw growth cards.');});
}

// Auction issuance only: free shares from value cards do not trigger Jerry.
export function resolveSharePurchase(g,company,buyer){
 const c=g.companies[company];
 if(c.founder!==7||c.down||c.hiringFumble||!c.tokens.some(t=>t.owner===buyer)||c.tokens.some(t=>t.owner!==null&&t.owner!==buyer))return null;
 return resolveIntelActions(g,[move(company,2,company)],null,{interactive:false,stage:'auction'});
}

export function resumeCrisis(g,base){
 const q=g.crisisChoice;q.players.shift();
 if(g.companies[q.company].down&&q.players.length){g.phase='intelCrisis';g.queue=[q.players[0]];return;}
 delete g.crisisChoice;return pump(g,base);
}

export function shareholderReactions(g,player,targets=[],heldAtPlay=[]){
 return order(g).map(id=>g.companies[id]).filter(c=>targets.includes(c.id)&&c.founder===17&&!c.down&&!c.hiringFumble&&(held(c,player)>0||heldAtPlay.includes(c.id))).map(c=>({kind:'shareholderOffer',company:c.id,player,qualified:true}));
}

// Only face-up discards can return. Unseen burns stay removed; returned cards go to the bottom.
export function returnDiscarded(g,company,count){
 const cards=g.removed.filter(card=>card.company===company&&!card.burned).slice(-count),ids=new Set(cards.map(c=>c.id));
 if(!cards.length)return [];
 g.removed=g.removed.filter(card=>!ids.has(card.id));
 const c=g.companies[company];c.history=c.history.filter(card=>!ids.has(card.id));
 const restored=cards.map(({revealed,discarded,burned,paid,...card})=>({...card,paid:false,fundingCount:card.fundingCount??Number(!!paid)}));
 c.supply.push(...restored);c.discardCount=g.removed.filter(card=>card.company===company&&!card.burned).length;
 return restored;
}

export function resumePhase(g,base){g.race.startPositions=g.companies.map(c=>c.position);g.race.startArrivalOrders=g.companies.map(c=>c.arrivalOrder);return pump(g,base);}
