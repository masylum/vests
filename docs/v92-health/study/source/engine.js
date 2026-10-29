import {recordArrivals} from './movement.js';
import {INTEL_MODES,MAX_VALUE_HAND,canDrawIntel,canExchangeIntel,intelDeck,intelTargets,intelSecondTargets,playableIntel,invested,intelLead} from './intel.js';
import {canHireFounder} from './config.js';
import {canExit,dilution} from './config.js';
import { REVEALS_PER_ROUND } from "./config.js";
import {checkpointReached, podium} from './config.js';
import { recordFounderMovement, resolveSharePurchase, shareholderReactions, resolveIntelActions, beginRace, resumeRace,resumePhase, resolveRevealPhase, markIPO } from "./racing.js";
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
export const holdings = (c, id) =>
  c.tokens.filter((t) => t.owner === id).length;
export const outstanding = (c) => c.tokens.length;
export const bankHeld = (c) => c.tokens.filter((t) => t.owner === null).length;
export const quote = (c, rules = RULES, companies = [c]) =>
  c.tokens.length ? sharePayout(settlementValue(c, companies, rules), dilution(c),rules) : 0;
export function lead(c) {
  const ids = c.lastBuy.map((_, id) => id).filter((id) => holdings(c, id));
  return (
    ids.sort(
      (a, b) => holdings(c, b) - holdings(c, a) || c.lastBuy[b] - c.lastBuy[a],
    )[0] ?? null
  );
}
const order = (g, first = g.first) =>
  g.players.map((_, i) => (first + i) % g.players.length);
const emit = (g, e) => {
  if (!g.fast) g.log.push({ leg: g.leg, cycle: g.cycle, ...clone(e) });
};
export const currentPlayer = (g) =>
  g.ended ? null : g.queue.length ? g.queue[0] : g.active;
