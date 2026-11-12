import {valueChoices as previousChoices} from './value-choices.js';
import {createGame,command as legacyCommand,currentPlayer,random,shuffle,resolveCard,resolveCardBase,observation as legacyObservation,holdings} from './engine.js';
import {resolveRevealPhase,resumeRace,resumePhase} from './racing.js';
import {grantGrowth,pendingFor,nextGrowthPlayer,consumeGrowth,dealFlowScore} from './deal-flow.js';
import {shareLeader} from './ownership.js';
import {ACTIVE_FOUNDERS,FOUNDERS as BASE_FOUNDERS} from './config.js';
import {INTEL_CARDS as BASE_INTEL_CARDS,intelDeck} from './intel.js';
import {LIVE_DICE_VERSION,DEAL_COPIES,LEG_ENDS,secretBonusDeck,secretBonusPerShare,investorSharePrice,diceCompanyValue,diceSharePrice,exitPrice,shareExitPrice,rollDie,validateDice} from './live-dice-rules.js';

const versions={155:'155-five-card-flow',156:'156-fundraise-first',157:LIVE_DICE_VERSION};
const check=(ok,message)=>{if(!ok)throw Error(message);};
const event=(g,e)=>g.log.push({round:g.round,leg:g.leg,turn:g.turnNumber,...structuredClone(e)});
const turn=(g,phase,id=g.first)=>{g.phase=phase;g.active=id;g.queue=[id];};
export const DICE_FOUNDERS=[...ACTIVE_FOUNDERS];
export const DICE_VALUES=Object.keys(BASE_INTEL_CARDS);

const INTEL_CARDS={...BASE_INTEL_CARDS,sweat:{...BASE_INTEL_CARDS.sweat,text:'Move a portfolio company back 2 spaces and add 1 of your shares to it. No dice.'},...Object.fromEntries(['rights','public','tender'].map(k=>[k,{...BASE_INTEL_CARDS[k],text:({rights:'Spend matching deal-flow. Offer 1 new portfolio share at $1+ you can pay. Clockwise, first acceptance buys; if all pass, you buy.',public:'Spend matching deal-flow. Auction 1 new portfolio share from $1. Raise $1+; passing is final. Highest bidder pays.',tender:'Spend matching deal-flow. Auction 1 new portfolio share. Everyone bids secretly once; highest bidder pays their offer. Normal ties.'})[k]}]))};
Object.assign(INTEL_CARDS,Object.fromEntries(Object.entries({
 coup:'Discard a public deal-flow card of a portfolio company. Become its lead investor until its next ownership change.',
 inside:'Swap a spent deal-flow card with a card in the public row. Both must be portfolio companies.',
 launch:'Roll one mild die for a portfolio company with a card in the public row.',
 smear:'Roll 2 mild dice for a portfolio company, then fumble it.',
 advisor:'Return one spent deal-flow card of a portfolio company to the top of the deck, then move that company forward 1 space.',
 clearance:'Discard a portfolio company’s card from the public row and draw a new one. Gain $3.',
 weekend:'Take 2 support actions after playing this card. At most once per turn.',
 underwritten:'Return 1 share you own in a portfolio company. Gain $6 / $12 / $16 in leg 1 / 2 / 3.',
 matching:'Pay $3 to roll one bland die for a portfolio company. No new share.',
 dividend:'Move a portfolio company back 2 spaces. Its shareholders gain $3 per share.',
 focused:'Choose 2 portfolio companies. Move one back 1 space, then the other forward 1 space.',
 financing:'Increase your called capital by $20. Move a portfolio company 2 spaces, then roll one mild die. Gain no cash.',
 fresh:'Replace all 4 public founders. Draw 2 value cards instead of your normal replacement.',
 consolidation:'Return 2 shares you own, from one or two portfolio companies. Reduce your called capital by $20.',
 restructure:'Move a portfolio company back 3 spaces. Reduce your called capital by $20.',
 rights:'Offer 1 new portfolio share at $1+ you can pay. First clockwise acceptance buys; if all pass, you buy. No dice.',
 public:'Discard a portfolio company’s card from the public deal-flow row. Draw 2 new deal-flow cards into the row.',
 tender:'Auction 1 new portfolio share. Everyone bids secretly once; highest bidder pays their offer. No dice.'
}).map(([kind,text])=>[kind,{...BASE_INTEL_CARDS[kind],text}])));
INTEL_CARDS.advice={...INTEL_CARDS.advice,name:'Wasteful Advice'};
INTEL_CARDS.restructure={...INTEL_CARDS.restructure,name:'Illicit Capital'};
const founderOverrides={24:'When a company sharing my space moves, I move with it.',4:'At game end, if I finish second to last, my company may exit for $16 per share.',8:'When I move forward, I move 1 extra space unless I am leading.',10:'Once per reveal, when another company lands on my space, that company fumbles and I move 1 space.',9:'Once per reveal, when another company fumbles, I may recover it and roll one bland die for my company.',14:'Before the reveal, I roll one mild die.',16:'Once per reveal, I may pay $1 to redirect a revealed die to my company.',21:'Once per reveal, return a spent deal-flow card to the top of the deck, then move that company back 2.'};
const founderCopy=text=>text.replace(/numbered growth (?:token|card) is revealed/gi,'dice reveal has numbers').replace(/growth (?:token|card) is revealed/gi,'dice are revealed');
const roundTiming=text=>text.replace(/before the reveal/gi,'At the end of the round').replace(/once per reveal/gi,'Once per round').replace(/after the reveal/gi,'At the end of the round');
const FOUNDERS=BASE_FOUNDERS.map(f=>{if(founderOverrides[BASE_FOUNDERS.indexOf(f)])return {...f,trigger:'',action:roundTiming(founderOverrides[BASE_FOUNDERS.indexOf(f)]),text:roundTiming(founderOverrides[BASE_FOUNDERS.indexOf(f)])};const trigger=roundTiming(founderCopy(f.trigger)),action=roundTiming(founderCopy(f.action));if(f.id===11||BASE_FOUNDERS.indexOf(f)===11)return {...f,trigger,action:action.replace('2','1'),text:`${trigger}: ${action.replace('2','1')}`};return {...f,trigger,action,text:`${trigger}: ${action}`};});

