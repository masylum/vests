import {valueChoices,pendingFor,holdings,shareLeader,exitPrice} from './dice-engine.js';
import {choosePower} from '../../src/racing.js';
export const DICE_POLICIES=['balanced','growth','saver','random'];
export const DICE_BOT_VERSION='dice-heuristic-1';
// Only public observations and the acting investor's cards enter this policy.
export function diceBot(view,id,policy='balanced'){
 if(!DICE_POLICIES.includes(policy))throw Error('Unknown dice policy.');
 const p=view.players[id],remaining=4-view.round;
 const expected=c=>exitPrice(Math.min(24,c.position+remaining*2.5+2),view.payoutStep);
 const exposure=c=>holdings(c,id)-.25*view.players.filter(p=>p.id!==id).reduce((n,p)=>n+holdings(c,p.id),0);
 const worth=c=>Math.max(1,Math.floor(expected(c)*(policy==='growth'?.95:policy==='saver'?.45:.7)));
 let seed=(view.metrics.actions*7919+view.metrics.rolls*104729+id*101+p.cash*17+view.round*47)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const choose=items=>items[Math.floor(random()*items.length)];
 if(view.phase==='flowRoll'){
  const entries=pendingFor(view,id);const unfinished=entries.find(e=>e.id===view.rollingEntitlement);if(unfinished)return {type:'roll',entitlement:unfinished.id};return {type:'roll',entitlement:(policy==='random'?choose(entries):[...entries].sort((a,b)=>exposure(view.companies[b.company])-exposure(view.companies[a.company]))[0]).id};
 }
 if(view.phase==='flowCentre')return {type:'rollCentre'};
 if(view.phase==='power')return {type:'power',choice:policy==='random'?Math.floor(random()*view.powerChoice.options.length):choosePower(view)};
 if(['bid','tie','openBid','rights'].includes(view.phase)){
  const a=view.auction,c=view.companies[a.company],budget=Math.min(p.cash,worth(c));
  if(view.phase==='rights')return {type:'rights',accept:a.price<=budget};
  const min=view.phase==='bid'?a.reserve:view.phase==='tie'?a.price+1:a.highBidder==null?a.reserve:a.price+1;
  const bid=policy==='random'?Math.floor(random()*(Math.min(p.cash,8)+1)):budget;
  return {type:view.phase,amount:bid>=min?bid:0};
 }
 const cardScore=cmd=>{
  const kind=p.intel[cmd.card].kind,c=view.companies[cmd.company],own=c?holdings(c,id):0;
  const movement=cid=>{const c=view.companies[cid];return exposure(c)*view.payoutStep*.5*(c.position>=8?1:.4);};
  if(kind==='recover')return movement(c.id)+(c.down?Math.max(0,exposure(c))*.7:0);
  if(kind==='move')return movement(c.id)+(cmd.target==null?0:movement(cmd.target));
  if(kind==='conflict')return 5-2*movement(c.id);
  if(kind==='dividend')return 3*own-2*movement(c.id);
  if(kind==='sweat')return expected(c)-2*movement(c.id);
  if(kind==='fresh')return remaining>0?1:0;
  if(kind==='advice')return 2+movement(c.id);
  if(kind==='focused')return 2*(movement(cmd.target)-movement(c.id));
  if(kind==='swap')return (view.companies[cmd.target].position-c.position)*(movement(c.id)-movement(cmd.target));
  if(kind==='insurance')return Math.max(0,exposure(c))*.7-Math.max(0,exposure(view.companies[cmd.target]))*.7;
  if(['rights','public','tender'].includes(kind))return 1;
  return .1;
 };
 if(view.phase==='intelPlay'){
  const choices=valueChoices(view,id);return policy==='random'?choose(choices):choices.sort((a,b)=>cardScore(b)-cardScore(a))[0];
 }
 if(view.phase==='founder')return {type:'founder',choice:0};
 if(view.phase==='flowAction'){
  const deals=p.dealFlow.map((card,deal)=>({deal,company:card.company,quality:expected(view.companies[card.company])+exposure(view.companies[card.company])}));
  const discard=[...deals].sort((a,b)=>a.quality-b.quality)[0].deal;
  const value=valueChoices({...view,phase:'call'},id).sort((a,b)=>cardScore(b)-cardScore(a))[0];
  const funding=[...deals].sort((a,b)=>b.quality-a.quality)[0];
  const capital={type:'raiseMoney',deal:discard},fund={type:'call',deal:funding.deal,company:funding.company};
  if(policy==='random')return choose([capital,...deals.map(d=>({type:'call',deal:d.deal,company:d.company})),...(value?[{type:'valueAction',deal:discard}]:[]),...view.companies.filter(c=>shareLeader(c)===id).map(c=>({type:'changeFounder',deal:discard,company:c.id}))]);
  if(value&&cardScore(value)>(policy==='growth'?3:1))return {type:'valueAction',deal:discard};
  if(p.cash<worth(view.companies[fund.company])&&remaining>0&&policy!=='saver')return capital;
  if(p.cash===0&&remaining>0)return capital;
  return fund;
 }
 return {type:'continue'};
}
