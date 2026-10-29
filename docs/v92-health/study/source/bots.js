import {discardValue,canDrawIntel,canExchangeIntel,intelSecondTargets,intelTargets,intelValue,bestIntelPlay} from './intel.js';
import {canHireFounder} from './config.js';
import {canExit,dilution} from './config.js';
import {INVESTMENT_RISK_DISCOUNT} from "./config.js";
import {portfolioWealth,portfolioOptions} from './valuation.js';
import {resolveSharePurchase,resolveRevealPhase,resolveIntelActions,shareholderReactions} from './racing.js';
import {adaptiveBid, investmentCeiling, opponentBids, fundingNeed} from "./adaptive.js";
import {choosePower} from "./racing.js";
import { slotCards,currencyUnit,floorMoney,sharePayout, availableCash, minimumBid, settlementValue, fundedCards, fundingPrices, fundingBand, growthDeck, checkpointReached, podium } from "./config.js";
import {
  observation,
  currentPlayer,
  holdings,
  lead,
  eligibleCompanies,
  deployReserves,
  resolveCard,
  returnGrowthCards,burnPile,
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
  const w={rules:v.rules,leg:v.leg,first:v.first,players:v.players,companies:clone(v.companies),ipoCompany:v.ipoCompany,returningCards:clone(v.returningCards??[]),removed:clone(v.discarded??[]),pile:[],fast:true,metrics:{purchased:0,entered:0,wasted:0,wastedPaid:0,revealed:0,growthMovement:0,founderBonus:0,fumbles:0}};
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
  w.pile=pile;w.founderUsed=clone(v.founderUsed??[]);
  const cash=v.players.map(p=>p.cash),futureSpending=v.players.map(()=>0);
  if(auctionOutcome?.winner!=null){
   const c=w.companies[v.auction.company];c.tokens.push({owner:auctionOutcome.winner});c.lastBuy[auctionOutcome.winner]=Math.max(0,...c.lastBuy)+1;
   c.reserve=Math.min(3,(c.reserve??0)+fundedCards(fundingBand(c.position),auctionOutcome.paid,v.rules));
   cash[auctionOutcome.winner]-=auctionOutcome.paid;
   resolveSharePurchase(w,c.id,auctionOutcome.winner);
  }
  const initialShares=w.companies.map(c=>v.players.map(p=>c.tokens.filter(t=>t.owner===p.id).length));
  let endLeg=2, elapsedRounds=0;
  for(let leg=v.leg;leg<3;leg++){
   w.leg=leg;

   // At settlement the first prices are already public and locked.
   const locked=leg===v.leg&&v.phase==='settle';
   if(!locked)for(let cycle=0;cycle<v.rules.maxCycles;cycle++) {
    if(leg!==v.leg||cycle>0)w.founderUsed=[];
    elapsedRounds++;
    // Funding is an action; every funded company deploys automatically afterward.
    const candidates=w.companies.filter(c=>available[c.id].length&&c.tokens.length<w.rules.shareLimit);
    for(const player of mix([...v.players],rand)) {
     const forecastView={...v,companies:w.companies,poolWeights:w.companies.map(c=>pile.filter(card=>card.company===c.id).length),poolWeightsAreUpperBounds:false};
     const raise=mix(candidates.filter(c=>fundingNeed(forecastView,c.id)>0&&c.reserve<3&&(lead(c)===player.id||lead(c)===null)&&!(leg===v.leg&&cycle===0&&(v.called?.includes(c.id)||c.id===v.auction?.company))),rand)[0];
     if(raise&&elapsedRounds>fundingDelay&&rand()<fundingRate(v)){
       const minimum=minimumBid(raise,v.rules),buyers=v.players.filter(p=>cash[p.id]>=minimum);
       if(!buyers.length)continue;
       const owner=buyers[Math.floor(rand()*buyers.length)].id;
       const slots=Math.min(3-raise.reserve,Math.max(1,Math.ceil(fundingNeed(forecastView,raise.id)/2)));
       const useful=fundingPrices(fundingBand(raise.position),v.rules)[slots-1];
       const pay=floorMoney(Math.min(cash[owner],Math.max(minimum,useful)),v.rules);
       raise.reserve=Math.min(3,raise.reserve+fundedCards(fundingBand(raise.position),pay,v.rules));
       cash[owner]-=pay;futureSpending[owner]+=pay;
       raise.tokens.push({owner});raise.lastBuy[owner]=cycle+100;
       resolveSharePurchase(w,raise.id,owner);
     }
    }
    for(const c of w.companies) {
     c.revealedCycle=0;c.boughtCycle=0;

    }
    if(v.rules.intelMode!=='off'&&w.companies.some(c=>c.founder===17))for(const player of v.players){
      w.harryUsed=[];
      // Forecast a played card about every other turn, targeting one of that player's holdings.
      const portfolio=w.companies.filter(c=>c.tokens.some(t=>t.owner===player.id));
      if(portfolio.length&&rand()<.5&&!(leg===v.leg&&cycle===0&&v.valueUsed?.includes(player.id))){
        const target=portfolio[Math.floor(rand()*portfolio.length)].id;
        resolveIntelActions(w,shareholderReactions(w,player.id,[target]),null,{interactive:false});
      }
    }
    w.pile=pile;w.founderUsed=clone(v.founderUsed??[]);w.purchaseSummary=[];deployReserves(w);w.burnEligible=pile.map(card=>card.id);mix(pile,rand);resolveRevealPhase(w,'start');
    for(let draw=0;draw<v.rules.revealsPerRound&&pile.length;){const card=pile.shift();resolveCard(w,card);if(!w.lastRevealed?.deferred)draw++;}
    returnGrowthCards(w);burnPile(w,rand);resolveRevealPhase(w,'end');resolveRevealPhase(w,'catchUp');
    if(w.ipoCompany!=null||checkpointReached(w)||!pile.length&&candidates.length===0)break;
   }
   w.companies.forEach((c,i)=>{wholePaths[i].push(settlementValue(c,w.companies,v.rules));paths[i].push(locked?v.settlement.prices[i]:sharePayout(settlementValue(c,w.companies,v.rules),dilution(c),v.rules));});
   if(w.ipoCompany!=null||!pile.length&&w.companies.every(c=>!c.supply.length||c.tokens.length>=w.rules.shareLimit)){endLeg=leg;break;}
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
  return mean - 0.25 * Math.sqrt(avg(outcomes.map(n => (n - mean) ** 2)))+portfolioOptions(v,id);
}
// Comparing many founders can select Monte Carlo noise. Require a credible gain
// over keeping the current founder, including the lost funding turn.
function founderImprovement(v,id,baseline,next) {
 const base=portfolioOutcomes(v,id,baseline),diff=portfolioOutcomes(v,id,next).map((x,i)=>x-base[i]),mean=avg(diff);
 const uncertainty=diff.length>1?2*Math.sqrt(avg(diff.map(x=>(x-mean)**2))/(diff.length-1)):0;
 return portfolioUtility(v,id,next)-portfolioUtility(v,id,baseline)-uncertainty;
}
// Price the marginal exit proceeds forgone, including the dilution released to remaining shares.
export function saleValue(v,id,cid,values) {
 const c=v.companies[cid],held=holdings(c,id),denom=dilution(c);
 const price=avg(values[cid].finalPrices);
 const loss=denom>1?price*(denom-held)/(denom-1):price;
 const options=held===1?portfolioOptions(v,id)-portfolioOptions({...v,companies:v.companies.map(x=>x.id===cid?{...x,tokens:x.tokens.filter(t=>t.owner!==id)}:x)},id):0;
 return (v.rules.sellPayouts[v.leg]-loss-options)/3;
}
export function secondaryValue(v,id,cid,values) {
 const c=v.companies[cid],row=values[cid],denom=Math.max(1,row.expectedFinalShares);
 const held=holdings(c,id)+avg(row.futureShares?.[id]??[]);
 const gain=avg(row.finalPrices)*Math.max(0,denom-held)/(denom+1);
 const runway=Math.min(slotCards(c,c.reserve),c.supplyCount??c.supply?.length??0)*.35;
 return (gain-v.rules.secondaryCost)/3-runway;
}
export function botCommand(
  game,
  id = currentPlayer(game),
  { samples = 20, policy = "normal", disabledIntel=[] } = {},
) {
  const v = game.playerId === id ? game : observation(game, id),
    p = {...v.players[id],cash:availableCash(v.players[id])};
  if(v.phase==='intelPlay'){
    const values=p.intel.some(card=>['sell','secondary'].includes(card.kind)&&intelTargets(v,id,card.kind).length)?forecasts(v,id,{samples}):null;
    const swapScores=new Map();let swapBaseline;
    const scoreCard=(kind,cid,target)=>{
      if(kind==='headhunt'&&target!==undefined){
        const key=[cid,target].sort().join(':');
        if(!swapScores.has(key)){
          swapBaseline??=portfolioUtility(v,id,forecasts(v,id,{samples}));
          const scenario=clone(v);[scenario.companies[cid].founder,scenario.companies[target].founder]=[scenario.companies[target].founder,scenario.companies[cid].founder];
          swapScores.set(key,portfolioUtility(scenario,id,forecasts(scenario,id,{samples}))-swapBaseline);
        }
        return swapScores.get(key);
      }
      if(kind==='sell')return saleValue(v,id,cid,values);
      if(kind==='secondary')return secondaryValue(v,id,cid,values);
      return intelValue(v,id,kind,cid);
    };
    const best=bestIntelPlay(v,id,scoreCard);
    const canDraw=canDrawIntel(v,id);
    if(canDraw&&policy!=='randomValue'&&(policy==='noIntel'||best.card<0||best.value<=.8))return {type:'drawValue'};
    const canExchange=canExchangeIntel(v,id);
    if(!canDraw&&canExchange&&policy!=='randomValue'&&(best.card<0||best.value<=.8)){
      const scores=p.intel.map(card=>Math.max(-1,...intelTargets(v,id,card.kind).map(cid=>scoreCard(card.kind,cid))));
      return {type:'exchangeValue',card:scores.indexOf(Math.min(...scores))};
    }
    if(!canDraw&&!canExchange&&best.card<0)return {type:'passValue'};
    if(policy==='randomValue'){
      const options=canDraw?[{type:'drawValue'}]:[];
      if(canExchange)options.push(...p.intel.map((_,card)=>({type:'exchangeValue',card})));
      for(const [card,item] of p.intel.entries())for(const company of intelTargets(v,id,item.kind)){
        const targets=intelSecondTargets(v,id,item.kind,company);
        for(const target of item.kind==='move'?[undefined,...targets]:targets.length?targets:[undefined])options.push({type:'playIntel',card,company,target});
      }
      return options[Math.floor(randomFor(v,135)()*options.length)];
    }
    return {type:'playIntel',card:best.card,company:best.company,target:best.target};
  }
  if(v.phase==='intelScout'){
    const scores=v.intelScout.cards.map(card=>{if(v.intelScout.kind==='inside')return discardValue(v,id,card);const c=v.companies[card.company],own=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),value=card.effect==='fumble'?(c.founder===11?2:-3):card.effect==='setback'?-1:card.printed+(card.signature?.5:0);return value*(v.intelScout.kind==='inside'?own-.3*(1-own):1);});
    if(['launch','inside'].includes(v.intelScout.kind))return {type:'scoutIntel',choice:scores.indexOf(Math.max(...scores))};
    const order=scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);return {type:'orderIntel',order};
  }
  if (v.phase === "power") return {type:"power",choice:policy==="randomPower"?Math.floor(randomFor(v,83)()*v.powerChoice.options.length):choosePower(v)};
  const options={samples,blindDeck:policy==="blindDeck",blindFounders:policy==="blindFounders"};
  if(v.phase==="call") {
    if(policy==="passive"&&v.rules.intelMode==="off")return {type:"call",company:null};
    const ids=eligibleCompanies(v,id);
    if(policy==="randomCall"){
      const actions=[...ids.map(company=>({type:"call",company})),...v.companies.filter(c=>lead(c)===id).map(c=>({type:"changeFounder",company:c.id})),{type:"call",company:null}];
      return actions[Math.floor(randomFor(v,52)()*actions.length)];
    }
    const actionOptions={...options,fundingDelay:2};
    const fs=forecasts(v,id,actionOptions),base=portfolioUtility(v,id,fs);
    let best={gain:0,command:{type:"call",company:null}};
    for(const cid of ids){
     const c=v.companies[cid],scenario=clone(v);
     if(lead(c)===id&&fundingNeed(v,cid)===0)continue;
     scenario.auction={company:cid,host:id,reserve:minimumBid(c,v.rules)};
     const cache=new Map();
     const projected=(winner,paid)=>{const key=`${winner}:${paid}`;if(!cache.has(key))cache.set(key,forecasts(scenario,id,{...actionOptions,auctionOutcome:{winner,paid}}));return cache.get(key);};
     const ownBid=Math.min(availableCash(p),investmentCeiling(scenario,id,fs,projected));
     const sampled=opponentBids(v,id,cid,fs[cid].expected,randomFor(v,52+cid),24);
     // Use public bidding history instead of assuming every rival bids our valuation.
     const offers=v.players.map(player=>{const bids=sampled.map(row=>row[player.id]).sort((a,b)=>a-b);return {id:player.id,bid:player.id===id?ownBid:bids[Math.floor(bids.length/2)]};}).filter(p=>p.bid>=minimumBid(c,v.rules)).sort((a,b)=>b.bid-a.bid||Number(b.id===id)-Number(a.id===id));
     // Borrow only when liquidity blocks a profitable purchase; price in the $5 financing loss.
     if(availableCash(p)<v.rules.projectPrices[0][2]&&(c.supplyCount??c.supply?.length??0)>0){
      const funded=clone(v);funded.auction={company:cid,host:id,reserve:minimumBid(c,v.rules)};
      funded.players[id].cash+=v.rules.startingCash;funded.players[id].obligation+=v.rules.obligation;
      const bid=investmentCeiling(funded,id,fs,projected);
      const rivals=offers.filter(o=>o.id!==id).sort((a,b)=>b.bid-a.bid);
      const price=rivals[0]?.bid??minimumBid(c,v.rules);
      if(bid>=Math.max(minimumBid(c,v.rules),price)){
       funded.players[id].cash-=price;funded.companies[cid].tokens.push({owner:id});
       const borrowingGain=(portfolioUtility(funded,id,projected(id,price))-base);
       if(borrowingGain>best.gain)best={gain:borrowingGain,command:{type:'raiseMoney'}};
      }
     }
     if(!offers.length)continue;
     let winner=offers[0].id,paid=offers[1]?.bid??offers[0].bid;
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
     const scenario=clone(v);scenario.companies[c.id].founder=founder;
     const gain=founderImprovement(scenario,id,fs,forecasts(scenario,id,actionOptions));
     if(gain>Math.max(.8*(v.rules.moneyScale??1),best.gain))best={gain,command:{type:"changeFounder",company:c.id}};
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
    if(policy==="randomBid"){const minimum=v.phase==="bid"?a.reserve:Math.max(a.reserve,a.price+currencyUnit(v.rules)),amount=floorMoney(randomFor(v,957)()*(p.cash+currencyUnit(v.rules)),v.rules);return{type:v.phase,amount:amount>=minimum?amount:0};}
    // Payment changes remaining financing capacity even after treasury is full.
    const cache=new Map();
    const outcomeForecast=(winner,paid)=>{const key=`${winner}:${paid}`;
      if(!cache.has(key))cache.set(key,forecasts(v,id,{...options,auctionOutcome:{winner,paid}}));return cache.get(key);};
    if(v.phase==='bid'){
      const normal=adaptiveBid(v,id,projected,randomFor(v,917),outcomeForecast,true);
      // Borrow only when the added liquidity improves this bid after the LP premium.
      if(p.cash<v.rules.ipoValue&&!v.finalExit){
        const funded=clone(v);funded.players[id].cash+=v.rules.startingCash;funded.players[id].obligation+=v.rules.obligation;
        const fundedBase=forecasts(funded,id,options),fundedCache=new Map();
        const fundedOutcome=(winner,paid)=>{const key=`${winner}:${paid}`;if(!fundedCache.has(key))fundedCache.set(key,forecasts(funded,id,{...options,auctionOutcome:{winner,paid}}));return fundedCache.get(key);};
        const borrowed=adaptiveBid(funded,id,fundedBase,randomFor(v,917),fundedOutcome,true);
        if(borrowed.amount>p.cash&&borrowed.value>normal.value+.5)return {type:'raiseMoney'};
      }
      return {type:'bid',amount:normal.amount};
    }
    if(v.phase==='tie'){
      const ceiling=investmentCeiling(v,id,projected,outcomeForecast);
      if(a.price+currencyUnit(v.rules)>p.cash&&!v.finalExit){
        const funded=clone(v),pay=a.price+currencyUnit(v.rules);funded.players[id].cash+=v.rules.startingCash;funded.players[id].obligation+=v.rules.obligation;
        if(pay<=availableCash(funded.players[id])){
          const future=forecasts(funded,id,{...options,auctionOutcome:{winner:id,paid:pay}});
          funded.players[id].cash-=pay;funded.companies[c.id].tokens.push({owner:id});
          if(portfolioUtility(funded,id,future)>portfolioUtility(v,id,projected)+.5)return {type:'raiseMoney'};
        }
      }
      return {type:'tie',amount:a.price+currencyUnit(v.rules)<=ceiling?a.price+currencyUnit(v.rules):0};
    }
  }
  if (v.phase === "settle") return {type:"sell",shares:v.companies.map(c=>holdings(c,id))};
  if (v.phase === "reveal") return { type: "reveal" };
  return { type: "continue" };
}
