import {createGame,command as legacyCommand,currentPlayer,random,shuffle,resolveCard,resolveCardBase,observation as legacyObservation,holdings} from '../../src/engine.js';
import {resolveRevealPhase,resumeRace,resumePhase} from '../../src/racing.js';
import {ACTIVE_FOUNDERS,FOUNDERS} from '../../src/config.js';
import {intelDeck,INTEL_CARDS,intelTargets,intelSecondTargets} from '../../src/intel.js';
import {expansionChoices} from '../../src/card-expansion.js';
import {shareLeader} from '../../src/ownership.js';
import {DEAL_FLOW_VERSION,rollGrowthDie,grantGrowth,pendingFor,nextGrowthPlayer,consumeGrowth,consumeDealFlow,revealCentreCards,dealFlowScore} from '../../src/deal-flow.js';

export const DICE_FOUNDERS=ACTIVE_FOUNDERS.filter(id=>![4,9,14,16,21].includes(id));
export const DICE_VALUES=['recover','move','swap','headhunt','conflict','session','insurance','rights','public','tender','dividend','focused','advice','fresh','sweat'];
export const exitPrice=(position,step=1)=>Math.max(0,Math.ceil((position-8)/2))*step;
const requireRule=(ok,message)=>{if(!ok)throw Error(message);};
const event=(g,e)=>g.log.push({round:g.round,...structuredClone(e)});
const order=g=>g.players.map((_,i)=>(g.first+i)%g.players.length);
const setTurn=(g,phase,id=g.first)=>{g.phase=phase;g.active=id;g.queue=[id];};

