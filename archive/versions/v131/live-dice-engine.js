import {createDiceGame as createPrevious,DICE_FOUNDERS as PREVIOUS_FOUNDERS,DICE_VALUES as PREVIOUS_VALUES,valueChoices as previousChoices} from './dice-engine.js';
import {command as legacyCommand,currentPlayer,random,shuffle,resolveCard,resolveCardBase,observation as legacyObservation,holdings} from './engine.js';
import {resolveRevealPhase,resumeRace,resumePhase} from './racing.js';
import {grantGrowth,pendingFor,nextGrowthPlayer,consumeGrowth,dealFlowScore} from './deal-flow.js';
import {shareLeader} from './ownership.js';
import {FOUNDERS} from './config.js';
import {INTEL_CARDS,intelDeck} from './intel.js';
import {LIVE_DICE_VERSION,LEG_ENDS,exitPrice,rollDie,validateDice} from './live-dice-rules.js';

const check=(ok,message)=>{if(!ok)throw Error(message);};
const event=(g,e)=>g.log.push({round:g.round,...structuredClone(e)});
const turn=(g,phase,id=g.first)=>{g.phase=phase;g.active=id;g.queue=[id];};
export const DICE_FOUNDERS=PREVIOUS_FOUNDERS.filter(id=>id!==26);
export const DICE_VALUES=PREVIOUS_VALUES.filter(kind=>!['advice','fresh'].includes(kind));