export function createGame({ seed = 42, players = 4, rules = {} } = {}) {
  check(
    integer(seed, 0, 0xffffffff) && integer(players, 3, 5),
    "Choose 3–5 investors and a whole seed.",
  );
  check(
    Object.keys(rules).every((k) => ["exitMultiplier", "currencyUnit", "bridgeCost", "secondaryCost", "conflictPayout", "sellPayouts", "intelMode", "burnPerRound", "moneyScale", "muraMinimum", "wangExit", "catchUp", "purchaseStep", "exitScale", "defaultFee", "purchaseBase", "exitLinear", "exitCurve", "ipoValue", "growthDivisor", "checkpointCount", "costAcceleration", "payoutPlaces", "startingCash", "obligation", "projectPrices", "hedgeFund", "revealsPerRound"].includes(k)),
    "Unknown experimental rule.",
  );
  const r = clone({ ...RULES, burnPerRound:players-1, ...rules });
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
    Array.from({ length: FOUNDERS.length }, (_, i) => i),
  );
  for (let id = 0; id < players + 2; id++)
    g.companies.push({
      id,
      position: 1,
      purchased: 0,
      reserve: 0,
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
  if(r.intelMode!=="off"){g.intelDeck=shuffle(g,intelDeck(r.intelMode));g.intelDiscard=[];g.valueUsed=[];for(const p of g.players)p.intel=g.intelDeck.splice(0,1);}
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
    p.lpObligations += Number(p.lp.cash>0);
    g.bank.issued += p.lp.cash;
  }
  startCycle(g);
}
export function eligibleCompanies(g,id) {
  return g.companies.filter(c => c.reserve < 3 && c.tokens.length < g.rules.shareLimit && (c.supplyCount ?? c.supply?.length) && (lead(c) === id || lead(c) === null)).map(c=>c.id);
}
function startCycle(g) {
  delete g.burnEligible;g.pileBurned=false;
  for (const c of g.companies) {c.flags={};c.revealedCycle=0;c.boughtCycle=0;}
  g.lastRevealed=null;g.founderUsed=[];g.revealMovement=g.companies.map(()=>0);g.revealMoved=g.companies.map(()=>false);g.intelMovementStarted=true;delete g.intelOrder;delete g.afterIntelDone;delete g.catchUpDone;delete g.catchUpResult;
  g.purchaseSummary=[];delete g.poolSize;g.drawsLeft=0;
  g.valueUsed=[];
  g.called=[];g.callOrder=order(g);g.callIndex=0;
  g.metrics.cycles++;emit(g,{type:"cycle"});nextAuction(g);
}
function nextAuction(g) {
  delete g.auction;
  while(g.callIndex < g.callOrder.length) {
    const id=g.callOrder[g.callIndex++];
    g.phase='call';g.queue=[id];g.active=id;return;
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
    finishAuction(g, top[0].player, positive.length===1 ? positive[0].amount : Math.max(a.reserve, positive[1].amount));
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
  g.auctionHistory.push({company:a.company,host:a.host,bids:clone(a.bids),winner,paid,cash:g.players.map(p=>p.cash)});
  if (winner === null) g.metrics.unsold++;
  else {
    const p = g.players[winner];
    const commitment = Math.max(paid, a.bids.find(b=>b.player===winner).amount);
    a.locked = commitment-paid;
    p.locked += a.locked;
    p.cash -= paid;
    g.bank.burn += paid;
    const charges = Math.min(fundedCards(fundingBand(c.position),paid,g.rules), 3-c.reserve);
    c.reserve += charges;
    a.cards = reserveCards(c);
    a.charges = charges;
    c.tokens.push({ id: c.tokens.length + 1, owner: winner, paid, boughtLeg:g.leg });
    c.lastBuy[winner] = ++g.serial;
    g.metrics.issued++;
    g.metrics.payments.push(paid);
    a.bonusCards=0;
    a.reactions=resolveSharePurchase(g,c.id,winner)?.reactions??[];

  }
  g.queue = [];
  g.active = a.host;
  g.phase = "auctionResult";
  emit(g, { type: "auction", ...a });
}
export function deployReserves(g) {
  for(const c of g.companies)if(c.reserve>0||slotCards(c,0,g.companies)>0){
    const funded=c.reserve>0,fromReserve=c.reserve;
    const cards=c.supply.splice(0,slotCards(c,c.reserve,g.companies)).map(card=>({...card,paid:funded,fundingCount:(card.fundingCount??Number(!!card.paid))+Number(funded)}));
    c.reserve=Math.max(0,c.reserve-1);if(!c.supply.length)c.reserve=0;
    c.purchased+=funded?cards.length:0;c.boughtCycle=cards.length;
    g.pile.push(...cards);g.metrics.purchased+=funded?cards.length:0;g.metrics.entered+=cards.length;
    g.purchaseSummary.push({company:c.id,count:cards.length,spent:0,fromReserve,toReserve:c.reserve});
    emit(g,{type:"deploy",company:c.id,count:cards.length,reserve:c.reserve});
  }
}
function buyGrowth(g) {
  g.revealStartPositions=g.companies.map(c=>c.position);
  g.revealStartArrivalOrders=g.companies.map(c=>c.arrivalOrder);
  deployReserves(g);
  // Cards deployed by reveal-time powers get one reveal before they can burn.
  g.burnEligible=g.pile.map(card=>card.id);
  shuffle(g,g.pile);g.drawsLeft=Math.min(g.rules.revealsPerRound,g.pile.length);g.poolSize=g.pile.length;
  g.revealEnded=false;
  g.queue=[];g.active=g.first;g.phase="purchaseResult";
  g.metrics.auctionCards.push({leg:g.leg,cycle:g.cycle,companies:clone(g.purchaseSummary)});
  emit(g,{type:"purchases",companies:g.purchaseSummary,poolSize:g.poolSize,draws:g.drawsLeft});
}
export function resolveCardBase(g, card) {
  if(card.kind==='deferred'){
    const c=g.companies[card.company],original=card.original,before=c.position;
    c.history.push(clone(original));g.removed.push({...original,discarded:true});
    g.metrics.wasted++;g.metrics.wastedPaid+=Number(!!original.paid);g.metrics.deferred=(g.metrics.deferred??0)+1;
    c.down=false;c.hiringFumble=false;
    const event={type:'deferred',card:clone(original),deferred:true,effect:{before,after:before}};emit(g,event);g.lastRevealed=event;return event;
  }
  if(card.paid)g.metrics.revealedPaid++;
  const positions = g.companies.map((c) => c.position),
    event = { type: "reveal", card: clone(card), positions };
  if (card.kind === "growth" && card.effect) {
    const c = g.companies[card.company];
    const issued = 0;
    if (card.effect === "setback") c.position = Math.max(0,c.position-1);
    g.metrics.setbacks = (g.metrics.setbacks ?? 0) + Number(card.effect === "setback");
    event.effect = {company:c.id, before:positions[c.id], after:c.position, risk:card.effect, issued};
    c.history.push(clone(card));
    g.removed.push({...card, revealed:true});
    g.metrics.revealed++;
    g.metrics.growthMovement += c.position - positions[c.id];
  } else if (card.kind === "growth") {
    const c = g.companies[card.company];
    c.revealedCycle++;
    const founder=g.race?.bonus ?? 0, recovered=!!c.down&&card.signature==="recover", fumble=!!c.down&&!recovered;
    const printed=card.signature==="breakthrough"?(positions[c.id]<Math.max(...positions)?3:1):card.printed;
    const requested=printed+founder,movement=fumble?0:Math.max(0,requested);
    c.position=Math.min(g.rules.checkpoints.at(-1),c.position+movement);c.down=false;
    event.effect={company:c.id,before:positions[c.id],after:c.position,printed,signature:0,founder,multiplier:1,addition:0,fumble,recovered,requested};
    c.history.push(clone(card));
    if(card.signature==="recycle")(g.returningCards??=[]).push({...card,revealed:true});
    else g.removed.push({ ...card, revealed: true });
    g.metrics.revealed++;
    g.metrics.growthMovement += c.position - positions[c.id];
    
    g.metrics.founderBonus += founder;
    if(founder&&!fumble)recordFounderMovement(g,c.founder,Math.max(0,c.position-Math.min(g.rules.checkpoints.at(-1),positions[c.id]+printed)));
    
    g.metrics.fumbles += Number(fumble);
  }
  if(card.signature)resolveSpecial(g,card);
  const moves=event.moves??[{company:card.company,before:positions[card.company],after:g.companies[card.company].position}];
  recordArrivals(g,moves);
  for(const m of moves)markIPO(g,m.company);
  g.lastRevealed = event;
  emit(g, event);
  return event;
}
function resolveSpecial(g,card) {
 const c=g.companies[card.company];
 const add = target => {if(target?.supply.length){g.pile.push(target.supply.shift());g.metrics.entered++;}};
 if(card.signature==="add"){add(c);shuffle(g,g.pile);}
 if(card.signature==="swapCard")c.reserve=Math.min(3,c.reserve+1);
}
export function resolveCard(g, card, {interactive = false} = {}) {
  return beginRace(g, card, resolveCardBase, interactive);
}
function drawNext(g) {
  while(g.pile.length&&g.drawsLeft){
    const card=g.pile.shift(),c=g.companies[card.company];
    g.pendingRedraw=!!c.down&&card.signature!=="recover";
    if(!g.pendingRedraw)g.drawsLeft--;
    resolveCard(g,card,{interactive:true});
    return; // One shown card per click, including a fumble discard.
  }
  g.pendingRedraw=false;
}
function checkRevealEnd(g) {
  if (g.race) return;
  if(!g.revealEnded&&g.pendingRedraw&&g.pile.length)return;
  if (!g.revealEnded && (!g.drawsLeft || !g.pile.length)) {
    returnGrowthCards(g);
    if(!g.pileBurned){burnPile(g);g.pileBurned=true;}
    g.phase='afterRevealReady';g.queue=[];g.active=g.first;return;
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
export function hedgeFundInvest(g) {
 if(!g.rules.hedgeFund||g.companies.some(c=>c.position>=24))return;
 const last=Math.min(...g.companies.map(c=>c.position));
 for(const c of g.companies.filter(c=>c.position===last)){
  if(c.reserve!==0||!c.supply.length||c.tokens.length>=g.rules.shareLimit)continue;
  c.reserve=3;
  c.tokens.push({id:c.tokens.length+1,owner:null,paid:0,boughtLeg:g.leg,hedge:true});
  g.metrics.hedgeInvestments=(g.metrics.hedgeInvestments??0)+1;
  emit(g,{type:'hedge',company:c.id,position:c.position});
 }
}
export function burnPile(g,rand=()=>random(g)) {
 if(g.ipoCompany!=null)return;
 const eligible=g.burnEligible?new Set(g.burnEligible):null;
 const cards=g.pile.filter(card=>!eligible||eligible.has(card.id));
 const count=Math.min(g.rules.burnPerRound??0,cards.length);
 for(let i=0;i<count;i++){
  const [card]=cards.splice(Math.floor(rand()*cards.length),1);
  g.pile.splice(g.pile.findIndex(c=>c.id===card.id),1);g.removed.push({...card,burned:true});
 }
 delete g.burnEligible;
 if(count){g.metrics.burned=(g.metrics.burned??0)+count;emit(g,{type:'burn',count});}
}
function finishCycle(g, reason) {
  for(const p of g.players)p.locked=0;
  g.drawsLeft=0;
  if(g.ipoCompany!=null){reason="ipo";g.ipoCompany=podium(g.companies,1)[0];}
  g.cycleEnd = reason;
  g.first = (g.first + 1) % g.players.length;
  g.queue = [];
  g.active = g.first;
  g.phase = "cycleResult";
  emit(g, { type: "carry", reason, count: g.pile.length });
}
function beginSettlement(g) {
  g.finalExit = g.ipoCompany!=null||g.companies.some(c=>c.position>=24);
  if(g.finalExit)g.ipoCompany=podium(g.companies,1)[0];
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
export const canRaiseMoney=g=>!g.ended&&!g.finalExit&&!['settle','legResult'].includes(g.phase);
export function command(g, id, cmd) {
  if(cmd?.type==='raiseMoney'){
    check(canRaiseMoney(g)&&integer(id,0,g.players.length-1),'New LPs are available until final settlement starts.');
    const p=g.players[id];
    p.cash+=g.rules.startingCash;p.obligation+=g.rules.obligation;p.lpObligations++;g.bank.issued+=g.rules.startingCash;
    g.metrics.raises=(g.metrics.raises??0)+1;
    emit(g,{type:'raiseMoney',player:id,cash:g.rules.startingCash,obligation:g.rules.obligation,lpObligations:p.lpObligations});
    return;
  }
  check(!g.ended && id === currentPlayer(g), "Another investor must decide.");
  check(cmd && typeof cmd.type === "string", "Choose an action.");
  const p = g.players[id];
  switch (g.phase) {
    case "call": {
      if(cmd.type==='changeFounder'){
        check(integer(cmd.company,0,g.companies.length-1)&&lead(g.companies[cmd.company])===id,'Choose a company you lead.');

        g.company=cmd.company;g.phase='founder';break;
      }
      check(cmd.type==="call" && (cmd.company===null || eligibleCompanies(g,id).includes(cmd.company)),"Choose an unowned company or one you lead, or pass.");
      if(cmd.company===null){emit(g,{type:'pass',player:id});beginValueTurn(g,id);break;}

      g.called.push(cmd.company);g.auction={company:cmd.company,host:id,reserve:minimumBid(g.companies[cmd.company],g.rules),bids:[],winner:null,paid:0};
      g.auction.equityController=lead(g.companies[cmd.company]);
      g.auction.equityControl=false;
      g.auction.mode='sealed';g.auction.price=0;
      g.queue=order(g);g.phase="bid";g.metrics.auctions++;break;
    }
    case "intelPlay": {
      check(!g.valueUsed.includes(id),'You already used your value-card opportunity this round.');
      if(cmd.type==='passValue'){
        check(!canDrawIntel(g,id)&&!canExchangeIntel(g,id)&&!p.intel.some(card=>intelTargets(g,id,card.kind).length),'Draw or play a card when possible.');
        g.valueUsed.push(id);delete g.intelOrder;delete g.intelTiming;nextAuction(g);break;
      }
      if(cmd.type==='drawValue'||cmd.type==='exchangeValue'){
        const exchange=cmd.type==='exchangeValue';
        if(exchange){
          check(integer(cmd.card,0,p.intel.length-1),'Choose a card to discard.');
          check(canExchangeIntel(g,id),'No different value card is available to draw.');
        }else{
          check(p.intel.length<MAX_VALUE_HAND,'You may hold at most 3 value cards. Play or exchange a card instead.');
          check(canDrawIntel(g,id),'No value cards left to draw.');
        }
        if(!g.intelDeck.length)g.intelDeck=shuffle(g,g.intelDiscard.splice(0));
        // Draw before discarding so an exchange cannot give back the same card.
        const drawn=g.intelDeck.shift();
        if(exchange){const discarded=p.intel.splice(cmd.card,1)[0];g.intelDiscard.push(discarded);g.metrics.intelExchanges=(g.metrics.intelExchanges??0)+1;emit(g,{type:'intelExchange',player:id,discard:discarded.kind});}
        else emit(g,{type:'intelDraw',player:id});
        p.intel.push(drawn);g.valueUsed.push(id);g.metrics.intelDraws=(g.metrics.intelDraws??0)+1;
        delete g.intelOrder;delete g.intelTiming;nextAuction(g);
        break;
      }
      check(cmd.type==='playIntel'&&integer(cmd.card,0,p.intel.length-1),'Choose one value card to play.');
      const card=p.intel[cmd.card];
      const result={kind:card.kind,player:id,heldCompanies:g.companies.filter(c=>holdings(c,id)>0).map(c=>c.id),company:cmd.company,target:cmd.target,before:g.companies.map(c=>({position:c.position,arrivalOrder:c.arrivalOrder,reserve:c.reserve,supply:c.supply.length,down:c.down,founder:c.founder,shares:holdings(c,id)})),reactions:[]};
      check(playableIntel(g,card)&&intelTargets(g,id,card.kind).includes(cmd.company),'Choose an eligible card and company.');
      const c=g.companies[cmd.company];
      if(['swap','waste','headhunt'].includes(card.kind)||(card.kind==='move'&&cmd.target!=null))check(intelSecondTargets(g,id,card.kind,c.id).includes(cmd.target),'Choose a second eligible company.');
      g.valueResult=result;p.intel.splice(cmd.card,1);g.intelDiscard.push(card);g.valueUsed.push(id);
      g.metrics.intelPlays=(g.metrics.intelPlays??0)+1;emit(g,{type:'intelPlay',player:id,kind:card.kind,company:c.id});
      if(card.kind==='headhunt'){const other=g.companies[cmd.target];[c.founder,other.founder]=[other.founder,c.founder];g.metrics.founderSwaps++;emit(g,{type:'founderSwap',companies:[c.id,other.id],founders:[c.founder,other.founder]});}
      if(['scout','inside','launch'].includes(card.kind)){
        g.lastRevealed=null;const deck=c.supply;
        g.intelScout={player:id,company:c.id,kind:card.kind,cards:clone(card.kind==='inside'?g.removed.filter(card=>!card.burned):deck.slice(0,card.kind==='launch'?2:3))};g.phase='intelScout';break;
      }
            if(card.kind==='bridge'){p.cash-=g.rules.bridgeCost;g.bank.burn+=g.rules.bridgeCost;result.cashChange=-g.rules.bridgeCost;c.reserve++;}
      if(card.kind==='learn'){const cards=c.supply.splice(0,3);g.removed.push(...cards.map(x=>({...x,burned:true})));g.metrics.burned=(g.metrics.burned??0)+cards.length;c.reserve=Math.min(3,c.reserve+1);}
      if(card.kind==='secondary'){
        p.cash-=g.rules.secondaryCost;g.bank.burn+=g.rules.secondaryCost;result.cashChange=-g.rules.secondaryCost;
        c.reserve-=1;c.tokens.push({id:c.tokens.length+1,owner:id,paid:0,boughtLeg:g.leg});c.lastBuy[id]=++g.serial;g.metrics.issued++;
      }
      if(card.kind==='sell'){
        const index=c.tokens.findLastIndex(t=>t.owner===id);c.tokens.splice(index,1);c.tokens.forEach((t,i)=>t.id=i+1);
        if(!holdings(c,id))c.lastBuy[id]=0;
        const payout=g.rules.sellPayouts[g.leg];p.cash+=payout;g.bank.issued+=payout;result.cashChange=payout;
      }
      g.lastRevealed=null;
      let actions=[];
      if(card.kind==='advisor')actions=[{kind:'returnSupply',company:c.id,count:2,intel:true},{kind:'move',company:c.id,amount:1,intel:true}];
      if(card.kind==='recover')actions=[{kind:'move',company:c.id,amount:1,intel:true},...(c.down||c.hiringFumble?[{kind:'repair',company:c.id,source:c.id,intel:true}]:[])];
      if(card.kind==='waste'){c.reserve--;g.companies[cmd.target].reserve++;}
      if(card.kind==='conflict'){p.cash+=g.rules.conflictPayout;g.bank.issued+=g.rules.conflictPayout;result.cashChange=g.rules.conflictPayout;actions=[{kind:'move',company:c.id,amount:-2,intel:true}];}
      if(card.kind==='move')actions=[c.id,...(cmd.target==null?[]:[cmd.target])].map(company=>({kind:'move',company,amount:1,intel:true}));
      if(card.kind==='smear')actions=[{kind:'fumble',company:c.id},{kind:'addSupply',company:c.id,count:3,intel:true}];
      if(card.kind==='back')actions=[{kind:'move',company:c.id,amount:-2,intel:true}];
      if(card.kind==='swap')actions=[{kind:'batch',moves:[{kind:'move',company:c.id,destination:g.companies[cmd.target].position,intel:true},{kind:'move',company:cmd.target,destination:c.position,intel:true}]},{kind:'fumble',company:c.id},{kind:'fumble',company:cmd.target}];
      if(actions.length)resolveIntelActions(g,actions,{player:id,kind:card.kind});
      if(!g.race)advanceIntel(g);break;
    }
    case "intelScout": {
      const peek=g.intelScout,deck=g.companies[peek.company].supply,n=peek.cards.length;
      if(peek.kind==='inside'){
        check(cmd.type==='scoutIntel'&&integer(cmd.choice,0,n-1),'Choose a face-up discard.');
        const selected=peek.cards[cmd.choice],index=g.removed.findIndex(c=>c.id===selected.id&&!c.burned);
        check(index>=0,'Choose an available face-up discard.');
        const {revealed,discarded,burned,paid,...card}=g.removed.splice(index,1)[0];
        const c=g.companies[card.company];c.history=c.history.filter(c=>c.id!==card.id);
        g.pile.push({...card,paid:false,fundingCount:card.fundingCount??Number(!!paid)});g.metrics.entered++;
        g.valueResult.returnedCard=clone(card);g.valueResult.company=card.company;
      }else if(peek.kind==='launch'){
        check(cmd.type==='scoutIntel'&&integer(cmd.choice,0,n-1),'Choose a supply card.');
        g.pile.push(deck.splice(cmd.choice,1)[0]);g.metrics.entered++;
      }else{
        check(cmd.type==='orderIntel'&&Array.isArray(cmd.order)&&cmd.order.length===n&&new Set(cmd.order).size===n&&cmd.order.every(x=>integer(x,0,n-1)),'Arrange every inspected card once, with the bottom card last.');
        const cards=deck.splice(0,n),sorted=cmd.order.map(i=>cards[i]);deck.unshift(...sorted.slice(0,-1));deck.push(sorted.at(-1));
        if(peek.kind==='scout'){
          for(const player of g.players)if(player.intelKnowledge?.company===peek.company)delete player.intelKnowledge;
          p.intelKnowledge={company:peek.company,count:deck.length,top:clone(sorted.slice(0,-1)),bottom:clone(sorted.at(-1))};
        }
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
        g.founderSupply.push(old);
        g.founderMarket[cmd.choice] = g.founderSupply.shift();
        g.metrics.founderSwaps++;
        emit(g, { type: "founder", company: c.id, old, founder: c.founder });
      }
      if(cmd.choice<0&&g.rules.intelMode==='off')g.phase='call';else beginValueTurn(g,id);
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
      if (g.phase === "auctionResult") beginValueTurn(g,g.auction.host);
      else if(g.phase==='phaseResult'){resumePhase(g,resolveCardBase);checkRevealEnd(g);}
      else if(g.phase==='valueResult')nextAuction(g);
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
          g.scores = g.players.map((p) => p.savedCash + p.cash - p.debt - p.fees);
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
function beginValueTurn(g,id){
  if(g.rules.intelMode==='off'){nextAuction(g);return;}
  g.intelOrder=[id];g.intelTiming='turn';delete g.valueResult;
  g.phase='intelPlay';g.queue=[id];g.active=id;
}
function advanceIntel(g){
  const id=g.intelOrder?.[0]??g.active;
  if(g.valueResult&&!g.valueResult.shareholderReactionsDone){
    g.valueResult.shareholderReactionsDone=true;
    const result=g.valueResult,actions=shareholderReactions(g,id,[result.company,...(['move','swap','waste','headhunt'].includes(result.kind)?[result.target]:[])],result.heldCompanies);
    if(actions.length){
      const log=g.lastRevealed?.stage==='intel'?g.lastRevealed.reactions??[]:[];
      resolveIntelActions(g,actions,{player:id,kind:g.valueResult.kind},{log});
      if(g.race)return;
    }
  }
  delete g.intelOrder;delete g.intelTiming;delete g.intelOptional;
  if(g.valueResult){
    const result=g.valueResult;
    result.after=g.companies.map(c=>({position:c.position,arrivalOrder:c.arrivalOrder,reserve:c.reserve,supply:c.supply.length,down:c.down,founder:c.founder,shares:holdings(c,result.player)}));
    result.reactions=g.lastRevealed?.stage==='intel'?clone(g.lastRevealed.reactions??[]):[];
    result.noEffect=!!g.log.findLast(e=>e.type==='intelPlay'&&e.player===result.player)?.noEffect;
    g.lastRevealed={type:'valueResolved',value:clone(result),reactions:result.reactions};
    emit(g,{type:'valueResolved',value:clone(result)});
  }
  g.phase='valueResult';g.queue=[];g.active=id;
}
export function hasTurnAction(g,id){return true;} // Skipping the main action is always allowed.
export function observation(g, id) {
  const v = clone(g);
  v.playerId = id;
  v.discarded=g.removed.filter(card=>!card.burned).map(card=>clone(card));
  if(v.crisisChoice)v.crisisChoice={company:v.crisisChoice.company};
  delete v.intelDeck;delete v.intelDiscard;
  for(const c of v.companies)c.discardCount=g.removed.filter(x=>x.company===c.id&&!x.burned).length;
  for(const p of v.players){p.intelCount=p.intel.length;if(p.id!==id){delete p.intel;delete p.intelKnowledge;}}
  if(v.intelScout?.player!==id)delete v.intelScout;
  v.pileCount = g.pile.length;
  v.poolWeightsAreUpperBounds=!!g.metrics.burned;
  v.poolWeights = g.companies.map(c => g.metrics.burned?growthDeck(c.id).length-c.history.length-c.supply.length:g.pile.filter(card => card.company === c.id).length);

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
    founders.length === FOUNDERS.length &&
      new Set(founders).size === FOUNDERS.length &&
      g.founderMarket.length === 3,
    "Founder conservation failed.",
  );
  check(g.companies.every(c=>integer(c.arrivalOrder,1,Number.MAX_SAFE_INTEGER))&&new Set(g.companies.map(c=>c.arrivalOrder)).size===g.companies.length,"Invalid race arrival order.");
  for (const c of g.companies) {
    check(
      integer(c.position, 0, g.rules.checkpoints.at(-1)) &&
        integer(c.purchased, 0, Number.MAX_SAFE_INTEGER) && integer(c.reserve,0,3) &&
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
        ) && integer(p.lpObligations,0,1e9) && p.locked<=p.cash,
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
