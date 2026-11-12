import {createDiceGame as createPrevious,DICE_FOUNDERS as PREVIOUS_FOUNDERS,DICE_VALUES as PREVIOUS_VALUES,valueChoices as previousChoices} from './dice-engine.js';
import {command as legacyCommand,currentPlayer,random,shuffle,resolveCard,resolveCardBase,observation as legacyObservation,holdings} from './engine.js';
import {resolveRevealPhase,resumeRace,resumePhase} from './racing.js';
import {grantGrowth,pendingFor,nextGrowthPlayer,consumeGrowth,dealFlowScore} from './deal-flow.js';
import {shareLeader} from './ownership.js';
import {FOUNDERS as BASE_FOUNDERS} from './config.js';
import {INTEL_CARDS as BASE_INTEL_CARDS,intelDeck} from './intel.js';
import {LIVE_DICE_VERSION,DEAL_COPIES,LEG_ENDS,exitPrice,shareExitPrice,rollDie,validateDice} from './live-dice-rules.js';

const check=(ok,message)=>{if(!ok)throw Error(message);};
const event=(g,e)=>g.log.push({round:g.round,leg:g.leg,turn:g.turnNumber,...structuredClone(e)});
const turn=(g,phase,id=g.first)=>{g.phase=phase;g.active=id;g.queue=[id];};
export const DICE_FOUNDERS=PREVIOUS_FOUNDERS.filter(id=>id!==26);
export const DICE_VALUES=PREVIOUS_VALUES.filter(kind=>!['advice','fresh','public','rights','tender'].includes(kind));

const INTEL_CARDS={...BASE_INTEL_CARDS,sweat:{...BASE_INTEL_CARDS.sweat,text:'Move a portfolio company back 2 spaces and add 1 of your shares to it. No dice.'},...Object.fromEntries(['rights','public','tender'].map(k=>[k,{...BASE_INTEL_CARDS[k],text:({rights:'Spend matching deal-flow. Offer 1 new portfolio share at $1+ you can pay. Clockwise, first acceptance buys; if all pass, you buy.',public:'Spend matching deal-flow. Auction 1 new portfolio share from $1. Raise $1+; passing is final. Highest bidder pays.',tender:'Spend matching deal-flow. Auction 1 new portfolio share. Everyone bids secretly once; highest bidder pays their offer. Normal ties.'})[k]}]))};
const founderCopy=text=>text.replace(/numbered growth (?:token|card) is revealed/gi,'dice reveal has numbers').replace(/growth (?:token|card) is revealed/gi,'dice are revealed');
const FOUNDERS=BASE_FOUNDERS.map(f=>{const trigger=founderCopy(f.trigger),action=founderCopy(f.action);return {...f,trigger,action,text:`${trigger}: ${action}`};});

function resetWindow(g){
 g.revealMovement=Array(6).fill(0);g.revealMoved=Array(6).fill(false);g.intelMovementStarted=false;
}
function dealRow(g){
 g.dealRow=[];
 for(let i=0;i<g.players.length+1&&g.dealDeck.length;i++){
  const index=g.distinctRow?g.dealDeck.findIndex(c=>!g.dealRow.some(d=>d.company===c.company)):g.dealDeck.length-1;
  if(index<0)break;g.dealRow.push(g.dealDeck.splice(index,1)[0]);
 }
 event(g,{type:'dealFlowRow',cards:g.dealRow,remaining:g.dealDeck.length});
}
function bankRemainder(g){
 for(const card of g.dealRow.splice(0)){
  g.dealSpent.push(card);const entry=grantGrowth(g,g.first,card.company,'bank');
  entry.remaining=g.bankDice;entry.dice=Array(g.bankDice).fill('bland');entry.bank=true;
  event(g,{type:'bankFunding',company:card.company,card,dice:entry.dice});
 }
}

