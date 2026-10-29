import {INTEL_MODES,intelDeck,canGetIntel,intelTargets,intelSecondTargets,playableIntel,invested,intelLead} from './intel.js';
import {canHireFounder} from './config.js';
import {canExit,dilution} from './config.js';
import { REVEALS_PER_ROUND } from "./config.js";
import {checkpointReached, podium} from './config.js';
import { recordFounderMovement, resolveIntelActions, resumeCrisis, beginRace, resumeRace, resolveRevealPhase, stopAtIPO } from "./racing.js";
import {
  VERSION, sharePayout, minimumBid, availableCash, fundingPrices, slotCards, reserveCards,
  FOUNDERS,
  RULES,
  growthDeck,
  fixedLP,
  fundedCards, fundingBand,
  companyValue,
  settlementValue,
} from "./config.js";
export const clone = (x) => structuredClone(x);
const check = (ok, message) => {
  if (!ok) throw Error(message);
};
const integer = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
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
    integer(seed, 0, 0xffffffff) && integer(players, 3, 6),
    "Choose 3–6 investors and a whole seed.",
  );
  check(
    Object.keys(rules).every((k) => ["exitMultiplier", "intelMode", "burnPerRound", "moneyScale", "muraMinimum", "wangExit", "catchUp", "purchaseStep", "exitScale", "defaultFee", "purchaseBase", "exitLinear", "exitCurve", "ipoValue", "growthDivisor", "checkpointCount", "costAcceleration", "payoutPlaces", "startingCash", "obligation", "projectPrices", "hedgeFund", "revealsPerRound"].includes(k)),
    "Unknown experimental rule.",
  );
  const r = clone({ ...RULES, ...rules });
  check(Object.hasOwn(INTEL_MODES,r.intelMode), "Invalid intel mode.");
  check(integer(r.burnPerRound,0,10), "Invalid round burn count.");
  check(typeof r.catchUp === "boolean" && integer(r.moneyScale,1,10) && integer(r.muraMinimum,1,1000) && integer(r.wangExit,1,10000), "Invalid catch-up or money scale.");
  check(integer(r.revealsPerRound,1,10), "Invalid reveal count.");
  check(typeof r.hedgeFund === "boolean", "Invalid hedge fund setting.");
  check(integer(r.purchaseBase, 0, 100) && integer(r.purchaseStep, 1, 100) && integer(r.exitScale, 1, 20) && integer(r.defaultFee, 0, 1000), "Invalid economy settings.");
  check(["linear","quadratic"].includes(r.exitCurve),"Invalid exit curve.");
  check(integer(r.exitMultiplier??1,1,10)&&integer(r.startingCash,1,10000)&&integer(r.obligation,0,10000)&&integer(r.payoutPlaces,1,players+2)&&integer(r.costAcceleration,0,20)&&Number.isFinite(r.exitLinear)&&r.exitLinear>=0&&r.exitLinear<=100&&integer(r.ipoValue,1,10000)&&integer(r.growthDivisor,0,100)&&integer(r.checkpointCount,1,players+2),"Invalid race settings.");
  check(Array.isArray(r.projectPrices)&&r.projectPrices.length===3&&r.projectPrices.every(row=>Array.isArray(row)&&row.length===3&&row.every((x,i)=>integer(x,1,1000)&&(!i||x>row[i-1]))),"Invalid funding prices.");
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
  for (const c of g.companies) { g.pile.push(...c.supply.splice(0,1)); g.metrics.entered+=1; }
  shuffle(g,g.pile);
  g.founderMarket = founders.splice(0, 4);
  g.founderSupply = founders;
  g.first = Math.floor(random(g) * players);
  g.active = g.first;
  if(r.intelMode!=="off"){g.intelDeck=shuffle(g,intelDeck(r.intelMode));g.intelDiscard=[];for(const p of g.players)p.intel=g.intelDeck.splice(0,1);}
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
    g.bank.issued += p.lp.cash;
  }
  startCycle(g);
}
export function eligibleCompanies(g,id) {
  return g.companies.filter(c => c.reserve < 3 && c.tokens.length < g.rules.shareLimit && (c.supplyCount ?? c.supply?.length) && (lead(c) === id || lead(c) === null)).map(c=>c.id);
}
function startCycle(g) {
  for (const c of g.companies) {c.flags={};c.revealedCycle=0;c.boughtCycle=0;}
  g.lastRevealed=null;g.founderUsed=[];g.revealMovement=g.companies.map(()=>0);g.revealMoved=g.companies.map(()=>false);g.intelMovementStarted=true;delete g.intelOrder;delete g.afterIntelDone;delete g.catchUpDone;delete g.catchUpResult;
  g.purchaseSummary=[];delete g.poolSize;g.drawsLeft=0;
  g.called=[];g.callOrder=order(g);g.callIndex=0;
  g.metrics.cycles++;emit(g,{type:"cycle"});nextAuction(g);
}
function nextAuction(g) {
  delete g.auction;
  while(g.callIndex < g.callOrder.length) {
    const id=g.callOrder[g.callIndex++];
    if(g.rules.intelMode==="off" && !eligibleCompanies(g,id).length && !g.companies.some(c=>lead(c)===id) && !canGetIntel(g,id)) {emit(g,{type:"pass",player:id});continue;}
    g.phase="call";g.queue=[id];g.active=id;return;
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

  }
  g.queue = [];
  g.active = a.host;
  g.phase = "auctionResult";
  emit(g, { type: "auction", ...a });
}
export function deployReserves(g) {
  for(const c of g.companies)if(c.reserve>0||slotCards(c,0,g.companies)>0){
    const funded=c.reserve>0,fromReserve=c.reserve;
    const cards=c.supply.splice(0,slotCards(c,c.reserve,g.companies)).map(card=>({...card,paid:funded}));
    c.reserve=Math.max(0,c.reserve-1);if(!c.supply.length)c.reserve=0;
    c.purchased+=funded?cards.length:0;c.boughtCycle=cards.length;
    g.pile.push(...cards);g.metrics.purchased+=funded?cards.length:0;g.metrics.entered+=cards.length;
    g.purchaseSummary.push({company:c.id,count:cards.length,spent:0,fromReserve,toReserve:c.reserve});
    emit(g,{type:"deploy",company:c.id,count:cards.length,reserve:c.reserve});
  }
}
function buyGrowth(g) {
  g.revealStartPositions=g.companies.map(c=>c.position);
  deployReserves(g);
  shuffle(g,g.pile);g.drawsLeft=Math.min(g.rules.revealsPerRound,g.pile.length);g.poolSize=g.pile.length;
  g.revealEnded=false;
  g.queue=[];g.active=g.first;g.phase="purchaseResult";
  g.metrics.auctionCards.push({leg:g.leg,cycle:g.cycle,companies:clone(g.purchaseSummary)});
  emit(g,{type:"purchases",companies:g.purchaseSummary,poolSize:g.poolSize,draws:g.drawsLeft});
}
export function resolveCardBase(g, card) {
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
    const founder=g.race?.bonus ?? 0, fumble=!!c.down;
    const printed=card.signature==="breakthrough"?(positions[c.id]<Math.max(...positions)?3:0):card.printed;
    const requested=printed+founder,movement=fumble?0:Math.max(0,requested);
    c.position=Math.min(g.rules.checkpoints.at(-1),c.position+movement);c.down=false;
    event.effect={company:c.id,before:positions[c.id],after:c.position,printed:card.printed,signature:0,founder,multiplier:1,addition:0,fumble,requested};
    c.history.push(clone(card));
    g.removed.push({ ...card, revealed: true });
    g.metrics.revealed++;
    g.metrics.growthMovement += c.position - positions[c.id];
    
    g.metrics.founderBonus += founder;
    if(founder&&!fumble)recordFounderMovement(g,c.founder,Math.max(0,c.position-Math.min(g.rules.checkpoints.at(-1),positions[c.id]+printed)));
    
    g.metrics.fumbles += Number(fumble);
  }
  stopAtIPO(g,card.company);
  if(card.signature&&g.ipoCompany==null)resolveSpecial(g,card,event);
  g.lastRevealed = event;
  emit(g, event);
  return event;
}
function resolveSpecial(g,card,event) {
 const c=g.companies[card.company];
 const add = target => {if(target?.supply.length){g.pile.push(target.supply.shift());g.metrics.entered++;}};
 if(card.signature==="add"){add(c);shuffle(g,g.pile);}
 if(card.signature==="ecosystem") {const last=Math.min(...g.companies.map(x=>x.position));g.companies.filter(x=>x.id!==c.id&&x.position===last).forEach(add);shuffle(g,g.pile);}
 if(card.signature==="swapCard")c.reserve=Math.min(3,c.reserve+1);
 if(card.signature==="discard") {
  const top=Math.max(...g.companies.map(x=>x.position));
  for(const rival of g.companies.filter(x=>x.id!==c.id&&x.position===top)){
   const removed=rival.supply.shift();if(removed){g.removed.push({...removed,burned:true});g.metrics.burned=(g.metrics.burned??0)+1;}
  }
 }
 if(card.signature==="swap") {
  const ahead=g.companies.filter(x=>x.position>c.position&&x.position-c.position<=1);
  const nearest=Math.min(...ahead.map(x=>x.position)),rivals=ahead.filter(x=>x.position===nearest);
  if(rivals.length){const from=c.position;c.position=nearest;
   event.moves=[{company:c.id,before:event.positions[c.id],after:c.position},...rivals.map(rival=>{const before=rival.position;rival.position=from;return {company:rival.id,before,after:from};})];event.effect.after=c.position;
  }
 }
}
export function resolveCard(g, card, {interactive = false} = {}) {
  if(g.ipoCompany!=null)return null;
  const c=g.companies[card.company];
  if(c.down){
    c.history.push(clone(card));g.removed.push({...card,discarded:true});
    g.metrics.wasted++;g.metrics.wastedPaid+=Number(!!card.paid);g.metrics.deferred=(g.metrics.deferred??0)+1;
    emit(g,{type:"deferred",card:clone(card)});
    return beginRace(g,{kind:"deferred",company:card.company,original:card},resolveCardBase,interactive);
  }
  return beginRace(g, card, resolveCardBase, interactive);
}
function drawNext(g) {
  while(g.pile.length&&g.drawsLeft){
    const card=g.pile.shift(),c=g.companies[card.company];
    g.pendingRedraw=!!c.down;
    if(!g.pendingRedraw)g.drawsLeft--;
    resolveCard(g,card,{interactive:true});
    return; // One shown card per click, including a fumble discard.
  }
  g.pendingRedraw=false;
}
function checkRevealEnd(g) {
  if (g.race) return;
  if(g.ipoCompany!=null){
    g.drawsLeft=0;g.pendingRedraw=false;g.revealEnded=true;g.cycleEnd='ipo';
    for(const p of g.players)p.locked=0;
    g.phase='ipoResult';g.queue=[];g.active=g.first;return;
  }
  if(!g.revealEnded&&g.pendingRedraw&&g.pile.length)return;
  if (!g.revealEnded && (!g.drawsLeft || !g.pile.length)) {
    g.phase='afterRevealReady';g.queue=[];g.active=g.first;return;
  }
  if(g.ipoCompany!=null){checkRevealEnd(g);return;}
  if(g.revealEnded&&g.rules.catchUp){g.phase=g.catchUpDone?'catchUpResult':'catchUpReady';g.queue=[];g.active=g.first;return;}
  if (g.revealEnded && (g.companies.some(c=>c.position>=24) || checkpointReached(g))) finishCycle(g,"checkpoint");
  else if (g.revealEnded || !g.drawsLeft || !g.pile.length) finishCycle(g,null);
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
export function burnPile(g) {
 if(g.ipoCompany!=null)return;
 const count=Math.min(g.rules.burnPerRound??0,g.pile.length);
 for(let i=0;i<count;i++){const [card]=g.pile.splice(Math.floor(random(g)*g.pile.length),1);g.removed.push({...card,burned:true});}
 if(count){g.metrics.burned=(g.metrics.burned??0)+count;emit(g,{type:'burn',count});}
}
function finishCycle(g, reason) {
  burnPile(g);
  for(const p of g.players)p.locked=0;
  g.drawsLeft=0;
  g.cycleEnd = reason;
  g.first = (g.first + 1) % g.players.length;
  g.queue = [];
  g.active = g.first;
  g.phase = "cycleResult";
  emit(g, { type: "carry", reason, count: g.pile.length });
}
function beginSettlement(g) {
  g.finalExit = g.companies.some(c=>c.position>=24);
  const winners = podium(g.companies,g.rules.payoutPlaces);
  g.settlement = {
    leg: g.leg,
    reason: g.cycleEnd,
    positions: g.companies.map((c) => c.position),
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
    p.lp = null;
  }
  g.settlements.push(clone(g.settlement));
  g.metrics.legCycles.push(g.cycle);
  g.queue = [];
  g.active = g.first;
  g.phase = "legResult";
  emit(g, { type: "settled", accounts: g.settlement.accounts });
}
export function command(g, id, cmd) {
  check(!g.ended && id === currentPlayer(g), "Another investor must decide.");
  check(cmd && typeof cmd.type === "string", "Choose an action.");
  const p = g.players[id];
  switch (g.phase) {
    case "call": {
      if(cmd.type==='getIntel'){
        check(canGetIntel(g,id),'Choose an available action.');
        beginValueTurn(g,id,false);break;
      }
      if(cmd.type==='changeFounder'){
        check(integer(cmd.company,0,g.companies.length-1)&&lead(g.companies[cmd.company])===id,'Choose a company you lead.');

        g.company=cmd.company;g.phase='founder';break;
      }
      check(cmd.type==="call" && (cmd.company===null || eligibleCompanies(g,id).includes(cmd.company)),"Choose an unowned company or one you lead, or pass.");
      if(cmd.company===null){check(g.rules.intelMode==='off'||!hasTurnAction(g,id),'You must take a legal turn action.');emit(g,{type:"pass",player:id});nextAuction(g);break;}

      g.called.push(cmd.company);g.auction={company:cmd.company,host:id,reserve:minimumBid(g.companies[cmd.company],g.rules),bids:[],winner:null,paid:0};
      g.auction.equityController=lead(g.companies[cmd.company]);
      g.auction.equityControl=false;
      g.queue=order(g);g.phase="bid";g.metrics.auctions++;break;
    }
    case "intelDraft": {
      check(cmd.type==='keepIntel'&&integer(cmd.choice,0,g.intelDraft.cards.length-1),'Choose one private card.');
      const cards=g.intelDraft.cards;p.intel.push(cards[cmd.choice]);g.intelDeck.push(...cards.filter((_,i)=>i!==cmd.choice));
      delete g.intelDraft;g.metrics.intelDraws=(g.metrics.intelDraws??0)+1;emit(g,{type:'intelDraw',player:id});nextAuction(g);break;
    }
    case "intelPlay": {
      if(cmd.type==='keepValue'){
        check(g.intelOptional&&integer(cmd.card,0,p.intel.length-1),'Choose one card to keep.');
        const kept=p.intel[cmd.card];g.intelDeck.push(...p.intel.filter((_,i)=>i!==cmd.card));p.intel=[kept];
        delete g.intelOrder;delete g.intelTiming;delete g.intelOptional;
        emit(g,{type:'valueKept',player:id});nextAuction(g);break;
      }
      check(cmd.type==='playIntel'&&integer(cmd.card,0,p.intel.length-1),'Choose one value card to play.');
      const card=p.intel[cmd.card];
      const result={kind:card.kind,player:id,company:cmd.company,target:cmd.target,before:g.companies.map(c=>({position:c.position,reserve:c.reserve,supply:c.supply.length,down:c.down})),reactions:[]};
      if(!p.intel.some(x=>intelTargets(g,id,x.kind).length)){
        g.valueResult=result;g.lastRevealed=null;g.intelDiscard.push(...p.intel.splice(cmd.card,1));emit(g,{type:'intelPlay',player:id,kind:card.kind,noEffect:true});advanceIntel(g);break;
      }
      check(playableIntel(g,card)&&intelTargets(g,id,card.kind).includes(cmd.company),'Choose an eligible card and company.');
      const c=g.companies[cmd.company];
      if(['swap','move','waste'].includes(card.kind))check(intelSecondTargets(g,id,card.kind,c.id).includes(cmd.target),'Choose a second eligible company.');
      g.valueResult=result;p.intel.splice(cmd.card,1);g.intelDiscard.push(card);
      g.metrics.intelPlays=(g.metrics.intelPlays??0)+1;emit(g,{type:'intelPlay',player:id,kind:card.kind,company:c.id});
      if(['scout','inside','launch'].includes(card.kind)){
        g.lastRevealed=null;const deck=c.supply;
        g.intelScout={player:id,company:c.id,kind:card.kind,cards:clone(deck.slice(0,card.kind==='launch'?2:3))};g.phase='intelScout';break;
      }
            if(card.kind==='bridge'){p.cash-=6;g.bank.burn+=6;c.reserve++;}
      if(card.kind==='learn'){g.removed.push(...c.supply.splice(0,2).map(x=>({...x,burned:true})));c.reserve=Math.min(3,c.reserve+1);}
      g.lastRevealed=null;
      let actions=[];
      if(card.kind==='recover')actions=[{kind:'move',company:c.id,amount:1,intel:true},...(c.down||c.hiringFumble?[{kind:'repair',company:c.id,source:c.id,intel:true}]:[])];
      if(card.kind==='waste'){c.reserve--;g.companies[cmd.target].reserve++;}
      if(card.kind==='conflict'){actions=[{kind:'move',company:c.id,amount:-2,intel:true}];}
      if(card.kind==='move')actions=[c.id,cmd.target].map(company=>({kind:'move',company,amount:1,intel:true}));
      if(card.kind==='smear')actions=[{kind:'fumble',company:c.id}];
      if(card.kind==='back')actions=[{kind:'move',company:c.id,amount:-2,intel:true}];
      if(card.kind==='swap')actions=[{kind:'batch',moves:[{kind:'move',company:c.id,destination:g.companies[cmd.target].position,intel:true},{kind:'move',company:cmd.target,destination:c.position,intel:true}]}];
      if(actions.length)resolveIntelActions(g,actions,{player:id,kind:card.kind});
      if(!g.race)advanceIntel(g);break;
    }
    case "intelScout": {
      const peek=g.intelScout,deck=g.companies[peek.company].supply,n=peek.cards.length;
      if(peek.kind==='launch'){
        check(cmd.type==='scoutIntel'&&integer(cmd.choice,0,n-1),'Choose a supply card.');
        g.pile.push(deck.splice(cmd.choice,1)[0]);g.metrics.entered++;
      }else{
        check(cmd.type==='orderIntel'&&Array.isArray(cmd.order)&&cmd.order.length===n&&new Set(cmd.order).size===n&&cmd.order.every(x=>integer(x,0,n-1)),'Arrange every inspected card once, with the bottom card last.');
        const cards=deck.splice(0,n),sorted=cmd.order.map(i=>cards[i]);deck.unshift(...sorted.slice(0,-1));if(peek.kind==='inside'){g.removed.push({...sorted.at(-1),burned:true});g.metrics.burned=(g.metrics.burned??0)+1;shuffle(g,deck);}else deck.push(sorted.at(-1));
        if(peek.kind==='scout'){
          for(const player of g.players)if(player.intelKnowledge?.company===peek.company)delete player.intelKnowledge;
          p.intelKnowledge={company:peek.company,count:deck.length,top:clone(sorted.slice(0,-1)),bottom:clone(sorted.at(-1))};
        }
      }
      delete g.intelScout;advanceIntel(g);break;
    }
    case "intelCrisis": {
      check(cmd.type==='crisisIntel'&&typeof cmd.play==='boolean','Recover or keep your card.');
      const q=g.crisisChoice;
      if(cmd.play){const index=p.intel.findIndex(c=>c.kind==='recover');check(index>=0,'No crisis card.');
        g.intelDiscard.push(...p.intel.splice(index,1));const c=g.companies[q.company];c.down=false;c.hiringFumble=false;
        g.race.log.push({company:c.id,founder:-1,intel:true,text:'Recovered with Resolve crisis.'});
        g.metrics.intelPlays=(g.metrics.intelPlays??0)+1;emit(g,{type:'intelPlay',player:id,kind:'recover',company:c.id});}
      resumeCrisis(g,resolveCardBase);
      if(g.intelOrder){if(!g.race)advanceIntel(g);}else checkRevealEnd(g);break;
    }
    case "founder": {
      check(
        cmd.type === "founder" && integer(cmd.choice, -1, g.founderMarket.length-1),
        "Keep founder or choose a public replacement.",
      );
      if(g.rules.intelMode!=='off')check(cmd.choice>=0,'Choose a replacement founder to complete your turn.');
      const c = g.companies[g.company];
      if (cmd.choice >= 0) {
        check(canHireFounder(g.founderMarket[cmd.choice],g.leg), "Jerry cannot be hired on the third leg.");
        const old = c.founder;
        c.founder = g.founderMarket[cmd.choice];
        c.down = true;
        c.hiringFumble = true;
        g.founderSupply.push(old);
        g.founderMarket[cmd.choice] = g.founderSupply.shift();
        g.metrics.founderSwaps++;
        emit(g, { type: "founder", company: c.id, old, founder: c.founder });
      }
      if(g.intelOrder){if(cmd.choice>=0)resolveIntelActions(g,[{kind:'crisisOffer',company:c.id}]);if(!g.race)advanceIntel(g);}else if(cmd.choice<0&&g.rules.intelMode==='off')g.phase='call';else beginValueTurn(g,id,true);
      break;
    }
    case "bid": {
      check(
        cmd.type === "bid" && (cmd.amount === 0 || integer(cmd.amount, g.auction.reserve, availableCash(p))),
        "Bid a whole affordable amount, or zero to pass.",
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
            integer(cmd.amount, g.auction.price + 1, availableCash(p))),
        "Raise the open price by at least 1, or withdraw.",
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
      if (g.phase === "auctionResult") beginValueTurn(g,g.auction.host,true);
      else if(g.phase==='valueResult')nextAuction(g);
      else if(g.phase==='ipoResult')beginSettlement(g);
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
function beginValueTurn(g,id,optional){
  if(g.rules.intelMode==='off'){nextAuction(g);return;}
  if(!g.intelDeck.length)g.intelDeck=shuffle(g,g.intelDiscard.splice(0));
  check(g.players[id].intel.length<2&&g.intelDeck.length,'A value card must be available.');
  g.players[id].intel.push(g.intelDeck.shift());g.metrics.intelDraws=(g.metrics.intelDraws??0)+1;
  g.intelOrder=[id];g.intelTiming='turn';g.intelOptional=optional;delete g.valueResult;
  g.phase='intelPlay';g.queue=[id];g.active=id;emit(g,{type:'intelDraw',player:id});
}
function advanceIntel(g){
  const id=g.intelOrder?.[0]??g.active;
  delete g.intelOrder;delete g.intelTiming;delete g.intelOptional;
  if(g.valueResult){
    const result=g.valueResult;
    result.after=g.companies.map(c=>({position:c.position,reserve:c.reserve,supply:c.supply.length,down:c.down}));
    result.reactions=g.lastRevealed?.stage==='intel'?clone(g.lastRevealed.reactions??[]):[];
    result.noEffect=!!g.log.findLast(e=>e.type==='intelPlay'&&e.player===result.player)?.noEffect;
    g.lastRevealed={type:'valueResolved',value:clone(result),reactions:result.reactions};
    emit(g,{type:'valueResolved',value:clone(result)});
  }
  if(g.ipoCompany!=null){checkRevealEnd(g);return;}
  g.phase='valueResult';g.queue=[];g.active=id;
}
export function hasTurnAction(g,id){return canGetIntel(g,id)||eligibleCompanies(g,id).length>0||g.companies.some(c=>lead(c)===id);}
export function observation(g, id) {
  const v = clone(g);
  v.playerId = id;
  if(v.crisisChoice)v.crisisChoice={company:v.crisisChoice.company};
  delete v.intelDeck;delete v.intelDiscard;
  for(const c of v.companies)c.discardCount=g.removed.filter(x=>x.company===c.id&&!x.burned).length;
  for(const p of v.players){p.intelCount=p.intel.length;if(p.id!==id){delete p.intel;delete p.intelKnowledge;}}
  if(v.intelDraft?.player!==id)delete v.intelDraft;
  if(v.intelScout?.player!==id)delete v.intelScout;
  v.pileCount = g.pile.length;
  v.poolWeightsAreUpperBounds=!!g.metrics.burned;
  v.poolWeights = g.companies.map(c => g.metrics.burned?growthDeck(c.id).length-c.history.length-c.supply.length:g.pile.filter(card => card.company === c.id).length);

  if(g.race?.card?.kind==="growth")v.reviewCard=clone(g.race.card);
  v.removedCount = g.removed.length;

  for (const key of [
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
    const cards=[...g.intelDeck,...g.intelDiscard,...g.players.flatMap(p=>p.intel),...(g.intelDraft?.cards??[])];
    check(cards.length===intelDeck().length&&new Set(cards.map(c=>c.id)).size===intelDeck().length,'Intel conservation failed.');
    check(g.players.every(p=>p.intel.length<=2),'Intel hand limit exceeded.');
  }
  const growth = [
    ...g.companies.flatMap((c) => c.supply),
    ...g.pile.filter((c) => c.kind === "growth"),
    ...g.removed,
    ...(g.race && !g.race.revealed && g.race.card.kind === "growth" ? [g.race.card] : []),
  ];
  check(
    growth.length === g.companies.reduce((n,c)=>n+growthDeck(c.id).length,0) &&
      new Set(growth.map((c) => c.id)).size === growth.length,
    "Growth conservation failed.",
  );
  check(growth.filter(c => c.paid).length === g.metrics.purchased, "Paid growth conservation failed.");
  const founders = [
    ...g.founderSupply,
    ...g.founderMarket,
    ...g.companies.map((c) => c.founder),
  ];
  check(
    founders.length === FOUNDERS.length &&
      new Set(founders).size === FOUNDERS.length &&
      g.founderMarket.length === 4,
    "Founder conservation failed.",
  );
  for (const c of g.companies) {
    check(
      integer(c.position, 0, g.rules.checkpoints.at(-1)) &&
        integer(c.purchased, 0, growthDeck(c.id).length) && integer(c.reserve,0,3) &&
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
          integer(n, 0, 1e9),
        ) && p.locked<=p.cash,
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
