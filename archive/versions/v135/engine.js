import {grantGrowth} from './deal-flow.js';
import {CAPITAL_CASH} from './config.js';
import {NEW_CARDS,FUNDRAISE_CARDS,TWO_COMPANY_CARDS,expansionChoices} from './card-expansion.js';
import {blockedDestination,recordArrivals} from './movement.js';
import {shareCount,shareLeader} from './ownership.js';
import {INTEL_MODES,MAX_VALUE_HAND,canDrawIntel,canExchangeIntel,intelDeck,intelTargets,intelSecondTargets,playableIntel,invested,intelLead} from './intel.js';
import {canHireFounder,ACTIVE_FOUNDERS,capitalPenalty} from './config.js';
import {canExit,dilution} from './config.js';
import { REVEALS_PER_ROUND } from "./config.js";
import {checkpointReached, podium, ipoFinisher} from './config.js';
import { recordFounderMovement, sharePurchaseActions, resolveSharePurchase, shareholderReactions, resolveIntelActions, beginRace, resumeRace,resumePhase, resolveRevealPhase, markIPO } from "./racing.js";
import {
  VERSION, currencyUnit,sharePayout, minimumBid, availableCash, fundingPrices, slotCards, reserveCards,
  FOUNDERS,
  RULES,
  growthDeck,
  fixedLP,
  fundedCards, fundingBand,
  companyValue,
  settlementValue,
} from "./config.js";
import {clone} from './clone.js';
export {clone};
const check = (ok, message) => {
  if (!ok) throw Error(message);
};
const integer = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
const money=(x,a,b,rules)=>Number.isFinite(x)&&x>=a&&x<=b&&Number.isInteger(x/currencyUnit(rules));
export function random(g) {
  let t = (g.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  g.rng >>>= 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function shuffle(g, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const holdings = shareCount;
export const outstanding = (c) => c.tokens.length;
export const bankHeld = (c) => c.tokens.filter((t) => t.owner === null).length;
export const quote = (c, rules = RULES, companies = [c]) =>
  c.tokens.length ? sharePayout(settlementValue(c, companies, rules), dilution(c),rules) : 0;
export const lead = shareLeader;
const order = (g, first = g.first) =>
  g.players.map((_, i) => (first + i) % g.players.length);
const emit = (g, e) => {
  if (!g.fast) g.log.push({ leg: g.leg, cycle: g.cycle, ...clone(e) });
};
export const currentPlayer = (g) =>
  g.ended ? null : g.queue.length ? g.queue[0] : g.active;
export function createGame({ seed = 42, players = 4, rules = {}, variant = 'classic' } = {}) {
  check(
    integer(seed, 0, 0xffffffff) && integer(players, 2, 4),
    "Choose 2 to 4 investors and a whole seed.",
  );
  check(
    Object.keys(rules).every((k) => ["exitMultiplier", "currencyUnit", "bridgeCost", "secondaryCost", "conflictPayout", "sellPayouts", "intelMode", "burnPerRound", "moneyScale", "muraMinimum", "wangExit", "catchUp", "purchaseStep", "exitScale", "defaultFee", "purchaseBase", "exitLinear", "exitCurve", "ipoValue", "growthDivisor", "checkpointCount", "costAcceleration", "payoutPlaces", "startingCash", "obligation", "projectPrices", "hedgeFund", "revealsPerRound"].includes(k)),
    "Unknown experimental rule.",
  );
  const r = clone({ ...RULES, payoutPlaces:Math.floor((players+2)/2), ...rules });
  check(r.currencyUnit===1,'Invalid currency unit.');
  check(integer(r.secondaryCost,0,100)&&integer(r.bridgeCost,0,100)&&integer(r.conflictPayout,0,100)&&Array.isArray(r.sellPayouts)&&r.sellPayouts.length===3&&r.sellPayouts.every(n=>integer(n,0,100)),'Invalid value-card cash settings.');
  check(Object.hasOwn(INTEL_MODES,r.intelMode), "Invalid intel mode.");
  check(integer(r.burnPerRound,0,10), "Invalid round burn count.");
  check(typeof r.catchUp === "boolean" && integer(r.moneyScale,1,10) && integer(r.muraMinimum,1,1000) && integer(r.wangExit,1,10000), "Invalid catch-up or money scale.");
  check(integer(r.revealsPerRound,1,10), "Invalid reveal count.");
  check(typeof r.hedgeFund === "boolean", "Invalid hedge fund setting.");
  check(integer(r.purchaseBase, 0, 100) && integer(r.purchaseStep, 1, 100) && integer(r.exitScale, 1, 20) && integer(r.defaultFee, 0, 1000), "Invalid economy settings.");
  check(["linear","quadratic"].includes(r.exitCurve),"Invalid exit curve.");
  check(integer(r.exitMultiplier??1,1,10)&&integer(r.startingCash,1,10000)&&integer(r.obligation,0,10000)&&integer(r.payoutPlaces,1,players+2)&&integer(r.costAcceleration,0,20)&&Number.isFinite(r.exitLinear)&&r.exitLinear>=0&&r.exitLinear<=100&&integer(r.ipoValue,1,10000)&&integer(r.growthDivisor,0,100)&&integer(r.checkpointCount,1,players+2),"Invalid race settings.");
  check(Array.isArray(r.projectPrices)&&r.projectPrices.length===3&&r.projectPrices.every(row=>Array.isArray(row)&&row.length===3&&row.every((x,i)=>money(x,currencyUnit(r),1000,r)&&(!i||x>row[i-1]))),"Invalid funding prices.");
  const g = {
    version: VERSION,
    valueDeckSize:intelDeck().length,
    seed,
    rng: seed,
    rules: r,
    players: [],
    companies: [],
    leg: 0,
    cycle: 1,
    first: 0,
    serial: 0,
    phase: "call",
    queue: [],
    active: 0,
    ended: false,
    founderSupply: [],
    founderMarket: [],
    pile: [],
    removed: [],
    destroyed: [],
    returningCards: [],
    lastRevealed: null,
    log: [],
    auctionHistory: [],
    settlements: [],
    bank: { issued: 0, payout: 0, burn: 0, repaid: 0 },
    metrics: {
      cycles: 0,
      auctions: 0,
      issued: 0,
      unsold: 0,
      contested: 0,
      soleBidder: 0,
      ties: 0,
      purchased: 0,
      revealed: 0,
      downRounds: 0,
      bankDilution: 0,
      setbacks: 0,
      wasted: 0,
      entered:0,
      wastedPaid:0,
      revealedPaid:0,
      payments: [],
      investments: [],
      defaults: 0,
      fees: 0,
      sold: 0,
      retained: 0,
      founderSwaps: 0,
      growthMovement: 0,
      founderBonus: 0,
      fumbles: 0,
      fallbacks: 0,
      legCycles: [],
      auctionCards: [],
    },
  };
  for (let id = 0; id < players; id++)
    g.players.push({
      id,
      cash: 0,
      capital: 0,
      locked: 0,
      savedCash: 0,
      debt: 0,
      fees: 0,
      lp: null,
      obligation: 0,
      lpObligations: 0,
      intel: [],
    });
  const founders = shuffle(
    g,
    [...ACTIVE_FOUNDERS],
  );
  for (let id = 0; id < (variant === 'dice' ? 6 : players + 2); id++)
    g.companies.push({
      id,
      position: 1,
      purchased: 0,
      tokens: [],
      lastBuy: Array(players).fill(0),
      supply: shuffle(g, growthDeck(id)),
      founder: founders.shift(),
      flags: {},
      revealedCycle: 0,
      history: [],
      openingCard: null,
      down: false,
    });
  g.arrivalSerial=g.companies.length;
  shuffle(g,[...g.companies]).forEach((c,i)=>{c.arrivalOrder=i+1;});
  for (const c of g.companies) { g.pile.push(...c.supply.splice(0,1)); g.metrics.entered+=1; }
  shuffle(g,g.pile);
  g.founderMarket = founders.splice(0, 3);
  g.founderSupply = founders;
  g.first = Math.floor(random(g) * players);
  g.active = g.first;
  if(r.intelMode!=="off"){g.intelDeck=shuffle(g,intelDeck(r.intelMode));g.intelDiscard=[];g.valueUsed=[];for(const p of g.players)p.intel=g.intelDeck.splice(0,3);}
  beginLeg(g);
  assertGame(g);
  return g;
}
function beginLeg(g) {
  g.legStartPositions = g.companies.map(c => c.position);
  g.cycle = 1;
  for (const p of g.players) {
    p.lp = fixedLP(g.players.length,g.leg,g.rules);
    p.cash += p.lp.cash;
    p.obligation += p.lp.repayment;
    p.lpObligations += Number(p.lp.repayment>0);
    g.bank.issued += p.lp.cash;
  }
  startCycle(g);
}
export function eligibleCompanies(g,id) {
  if(g.variant==='dice')return g.companies.map(c=>c.id);
  return g.companies.filter(c => (lead(c) === null || lead(c) === id) && c.tokens.length < g.rules.shareLimit && (c.supplyCount ?? c.supply?.length)).map(c=>c.id);
}
function startCycle(g) {
  for (const c of g.companies) {c.flags={};c.revealedCycle=0;c.boughtCycle=0;}
  g.lastRevealed=null;g.founderUsed=[];g.revealMovement=g.companies.map(()=>0);g.revealMoved=g.companies.map(()=>false);g.intelMovementStarted=true;delete g.intelOrder;delete g.afterIntelDone;delete g.catchUpDone;delete g.catchUpResult;
  g.purchaseSummary=[];g.harryUsed=[];delete g.poolSize;g.drawsLeft=0;
  g.valueUsed=[];
  g.called=[];g.callOrder=order(g);g.callIndex=0;
  g.metrics.cycles++;emit(g,{type:"cycle"});nextAuction(g);
}
function nextAuction(g) {
  delete g.auction;
  while(g.callIndex < g.callOrder.length) {
    const id=g.callOrder[g.callIndex++];
    g.actionsLeft=2;g.weekendUsed=false;g.turnHires=[];g.turnPlayer=id;g.phase='call';g.queue=[id];g.active=id;return;
  }
  buyGrowth(g);
}
function resolveBids(g) {
  const a = g.auction,
    positive = a.bids
      .filter((b) => b.amount >= a.reserve)
      .sort((x, y) => y.amount - x.amount);
  a.positive = positive.length;
  g.metrics.contested += Number(positive.length >= 2);
  g.metrics.soleBidder += Number(positive.length === 1);
  if (!positive.length) {
    finishAuction(g, null, 0);
    return;
  }
  const top = positive.filter((b) => b.amount === positive[0].amount);
  if (top.length === 1) {
    finishAuction(g, top[0].player, a.mode==='tender'||positive.length===1 ? positive[0].amount : Math.max(a.reserve, positive[1].amount));
    return;
  }
  g.metrics.ties++;
  if (top.some((b) => b.player === a.host)) {
    finishAuction(g, a.host, top[0].amount);
    return;
  }
  a.contenders = order(g, (a.host + 1) % g.players.length).filter((id) =>
    top.some((b) => b.player === id),
  );
  a.price = top[0].amount;
  a.open = [];
  g.queue = [...a.contenders];
  g.phase = "tie";
}
function finishAuction(g, winner, paid) {
  const a = g.auction,
    c = g.companies[a.company];
  a.winner = winner;
  a.paid = paid;
  g.auctionHistory.push({company:a.company,host:a.host,bids:clone(a.bids),winner,paid,cash:g.players.map(p=>p.cash),context:{mode:a.mode,poolWeights:g.companies.map(c=>g.pile.filter(t=>t.company===c.id).length),positions:g.companies.map(c=>c.position),founders:g.companies.map(c=>c.founder),owners:g.companies.map(c=>c.tokens.map(t=>t.owner)),down:g.companies.map(c=>!!(c.down||c.hiringFumble))}});
  if (winner === null) g.metrics.unsold++;
  else {
    const p = g.players[winner];
    p.cash -= paid;
    g.bank.burn += paid;
    a.cards = g.variant==='dice' ? 1 : deployInvestment(g,c,paid);
    const previousLead=lead(c),wasShareholder=holdings(c,winner)>0;delete c.mandate;
    c.tokens.push({ id: c.tokens.length + 1, owner: winner, paid, boughtLeg:g.leg });
    c.lastBuy[winner] = ++g.serial;
    if(g.variant==='dice')grantGrowth(g,winner,c.id);
    g.metrics.issued++;
    g.metrics.payments.push(paid);
    a.bonusCards=0;
    a.reactions=resolveSharePurchase(g,c.id,winner,{auction:true,existing:wasShareholder,previousLead})?.reactions??[];
    if(a.mode==='underwritten'&&winner!==a.host){const extra=c.supply.splice(0,2);g.pile.push(...extra);shuffle(g,g.pile);g.metrics.entered+=extra.length;a.bonusCards=extra.length;}

  }
  g.queue = [];
  g.active = a.host;
  g.phase = "auctionResult";
  emit(g, { type: "auction", ...a });
}
export function deployInvestment(g,c,payment) {
  const cards=c.supply.splice(0,fundedCards(fundingBand(c.position),payment,g.rules)).map(card=>({...card,paid:true,fundingCount:(card.fundingCount??Number(!!card.paid))+1}));
  c.purchased+=cards.length;c.boughtCycle=(c.boughtCycle??0)+cards.length;
  g.pile.push(...cards);shuffle(g,g.pile);
  g.metrics.purchased+=cards.length;g.metrics.entered+=cards.length;
  g.purchaseSummary??=[];g.purchaseSummary.push({company:c.id,count:cards.length,spent:payment});
  emit(g,{type:'deploy',company:c.id,count:cards.length});return cards.length;
}
// Retained for historical callers; funding now deploys immediately.
export function deployReserves(g) {}
function buyGrowth(g) {
  g.revealStartPositions=g.companies.map(c=>c.position);
  g.revealStartArrivalOrders=g.companies.map(c=>c.arrivalOrder);
  deployReserves(g);
  shuffle(g,g.pile);g.drawsLeft=Math.min(g.rules.revealsPerRound,g.pile.length);g.poolSize=g.pile.length;
  g.revealEnded=false;
  g.queue=[];g.active=g.first;g.phase="purchaseResult";
  g.metrics.auctionCards.push({leg:g.leg,cycle:g.cycle,companies:clone(g.purchaseSummary)});
  emit(g,{type:"purchases",companies:g.purchaseSummary,poolSize:g.poolSize,draws:g.drawsLeft});
}
export function resolveCardBase(g, card) {
  const physical=g.race?.card?.kind==='growth'?g.race.card:card.kind==='deferred'?card.original:card;
  const owner=g.companies[physical.company];
  if(card.kind==='deferred'){
    const c=g.companies[card.company],original=card.original,before=c.position;
    owner.history.push(g.forecast?original:clone(original));g.removed.push({...original,discarded:true});
    g.metrics.wasted++;g.metrics.wastedPaid+=Number(!!original.paid);g.metrics.deferred=(g.metrics.deferred??0)+1;
    c.down=false;c.hiringFumble=false;
    const event={type:'deferred',card:g.forecast?original:clone(original),deferred:true,effect:{company:c.id,before,after:before}};emit(g,event);g.lastRevealed=event;return event;
  }
  if(card.paid)g.metrics.revealedPaid++;
  const positions = g.companies.map((c) => c.position),
    event = { type: "reveal", card: g.forecast?physical:clone(physical), positions };
  if (card.kind === "growth" && card.effect) {
    const c = g.companies[card.company];
    const issued = 0;
    if (card.effect === "setback") c.position = Math.max(0,c.position-1);
    g.metrics.setbacks = (g.metrics.setbacks ?? 0) + Number(card.effect === "setback");
    event.effect = {company:c.id, before:positions[c.id], after:c.position, risk:card.effect, issued};
    owner.history.push(g.forecast?physical:clone(physical));
    g.removed.push({...physical, revealed:true});
    g.metrics.revealed++;
    g.metrics.growthMovement += c.position - positions[c.id];
  } else if (card.kind === "growth") {
    const c = g.companies[card.company];
    c.revealedCycle++;
    const founder=g.race?.bonus ?? 0, recovered=!!c.down&&card.signature==="recover", fumble=!!c.down&&!recovered;
    const printed=card.signature==="breakthrough"?(positions[c.id]<Math.max(...positions)?3:1):card.printed;
    const requested=printed+founder,movement=fumble?0:Math.max(0,requested);
    c.position=blockedDestination(g.companies,c.id,c.position,Math.min(g.rules.checkpoints.at(-1),c.position+movement),false,g.rules.checkpoints.at(-1));c.down=false;
    event.effect={company:c.id,before:positions[c.id],after:c.position,printed,signature:0,founder,multiplier:1,addition:0,fumble,recovered,requested};
    owner.history.push(g.forecast?physical:clone(physical));
    if(card.signature==="recycle")(g.returningCards??=[]).push({...physical,revealed:true});
    else g.removed.push({ ...physical, revealed: true });
    g.metrics.revealed++;
    g.metrics.growthMovement += c.position - positions[c.id];
    
    g.metrics.founderBonus += founder;
    if(founder&&!fumble)recordFounderMovement(g,c.founder,Math.max(0,c.position-Math.min(g.rules.checkpoints.at(-1),positions[c.id]+printed)));
    
    g.metrics.fumbles += Number(fumble);
  }

  const moves=event.moves??[{company:card.company,before:positions[card.company],after:g.companies[card.company].position}];
  recordArrivals(g,moves);
  for(const m of moves)markIPO(g,m.company);
  g.lastRevealed = event;
  emit(g, event);
  return event;
}
export function resolveCard(g, card, {interactive = false} = {}) {
  return beginRace(g, card, resolveCardBase, interactive);
}
function drawNext(g) {
  while(g.pile.length&&g.drawsLeft){
    const card=g.pile.shift(),c=g.companies[card.company];
    g.pendingRedraw=false;
    g.drawsLeft--;
    resolveCard(g,card,{interactive:true});
    return; // One shown card per click, including a fumble discard.
  }
  g.pendingRedraw=false;
}
function checkRevealEnd(g) {
  if (g.race) return;
  if (!g.revealEnded && (!g.drawsLeft || !g.pile.length)) {
    burnPile(g);
    returnGrowthCards(g);
    g.queue=[];g.active=g.first;
    g.revealEnded=true;
  }
  if(g.revealEnded&&g.rules.catchUp){g.phase=g.catchUpDone?'catchUpResult':'catchUpReady';g.queue=[];g.active=g.first;return;}
  if (g.revealEnded && (g.ipoCompany!=null || checkpointReached(g))) finishCycle(g,"checkpoint");
  else if (g.revealEnded || !g.drawsLeft || !g.pile.length) finishCycle(g,null);
}
// Recurring signatures wait outside the pile so they cannot be drawn twice in one reveal.
export function returnGrowthCards(g){
 const cards=g.returningCards??[];if(!cards.length)return;
 const ids=new Set(cards.map(c=>c.id));
 for(const c of g.companies)c.history=c.history.filter(card=>!ids.has(card.id));
 for(const {revealed,...card} of cards)g.companies[card.company].supply.push({...card,paid:false,fundingCount:card.fundingCount??Number(!!card.paid)});
 g.returningCards=[];
 emit(g,{type:'returnGrowth',destination:'supply',count:cards.length,companies:cards.map(c=>c.company)});
}
// Retired experimental treasury investor; retained for historical imports.
export function hedgeFundInvest(g) {}
export function burnPile(g,rand=()=>random(g)) {
 const eligible=g.burnEligible?new Set(g.burnEligible):null;
 const cards=g.pile.filter(card=>!eligible||eligible.has(card.id));
 const count=Math.min(g.rules.burnPerRound??0,cards.length),burned=[];
 for(let i=0;i<count;i++){
  const [card]=cards.splice(Math.floor(rand()*cards.length),1);
  g.pile.splice(g.pile.findIndex(c=>c.id===card.id),1);g.removed.push({...card,discarded:true});g.companies[card.company].history.push(clone(card));burned.push(clone(card));
 }
 delete g.burnEligible;
 if(count){g.metrics.burned=(g.metrics.burned??0)+count;emit(g,{type:'burn',count,cards:burned});}
}
function finishCycle(g, reason) {
  for(const p of g.players)p.locked=0;
  g.drawsLeft=0;
  g.ipoCompany=ipoFinisher(g);
  if(g.ipoCompany!=null)reason="ipo";
  g.cycleEnd = reason;
  g.first = (g.first + 1) % g.players.length;
  g.queue = [];
  g.active = g.first;
  g.phase = "cycleResult";
  emit(g, { type: "carry", reason, count: g.pile.length });
}
function beginSettlement(g) {
  g.ipoCompany=ipoFinisher(g);
  g.finalExit = g.ipoCompany!=null;
  const winners = podium(g.companies,g.rules.payoutPlaces);
  g.settlement = {
    leg: g.leg,
    reason: g.cycleEnd,
    positions: g.companies.map((c) => c.position),
    ranks: g.companies.map(c=>podium(g.companies,g.companies.length).indexOf(c.id)+1),
    prices: g.companies.map(c => g.finalExit && canExit(c,winners,g.companies) ? quote(c, g.rules, g.companies) : 0),
    podium: winners, final: g.finalExit,
    holdings: g.players.map((p) => g.companies.map((c) => holdings(c, p.id))),
    outstanding: g.companies.map(c => c.tokens.length),
    bankHeld: g.companies.map(bankHeld),
    founders: g.companies.map(c => c.founder),
    startPositions: clone(g.legStartPositions),
    contracts: g.players.map((p) => clone(p.lp)),
    accounts: [],
  };
  if (!g.finalExit) {
    g.settlement.accounts=g.players.map(p=>({player:p.id,before:p.cash,cash:p.cash,due:0,paid:0,unpaid:0,fee:0,sold:g.companies.map(()=>0),retained:g.companies.map(c=>holdings(c,p.id))}));
    g.settlements.push(clone(g.settlement));g.metrics.legCycles.push(g.cycle);
    g.queue=[];g.active=g.first;g.phase="legResult";
    emit(g,{type:"checkpoint",snapshot:g.settlement});return;
  }
  g.salePlans = {};
  for (const p of g.players) {
    p.adjustment=0;p.due=p.obligation;
  }
  g.queue = order(g);
  g.phase = "settle";
  emit(g, { type: "checkpoint", snapshot: g.settlement });
}
function applySales(g) {
  for (const p of g.players) {
    const sold = g.salePlans[p.id],
      before = p.cash;
    for (const c of g.companies) {
      let n = sold[c.id];
      for (const t of c.tokens)
        if (t.owner === p.id && n > 0) {
          g.metrics.investments.push({company:c.id, player:p.id, cost:t.paid ?? 0, payout:g.settlement.prices[c.id], boughtLeg:t.boughtLeg, soldLeg:g.leg});
          t.owner = null;
          n--;
        }
      const payout = sold[c.id] * g.settlement.prices[c.id];
      p.cash += payout;
      g.bank.payout += payout;
      g.metrics.sold += sold[c.id];
    }
    const paid = Math.min(p.cash, p.due),
      unpaid = p.due - paid,
      fee = unpaid ? g.rules.defaultFee * (g.leg + 1) : 0;
    p.cash -= paid;
    g.bank.repaid += paid;
    p.debt += unpaid;
    p.fees += fee;
    g.metrics.defaults += Number(unpaid > 0);
    g.metrics.fees += fee;
    const retained = g.companies.map((c) => holdings(c, p.id));
    g.metrics.retained += retained.reduce((s, n) => s + n, 0);
    g.settlement.accounts.push({
      player: p.id,
      before,
      adjustment: p.adjustment,
      due: p.due,
      paid,
      unpaid,
      fee,
      sold,
      retained,
      cash: p.cash,
    });
    p.savedCash += p.cash;
    p.cash = 0;
    p.obligation = 0;
    p.lpObligations = 0;
    p.lp = null;
  }
  g.settlements.push(clone(g.settlement));
  g.metrics.legCycles.push(g.cycle);
  g.queue = [];
  g.active = g.first;
  g.phase = "legResult";
  emit(g, { type: "settled", accounts: g.settlement.accounts });
}
export const canDrawEmptyHand=(g,id=currentPlayer(g))=>g.rules.intelMode!=='off'&&g.players[id].intel.length===0&&canDrawIntel(g,id);
export const canRaiseMoney=g=>!g.ended&&g.phase==='call'&&g.actionsLeft>0&&g.players[currentPlayer(g)].capital<6;
export function command(g, id, cmd) {
  check(!g.ended && id === currentPlayer(g), "Another investor must decide.");
  check(cmd && typeof cmd.type === "string", "Choose an action.");
  const p = g.players[id];
  switch (g.phase) {
    case "call": {
      if(cmd.type==='pass'){check(!hasTurnAction(g,id),'An action is available.');g.actionsLeft=1;finishAction(g,id);break;}
      if(cmd.type==='drawValue'){
        check(canDrawEmptyHand(g,id),'Draw a value card only when your hand is empty and a card is available.');
        replaceValue(g,id);emit(g,{type:'intelDraw',player:id,action:true});finishAction(g,id);break;
      }
      if(cmd.type==='raiseMoney'){
        check(p.capital<6,'Capital is limited to six uses per game.');
        p.cash+=CAPITAL_CASH;p.capital++;g.bank.issued+=CAPITAL_CASH;
        emit(g,{type:'raiseMoney',player:id,cash:CAPITAL_CASH,capital:p.capital});finishAction(g,id);break;
      }
      if(cmd.type==='sellShare'){
        check(integer(cmd.company,0,g.companies.length-1)&&holdings(g.companies[cmd.company],id)>0,'Choose a share you own.');
        const c=g.companies[cmd.company],token=c.tokens.findLast(t=>t.owner===id);
        delete c.mandate;token.owner=null;if(!holdings(c,id))c.lastBuy[id]=0;
        const payout=g.rules.sellPayouts[fundingBand(c.position)];p.cash+=payout;g.bank.issued+=payout;g.metrics.sold++;
        emit(g,{type:'sellShare',player:id,company:c.id,payout});
        finishAction(g,id);break;
      }
      if(cmd.type==='valueAction'){check(g.rules.intelMode!=='off','Value cards are disabled.');check(g.players[id].intel.length>0,'You have no value cards.');beginValueTurn(g,id);break;}
      if(cmd.type==='changeFounder'){
        check(integer(cmd.company,0,g.companies.length-1)&&lead(g.companies[cmd.company])===id,'Choose a company you lead.');

        g.company=cmd.company;g.phase='founder';break;
      }
      check(cmd.type==="call" && (eligibleCompanies(g,id).includes(cmd.company)),"Choose a company you lead (or one without a leader), with supply and an unissued share.");

      g.called.push(cmd.company);g.auction={company:cmd.company,host:id,reserve:minimumBid(g.companies[cmd.company],g.rules),bids:[],winner:null,paid:0};
      g.auction.equityController=lead(g.companies[cmd.company]);
      g.auction.equityControl=false;
      g.auction.mode='sealed';g.auction.price=0;
      g.queue=order(g);g.phase="bid";g.metrics.auctions++;break;
    }
    case "intelPlay": {
      if(cmd.type==='cancelValue'){delete g.intelOrder;delete g.intelTiming;g.phase='call';break;}
      if(cmd.type==='passValue'){
        check(!canDrawIntel(g,id)&&!canExchangeIntel(g,id)&&!p.intel.some(card=>intelTargets(g,id,card.kind).length),'Draw or play a card when possible.');
        if(!g.valueUsed.includes(id))g.valueUsed.push(id);delete g.intelOrder;delete g.intelTiming;finishAction(g,id);break;
      }
      if(cmd.type==='exchangeValue'){
        check(integer(cmd.card,0,p.intel.length-1),'Choose a card to discard.');
        check(canExchangeIntel(g,id),'No different value card is available to draw.');
        if(!g.intelDeck.length)g.intelDeck=shuffle(g,g.intelDiscard.splice(0));
        // Draw before discarding so an exchange cannot return the same card.
        const drawn=g.intelDeck.shift(),discarded=p.intel.splice(cmd.card,1)[0];
        g.intelDiscard.push(discarded);p.intel.push(drawn);
        g.metrics.intelExchanges=(g.metrics.intelExchanges??0)+1;
        g.metrics.intelDraws=(g.metrics.intelDraws??0)+1;
        emit(g,{type:'intelExchange',player:id,discard:discarded.kind});
        if(!g.valueUsed.includes(id))g.valueUsed.push(id);
        delete g.intelOrder;delete g.intelTiming;finishAction(g,id);
        break;
      }
      check(cmd.type==='playIntel'&&integer(cmd.card,0,p.intel.length-1),'Choose one value card to play.');
      const card=p.intel[cmd.card];
      const result={kind:card.kind,player:id,heldCompanies:g.companies.filter(c=>holdings(c,id)>0).map(c=>c.id),company:cmd.company,target:cmd.target,before:g.companies.map(c=>({position:c.position,arrivalOrder:c.arrivalOrder,supply:c.supply.length,down:c.down,founder:c.founder,shares:holdings(c,id)})),reactions:[]};
      check(playableIntel(g,card)&&intelTargets(g,id,card.kind).includes(cmd.company),'Choose an eligible card and company.');
      const c=g.companies[cmd.company];
      if(NEW_CARDS[card.kind]){
        if(TWO_COMPANY_CARDS.includes(card.kind))check(intelSecondTargets(g,id,card.kind,cmd.company).includes(cmd.target),'Choose a second portfolio company.');
        const choices=expansionChoices(g,id,cmd.card,cmd.company);
        if(card.kind==='rights')check(money(cmd.price,minimumBid(c,g.rules),availableCash(p),g.rules),'Name an affordable price at least the minimum.');
        else check(choices.some(choice=>Object.entries(choice).every(([key,value])=>cmd[key]===value)),'Choose valid card options.');
      }
      if(['swap','waste','headhunt'].includes(card.kind)||(card.kind==='move'&&cmd.target!=null))check(intelSecondTargets(g,id,card.kind,c.id).includes(cmd.target),'Choose a second eligible company.');
      g.valueResult=result;p.intel.splice(cmd.card,1);g.intelDiscard.push(card);if(!g.valueUsed.includes(id))g.valueUsed.push(id);
      g.metrics.intelPlays=(g.metrics.intelPlays??0)+1;emit(g,{type:'intelPlay',player:id,kind:card.kind,company:cmd.company});
      if(NEW_CARDS[card.kind]){g.lastRevealed=null;applyExpansion(g,id,card,cmd);if(!g.race&&!g.cardFundraise)advanceIntel(g);break;}
      if(card.kind==='headhunt'){const other=g.companies[cmd.target];[c.founder,other.founder]=[other.founder,c.founder];g.metrics.founderSwaps++;emit(g,{type:'founderSwap',companies:[c.id,other.id],founders:[c.founder,other.founder]});}
      if(['inside','launch'].includes(card.kind)){
        g.lastRevealed=null;const deck=c.supply;
        g.intelScout={player:id,company:c.id,kind:card.kind,cards:clone(card.kind==='inside'?g.removed.filter(token=>token.company===c.id&&!token.burned):deck.slice(0,2))};g.phase='intelScout';break;
      }
      g.lastRevealed=null;
      let actions=[];
      if(card.kind==='advisor')actions=[{kind:'returnSupply',company:c.id,count:2,intel:true},{kind:'move',company:c.id,amount:1,intel:true}];
      if(card.kind==='recover')actions=[{kind:'move',company:c.id,amount:1,intel:true},...(c.down||c.hiringFumble?[{kind:'repair',company:c.id,source:c.id,intel:true}]:[])];
      if(card.kind==='conflict'){p.cash+=g.rules.conflictPayout;g.bank.issued+=g.rules.conflictPayout;result.cashChange=g.rules.conflictPayout;actions=[{kind:'move',company:c.id,amount:-2,intel:true}];}
      if(card.kind==='move')actions=[c.id,...(cmd.target==null?[]:[cmd.target])].map(company=>({kind:'move',company,amount:1,intel:true}));
      if(card.kind==='smear')actions=[{kind:'fumble',company:c.id},{kind:'addSupply',company:c.id,count:2,intel:true}];
      if(card.kind==='back')actions=[{kind:'move',company:c.id,amount:-2,intel:true}];
      if(card.kind==='swap')actions=[{kind:'batch',moves:[{kind:'move',company:c.id,destination:g.companies[cmd.target].position,intel:true},{kind:'move',company:cmd.target,destination:c.position,intel:true}]}];
      if(actions.length)resolveIntelActions(g,actions,{player:id,kind:card.kind});
      if(!g.race)advanceIntel(g);break;
    }
    case "intelScout": {
      const peek=g.intelScout,deck=g.companies[peek.company].supply,n=peek.cards.length;
      if(peek.kind==='inside'){
        const choices=cmd.choices;
        check(cmd.type==='scoutIntel'&&Array.isArray(choices)&&choices.length===1&&new Set(choices).size===1&&choices.every(i=>integer(i,0,n-1)),'Choose 1 discarded token to return to the growth bag.');
        const ids=new Set(choices.map(i=>peek.cards[i].id));
        const cards=g.removed.filter(t=>ids.has(t.id)&&!t.burned);
        check(cards.length===1,'Choose available discarded tokens.');
        g.removed=g.removed.filter(t=>!ids.has(t.id));
        g.companies[peek.company].history=g.companies[peek.company].history.filter(t=>!ids.has(t.id));
        const returned=cards.map(({revealed,discarded,burned,paid,...t})=>({...t,paid:false}));
        g.pile.push(...returned);shuffle(g,g.pile);g.metrics.entered+=1;
        g.valueResult.returnedCards=clone(returned);emit(g,{type:'returnBag',company:peek.company,cards:returned});
      }else{
        check(peek.kind==='launch'&&cmd.type==='scoutIntel'&&integer(cmd.choice,0,n-1),'Choose one of the top 2 supply tokens.');
        g.pile.push(deck.splice(cmd.choice,1)[0]);g.metrics.entered++;shuffle(g,g.pile);
        for(const player of g.players)if(player.intelKnowledge?.company===peek.company)delete player.intelKnowledge;
        p.intelKnowledge={company:peek.company,count:deck.length,top:clone(deck.slice(0,1)),bottom:null};
      }
      delete g.intelScout;advanceIntel(g);break;
    }
    case "founder": {
      check(
        cmd.type === "founder" && integer(cmd.choice, -1, g.founderMarket.length-1),
        "Keep founder or choose a public replacement.",
      );
      if(g.rules.intelMode!=='off')check(cmd.choice>=0,'Choose a replacement founder to complete your turn.');
      const c = g.companies[g.company];
      if (cmd.choice >= 0) {
        check(canHireFounder(g.founderMarket[cmd.choice],g.leg), "That founder cannot be hired.");
        const old = c.founder;
        c.founder = g.founderMarket[cmd.choice];
        c.flags.founderChanges=(c.flags.founderChanges??0)+1;
        (g.turnHires??=[]).push(c.id);
        g.founderSupply.push(old);
        g.founderMarket[cmd.choice] = g.founderSupply.shift();
        g.metrics.founderSwaps++;
        emit(g, { type: "founder", company: c.id, old, founder: c.founder });
        // Replacing a founder costs the action only; preserve the company's fumble state.
      }
      if(cmd.choice<0)g.phase='call';else finishAction(g,id);
      break;
    }
    case 'rights': {
      check(cmd.type==='rights'&&typeof cmd.accept==='boolean','Accept or pass the named price.');
      check(!cmd.accept||availableCash(p)>=g.auction.price,'You cannot afford that price.');
      const a=g.auction;a.bids.push({player:id,amount:cmd.accept?a.price:0});g.queue.shift();
      if(cmd.accept)finishAuction(g,id,a.price);
      else if(!g.queue.length){a.bids.push({player:a.host,amount:a.price});finishAuction(g,a.host,a.price);}
      break;
    }
    case 'openBid': {
      const a=g.auction,min=a.highBidder==null?a.reserve:a.price+1;
      check(cmd.type==='openBid'&&(cmd.amount===0||money(cmd.amount,min,availableCash(p),g.rules)),'Raise by at least $1 or pass permanently.');
      a.bids.push({player:id,amount:cmd.amount});g.queue.shift();
      if(cmd.amount){a.highBidder=id;a.price=cmd.amount;}else a.contenders=a.contenders.filter(x=>x!==id);
      const remaining=a.contenders.filter(x=>x!==a.highBidder);
      if(!remaining.length)finishAuction(g,a.highBidder??null,a.highBidder==null?0:a.price);
      else {g.queue=order(g,(id+1)%g.players.length).filter(x=>remaining.includes(x));}
      break;
    }
    case "bid": {
      check(
        cmd.type === "bid" && (cmd.amount === 0 || money(cmd.amount, g.auction.reserve, availableCash(p),g.rules)),
        "Bid an affordable amount in currency increments, or zero to pass.",
      );
      g.auction.bids.push({ player: id, amount: cmd.amount });
      g.queue.shift();
      if (!g.queue.length) resolveBids(g);
      break;
    }
    case "tie": {
      check(
        cmd.type === "tie" &&
          (cmd.amount === 0 ||
            money(cmd.amount, g.auction.price + currencyUnit(g.rules), availableCash(p),g.rules)),
        "Raise the open price by at least one currency increment, or withdraw.",
      );
      const a = g.auction;
      a.open.push({ player: id, amount: cmd.amount });
      g.queue.shift();
      if (cmd.amount) {
        a.price = cmd.amount;
        g.queue.push(id);
      } else a.contenders = a.contenders.filter((n) => n !== id);
      if (a.contenders.length === 1) finishAuction(g, a.contenders[0], a.price);
      break;
    }
    case "settle": {
      check(
        cmd.type === "sell" &&
          Array.isArray(cmd.shares) &&
          cmd.shares.length === g.companies.length &&
          cmd.shares.every((n, cid) =>
            integer(n, 0, holdings(g.companies[cid], id)),
          ),
        "Choose valid share sales.",
      );
      const all = cmd.shares.every(
          (n, cid) => n === holdings(g.companies[cid], id),
        ),
        sale = cmd.shares.reduce(
          (s, n, i) => s + n * g.settlement.prices[i],
          0,
        );
      check(!g.finalExit || all, "Sell all shares at the final exit.");
      check(
        p.cash + sale >= p.due || all,
        "Sell enough to repay, or liquidate all holdings if you cannot.",
      );
      g.salePlans[id] = clone(cmd.shares);
      g.queue.shift();
      if (!g.queue.length) applySales(g);
      break;
    }
    case "power": {
      check(cmd.type === "power" && integer(cmd.choice,0,g.powerChoice.options.length-1), "Choose a founder action.");
      resumeRace(g, cmd.choice, resolveCardBase);
      if(g.intelOrder){if(!g.race)advanceIntel(g);}else checkRevealEnd(g);
      break;
    }
    case "reveal": {
      check(cmd.type === "reveal", "Reveal the next card.");
      check(g.pile.length > 0, "Reveal pile is empty.");
      drawNext(g);
      checkRevealEnd(g);
      break;
    }
    default: {
      check(cmd.type === "continue", "Review the result, then continue.");
      if (g.phase === "auctionResult"){if(g.cardFundraise){delete g.cardFundraise;advanceIntel(g);}else finishAction(g,g.auction.host);}
      else if(g.phase==='phaseResult'){resumePhase(g,resolveCardBase);checkRevealEnd(g);}
      else if(g.phase==='valueResult')finishAction(g,id);
      else if(g.phase==='afterRevealReady'){
        g.revealEnded=true;resolveRevealPhase(g,'end',true);checkRevealEnd(g);
      }else if(g.phase==='catchUpReady'){
        g.catchUpDone=true;resolveRevealPhase(g,'catchUp',true);checkRevealEnd(g);
      }else if(g.phase==='catchUpResult')finishCycle(g,checkpointReached(g)?'checkpoint':null);
      else if (g.phase === "purchaseResult") {
        startReveal(g);
      } else if (g.phase === "cycleResult") {
        if (g.cycleEnd) beginSettlement(g);
        else {
          g.cycle++;
          startCycle(g);
        }
      } else if (g.phase === "legResult") {
        if (g.finalExit) {
          g.ended = true;
          g.phase = "finished";
          g.scores = g.players.map((p) => p.savedCash + p.cash - p.debt - p.fees - capitalPenalty(p));
          const max = Math.max(...g.scores);
          g.winners = g.players
            .filter((p) => g.scores[p.id] === max)
            .map((p) => p.id);
        } else {
          g.leg++;
          beginLeg(g);
        }
      } else throw Error("Unknown phase.");
    }
  }
  for(const player of g.players)if(player.intelKnowledge&&g.companies[player.intelKnowledge.company].supply.length!==player.intelKnowledge.count)delete player.intelKnowledge;
  return g;
}
function startReveal(g){
  g.phase='reveal';g.queue=[];g.active=g.first;
  resolveRevealPhase(g,'start',true);checkRevealEnd(g);
}
function finishAction(g,id){
  g.actionsLeft--;
  if(g.actionsLeft>0){delete g.auction;g.phase='call';g.queue=[id];g.active=id;}
  else nextAuction(g);
}
function replaceValue(g,id){
  if(!g.intelDeck.length)g.intelDeck=shuffle(g,g.intelDiscard.splice(0));
  if(g.intelDeck.length){g.players[id].intel.push(g.intelDeck.shift());g.metrics.intelDraws=(g.metrics.intelDraws??0)+1;}
}
function beginValueTurn(g,id){
  if(g.rules.intelMode==='off'){nextAuction(g);return;}
  g.intelOrder=[id];g.intelTiming='turn';delete g.valueResult;
  g.phase='intelPlay';g.queue=[id];g.active=id;
}
function advanceIntel(g){
  const id=g.intelOrder?.[0]??g.active;
  if(g.valueResult&&!g.valueResult.shareholderReactionsDone){
    g.valueResult.shareholderReactionsDone=true;
    const result=g.valueResult,targets=result.company<0?[]:[result.company,...(['move','swap','waste','headhunt','insurance','transfer','focused'].includes(result.kind)?[result.target]:[])],actions=shareholderReactions(g,id,targets,result.heldCompanies);
    if(actions.length){
      const log=g.lastRevealed?.stage==='intel'?g.lastRevealed.reactions??[]:[];
      resolveIntelActions(g,actions,{player:id,kind:g.valueResult.kind},{log});
      if(g.race)return;
    }
  }
  delete g.intelOrder;delete g.intelTiming;delete g.intelOptional;
  if(g.valueResult){
    if(!g.liveDice){replaceValue(g,id);if(g.valueResult.kind==='fresh')replaceValue(g,id);}
    const result=g.valueResult;
    result.after=g.companies.map(c=>({position:c.position,arrivalOrder:c.arrivalOrder,supply:c.supply.length,down:c.down,founder:c.founder,shares:holdings(c,result.player)}));
    result.reactions=g.lastRevealed?.stage==='intel'?clone(g.lastRevealed.reactions??[]):[];
    result.noEffect=!!g.log.findLast(e=>e.type==='intelPlay'&&e.player===result.player)?.noEffect;
    g.lastRevealed={type:'valueResolved',value:clone(result),reactions:result.reactions};
    emit(g,{type:'valueResolved',value:clone(result)});
  }
  g.phase='valueResult';g.queue=[];g.active=id;
}
export function hasTurnAction(g,id){return canDrawEmptyHand(g,id) || g.players[id].capital<6 || eligibleCompanies(g,id).length>0 || g.companies.some(c=>holdings(c,id)>0) || (g.rules.intelMode!=='off' && g.players[id].intel.length>0);}
export function observation(g, id) {
  const v = clone(g);
  v.playerId = id;
  v.discarded=g.removed.filter(card=>!card.burned).map(card=>clone(card));
  v.publicBurns=g.removed.filter(card=>card.burned&&card.public).map(card=>clone(card));
  v.revealedDestroyed=(g.destroyed??[]).filter(t=>t.public).map(t=>clone(t));
  if(v.crisisChoice)v.crisisChoice={company:v.crisisChoice.company};
  // Anya's unchosen discard options contain private card identities.
  if(v.powerChoice?.founder===26&&v.powerChoice.player!==id)delete v.powerChoice.options;
  delete v.intelDeck;delete v.intelDiscard;v.destroyedCounts=g.companies.map(c=>(g.destroyed??[]).filter(t=>t.company===c.id).length);delete v.destroyed;
  for(const c of v.companies)c.discardCount=g.removed.filter(x=>x.company===c.id&&!x.burned).length;
  for(const p of v.players){p.intelCount=p.intel.length;if(p.id!==id){delete p.intel;delete p.intelKnowledge;}}
  if(v.intelScout?.player!==id)delete v.intelScout;
  v.pileCount = g.pile.length;
  v.poolWeightsAreUpperBounds=false;
  v.poolWeights = g.companies.map(c => g.pile.filter(card => card.company === c.id).length);

  if(g.race?.card?.kind==="growth")v.reviewCard=clone(g.race.card);
  v.removedCount = g.removed.length;

  for (const key of [
    "burnEligible",
    "seed",
    "rng",
    "log",
    "pile",
    "removed",
    "founderSupply",
    "salePlans",
    "race",
  ])
    delete v[key];
  for (const c of v.companies) {
    c.supplyCount = c.supply.length;
    delete c.supply;
  }
  if (g.phase === "bid")
    v.auction.bids = g.auction.bids.map((b) =>
      b.player === id ? b : { player: b.player, submitted: true },
    );
  return v;
}
export function assertGame(g) {
  if(g.rules.intelMode!=='off'){
    const cards=[...g.intelDeck,...g.intelDiscard,...g.players.flatMap(p=>p.intel)];
    check(cards.length===intelDeck().length&&new Set(cards.map(c=>c.id)).size===intelDeck().length,'Intel conservation failed.');
    check(g.players.every(p=>p.intel.length<=MAX_VALUE_HAND),'Value-card hand limit exceeded.');
    check(new Set(g.valueUsed).size===g.valueUsed.length&&g.valueUsed.every(id=>integer(id,0,g.players.length-1)),'Invalid value-card usage.');
  }
  const growth = [
    ...g.companies.flatMap((c) => c.supply),
    ...g.pile.filter((c) => c.kind === "growth"),
    ...g.removed,
    ...(g.destroyed??[]),
    ...(g.returningCards??[]),
    ...(g.race && !g.race.revealed && g.race.card.kind === "growth" ? [g.race.card] : []),
  ];
  check(
    growth.length === g.companies.reduce((n,c)=>n+growthDeck(c.id).length,0) &&
      new Set(growth.map((c) => c.id)).size === growth.length,
    "Growth conservation failed.",
  );
  check(growth.reduce((n,c)=>n+(c.fundingCount??Number(!!c.paid)),0) === g.metrics.purchased, "Paid growth conservation failed.");
  const founders = [
    ...g.founderSupply,
    ...g.founderMarket,
    ...g.companies.map((c) => c.founder),
  ];
  check(
    founders.length === ACTIVE_FOUNDERS.length &&
      new Set(founders).size === ACTIVE_FOUNDERS.length && founders.every(id=>ACTIVE_FOUNDERS.includes(id)) &&
      g.founderMarket.length === 3,
    "Founder conservation failed.",
  );
  check(g.companies.every(c=>integer(c.arrivalOrder,1,Number.MAX_SAFE_INTEGER))&&new Set(g.companies.map(c=>c.arrivalOrder)).size===g.companies.length,"Invalid race arrival order.");
  for (const c of g.companies) {
    check(
      integer(c.position, 0, g.rules.checkpoints.at(-1)) &&
        integer(c.purchased, 0, Number.MAX_SAFE_INTEGER) &&
        c.supply.length + growth.filter(x=>x.company===c.id && !c.supply.some(y=>y.id===x.id)).length === growthDeck(c.id).length,
      "Invalid company stocks.",
    );
    check(
      c.tokens.length <= g.rules.shareLimit &&
        c.tokens.every(
          (t, i) =>
            t.id === i + 1 &&
            (t.owner === null || integer(t.owner, 0, g.players.length - 1)),
        ),
      "Token ledger failed.",
    );
  }
  check(
    g.players.every(
      (p) =>
        [p.cash, p.locked, p.savedCash, p.debt, p.fees, p.obligation].every((n) =>
          money(n, 0, 1e9,g.rules),
        ) && integer(p.capital,0,6) && integer(p.lpObligations,0,1e9) && p.locked<=p.cash,
    ),
    "Invalid personal stocks.",
  );
  check(
    g.players.reduce((s, p) => s + p.cash + p.savedCash, 0) ===
      g.bank.issued + g.bank.payout - g.bank.burn - g.bank.repaid,
    "Cash conservation failed.",
  );
  check(
    g.ended || integer(currentPlayer(g), 0, g.players.length - 1),
    "No current decision.",
  );
  check(g.leg < 3 && Number.isInteger(g.cycle) && g.cycle > 0, "Sequence exceeded guard.");
  return true;
}
export function replayGame(data) {
  check(
    data?.version === VERSION && data.setup && Array.isArray(data.commands),
    "Unsupported replay; older saves remain untouched.",
  );
  const g = createGame(data.setup);
  for (const c of data.commands) {
    command(g, c.id, c.cmd);
    assertGame(g);
  }
  return g;
}

// Ownership mutations invalidate temporary mandates, including changes that retain the natural lead.
function retireShare(g,c,id){const index=c.tokens.findLastIndex(t=>t.owner===id);c.tokens.splice(index,1);c.tokens.forEach((t,i)=>t.id=i+1);delete c.mandate;if(!holdings(c,id))c.lastBuy[id]=0;}
function issueFreeShare(g,c,id){delete c.mandate;c.tokens.push({id:c.tokens.length+1,owner:id,paid:0,boughtLeg:g.leg});c.lastBuy[id]=++g.serial;g.metrics.issued++;}
export function cardCash(g,id,amount,detail={}){g.players[id].cash+=amount;if(amount>0)g.bank.issued+=amount;else g.bank.burn-=amount;emit(g,{type:'cardCash',player:id,amount,...detail});}
function applyExpansion(g,id,card,cmd){
 const p=g.players[id],c=g.companies[cmd.company],kind=card.kind;
 let actions=[];
 const move=(amount,company=cmd.company)=>({kind:'move',company,amount,intel:true});
 const deploy=(count,company=cmd.company)=>({kind:'addSupply',company,count,intel:true});
 if(kind==='clearance'){
  const removed=Array.from({length:2},()=>c.supply.splice(Math.floor(random(g)*c.supply.length),1)[0]);
  g.destroyed.push(...removed.map(t=>({...t,public:true})));cardCash(g,id,5);
  g.valueResult.destroyedCards=clone(removed);emit(g,{type:'clearance',player:id,company:c.id,count:2,cards:removed});
  for(const x of g.players)if(x.intelKnowledge?.company===c.id)delete x.intelKnowledge;
 }
 if(kind==='consolidation'){retireShare(g,c,id);p.capital--;}
 if(kind==='session'){const old=c.founder;c.founder=g.founderMarket[cmd.founder];(g.turnHires??=[]).push(c.id);g.founderSupply.push(old);g.founderMarket[cmd.founder]=g.founderSupply.shift();c.hiringFumble=true;g.metrics.founderSwaps++;emit(g,{type:'founder',company:c.id,old,founder:c.founder});actions=[{kind:'fumble',company:c.id}];}
 if(kind==='insurance')actions=[{kind:'repair',company:c.id,source:c.id,intel:true},{kind:'fumble',company:cmd.target}];
 if(kind==='weekend'){g.actionsLeft+=2;g.weekendUsed=true;}
 if(FUNDRAISE_CARDS.includes(kind)){
  g.auction={company:c.id,host:id,reserve:minimumBid(c,g.rules),bids:[],winner:null,paid:0,mode:kind,price:cmd.price??0};g.metrics.auctions++;g.cardFundraise=true;
  if(kind==='rights'){g.phase='rights';g.queue=order(g,(id+1)%g.players.length).filter(x=>x!==id);}
  else if(kind==='public'){g.phase='openBid';g.auction.contenders=order(g,id);g.auction.highBidder=null;g.queue=order(g,id);}
  else {g.phase='bid';g.queue=order(g);}
  return;
 }
 if(kind==='mandate'){cardCash(g,id,-2);c.mandate=id;}
 if(kind==='coup'){c.mandate=id;actions=[{kind:'fumble',company:c.id}];}
 if(kind==='matching'){cardCash(g,id,-3);actions=[deploy(2)];}
 if(kind==='dividend'){for(const x of g.players){const amount=holdings(c,x.id)*3;if(amount)cardCash(g,x.id,amount);}actions=[move(-2)];}
 if(kind==='stake'){
  const previousLead=lead(c),price=[6,12,18][fundingBand(c.position)];p.cash-=price;g.players[cmd.seller].cash+=price;
  delete c.mandate;c.tokens.find(t=>t.owner===cmd.seller).owner=id;c.lastBuy[id]=++g.serial;if(!holdings(c,cmd.seller))c.lastBuy[cmd.seller]=0;
  emit(g,{type:'shareTransfer',player:id,seller:cmd.seller,company:c.id,amount:price});resolveSharePurchase(g,c.id,id,{previousLead});
 }
 if(kind==='focused')actions=[move(-2),{kind:'move',company:cmd.target,amount:2,intel:true}];
 if(kind==='advice'){const index=cmd.discard-(cmd.discard>cmd.card?1:0);g.intelDiscard.push(p.intel.splice(index,1)[0]);cardCash(g,id,3);actions=[move(1)];}
 if(kind==='sweat'){issueFreeShare(g,c,id);actions=[move(-2)];}
 if(kind==='restructure'){p.capital--;actions=[move(-3)];}
 if(kind==='financing'){p.capital++;actions=[move(2),deploy(1)];}
 if(kind==='fresh'){
  const before=[...g.founderMarket];g.founderMarket=g.founderSupply.splice(0,3);g.founderSupply.push(...before);
  g.valueResult.marketBefore=before;g.valueResult.marketAfter=[...g.founderMarket];
  emit(g,{type:'founderMarketRefresh',player:id,before,after:[...g.founderMarket]});
 }
 if(kind==='transfer'){retireShare(g,c,id);issueFreeShare(g,g.companies[cmd.target],id);}
 if(actions.length)resolveIntelActions(g,actions,{player:id,kind});
}
