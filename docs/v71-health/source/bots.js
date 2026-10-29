import {intelSecondTargets,intelTargets,intelValue,expectedIntelValue,bestIntelPlay} from './intel.js';
import {canHireFounder} from './config.js';
import {canExit,dilution} from './config.js';
import {INVESTMENT_RISK_DISCOUNT} from "./config.js";
import {portfolioWealth} from './valuation.js';
import {resolveRevealPhase,resolveIntelActions,shareholderReactions} from './racing.js';
import {adaptiveBid, investmentCeiling, opponentBids} from "./adaptive.js";
import {choosePower} from "./racing.js";
import { sharePayout, availableCash, minimumBid, settlementValue, fundedCards, fundingPrices, fundingBand, growthDeck, checkpointReached, podium } from "./config.js";
import {
  observation,
  currentPlayer,
  holdings,
  lead,
  eligibleCompanies,
  deployReserves,
  resolveCard,
  clone,
} from "./engine.js";
const avg = (a) => a.reduce((s, n) => s + n, 0) / Math.max(1, a.length);
function randomFor(v, salt = 0) {
  let n =
    (v.cycle * 1301 +
      v.leg * 10007 +
      v.playerId * 71 +
      (v.auction?.company ?? 0) * 431 +
      salt +
      1) >>>
    0;
  return () => {
    n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0;
    return n / 4294967296;
  };
}
const mix = (a, random) => {
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Forecasts sample public compositions and plausible future funding, never hidden deck order.
// Estimate future issuance from observed successful auctions, not an assumed auction every turn.
export function fundingRate(view) {
 const history=view.auctionHistory??[];
 if(!history.length)return .25;
 return Math.max(.1,Math.min(.5,history.filter(a=>a.winner!==null).length/(Math.max(1,view.metrics.cycles)*view.players.length)));
}
export function forecasts(game,id=currentPlayer(game),{samples=20, auctionOutcome=null, blindDeck=false, blindFounders=false, fundingDelay=0}={}) {
 const v=game.playerId===id?game:observation(game,id),rand=randomFor({...v,auction:null}),rows=v.companies.map(()=>[]);
 for(let sample=0;sample<samples;sample++) {
  const w={rules:v.rules,leg:v.leg,first:v.first,players:v.players,companies:clone(v.companies),removed:[],pile:[],fast:true,metrics:{purchased:0,entered:0,wasted:0,wastedPaid:0,revealed:0,growthMovement:0,founderBonus:0,fumbles:0}};
  const pile=[],paths=w.companies.map(()=>[]),wholePaths=w.companies.map(()=>[]);
  const available=w.companies.map(c=>{
   const seen=new Set(c.history.map(x=>x.id));
   const note=!blindDeck&&v.players[id].intelKnowledge?.company===c.id&&v.players[id].intelKnowledge.count===c.supplyCount?v.players[id].intelKnowledge:null;
   const known=note?[...note.top,note.bottom]:[],knownIds=new Set(known.map(x=>x.id));
   const unseen=mix((blindDeck?growthDeck(c.id).map(x=>({...x,printed:2,effect:undefined,signature:false})):growthDeck(c.id)).filter(x=>!seen.has(x.id)&&!knownIds.has(x.id)),rand);
   pile.push(...unseen.splice(0,v.poolWeights[c.id]));
   c.supply=note?[...clone(note.top),...unseen.slice(0,c.supplyCount-known.length),clone(note.bottom)]:unseen.slice(0,c.supplyCount);return c.supply;
  });
  if(v.poolWeightsAreUpperBounds){mix(pile,rand);pile.splice(0,Math.max(0,pile.length-v.pileCount));}
  if(blindFounders)w.companies.forEach(c=>c.founder=-1);
  w.pile=pile;
  const cash=v.players.map(p=>p.cash),futureSpending=v.players.map(()=>0);
  if(auctionOutcome?.winner!=null){
   const c=w.companies[v.auction.company];c.tokens.push({owner:auctionOutcome.winner});c.lastBuy[auctionOutcome.winner]=Math.max(0,...c.lastBuy)+1;
   c.reserve=Math.min(3,(c.reserve??0)+fundedCards(fundingBand(c.position),auctionOutcome.paid,v.rules));
   cash[auctionOutcome.winner]-=auctionOutcome.paid;
  }
  // shortcut: estimate future shareholder plays from public history; simulate full card choices if this biases Melania valuations.
  const valuePlayRate=Math.min(.95,(2+(v.metrics.intelPlays??0))/(4+Math.max(0,v.metrics.cycles-1)*v.players.length));
  const initialShares=w.companies.map(c=>v.players.map(p=>c.tokens.filter(t=>t.owner===p.id).length));
  let endLeg=2, elapsedRounds=0;
  for(let leg=v.leg;leg<3;leg++){
   w.leg=leg;

   // At settlement the first prices are already public and locked.
   const locked=leg===v.leg&&v.phase==='settle';
   if(!locked)for(let cycle=0;cycle<v.rules.maxCycles;cycle++) {
    w.founderUsed=[];
    elapsedRounds++;
    // Funding is an action; every funded company deploys automatically afterward.
    const candidates=w.companies.filter(c=>available[c.id].length&&c.tokens.length<w.rules.shareLimit);
    for(const player of mix([...v.players],rand)) {
     const raise=mix(candidates.filter(c=>c.reserve<3&&(lead(c)===player.id||lead(c)===null)&&!(leg===v.leg&&cycle===0&&(v.called?.includes(c.id)||c.id===v.auction?.company))),rand)[0];
     if(raise&&elapsedRounds>fundingDelay&&rand()<fundingRate(v)){
       const minimum=minimumBid(raise,v.rules),buyers=v.players.filter(p=>cash[p.id]>=minimum);
       if(!buyers.length)continue;
       const owner=buyers[Math.floor(rand()*buyers.length)].id;
       const useful=fundingPrices(fundingBand(raise.position),v.rules)[2-raise.reserve];
       const pay=Math.floor(Math.min(cash[owner],Math.max(minimum,useful)));
       raise.reserve=Math.min(3,raise.reserve+fundedCards(fundingBand(raise.position),pay,v.rules));
       cash[owner]-=pay;futureSpending[owner]+=pay;
       raise.tokens.push({owner});raise.lastBuy[owner]=cycle+100;
     }
    }
    for(const c of w.companies) {
     c.revealedCycle=0;c.boughtCycle=0;

    }
    if(v.rules.intelMode!=='off'&&w.companies.some(c=>c.founder===17))for(const player of v.players){
      if(rand()<valuePlayRate)resolveIntelActions(w,shareholderReactions(w,player.id),null,{interactive:false});
      if(w.ipoCompany!=null)break;
    }
    if(w.ipoCompany!=null)break;
    w.pile=pile;w.purchaseSummary=[];deployReserves(w);mix(pile,rand);resolveRevealPhase(w,'start');
    for(let draw=0;draw<v.rules.revealsPerRound&&pile.length&&w.ipoCompany==null;){const card=pile.shift();resolveCard(w,card);if(!w.lastRevealed?.deferred)draw++;}
    resolveRevealPhase(w,'end');resolveRevealPhase(w,'catchUp');if(w.ipoCompany==null){mix(pile,rand);pile.splice(0,Math.min(w.rules.burnPerRound??0,pile.length));}
    if(w.companies.some(c=>c.position>=24)||checkpointReached(w)||!pile.length&&candidates.length===0)break;
   }
   w.companies.forEach((c,i)=>{wholePaths[i].push(settlementValue(c,w.companies,v.rules));paths[i].push(locked?v.settlement.prices[i]:sharePayout(settlementValue(c,w.companies,v.rules),dilution(c),v.rules));});
   if(w.companies.some(c=>c.position>=24)||!pile.length&&w.companies.every(c=>!c.supply.length||c.tokens.length>=w.rules.shareLimit)){endLeg=leg;break;}
  }
  const top=podium(w.companies,v.rules.payoutPlaces);
  w.companies.forEach((c,i)=>rows[i].push({roundsToExit:elapsedRounds,path:paths[i],whole:wholePaths[i][0],position:c.position,endLeg,futureSpending:[...futureSpending],futureShares:v.players.map(p=>c.tokens.filter(t=>t.owner===p.id).length-initialShares[i][p.id]),finalShares:c.tokens.length,final:canExit(c,top,w.companies)?sharePayout(settlementValue(c,w.companies,v.rules),dilution(c),v.rules):0}));
 }
 return rows.map((a,company)=>{
  const legPrices=Array.from({length:3-v.leg},(_,l)=>a.map(x=>x.path[l]??x.path.at(-1))),legMeans=legPrices.map(avg);
  const retained=a.map(x=>x.final),expected=avg(retained),risk=Math.sqrt(avg(retained.map(x=>(x-expected)**2)));
  return{roundsToExit:a.map(x=>x.roundsToExit),futureSpending:v.players.map(p=>a.map(x=>x.futureSpending[p.id])),futureShares:v.players.map(p=>a.map(x=>x.futureShares[p.id])),expectedFinalShares:avg(a.map(x=>x.finalShares)),finalPrices:retained,endLegs:a.map(x=>x.endLeg),company,expected,risk,value:Math.max(0,expected-INVESTMENT_RISK_DISCOUNT*risk),position:avg(a.map(x=>x.position)),whole:avg(a.map(x=>x.whole)),prices:legPrices[0],legPrices,legMeans};
 });
}
// An exit many rounds away is less reliable than one supported by cards already funded.
// Discount only projected proceeds, leaving current cash and future costs fully charged.
function timelyWealth(v,id,values,sample) {
 const discount=Math.pow(.95,values[0].roundsToExit?.[sample]??0);
 const proceeds=v.companies.reduce((sum,c)=>sum+(holdings(c,id)+(values[c.id].futureShares?.[id]?.[sample]??0))*values[c.id].finalPrices[sample],0);
 return portfolioWealth(v,id,values,sample)-(1-discount)*proceeds;
}
// Evaluate the whole portfolio together: correlated outcomes and LP shortfalls matter.
function portfolioOutcomes(v,id,values) {
 return values[0].prices.map((_, sample) => timelyWealth(v,id,values,sample)-0.2*v.players.filter(p=>p.id!==id).reduce((sum,p)=>sum+timelyWealth(v,p.id,values,sample),0)/(v.players.length-1));
}
function portfolioUtility(v, id, values) {
  const outcomes=portfolioOutcomes(v,id,values);
  const mean = avg(outcomes);
  return mean - 0.25 * Math.sqrt(avg(outcomes.map(n => (n - mean) ** 2)));
}
// Comparing many founders can select Monte Carlo noise. Require a credible gain
// over keeping the current founder, including the recovery card and lost funding turn.
function founderImprovement(v,id,baseline,next) {
 const base=portfolioOutcomes(v,id,baseline),diff=portfolioOutcomes(v,id,next).map((x,i)=>x-base[i]),mean=avg(diff);
 const uncertainty=diff.length>1?2*Math.sqrt(avg(diff.map(x=>(x-mean)**2))/(diff.length-1)):0;
 return portfolioUtility(v,id,next)-portfolioUtility(v,id,baseline)-uncertainty;
}
export function botCommand(
  game,
  id = currentPlayer(game),
  { samples = 20, policy = "normal", disabledIntel=[] } = {},
) {
  const v = game.playerId === id ? game : observation(game, id),
    p = {...v.players[id],cash:availableCash(v.players[id])};
  if(v.phase==='intelDraft'){
    const scores=v.intelDraft.cards.map(card=>Math.max(card.kind==='recover'?.45:0,...intelTargets(v,id,card.kind).map(cid=>intelValue(v,id,card.kind,cid))));
    return {type:'keepIntel',choice:scores.indexOf(Math.max(...scores))};
  }
  if(v.phase==='intelPlay'){const best=bestIntelPlay(v,id);if(v.intelOptional&&best.value<=0){const preferred=['recover','move','bridge','launch','inside','swap','waste','learn','smear','conflict'];return {type:'keepValue',card:p.intel.map(c=>preferred.indexOf(c.kind)).indexOf(Math.min(...p.intel.map(c=>preferred.indexOf(c.kind))))};}if(policy==='randomValue'){const options=[];for(const [card,item] of p.intel.entries())for(const company of intelTargets(v,id,item.kind)){const targets=intelSecondTargets(v,id,item.kind,company);for(const target of targets.length?targets:[undefined])options.push({type:'playIntel',card,company,target});}return options.length?options[Math.floor(randomFor(v,135)()*options.length)]:{type:'playIntel',card:0};}return {type:'playIntel',card:Math.max(0,best.card),company:best.company,target:best.target};}
  if(v.phase==='intelCrisis')return {type:'crisisIntel',play:policy!=='noIntel'&&!disabledIntel.includes('recover')};
  if(v.phase==='intelScout'){
    const scores=v.intelScout.cards.map(card=>{const c=v.companies[card.company],own=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),value=card.effect==='fumble'?(c.founder===11?2:-3):card.effect==='setback'?-1:card.printed+(card.signature?.5:0);return value*(v.intelScout.kind==='inside'?own-.3*(1-own):1);});
    if(v.intelScout.kind==='launch')return {type:'scoutIntel',choice:scores.indexOf(Math.max(...scores))};
    const order=scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);return {type:'orderIntel',order};
  }
  if (v.phase === "power") return {type:"power",choice:policy==="randomPower"?Math.floor(randomFor(v,83)()*v.powerChoice.options.length):choosePower(v)};
  const options={samples,blindDeck:policy==="blindDeck",blindFounders:policy==="blindFounders"};
  if(v.phase==="call") {
    if(policy==="passive"&&v.rules.intelMode==="off")return {type:"call",company:null};
    const ids=eligibleCompanies(v,id);
    if(policy==="randomCall"&&v.rules.intelMode==="off"){
      const actions=[...ids.map(company=>({type:"call",company})),{type:"call",company:null}];
      return actions[Math.floor(randomFor(v,52)()*actions.length)];
    }
    const actionOptions={...options,fundingDelay:2};
    const fs=forecasts(v,id,actionOptions),base=portfolioUtility(v,id,fs);
    let best={gain:0,command:{type:"call",company:null}};
    for(const cid of ids){
     const c=v.companies[cid],scenario=clone(v);
     scenario.auction={company:cid,host:id,reserve:minimumBid(c,v.rules)};
     const cache=new Map();
     const projected=(winner,paid)=>{const key=`${winner}:${paid}`;if(!cache.has(key))cache.set(key,forecasts(scenario,id,{...actionOptions,auctionOutcome:{winner,paid}}));return cache.get(key);};
     const ownBid=Math.min(availableCash(p),investmentCeiling(scenario,id,fs,projected));
     const sampled=opponentBids(v,id,cid,fs[cid].expected,randomFor(v,52+cid),24);
     // Use public bidding history instead of assuming every rival bids our valuation.
     const offers=v.players.map(player=>{const bids=sampled.map(row=>row[player.id]).sort((a,b)=>a-b);return {id:player.id,bid:player.id===id?ownBid:bids[Math.floor(bids.length/2)]};}).filter(p=>p.bid>=minimumBid(c,v.rules)).sort((a,b)=>b.bid-a.bid||Number(b.id===id)-Number(a.id===id));
     if(!offers.length)continue;
     const winner=offers[0].id,paid=offers[1]?.bid??offers[0].bid;
     const future=projected(winner,paid);
     // The auction scenario already includes dilution; value the purchased share and payment too.
     scenario.companies[cid].tokens.push({owner:winner});
     scenario.players[winner].cash-=paid;
     const gain=portfolioUtility(scenario,id,future)-base;
     if(gain>best.gain)best={gain,command:{type:"call",company:cid}};
    }
    const led=v.companies.filter(c=>lead(c)===id);
    if(v.rules.intelMode==="off"&&policy==="randomFounder"&&led.length&&randomFor(v,87)()<.5)return{type:"changeFounder",company:led[Math.floor(randomFor(v,88)()*led.length)].id};
    if(policy!=="noFounder"&&policy!=="blindFounders")for(const c of led)for(const founder of v.founderMarket){
     if(!canHireFounder(founder,v.leg))continue;
     const scenario=clone(v);scenario.companies[c.id].founder=founder;scenario.companies[c.id].down=true;scenario.companies[c.id].hiringFumble=true;
     const gain=founderImprovement(scenario,id,fs,forecasts(scenario,id,actionOptions));
     if(gain>Math.max(.8*(v.rules.moneyScale??1),best.gain))best={gain,command:{type:"changeFounder",company:c.id}};
    }
    if(v.rules.intelMode!=='off'){
      const helpGain=expectedIntelValue(v,id)*3;
      if(policy==='randomActions'){const actions=[{type:'getIntel'},...ids.map(company=>({type:'call',company})),...led.map(c=>({type:'changeFounder',company:c.id}))];return actions[Math.floor(randomFor(v,134)()*actions.length)];}
      if(best.command.company===null||helpGain>best.gain)return {type:'getIntel'};
    }
    return best.command;
  }

  if (v.phase === "founder") {
    if (policy === "randomFounder" || policy === "adaptiveRandomFounder" || policy === "randomChoices")
      {const choices=v.founderMarket.map((f,i)=>canHireFounder(f,v.leg)?i:-1).filter(i=>i>=0);return {type:'founder',choice:choices.length?choices[Math.floor(randomFor(v,v.company+41)()*choices.length)]:-1};}
    const c = v.companies[v.company];
    const scores = [c.founder, ...v.founderMarket].map(founder => {
      if(v.rules.intelMode!=="off"&&founder===c.founder)return -Infinity;
      if(founder!==c.founder&&!canHireFounder(founder,v.leg))return -Infinity;
      const scenario = clone(v);
      scenario.companies[c.id].founder = founder;
      if(founder!==c.founder){scenario.companies[c.id].down=true;scenario.companies[c.id].hiringFumble=true;}
      
      return portfolioUtility(scenario, id, forecasts(scenario, id, {...options,fundingDelay:2}));
    });
    return { type: "founder", choice: scores.indexOf(Math.max(...scores))-1 };
  }
  if (v.phase === "bid" || v.phase === "tie") {
    if (policy === "passive" || (policy === "concentrated" && v.auction.company !== (id % v.companies.length)))
      return { type: v.phase === "bid" ? "bid" : "tie", amount: 0 };
    const a = v.auction,
      c = v.companies[a.company],
      projected = forecasts(v, id, options);
    if (policy === "allIn" || policy === "concentrated")
      return {
        type: v.phase === "bid" ? "bid" : "tie",
        amount: v.phase === "bid" ? (p.cash>=a.reserve?p.cash:0) : p.cash > a.price ? p.cash : 0,
      };
    if(policy==="randomBid"){const amount=Math.floor(randomFor(v,957)()*(p.cash+1));return{type:v.phase,amount:v.phase==="bid"&&amount>=a.reserve?amount:0};}
    // Payment changes remaining financing capacity even after treasury is full.
    const cache=new Map();
    const outcomeForecast=(winner,paid)=>{const key=`${winner}:${paid}`;
      if(!cache.has(key))cache.set(key,forecasts(v,id,{...options,auctionOutcome:{winner,paid}}));return cache.get(key);};
    if(v.phase==='bid')return {type:'bid',amount:adaptiveBid(v,id,projected,randomFor(v,917),outcomeForecast)};
    if(v.phase==='tie'){
      const ceiling=investmentCeiling(v,id,projected,outcomeForecast);
      return {type:'tie',amount:a.price+1<=ceiling?a.price+1:0};
    }
  }
  if (v.phase === "settle") return {type:"sell",shares:v.companies.map(c=>holdings(c,id))};
  if (v.phase === "reveal") return { type: "reveal" };
  return { type: "continue" };
}