function resetWindow(g){
 // Leon says once per round; other reveal powers renew for each purchased share.
 g.founderUsed=(g.founderUsed??[]).filter(id=>g.companies[id].founder===10);
 g.harryUsed=[];g.julieUsed=[];g.danUsed=[];g.stefanUsed=[];g.reidUsed=[];
 g.revealMovement=Array(6).fill(0);g.revealMoved=Array(6).fill(false);g.intelMovementStarted=false;
}
function deal(g,count){
 const n=g.players.length*count,deck=shuffle(g,Array.from({length:6*Math.ceil(n/6)},(_,i)=>({id:`d${++g.dealSerial}`,company:i%6})));
 // A balanced fresh deck per draw, dealt clockwise. The unused cards are not revealed.
 for(let card=0;card<count;card++)for(let offset=0;offset<g.players.length;offset++)g.players[(g.first+offset)%g.players.length].dealFlow.push(deck.pop());
 event(g,{type:'dealFlowDraw',count});
}
function settle(g){
 g.prices=g.companies.map(c=>exitPrice(c.position));
 g.accounts=g.players.map(p=>({player:p.id,cash:p.cash,payout:g.companies.reduce((n,c)=>n+holdings(c,p.id)*g.prices[c.id],0),capitalCalled:p.capitalCalled}));
 g.scores=g.accounts.map(a=>dealFlowScore(a.cash,a.payout,a.capitalCalled));g.winners=g.players.filter(p=>g.scores[p.id]===Math.max(...g.scores)).map(p=>p.id);
 g.ended=true;g.phase='finished';g.queue=[];event(g,{type:'settlement',accounts:g.accounts,scores:g.scores});
}
function beginWindow(g,entry){
 g.windowEntry=entry.id;g.rollActor=entry.player;resetWindow(g);g.flowStage='purchaseStart';
 event(g,{type:'purchaseGrowthStart',company:entry.company,player:entry.player,entitlement:entry.id,dice:entry.dice});
 resolveRevealPhase(g,'start',true);afterEffects(g);
}
function afterEffects(g){
 if(g.race)return;
 if(g.flowStage==='purchaseStart'){g.flowStage='purchaseDice';turn(g,'flowRoll',g.rollActor);}
 else if(g.flowStage==='purchaseEnd'){
  event(g,{type:'purchaseGrowthEnd',entitlement:g.windowEntry,positions:g.companies.map(c=>c.position)});
  delete g.windowEntry;advanceAction(g);
 }else if(['purchaseDice','setup'].includes(g.flowStage))turn(g,'flowReceipt',g.rollActor);
}
function roll(g,entry){
 const index=entry.dice.length-entry.remaining,die=rollDie(()=>random(g),entry.dice[index]);
 consumeGrowth(g,entry.player,entry.id);g.metrics.rolls++;g.metrics.baseMovement+=die.printed;g.rollActor=entry.player;
 g.lastRoll={...die,company:entry.company,source:entry.source,number:g.metrics.rolls,index:index+1,total:entry.dice.length};
 event(g,{type:'die',...g.lastRoll,player:entry.player});
 resolveCard(g,{id:`die-${g.metrics.rolls}`,kind:'growth',company:entry.company,printed:die.printed,signature:false,...(die.fumble?{effect:'fumble'}:{})},{interactive:true});afterEffects(g);
}
function finishRoll(g){
 if(g.flowStage==='setup'){
  const next=nextGrowthPlayer(g,g.rollActor);
  if(next!==null)turn(g,'flowRoll',next);else finishSetup(g);
  return;
 }
 const entry=g.pendingGrowth.find(e=>e.id===g.windowEntry);
 if(!entry.resolved){turn(g,'flowRoll',entry.player);return;}
 g.flowStage='purchaseEnd';resolveRevealPhase(g,'end',true);afterEffects(g);
}
function advanceAction(g){
 const pending=g.pendingGrowth.find(e=>!e.resolved);
 if(pending){turn(g,'chooseDice',pending.player);return;}
 if(g.crossedLegs.includes(2)){event(g,{type:'roundEnd',positions:g.companies.map(c=>c.position),actions:g.players.map(p=>p.actionsTaken)});settle(g);return;}
 if(g.crossedLegs.includes(g.leg)){endLeg(g);return;}
 delete g.auction;delete g.valueResult;delete g.intelOrder;g.flowStage='action';
 for(let offset=1;offset<=g.players.length;offset++){
  const id=(g.flowActor+offset)%g.players.length;
  if(g.players[id].dealFlow.length){turn(g,'flowAction',id);return;}
 }
 // The user expects the boundary before exhaustion. Do not silently add a redeal rule.
 g.stalled=true;turn(g,'flowStalled');event(g,{type:'stalled',reason:'All deal-flow hands exhausted before the leg boundary.'});
}
function apply(g,id,cmd){
 check(!g.ended&&!g.stalled&&currentPlayer(g)===id,'Another investor must decide.');check(cmd&&typeof cmd.type==='string','Choose a command.');
 if(g.phase==='chooseDice'){
  check(cmd.type==='chooseDice','Choose the dice for this share.');const entry=g.pendingGrowth.find(e=>!e.resolved);
  entry.dice=validateDice(cmd.dice,entry.remaining);event(g,{type:'diceChoice',player:id,company:entry.company,dice:entry.dice});beginWindow(g,entry);return;
 }
 if(g.phase==='flowRoll'){
  check(cmd.type==='roll','Roll the next die.');
  const entry=g.flowStage==='setup'?pendingFor(g,id).find(e=>e.id===cmd.entitlement):g.pendingGrowth.find(e=>e.id===g.windowEntry);
  check(entry&&!entry.resolved&&entry.player===id,'Choose your pending share.');
  if(g.flowStage==='setup'){entry.dice=validateDice(cmd.dice??['balanced'],1);event(g,{type:'diceChoice',player:id,company:entry.company,dice:entry.dice,setup:true});}
  roll(g,entry);return;
 }
 if(g.phase==='flowReceipt'){check(cmd.type==='continue','Review the die result.');finishRoll(g);return;}
 if(g.phase==='roundResult'){check(cmd.type==='continue','Review the completed leg.');prepareLeg(g);return;}
 if(g.flowStage!=='action'&&g.phase==='power'){
  check(cmd.type==='power'&&Number.isInteger(cmd.choice)&&!!g.powerChoice.options[cmd.choice],'Choose a founder power.');resumeRace(g,cmd.choice,resolveCardBase);afterEffects(g);return;
 }
 if(g.flowStage!=='action'&&g.phase==='phaseResult'){check(cmd.type==='continue','Review founder effects.');resumePhase(g,resolveCardBase);afterEffects(g);return;}
 if(g.phase==='flowAction'){startAction(g,id,cmd);return;}
 check(g.flowStage==='action','Invalid phase.');check(!['cancelValue','exchangeValue','passValue'].includes(cmd.type),'Complete the chosen action.');
 const before=g.companies.map(c=>c.tokens.length);
 playLegacy(g,id,cmd);
 if(cmd.type==='playIntel')for(const c of g.companies)if(c.tokens.length>before[c.id])grantGrowth(g,id,c.id);
 if(g.phase==='call')advanceAction(g);
}
export function diceCommand(g,id,cmd){
 const next=structuredClone(g),logStart=next.log.length;apply(next,id,cmd);
 for(const e of next.log.slice(logStart))e.round??=next.round;
 assertDiceGame(next);for(const key of Object.keys(g))delete g[key];Object.assign(g,next);return g;
}
export function diceObservation(g,id){
 const view=legacyObservation(g,id);
 for(const p of view.players){p.dealFlowCount=p.dealFlow.length;if(p.id!==id)delete p.dealFlow;}
 return view;
}
export function replayDiceGame(data){check(data.version===LIVE_DICE_VERSION,'Load this replay in its original dice version.');const g=createDiceGame(data.setup);for(const {id,cmd} of data.commands)diceCommand(g,id,cmd);return g;}
export {currentPlayer,pendingFor,holdings,shareLeader,exitPrice,FOUNDERS,INTEL_CARDS};