function settle(g,reason='finish'){
 g.endReason=reason;
 g.companyValues=g.companies.map(c=>exitPrice(c.position));g.prices=g.companies.map(c=>shareExitPrice(c));
 g.accounts=g.players.map(p=>({player:p.id,cash:p.cash,payout:g.companies.reduce((n,c)=>n+holdings(c,p.id)*g.prices[c.id],0),capitalCalled:p.capitalCalled}));
 g.scores=g.accounts.map(a=>dealFlowScore(a.cash,a.payout,a.capitalCalled));g.winners=g.players.filter(p=>g.scores[p.id]===Math.max(...g.scores)).map(p=>p.id);
 g.ended=true;g.phase='finished';g.queue=[];event(g,{type:'settlement',accounts:g.accounts,scores:g.scores});
}
function startReveal(g){
 g.flowStage='roundStart';resetWindow(g);
 event(g,{type:'roundRevealStart',pending:g.pendingGrowth.filter(e=>!e.resolved).map(e=>({company:e.company,player:e.player,dice:e.dice}))});
 resolveRevealPhase(g,'start',true);afterEffects(g);
}
function nextReveal(g){
 const entry=g.pendingGrowth.find(e=>!e.resolved);
 if(entry){g.windowEntry=entry.id;g.rollActor=entry.player;g.flowStage='roundDice';turn(g,'flowRoll',entry.player);return;}
 delete g.windowEntry;g.flowStage='roundEnd';resolveRevealPhase(g,'end',true);afterEffects(g);
}
function afterEffects(g){
 if(g.race)return;
 if(g.flowStage==='roundStart')nextReveal(g);
 else if(g.flowStage==='roundEnd'){g.flowStage='roundCatchUp';resolveRevealPhase(g,'catchUp',true);afterEffects(g);}
 else if(g.flowStage==='roundCatchUp')finishRound(g);
 else if(['roundDice','setup'].includes(g.flowStage)){
  g.lastRoll.reactions.push(...(g.lastRevealed?.reactions??[]));
  if(g.revealQueue?.length)resolveNextFace(g);else turn(g,'flowReceipt',g.rollActor);
 }
}
function resolveNextFace(g){
 const card=g.revealQueue.shift();resolveCard(g,card,{interactive:true});afterEffects(g);
}
function roll(g,entry){
 const ordinal=entry.dice.length-entry.remaining+1,die=rollDie(()=>random(g),entry.dice[ordinal-1]),dice=[die];
 consumeGrowth(g,entry.player,entry.id);g.metrics.rolls++;g.metrics.baseMovement+=die.printed;
 event(g,{type:'die',...die,ordinal,company:entry.company,source:entry.source,player:entry.player});
 g.rollActor=entry.player;g.metrics.reveals=(g.metrics.reveals??0)+1;
 const printed=die.printed,fumbles=Number(die.fumble);
 g.lastRoll={reactions:[],dice,ordinal,totalDice:entry.dice.length,printed,fumbles,company:entry.company,source:entry.source,before:g.companies[entry.company].position,wasFumbled:g.companies[entry.company].down};
 event(g,{type:'diceReveal',...g.lastRoll,player:entry.player});
 g.revealQueue=[{id:`reveal-${g.metrics.reveals}`,kind:'growth',company:entry.company,signature:false,printed,...(die.fumble?{effect:'fumble'}:{})}];
 resolveNextFace(g);
}
function finishRoll(g){
 if(g.flowStage==='setup'){
  const next=nextGrowthPlayer(g,g.rollActor);
  if(next!==null)turn(g,'flowRoll',next);else finishSetup(g);
  return;
 }
 nextReveal(g);
}
function advanceAction(g){
 const pending=g.pendingGrowth.find(e=>!e.resolved&&!e.dice);
 if(pending){turn(g,'chooseDice',pending.player);return;}
 if(g.turnPart==='funding'){g.turnPart='support';turn(g,'flowAction',g.flowActor);return;}
 g.roundActed.push(g.flowActor);g.turnNumber++;nextTurn(g);
}
function resetRound(g){
 g.founderUsed=[];g.harryUsed=[];g.julieUsed=[];g.danUsed=[];g.stefanUsed=[];g.reidUsed=[];
 resetWindow(g);for(const c of g.companies)c.flags={};
 g.roundActed=[];g.roundFunded=[];for(const p of g.players)p.actionsTaken=0;
}
function finishRound(g){
 event(g,{type:'roundEnd',positions:g.companies.map(c=>c.position),actions:g.players.map(p=>p.actionsTaken)});
 if(g.crossedLegs.includes(2)){settle(g);return;}
 if(!g.dealDeck.length&&!g.dealRow.length){settle(g,'deckExhausted');return;}
 if(g.leg<2&&g.companies.filter(c=>c.position>=LEG_ENDS[g.leg]).length>=3){endLeg(g);return;}
 newRound(g);
}
function newRound(g){
 g.round++;g.cycle=g.round;g.metrics.cycles=g.round;g.first=(g.first+1)%g.players.length;g.flowActor=(g.first+g.players.length-1)%g.players.length;resetRound(g);dealRow(g);
 event(g,{type:'roundStart',leg:g.leg,target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position)});nextTurn(g);
}
function nextTurn(g){
 delete g.auction;delete g.valueResult;delete g.intelOrder;
 if(g.roundActed.length===g.players.length){bankRemainder(g);startReveal(g);return;}
 g.flowStage='action';g.turnPart=g.dealRow.length?'funding':'support';turn(g,g.dealRow.length?'pickFlow':'flowAction',(g.flowActor+1)%g.players.length);
}