export function createDiceGame({seed=42,players=4,payoutStep=1,dicePerShare=1,actionsPerRound=5}={}){
 requireRule(Number.isInteger(payoutStep)&&payoutStep>=1&&payoutStep<=5,'Invalid payout experiment.');
 requireRule([1,2].includes(dicePerShare)&&[3,5].includes(actionsPerRound),'Invalid pacing experiment.');
 const g=createGame({seed,players,variant:'dice'});
 g.variant='dice';g.version=DEAL_FLOW_VERSION;g.round=0;g.cycle=0;g.rules.shareLimit=Number.MAX_SAFE_INTEGER;g.rules.catchUp=false;g.payoutStep=payoutStep;g.dicePerShare=dicePerShare;g.actionsPerRound=actionsPerRound;
 g.log=[];g.pile=[];g.removed=[];g.pendingGrowth=[];g.centre=[];g.finishOrder=[];g.growthSerial=0;g.metrics.rolls=0;g.metrics.baseMovement=0;g.metrics.actions=0;g.metrics.cycles=0;
 const founders=shuffle(g,[...DICE_FOUNDERS]);
 for(const c of g.companies){c.position=1;c.supply=[];c.history=[];c.tokens=[];c.lastBuy=Array(players).fill(0);c.latestInvestor=true;c.founder=founders.shift();}
 g.founderMarket=founders.splice(0,3);g.founderSupply=founders;
 g.intelDeck=shuffle(g,intelDeck().filter(c=>DICE_VALUES.includes(c.kind)));g.intelDiscard=[];g.valueDeckSize=g.intelDeck.length;
 for(const p of g.players){p.intel=g.intelDeck.splice(0,3);p.dealFlow=[];p.actionsTaken=0;p.capitalCalled=0;}
 // Equal supply: two starting shares per company, shuffled and dealt clockwise.
 const supply=shuffle(g,Array.from({length:12},(_,i)=>i%6));
 for(let deal=0;deal<2;deal++)for(const id of order(g)){
  const c=g.companies[supply.pop()];c.tokens.push({id:c.tokens.length+1,owner:id,paid:0,boughtLeg:0});c.lastBuy[id]=++g.serial;grantGrowth(g,id,c.id,'setup');g.metrics.issued++;
 }
 event(g,{type:'setup',seed,players,portfolios:g.companies.map(c=>c.tokens.map(t=>t.owner))});
 setTurn(g,'flowRoll');assertDiceGame(g);return g;
}
function resetPowers(g){g.founderUsed=[];g.harryUsed=[];g.julieUsed=[];g.danUsed=[];g.stefanUsed=[];g.reidUsed=[];g.revealMovement=Array(6).fill(0);g.revealMoved=Array(6).fill(false);for(const c of g.companies)c.flags={};}
function startRound(g){
 g.round++;g.cycle=g.round;g.metrics.cycles=g.round;g.centre=[];g.pendingGrowth=[];resetPowers(g);
 const deck=shuffle(g,Array.from({length:6*g.players.length},(_,i)=>({id:`d${g.round}-${i}`,company:i%6})));
 for(const p of g.players){p.actionsTaken=0;p.dealFlow=deck.splice(0,g.actionsPerRound+1);}
 event(g,{type:'roundStart'});setTurn(g,'flowAction');
}
function nextAction(g){
 const id=g.flowActor;delete g.auction;delete g.valueResult;delete g.intelOrder;
 if(g.players.every(p=>p.actionsTaken===g.actionsPerRound)){
  g.centre=revealCentreCards(g.players,g.first,g.actionsPerRound);event(g,{type:'centre',cards:g.centre});g.flowStage='start';
  resolveRevealPhase(g,'start',true);if(!g.race)startShareGrowth(g);
 }else setTurn(g,'flowAction',(id+1)%g.players.length);
}
function startShareGrowth(g){
 g.flowStage='shares';const next=nextGrowthPlayer(g,(g.first+g.players.length-1)%g.players.length);
 if(next===null)startCentre(g);else setTurn(g,'flowRoll',next);
}
function startCentre(g){g.flowStage='centre';if(g.centre.some(c=>!c.resolved))setTurn(g,'flowCentre');else endGrowth(g);}
function endGrowth(g){
 if(g.round===0){resetPowers(g);startRound(g);return;}
 g.flowStage='end';resolveRevealPhase(g,'end',true);if(!g.race)endRound(g);
}
function endRound(g){
 event(g,{type:'roundEnd',positions:g.companies.map(c=>c.position),rolls:g.metrics.rolls});
 if(g.round===4){
  g.prices=g.companies.map(c=>exitPrice(c.position,g.payoutStep));
  g.accounts=g.players.map(p=>({player:p.id,cash:p.cash,payout:g.companies.reduce((sum,c)=>sum+holdings(c,p.id)*g.prices[c.id],0),capitalCalled:p.capitalCalled}));
  g.scores=g.accounts.map(a=>dealFlowScore(a.cash,a.payout,a.capitalCalled));g.winners=g.players.filter(p=>g.scores[p.id]===Math.max(...g.scores)).map(p=>p.id);g.ended=true;g.phase='finished';g.queue=[];
  event(g,{type:'settlement',accounts:g.accounts,scores:g.scores});
 }else{g.first=(g.first+1)%g.players.length;startRound(g);}
}
function afterEffects(g){
 if(g.race)return;
 if(g.flowStage==='start')startShareGrowth(g);
 else if(g.flowStage==='end')endRound(g);
 else if(['shares','centre','setup'].includes(g.flowStage))setTurn(g,'flowReceipt',g.rollActor);
}
function roll(g,company,source,id){
 const die=rollGrowthDie(()=>random(g));g.metrics.rolls++;g.metrics.baseMovement+=die.printed;g.rollActor=id;
 const card={id:`die-${g.metrics.rolls}`,kind:'growth',company,printed:die.printed,signature:false,...(die.fumble?{effect:'fumble'}:{})};
 g.lastRoll={...die,company,source,number:g.metrics.rolls};event(g,{type:'die',...g.lastRoll,player:id});
 resolveCard(g,card,{interactive:true});afterEffects(g);
}
function recordFinishers(g){for(const c of [...g.companies].sort((a,b)=>a.arrivalOrder-b.arrivalOrder))if(c.position===24&&!g.finishOrder.includes(c.id)){g.finishOrder.push(c.id);c.finishOrder=g.finishOrder.length;}for(const c of g.companies)c.finished=c.position===24&&!c.down;}
function apply(g,id,cmd){
 requireRule(!g.ended&&currentPlayer(g)===id,'Another investor must decide.');
 requireRule(cmd&&typeof cmd.type==='string','Choose a command.');
 if(g.phase==='flowAction'){
  requireRule(['call','raiseMoney','valueAction','changeFounder'].includes(cmd.type),'Choose funding, capital, value, or founder.');
  if(cmd.type==='valueAction')requireRule(valueChoices(g,id).length>0,'No playable value card.');
  const p=g.players[id];consumeDealFlow(p,cmd.deal,{fundingCompany:cmd.type==='call'?cmd.company:undefined,actionsPerRound:g.actionsPerRound});g.metrics.actions++;g.flowActor=id;g.flowStage='action';
  event(g,{type:'action',player:id,command:cmd});
  if(cmd.type==='raiseMoney'){p.cash+=10;p.capital++;p.capitalCalled+=10;g.bank.issued+=10;nextAction(g);return;}
  setTurn(g,'call',id);g.actionsLeft=2;g.turnHires=[];g.weekendUsed=false;
  legacyCommand(g,id,cmd);return;
 }
 if(g.phase==='flowRoll'){
  requireRule(cmd.type==='roll','Choose a pending share to roll.');const previous=g.pendingGrowth.find(e=>e.id===g.rollingEntitlement&&!e.resolved);requireRule(!previous||cmd.entitlement===previous.id,'Finish both dice for this share first.');const entry=consumeGrowth(g,id,cmd.entitlement);
  g.rollingEntitlement=entry.id;g.flowStage=g.round===0?'setup':'shares';roll(g,entry.company,entry.source,id);return;
 }
 if(g.phase==='flowCentre'){
  requireRule(cmd.type==='rollCentre','Roll the next centre card.');const card=g.centre.find(c=>!c.resolved);card.resolved=true;roll(g,card.company,'centre',id);return;
 }
 if(g.phase==='flowReceipt'){
  requireRule(cmd.type==='continue','Review the die, then continue.');
  if(g.flowStage==='centre')startCentre(g);
  else{const unfinished=g.pendingGrowth.find(e=>e.id===g.rollingEntitlement&&!e.resolved);if(unfinished){setTurn(g,'flowRoll',g.rollActor);return;}const next=nextGrowthPlayer(g,g.rollActor);if(next!==null)setTurn(g,'flowRoll',next);else if(g.round===0)endGrowth(g);else startCentre(g);}return;
 }
 if(g.flowStage!=='action'&&g.phase==='power'){
  requireRule(cmd.type==='power'&&Number.isInteger(cmd.choice)&&!!g.powerChoice.options[cmd.choice],'Choose a founder power.');resumeRace(g,cmd.choice,resolveCardBase);afterEffects(g);return;
 }
 if(g.flowStage!=='action'&&g.phase==='phaseResult'){
  requireRule(cmd.type==='continue','Review founder effects.');resumePhase(g,resolveCardBase);afterEffects(g);return;
 }
 // Value-card and auction effects use the production resolver, including bids,
 // public tie raises, replacement draws, and suspended founder decisions.
 requireRule(g.flowStage==='action','Invalid phase.');
 requireRule(!['cancelValue','exchangeValue','passValue'].includes(cmd.type),'Play a value card to complete this action.');
 const before=g.companies.map(c=>c.tokens.length);
 legacyCommand(g,id,cmd);
 // Sweat Equity issues a share through the existing value-card resolver.
 if(cmd.type==='playIntel')for(const c of g.companies)if(c.tokens.length>before[c.id])grantGrowth(g,id,c.id);
 if(g.phase==='call')nextAction(g);
}
export function diceCommand(g,id,cmd){
 // Validate on a working state, so a rejected card/target never consumes a turn.
 const next=structuredClone(g);apply(next,id,cmd);recordFinishers(next);assertDiceGame(next);
 for(const key of Object.keys(g))delete g[key];Object.assign(g,next);return g;
}
export function diceObservation(g,id){
 const view=legacyObservation(g,id);
 for(const p of view.players){p.dealFlowCount=p.dealFlow.length;if(p.id!==id)delete p.dealFlow;}
 return view;
}
export function valueChoices(g,id){
 const choices=[];
 for(const [card,item] of g.players[id].intel.entries())for(const company of intelTargets(g,id,item.kind)){
  const seconds=intelSecondTargets(g,id,item.kind,company);
  const targets=item.kind==='move'?[undefined,...seconds]:seconds.length?seconds:[undefined];
  for(const target of targets)for(const extra of expansionChoices(g,id,card,company))choices.push({type:'playIntel',card,company,...(target===undefined?{}:{target}),...extra});
 }
 return choices;
}
export function assertDiceGame(g){
 requireRule(g.companies.length===6&&g.players.length>=2&&g.players.length<=4,'Invalid table.');
 requireRule(g.players.every(p=>Number.isInteger(p.cash)&&p.cash>=0&&p.capitalCalled===p.capital*10),'Invalid cash/capital.');
 requireRule(g.players.reduce((n,p)=>n+p.cash,0)===g.bank.issued-g.bank.burn,'Cash conservation failed.');
 requireRule(g.companies.every(c=>c.position>=0&&c.position<=24&&c.tokens.every(t=>g.players[t.owner])),'Invalid company.');
 const founders=[...g.companies.map(c=>c.founder),...g.founderMarket,...g.founderSupply];
 requireRule(founders.length===DICE_FOUNDERS.length&&new Set(founders).size===DICE_FOUNDERS.length&&founders.every(f=>DICE_FOUNDERS.includes(f)),'Founder conservation failed.');
 const cards=[...g.intelDeck,...g.intelDiscard,...g.players.flatMap(p=>p.intel)];
 requireRule(cards.length===DICE_VALUES.length*2&&new Set(cards.map(c=>c.id)).size===cards.length,'Value-card conservation failed.');
 requireRule(g.pendingGrowth.every(e=>g.players[e.player]&&g.companies[e.company])&&new Set(g.pendingGrowth.map(e=>e.id)).size===g.pendingGrowth.length,'Invalid growth ledger.');
 requireRule(g.round>=0&&g.round<=4&&g.players.every(p=>p.actionsTaken>=0&&p.actionsTaken<=g.actionsPerRound),'Invalid round.');
 if(g.round>0&&g.flowStage==='action')requireRule(g.players.every(p=>p.dealFlow.length===g.actionsPerRound+1-p.actionsTaken),'Deal-flow accounting failed.');
 return true;
}
export function replayDiceGame(replay){requireRule([DEAL_FLOW_VERSION,'129-dice-preview'].includes(replay.version),'Unsupported dice replay.');const g=createDiceGame(replay.setup);for(const {id,cmd} of replay.commands)diceCommand(g,id,cmd);return g;}
export {currentPlayer,pendingFor,shareLeader,holdings,FOUNDERS,INTEL_CARDS};