// The round is a race segment; crossing its boundary is latched by movement.js.
function finishSetup(g){
 g.round=1;g.cycle=1;g.leg=0;g.metrics.cycles=1;g.flowStage='action';
 // Opening growth is round zero. Boundaries already passed are complete.
 while(g.leg<2&&g.crossedLegs.includes(g.leg))g.leg++;
 g.founderUsed=[];resetWindow(g);for(const c of g.companies)c.flags={};
 deal(g,8);event(g,{type:'roundStart',target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position)});
 if(g.crossedLegs.includes(2))settle(g);else turn(g,'flowAction');
}
function endLeg(g){
 g.roundResult={target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position),actions:g.players.map(p=>p.actionsTaken)};
 event(g,{type:'roundEnd',...g.roundResult});turn(g,'roundResult',g.flowActor);
}
function startAction(g,id,cmd){
 check(['call','raiseMoney','valueAction','changeFounder'].includes(cmd.type),'Choose funding, capital, value, or founder.');
 const p=g.players[id];check(Number.isInteger(cmd.deal)&&!!p.dealFlow[cmd.deal],'Choose a deal-flow card.');
 if(cmd.type==='call')check(p.dealFlow[cmd.deal].company===cmd.company,'Funding requires a matching deal-flow card.');
 if(cmd.type==='valueAction')check(valueChoices(g,id).length,'No playable value card.');
 const [card]=p.dealFlow.splice(cmd.deal,1);p.actionsTaken++;g.metrics.actions++;g.flowActor=id;g.flowStage='action';
 event(g,{type:'action',player:id,command:cmd,card,positions:g.companies.map(c=>c.position),founders:g.companies.map(c=>c.founder),values:g.valueMarket.map(c=>c.kind),market:g.founderMarket});
 if(cmd.type==='raiseMoney'){p.cash+=10;p.capital++;p.capitalCalled+=10;g.bank.issued+=10;advanceAction(g);return;}
 turn(g,'call',id);g.actionsLeft=2;g.turnHires=[];g.weekendUsed=false;
 if(cmd.type==='valueAction'&&g.publicValues){g.intelOrder=[id];g.intelTiming='turn';delete g.valueResult;turn(g,'intelPlay',id);}
 else legacyCommand(g,id,cmd);
}