function apply(g,id,cmd){
 check(!g.ended&&!g.stalled&&currentPlayer(g)===id,'Another investor must decide.');check(cmd&&typeof cmd.type==='string','Choose a command.');
 if(g.phase==='chooseDice'){
  check(cmd.type==='chooseDice','Choose the dice for this share.');const entry=g.pendingGrowth.find(e=>!e.resolved&&!e.dice);
  entry.dice=validateDice(cmd.dice,entry.remaining);event(g,{type:'diceChoice',player:id,company:entry.company,dice:entry.dice});advanceAction(g);return;
 }
 if(g.phase==='flowRoll'){
  check(cmd.type==='roll','Roll the next die.');
  const entry=g.flowStage==='setup'?pendingFor(g,id).find(e=>e.id===cmd.entitlement):g.pendingGrowth.find(e=>e.id===g.windowEntry);
  check(entry&&!entry.resolved&&entry.player===id,'Choose your pending share.');
  if(g.flowStage==='setup'){entry.dice=validateDice(cmd.dice??['mild'],1);event(g,{type:'diceChoice',player:id,company:entry.company,dice:entry.dice,setup:true});}
  roll(g,entry);return;
 }
 if(g.phase==='flowReceipt'){check(cmd.type==='continue','Review the die result.');finishRoll(g);return;}
 if(g.phase==='roundResult'){check(cmd.type==='continue','Review the completed leg.');prepareLeg(g);return;}
 if(g.flowStage!=='action'&&g.phase==='power'){
  check(cmd.type==='power'&&Number.isInteger(cmd.choice)&&!!g.powerChoice.options[cmd.choice],'Choose a founder power.');resumeRace(g,cmd.choice,resolveCardBase);afterEffects(g);return;
 }
 if(g.flowStage!=='action'&&g.phase==='phaseResult'){check(cmd.type==='continue','Review founder effects.');resumePhase(g,resolveCardBase);afterEffects(g);return;}
 if(['pickFlow','flowAction'].includes(g.phase)){startAction(g,id,cmd);return;}
 check(g.flowStage==='action','Invalid phase.');check(!['cancelValue','exchangeValue','passValue'].includes(cmd.type),'Complete the chosen action.');

 playLegacy(g,id,cmd);

 if(g.phase==='call')advanceAction(g);
}
export function diceCommand(g,id,cmd){
 const next=structuredClone(g),logStart=next.log.length,roundBefore=g.round;apply(next,id,cmd);
 for(const e of next.log.slice(logStart))e.round??=roundBefore;
 assertDiceGame(next);for(const key of Object.keys(g))delete g[key];Object.assign(g,next);return g;
}
export function diceObservation(g,id){
 const view=legacyObservation(g,id);
 view.publicValueDiscard=structuredClone(g.intelDiscard);view.dealDeckCount=g.dealDeck.length;delete view.dealDeck;delete view.intelDeck;
 for(const p of view.players){p.dealFlowCount=p.dealFlow.length;if(p.id!==id)delete p.dealFlow;}
 return view;
}
export function replayDiceGame(data){check(data.version===LIVE_DICE_VERSION,'Load this replay in its original dice version.');const g=createDiceGame(data.setup);for(const {id,cmd} of data.commands)diceCommand(g,id,cmd);return g;}
export {currentPlayer,pendingFor,holdings,shareLeader,exitPrice,shareExitPrice,FOUNDERS,INTEL_CARDS};

// Rounds count one completed turn per player; legs are independent position gates.
function finishSetup(g){
 g.round=1;g.cycle=1;g.leg=0;g.metrics.cycles=1;g.flowStage='action';
 while(g.leg<2&&g.companies.filter(c=>c.position>=LEG_ENDS[g.leg]).length>=3)g.leg++;
 g.dealCursor=g.first;
 g.flowActor=(g.first+g.players.length-1)%g.players.length;resetRound(g);dealRow(g);event(g,{type:'roundStart',leg:g.leg,target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position)});
 if(g.crossedLegs.includes(2))settle(g);else nextTurn(g);
}