function resetWindow(g){
 g.revealMovement=Array(g.companies.length).fill(0);g.revealMoved=Array(g.companies.length).fill(false);g.intelMovementStarted=false;
}
function dealRow(g){
 g.dealRow=[];
 for(let i=0;i<(g.rowSize??g.companies.length-1)&&g.dealDeck.length;i++){
  const available=c=>!g.dealRow.some(d=>d.company===c.company);
  const index=!g.distinctRow?g.dealDeck.length-1:g.diceRevision>=156?g.dealDeck.findLastIndex(available):g.dealDeck.findIndex(available);
  if(index<0)break;g.dealRow.push(g.dealDeck.splice(index,1)[0]);
 }
 event(g,{type:'dealFlowRow',cards:g.dealRow,remaining:g.dealDeck.length});
}
function bankRemainder(g){
 for(const card of g.dealRow.splice(0)){
  g.dealSpent.push(card);const entry=grantGrowth(g,g.first,card.company,'bank');
  entry.remaining=g.bankDice+(card.bonusDice??0);entry.dice=Array(entry.remaining).fill('bland');entry.bank=true;
  event(g,{type:'bankFunding',company:card.company,card,dice:entry.dice});
 }
}

function settle(g,reason='finish'){
 g.endReason=reason;
 g.companyValues=g.companies.map(c=>diceCompanyValue(g,c));g.prices=g.companies.map(c=>diceSharePrice(g,c));
 g.accounts=g.players.map(p=>({player:p.id,cash:p.cash,secretBonus:p.secretBonus,companies:g.companies.map(c=>({company:c.id,shares:holdings(c,p.id),basePrice:g.prices[c.id],bonus:secretBonusPerShare(g,p.id,c.id),price:investorSharePrice(g,c,p.id),payout:holdings(c,p.id)*investorSharePrice(g,c,p.id)})),payout:g.companies.reduce((n,c)=>n+holdings(c,p.id)*investorSharePrice(g,c,p.id),0),capitalCalled:p.capitalCalled}));
 g.scores=g.accounts.map(a=>dealFlowScore(a.cash,a.payout,a.capitalCalled));g.winners=g.players.filter(p=>g.scores[p.id]===Math.max(...g.scores)).map(p=>p.id);
 g.ended=true;g.phase='finished';g.queue=[];event(g,{type:'settlement',accounts:g.accounts,scores:g.scores});
}
function startReveal(g){
 g.flowStage='roundStart';resetWindow(g);
 event(g,{type:'roundRevealStart',pending:g.pendingGrowth.filter(e=>!e.resolved).map(e=>({company:e.company,player:e.player,dice:e.dice}))});
 resolveRevealPhase(g,'start',true);afterEffects(g);
}
function queueRoll(g,entry,stage){
 g.windowEntry=entry.id;g.rollActor=entry.player;g.flowStage=stage;
 turn(g,'flowRoll',entry.player);
}
function nextReveal(g){
 const entry=g.pendingGrowth.find(e=>!e.resolved);
 if(entry){queueRoll(g,entry,'roundDice');return;}
 if(g.diceRevision>=157&&g.flowStage!=='roundStart'){
  delete g.windowEntry;g.flowStage='roundStart';
  event(g,{type:'roundFounderStart'});
  resolveRevealPhase(g,'start',true);afterEffects(g);return;
 }
 delete g.windowEntry;g.flowStage='roundEnd';resolveRevealPhase(g,'end',true);afterEffects(g);
}
function afterEffects(g){
 if(g.race)return;
 if(g.flowStage==='roundStart')nextReveal(g);
 else if(g.flowStage==='roundEnd'){g.flowStage='roundCatchUp';resolveRevealPhase(g,'catchUp',true);afterEffects(g);}
 else if(g.flowStage==='roundCatchUp')finishRound(g);
 else if(['roundDice','auctionDice','setup'].includes(g.flowStage)){
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
 if(g.flowStage==='auctionDice'){
  const entry=g.pendingGrowth.find(e=>e.id===g.windowEntry);
  if(!entry.resolved){queueRoll(g,entry,'auctionDice');return;}
  delete g.windowEntry;g.flowStage='action';advanceAction(g);return;
 }
 nextReveal(g);
}
function advanceAction(g){
 const pending=g.pendingGrowth.find(e=>!e.resolved&&!e.dice);
 if(pending){turn(g,'chooseDice',pending.player);return;}
 if(g.turnPart==='support'&&g.extraSupport>0){g.extraSupport--;turn(g,'flowAction',g.flowActor);return;}
 if(g.diceRevision>=156&&g.turnPart==='funding'){
  g.turnPart='support';turn(g,'flowAction',g.flowActor);return;
 }
 if(g.diceRevision<156&&g.turnPart==='support'&&g.dealRow.length){g.turnPart='funding';turn(g,'pickFlow',g.flowActor);return;}
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
 if(g.roundLimit!==null&&g.round>=(g.roundLimit??7)){settle(g,'roundLimit');return;}
 if(g.endOnDeckExhaustion!==false&&!g.dealDeck.length&&!g.dealRow.length){settle(g,'deckExhausted');return;}
 if(g.leg<2&&g.companies.filter(c=>c.position>=LEG_ENDS[g.leg]).length>=3){endLeg(g);return;}
 newRound(g);
}
function newRound(g){
 g.round++;g.cycle=g.round;g.metrics.cycles=g.round;g.first=(g.first+1)%g.players.length;g.flowActor=(g.first+g.players.length-1)%g.players.length;resetRound(g);dealRow(g);
 event(g,{type:'roundStart',leg:g.leg,target:LEG_ENDS[g.leg],positions:g.companies.map(c=>c.position)});nextTurn(g);
}
function nextTurn(g){
 delete g.auction;delete g.valueResult;delete g.intelOrder;
 if(g.roundActed.length===g.players.length){bankRemainder(g);if(g.diceRevision>=157)nextReveal(g);else startReveal(g);return;}
 g.extraSupport=0;g.weekendUsed=false;g.flowStage='action';const fundingFirst=g.diceRevision>=156&&g.dealRow.length;
 g.turnPart=fundingFirst?'funding':'support';turn(g,fundingFirst?'pickFlow':'flowAction',(g.flowActor+1)%g.players.length);
}

function apply(g,id,cmd){
 check(!g.ended&&!g.stalled&&currentPlayer(g)===id,'Another investor must decide.');check(cmd&&typeof cmd.type==='string','Choose a command.');
 if(g.phase==='chooseDice'){
  check(cmd.type==='chooseDice','Choose the dice for this share.');const entry=g.pendingGrowth.find(e=>!e.resolved&&!e.dice);
  entry.dice=validateDice(cmd.dice,2);if(entry.bonusDice)entry.dice.push(...Array(entry.bonusDice).fill('bland'));event(g,{type:'diceChoice',player:id,company:entry.company,dice:entry.dice});if(g.diceRevision>=157)queueRoll(g,entry,'auctionDice');else advanceAction(g);return;
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
 while(next.intelDiscard.length)next.intelDeck.push(next.intelDiscard.shift());
 for(const e of next.log.slice(logStart))e.round??=roundBefore;
 assertDiceGame(next);for(const key of Object.keys(g))delete g[key];Object.assign(g,next);return g;
}
export function diceObservation(g,id){
 const view=legacyObservation(g,id);
 view.publicValueDiscard=structuredClone(g.intelDiscard);view.dealDeckCount=g.dealDeck.length;delete view.dealDeck;delete view.intelDeck;
 for(const p of view.players){p.dealFlowCount=p.dealFlow.length;if(p.id!==id){delete p.dealFlow;if(!g.ended){delete p.cash;delete p.capital;delete p.capitalCalled;delete p.secretBonus;}}}
 if(!g.ended){delete view.bank;view.log=[];}return view;
}
export function replayDiceGame(data){
 const revision=Number(Object.keys(versions).find(key=>versions[key]===data.version));
 check(Number.isInteger(revision),'Load this replay in its original dice version.');
 const g=createDiceGame({...data.setup,revision});
 for(const {id,cmd} of data.commands)diceCommand(g,id,cmd);
 return g;
}
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
 if(card)g.fundingCard=card;
 p.actionsTaken++;g.metrics.actions++;g.flowActor=id;g.flowStage='action';
 event(g,{type:'action',player:id,command:cmd,card,positions:g.companies.map(c=>c.position),founders:g.companies.map(c=>c.founder),values:p.intel.map(c=>c.kind),market:g.founderMarket});
 if(cmd.type==='passAction'){advanceAction(g);return;}
 if(cmd.type==='raiseMoney'){p.cash+=20;p.capital++;p.capitalCalled+=20;g.bank.issued+=20;advanceAction(g);return;}
 turn(g,'call',id);g.actionsLeft=2;g.turnHires=[];
 if(cmd.type==='valueAction'){g.intelOrder=[id];g.intelTiming='turn';delete g.valueResult;turn(g,'intelPlay',id);}
 else legacyCommand(g,id,cmd);
}

function drawValue(g){check(g.intelDeck.length,'Value deck is empty.');return g.intelDeck.shift();}
function refreshMarkets(g){
 const oldFounders=g.founderMarket;
 g.founderSupply=shuffle(g,g.founderSupply);g.founderMarket=g.founderSupply.splice(0,4);g.founderSupply.push(...oldFounders);
 event(g,{type:'marketsRefreshed',founders:g.founderMarket,values:[]});
}
function prepareLeg(g){
 const previousLeg=g.leg;
 do{g.leg++;}while(g.leg<2&&g.companies.filter(c=>c.position>=LEG_ENDS[g.leg]).length>=3);
 delete g.roundResult;refreshMarkets(g);newRound(g);
}

function playLegacy(g,id,cmd){
 if(cmd.type==='playIntel'){
  check(valueChoices(g,id).some(c=>Object.keys(c).every(k=>k==='price'||c[k]===cmd[k])),'Choose a held value card and legal targets.');
  const kind=g.players[id].intel[cmd.card].kind;legacyCommand(g,id,cmd);
  // The top is index zero: return played cards to the bottom, then draw once.
  g.intelDeck.push(...g.intelDiscard.splice(0));
  g.players[id].intel.push(drawValue(g));if(kind==='fresh'&&g.intelDeck.length)g.players[id].intel.push(drawValue(g));
  g.metrics.intelDraws=(g.metrics.intelDraws??0)+1;
 }else legacyCommand(g,id,cmd);
}
export function valueChoices(g,id){return previousChoices(g,id);}
export function createDiceGame({seed=42,players=4,dealCopies=DEAL_COPIES,bankDice=2,distinctRow=false,payoutMode='perShare',perShareMax=20,exitCurve='early5',initialCapital=20,secretBonuses=true,revision=157,daniloStep=revision===155,rowSize=5,roundLimit=null,endOnDeckExhaustion=true}={}){
 check(Number.isInteger(dealCopies)&&dealCopies>=1&&dealCopies<=100,'Choose 1–100 cards per company.');
 check(['dilution','perShare'].includes(payoutMode),'Choose dilution or per-share payouts.');
 check(Object.hasOwn(versions,revision),'Unknown Dice rules revision.');
 const g=createGame({seed,players,variant:'dice'});g.payoutMode=payoutMode;check([20,21,24].includes(perShareMax),'Choose a $20, $21 or $24 last-space payout.');g.perShareMax=exitCurve==='early5'?20:exitCurve==='early4'?21:perShareMax;
 check(['late','early4','early5'].includes(exitCurve),'Unknown exit curve.');check([0,20].includes(initialCapital),'Initial capital must be $0 or $20.');g.exitCurve=exitCurve;g.initialCapital=initialCapital;g.secretBonuses=!!secretBonuses;g.daniloStep=!!daniloStep;
 check(rowSize===null||Number.isInteger(rowSize)&&rowSize>=players&&rowSize<=12,'Invalid public row size.');check(roundLimit===null||Number.isInteger(roundLimit)&&roundLimit>0,'Invalid round limit.');g.rowSize=rowSize??players+1;g.roundLimit=roundLimit;g.endOnDeckExhaustion=!!endOnDeckExhaustion;
 g.companies=g.companies.slice(0,players+2);
 g.legStartPositions=g.companies.map(c=>c.position);
 g.variant='dice';g.round=0;g.cycle=0;g.rules.shareLimit=Number.MAX_SAFE_INTEGER;g.payoutStep=2;g.dicePerShare=2;
 g.log=[];g.pile=[];g.removed=[];g.pendingGrowth=[];g.centre=[];g.finishOrder=[];g.growthSerial=0;
 g.metrics.rolls=0;g.metrics.baseMovement=0;g.metrics.actions=0;g.metrics.cycles=0;
 for(const c of g.companies){c.position=1;c.supply=[];c.history=[];c.tokens=[];c.lastBuy=Array(players).fill(0);c.latestInvestor=true;}
 for(const p of g.players){p.dealFlow=[];p.actionsTaken=0;p.capital=initialCapital/20;p.capitalCalled=initialCapital;}
 turn(g,'flowRoll');
 check([1,2].includes(bankDice),'Bank rolls one or two dice.');g.bankDice=bankDice;g.distinctRow=!!distinctRow;g.publicFlow=true;g.dealRow=[];g.dealCopies=dealCopies;g.dealDeck=[];g.dealSpent=[];
 g.rules.catchUp=true;g.liveDice=true;g.roundDice=false;g.sharedReveal=true;g.roundFunded=[];g.roundActed=[];g.turnNumber=0;g.publicValues=false;g.diceRevision=revision;g.version=versions[revision];g.flowStage='setup';g.leg=0;g.crossedLegs=[];g.dealSerial=0;g.actionsPerRound=null;
 const founders=shuffle(g,[...DICE_FOUNDERS]);for(const c of g.companies)c.founder=founders.shift();
 g.founderMarket=founders.splice(0,4);g.founderSupply=founders;
 g.intelDeck=shuffle(g,intelDeck().filter((c,i,a)=>DICE_VALUES.includes(c.kind)&&a.findIndex(x=>x.kind===c.kind)===i));g.intelDiscard=[];g.valueDeckSize=g.intelDeck.length;g.valueMarket=[];
 // Opening shares consume actual deal-flow cards, one per player from the active companies.
 g.dealDeck=Array.from({length:g.companies.length*dealCopies},(_,i)=>({id:`d${i+1}`,company:i%g.companies.length}));
 const opening=shuffle(g,g.dealDeck.splice(0,g.companies.length));
 g.pendingGrowth=[];g.growthSerial=0;g.log=[];
 for(const c of g.companies){c.tokens=[];c.lastBuy=Array(players).fill(0);}
 for(let offset=0;offset<players;offset++){
  const id=(g.first+offset)%players,card=opening.pop(),c=g.companies[card.company];
  g.dealSpent.push(card);c.tokens.push({id:1,owner:id,paid:0,boughtLeg:0});c.lastBuy[id]=++g.serial;
  grantGrowth(g,id,c.id,'setup');g.metrics.issued++;
 }
 g.dealDeck=shuffle(g,[...g.dealDeck,...opening]);g.dealInitialized=true;
 event(g,{type:'setup',seed,players,portfolios:g.companies.map(c=>c.tokens.map(t=>t.owner)),spent:g.dealSpent});
 for(const p of g.players)p.intel=Array.from({length:3},()=>drawValue(g));
 // Separate seeded shuffle preserves the race/deal RNG in paired studies.
 if(secretBonuses){const cards=secretBonusDeck(g.companies.length);let secretSeed=(seed^0x51ec7e7)>>>0;
  // Avalanche nearby game seeds before shuffling this small, independent deck.
  secretSeed=Math.imul(secretSeed^(secretSeed>>>16),0x21f0aaad);
  secretSeed=Math.imul(secretSeed^(secretSeed>>>15),0x735a2d97);
  secretSeed=(secretSeed^(secretSeed>>>15))>>>0;
  for(let i=cards.length-1;i>0;i--){secretSeed=(Math.imul(secretSeed,1664525)+1013904223)>>>0;const j=Math.floor(secretSeed/4294967296*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}for(const p of g.players)p.secretBonus=cards.pop();}

 event(g,{type:'marketsRefreshed',founders:g.founderMarket,values:g.valueMarket.map(c=>c.kind)});
 assertDiceGame(g);return g;
}
export function assertDiceGame(g){
 check(g.companies.length===(g.diceRevision>=148?g.players.length+2:6)&&g.players.length>=2&&g.players.length<=4,'Invalid table.');
 if(g.secretBonuses){const cards=g.players.map(p=>p.secretBonus);check(cards.every(c=>c&&c.plus5===c.id&&c.plus3===(c.id+1)%g.companies.length&&c.id>=0&&c.id<g.companies.length)&&new Set(cards.map(c=>c.id)).size===cards.length,'Invalid secret investments.');}
 check(g.players.every(p=>Number.isInteger(p.cash)&&p.cash>=0&&p.capitalCalled===p.capital*20),'Invalid cash/capital.');
 check(g.players.reduce((n,p)=>n+p.cash,0)===g.bank.issued-g.bank.burn,'Cash conservation failed.');
 check(g.companies.every(c=>c.position>=(g.diceRevision>=156?1:0)&&c.position<=24&&c.tokens.every(t=>g.players[t.owner])),'Invalid company.');
 const founders=[...g.companies.map(c=>c.founder),...g.founderMarket,...g.founderSupply];
 check(g.founderMarket.length===4&&founders.length===DICE_FOUNDERS.length&&new Set(founders).size===founders.length&&founders.every(f=>DICE_FOUNDERS.includes(f)),'Founder conservation failed.');
 const values=[...g.intelDeck,...g.intelDiscard,...g.valueMarket,...g.players.flatMap(p=>p.intel)];
 check(new Set(values.map(c=>c.kind)).size===values.length,'Duplicate value card.');
 check(g.valueMarket.length===0&&values.length===DICE_VALUES.length&&new Set(values.map(c=>c.id)).size===values.length,'Value-card conservation failed.');
 check(values.every(c=>DICE_VALUES.includes(c.kind)),'Invalid value-card type.');
 check(g.players.every(p=>p.dealFlow.length===0),'Public deal flow has no private hands.');
 const deals=[...g.dealDeck,...g.dealRow,...g.dealSpent,...g.players.flatMap(p=>p.dealFlow)];
 if(g.dealInitialized)check(deals.length===g.dealCopies*g.companies.length&&Array.from({length:g.companies.length},(_,cid)=>deals.filter(c=>c.company===cid).length).every(n=>n===g.dealCopies),'Deal-flow conservation failed.');check(new Set(deals.map(c=>c.id)).size===deals.length,'Duplicate deal-flow card.');
 check(g.pendingGrowth.every(e=>g.players[e.player]&&g.companies[e.company]&&e.remaining>=0&&e.remaining<1000&&e.resolved===(e.remaining===0)),'Invalid growth ledger.');
 check(new Set(g.roundActed).size===g.roundActed.length&&g.roundActed.every(id=>g.players[id]),'Invalid round turns.');
 check(g.leg>=0&&g.leg<=2&&g.round>=0,'Invalid leg.');return true;
}