function drawValue(g){
 if(!g.intelDeck.length)g.intelDeck=shuffle(g,g.intelDiscard.splice(0));
 return g.intelDeck.shift();
}
function refreshMarkets(g){
 const oldFounders=g.founderMarket;
 g.founderSupply=shuffle(g,g.founderSupply);g.founderMarket=g.founderSupply.splice(0,4);g.founderSupply.push(...oldFounders);
 // Draw replacements before discarding the old market, so a refresh is new.
 const oldValues=g.valueMarket;g.valueMarket=Array.from({length:4},()=>drawValue(g));g.intelDiscard.push(...oldValues);
 event(g,{type:'marketsRefreshed',founders:g.founderMarket,values:g.valueMarket.map(c=>c.kind)});
}
function prepareLeg(g){
 do{g.leg++;}while(g.leg<2&&g.crossedLegs.includes(g.leg));
 g.round++;g.cycle=g.round;g.metrics.cycles=g.round;g.first=(g.first+1)%g.players.length;
 g.founderUsed=[];resetWindow(g);for(const c of g.companies)c.flags={};
 for(const p of g.players)p.actionsTaken=0;
 delete g.auction;delete g.valueResult;delete g.intelOrder;delete g.roundResult;
 refreshMarkets(g);deal(g,3);g.flowStage='action';event(g,{type:'roundStart',target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position)});turn(g,'flowAction');
}
function playLegacy(g,id,cmd){
 if(cmd.type==='playIntel'){
  check(valueChoices(g,id).some(c=>Object.keys(c).every(k=>k==='price'||c[k]===cmd[k])),'Choose a public value card and legal targets.');
  const [card]=g.valueMarket.splice(cmd.card,1);check(card,'Choose a public value card.');
  g.players[id].intel.push(card);legacyCommand(g,id,{...cmd,card:0});
  g.valueMarket.splice(cmd.card,0,drawValue(g));
 }else legacyCommand(g,id,cmd);
}
export function valueChoices(g,id){
 const view={...g,players:g.players.map(p=>p.id===id?{...p,intel:g.valueMarket}:p)};
 return previousChoices(view,id);
}
export function createDiceGame({seed=42,players=4}={}){
 const g=createPrevious({seed,players,dicePerShare:2,payoutStep:2});
 g.liveDice=true;g.publicValues=true;g.version=LIVE_DICE_VERSION;g.flowStage='setup';g.leg=0;g.crossedLegs=[];g.dealSerial=0;g.actionsPerRound=null;
 const founders=shuffle(g,[...DICE_FOUNDERS]);for(const c of g.companies)c.founder=founders.shift();
 g.founderMarket=founders.splice(0,4);g.founderSupply=founders;
 g.intelDeck=shuffle(g,intelDeck().filter(c=>DICE_VALUES.includes(c.kind)));g.intelDiscard=[];g.valueDeckSize=g.intelDeck.length;g.valueMarket=g.intelDeck.splice(0,4);
 for(const p of g.players)p.intel=[];
 event(g,{type:'marketsRefreshed',founders:g.founderMarket,values:g.valueMarket.map(c=>c.kind)});
 assertDiceGame(g);return g;
}
export function assertDiceGame(g){
 check(g.companies.length===6&&g.players.length>=2&&g.players.length<=4,'Invalid table.');
 check(g.players.every(p=>Number.isInteger(p.cash)&&p.cash>=0&&p.capitalCalled===p.capital*10),'Invalid cash/capital.');
 check(g.players.reduce((n,p)=>n+p.cash,0)===g.bank.issued-g.bank.burn,'Cash conservation failed.');
 check(g.companies.every(c=>c.position>=0&&c.position<=24&&c.tokens.every(t=>g.players[t.owner])),'Invalid company.');
 const founders=[...g.companies.map(c=>c.founder),...g.founderMarket,...g.founderSupply];
 check(g.founderMarket.length===4&&founders.length===DICE_FOUNDERS.length&&new Set(founders).size===founders.length&&founders.every(f=>DICE_FOUNDERS.includes(f)),'Founder conservation failed.');
 const values=[...g.intelDeck,...g.intelDiscard,...g.valueMarket,...g.players.flatMap(p=>p.intel)];
 check(g.valueMarket.length===4&&values.length===DICE_VALUES.length*2&&new Set(values.map(c=>c.id)).size===values.length,'Value-card conservation failed.');
 check(g.players.every(p=>p.intel.length===0),'Only deal-flow cards are private.');
 const deals=g.players.flatMap(p=>p.dealFlow);check(new Set(deals.map(c=>c.id)).size===deals.length,'Duplicate deal-flow card.');
 check(g.pendingGrowth.every(e=>g.players[e.player]&&g.companies[e.company]&&e.remaining>=0&&e.remaining<=2&&e.resolved===(e.remaining===0)),'Invalid growth ledger.');
 check(g.leg>=0&&g.leg<=2&&g.round>=0&&g.round<=3,'Invalid leg.');return true;
}