function endLeg(g){
 g.roundResult={target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position),actions:g.players.map(p=>p.actionsTaken)};
 event(g,{type:'legEnd',leg:g.leg,...g.roundResult});turn(g,'roundResult',g.flowActor);
}
function startAction(g,id,cmd){
 check((g.phase==='pickFlow'?['call']:['raiseMoney','valueAction','changeFounder','passAction']).includes(cmd.type),g.phase==='pickFlow'?'Choose one public deal-flow card to fundraise.':'Choose capital, value, founder, or pass.');
 const p=g.players[id];
 if(cmd.type==='call'){check(Number.isInteger(cmd.deal)&&!!g.dealRow[cmd.deal],'Choose a public deal-flow card.');check(g.dealRow[cmd.deal].company===cmd.company,'Choose the matching company.');}
 if(cmd.type==='valueAction')check(valueChoices(g,id).length,'No playable value card.');
 let card;if(cmd.type==='call'){[card]=g.dealRow.splice(cmd.deal,1);g.dealSpent.push(card);if(!g.roundFunded.includes(cmd.company))g.roundFunded.push(cmd.company);}
 p.actionsTaken++;g.metrics.actions++;g.flowActor=id;g.flowStage='action';
 event(g,{type:'action',player:id,command:cmd,card,positions:g.companies.map(c=>c.position),founders:g.companies.map(c=>c.founder),values:g.valueMarket.map(c=>c.kind),market:g.founderMarket});
 if(cmd.type==='passAction'){advanceAction(g);return;}
 if(cmd.type==='raiseMoney'){p.cash+=10;p.capital++;p.capitalCalled+=10;g.bank.issued+=10;advanceAction(g);return;}
 turn(g,'call',id);g.actionsLeft=2;g.turnHires=[];g.weekendUsed=false;
 if(cmd.type==='valueAction'&&g.publicValues){g.intelOrder=[id];g.intelTiming='turn';delete g.valueResult;turn(g,'intelPlay',id);}
 else legacyCommand(g,id,cmd);
}

function drawValue(g){
 const visible=new Set(g.valueMarket.map(c=>c.kind));
 let index=g.intelDeck.findIndex(c=>!visible.has(c.kind));
 if(index<0){g.intelDeck.push(...shuffle(g,g.intelDiscard.splice(0)));index=g.intelDeck.findIndex(c=>!visible.has(c.kind));}
 check(index>=0,'No distinct public value card available.');
 return g.intelDeck.splice(index,1)[0];
}
function refreshMarkets(g){
 const oldFounders=g.founderMarket;
 g.founderSupply=shuffle(g,g.founderSupply);g.founderMarket=g.founderSupply.splice(0,4);g.founderSupply.push(...oldFounders);
 // Draw replacements before discarding the old market, so a refresh is new.
 const oldValues=g.valueMarket;g.valueMarket=[];for(let i=0;i<4;i++)g.valueMarket.push(drawValue(g));g.intelDiscard.push(...oldValues);
 event(g,{type:'marketsRefreshed',founders:g.founderMarket,values:g.valueMarket.map(c=>c.kind)});
}
function prepareLeg(g){
 const previousLeg=g.leg;
 do{g.leg++;}while(g.leg<2&&g.companies.filter(c=>c.position>=LEG_ENDS[g.leg]).length>=3);
 delete g.roundResult;refreshMarkets(g);newRound(g);
}

function playLegacy(g,id,cmd){
 if(cmd.type==='playIntel'){
  check(valueChoices(g,id).some(c=>Object.keys(c).every(k=>k==='price'||c[k]===cmd[k])),'Choose a public value card and legal targets.');
  const kind=g.valueMarket[cmd.card].kind;if(['public','rights','tender'].includes(kind)){
   const index=g.players[id].dealFlow.findIndex(c=>c.company===cmd.company);check(index>=0,'Public fundraising requires a matching deal-flow card.');
   const [card]=g.players[id].dealFlow.splice(index,1);g.dealSpent.push(card);g.roundFunded.push(cmd.company);event(g,{type:'dealFlowSpent',player:id,company:cmd.company,card,source:kind});
  }
  const [card]=g.valueMarket.splice(cmd.card,1);check(card,'Choose a public value card.');
  g.players[id].intel.push(card);legacyCommand(g,id,{...cmd,card:0});
  g.valueMarket.splice(cmd.card,0,drawValue(g));
 }else legacyCommand(g,id,cmd);
}
export function valueChoices(g,id){
 const view={...g,players:g.players.map(p=>p.id===id?{...p,intel:g.valueMarket}:p)};
 return previousChoices(view,id).filter(cmd=>!['public','rights','tender'].includes(g.valueMarket[cmd.card]?.kind)||(!g.roundFunded.includes(cmd.company)&&g.players[id].dealFlow.some(c=>c.company===cmd.company)));
}
export function createDiceGame({seed=42,players=4,dealCopies=DEAL_COPIES,bankDice=2,distinctRow=false}={}){
 check(Number.isInteger(dealCopies)&&dealCopies>=1&&dealCopies<=100,'Choose 1–100 cards per company.');
 const g=createPrevious({seed,players,dicePerShare:2,payoutStep:2});
 check([1,2].includes(bankDice),'Bank rolls one or two dice.');g.bankDice=bankDice;g.distinctRow=!!distinctRow;g.publicFlow=true;g.dealRow=[];g.dealCopies=dealCopies;g.dealDeck=[];g.dealSpent=[];
 g.rules.catchUp=true;g.liveDice=true;g.roundDice=false;g.sharedReveal=true;g.roundFunded=[];g.roundActed=[];g.turnNumber=0;g.publicValues=true;g.version=LIVE_DICE_VERSION;g.flowStage='setup';g.leg=0;g.crossedLegs=[];g.dealSerial=0;g.actionsPerRound=null;
 const founders=shuffle(g,[...DICE_FOUNDERS]);for(const c of g.companies)c.founder=founders.shift();
 g.founderMarket=founders.splice(0,4);g.founderSupply=founders;
 g.intelDeck=shuffle(g,intelDeck().filter(c=>DICE_VALUES.includes(c.kind)));g.intelDiscard=[];g.valueDeckSize=g.intelDeck.length;g.valueMarket=[];for(let i=0;i<4;i++)g.valueMarket.push(drawValue(g));
 // Opening shares consume actual deal-flow cards, one per player from six distinct companies.
 g.dealDeck=Array.from({length:6*dealCopies},(_,i)=>({id:`d${i+1}`,company:i%6}));
 const opening=shuffle(g,g.dealDeck.splice(0,6));
 g.pendingGrowth=[];g.growthSerial=0;g.metrics.issued-=2*players;g.log=[];
 for(const c of g.companies){c.tokens=[];c.lastBuy=Array(players).fill(0);}
 for(let offset=0;offset<players;offset++){
  const id=(g.first+offset)%players,card=opening.pop(),c=g.companies[card.company];
  g.dealSpent.push(card);c.tokens.push({id:1,owner:id,paid:0,boughtLeg:0});c.lastBuy[id]=++g.serial;
  grantGrowth(g,id,c.id,'setup');g.metrics.issued++;
 }
 g.dealDeck=shuffle(g,[...g.dealDeck,...opening]);g.dealInitialized=true;
 event(g,{type:'setup',seed,players,portfolios:g.companies.map(c=>c.tokens.map(t=>t.owner)),spent:g.dealSpent});
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
 check(new Set(g.valueMarket.map(c=>c.kind)).size===4,'Duplicate public value option.');
 check(g.valueMarket.length===4&&values.length===DICE_VALUES.length*2&&new Set(values.map(c=>c.id)).size===values.length,'Value-card conservation failed.');
 check(g.players.every(p=>p.intel.length===0),'Only deal-flow cards are private.');
 check(g.players.every(p=>p.dealFlow.length===0),'Public deal flow has no private hands.');
 const deals=[...g.dealDeck,...g.dealRow,...g.dealSpent,...g.players.flatMap(p=>p.dealFlow)];
 if(g.dealInitialized)check(deals.length===g.dealCopies*6&&Array.from({length:6},(_,cid)=>deals.filter(c=>c.company===cid).length).every(n=>n===g.dealCopies),'Deal-flow conservation failed.');check(new Set(deals.map(c=>c.id)).size===deals.length,'Duplicate deal-flow card.');
 check(g.pendingGrowth.every(e=>g.players[e.player]&&g.companies[e.company]&&e.remaining>=0&&e.remaining<=2&&e.resolved===(e.remaining===0)),'Invalid growth ledger.');
 check(new Set(g.roundActed).size===g.roundActed.length&&g.roundActed.every(id=>g.players[id]),'Invalid round turns.');
 check(g.leg>=0&&g.leg<=2&&g.round>=0,'Invalid leg.');return true;
}
