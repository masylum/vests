import {CAPITAL_CASH,CAPITAL_DEDUCTION,FUNDING_DIVISOR} from './config.js';
import {resolvedCard,sampledGame} from './bot-scenarios.js';
import {NEW_CARDS,expansionChoices} from './card-expansion.js';
import {INTEL_CARDS,expectedIntelValue,discardValue,canDrawIntel,canExchangeIntel,intelSecondTargets,intelTargets,intelValue,bestIntelPlay} from './intel.js';
import {nativeRollouts,setNativeBackend,nativeForecastAvailable,nativeForecastStats} from './native-forecast.js';
export {nativeForecastAvailable,nativeForecastStats};
export function setForecastBackend(value){setNativeBackend(value);clearForecastCache();}
import {canHireFounder} from './config.js';
import {canExit,dilution} from './config.js';
import {INVESTMENT_RISK_DISCOUNT} from "./config.js";
import {portfolioWealth,portfolioOptions,portfolioSamples,riskUtility,optionHorizon} from './valuation.js';
import {resolveSharePurchase,resolveRevealPhase,resolveIntelActions,shareholderReactions} from './racing.js';
import {adaptiveBid, investmentCeiling, opponentBids, fundingNeed} from "./adaptive.js";
import {choosePower} from "./racing.js";
import { slotCards,currencyUnit,floorMoney,sharePayout, availableCash, minimumBid, settlementValue, fundedCards, fundingPrices, fundingBand, growthDeck, checkpointReached, ipoFinisher, podium } from "./config.js";
import {
  observation,
  currentPlayer,
  holdings,
  lead,
  eligibleCompanies, hasTurnAction, canDrawEmptyHand,
  deployReserves,
  resolveCard,
  returnGrowthCards, burnPile,
  clone,
} from "./engine.js";
const avg = (a) => a.reduce((s, n) => s + n, 0) / Math.max(1, a.length);
// Content keys survive in-place game updates; only public forecast inputs enter
// this bounded worker-local cache. Callers never receive a cached mutable object.
const forecastCache=new Map(),forecastCacheLimit=256,preparations=new Map();
let cacheHits=0,cacheMisses=0,decisionKeys=null;
export function forecastCacheStats(){return {hits:cacheHits,misses:cacheMisses,size:forecastCache.size,limit:forecastCacheLimit};}
export function clearForecastCache(){forecastCache.clear();preparations.clear();cacheHits=cacheMisses=0;}
function forecastKey(v,id,options){
 const kind=JSON.stringify([id,options[0],...options.slice(2,7)]);
 let entries=decisionKeys?.get(v),base=entries?.get(kind);
 if(!base){
  base=JSON.stringify([id,[options[0],...options.slice(2,7)],v.rules,v.cycle,v.leg,v.first,v.players,v.companies,v.ipoCompany,v.returningCards,v.discarded,v.publicBurns,v.revealedDestroyed,v.poolWeights,v.poolWeightsAreUpperBounds,v.pileCount,v.founderUsed,v.stefanUsed,v.reidUsed,v.harryUsed,v.danUsed,v.julieUsed,v.valueUsed,v.called,v.auction?[v.auction.company,v.auction.host,v.auction.mode]:null,v.phase==='settle'?v.settlement?.prices:null,v.metrics.cycles,v.auctionHistory]);
  if(decisionKeys){if(!entries){entries=new Map();decisionKeys.set(v,entries);}entries.set(kind,base);}
 }
 return {base,key:base+'|'+JSON.stringify([options[1],options[7]??0])};
}

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
function forecastResult(game,id=currentPlayer(game),{samples=20, auctionOutcome=null, blindDeck=false, blindFounders=false, fundingDelay=0,cache=true,sampler='legacy',sampleStart=0,sampleMask=0}={}) {
 if(!Number.isInteger(samples)||samples<1||!['legacy','independent'].includes(sampler)||!Number.isInteger(sampleStart)||sampleStart<0||sampleMask&&(!Number.isInteger(sampleMask)||sampleMask<0||samples>30||sampleMask>2**samples-1||sampler!=='independent'))throw Error('Invalid forecast sample selection.');
 const v=game.playerId===id?game:observation(game,id);
 const keys=cache?forecastKey(v,id,[samples,auctionOutcome?.winner!=null?auctionOutcome:null,blindDeck,blindFounders,fundingDelay,sampler,sampleStart,sampleMask]):null;
 const key=keys?.key;
 if(cache&&forecastCache.has(key)){
  cacheHits++;const result=forecastCache.get(key);forecastCache.delete(key);forecastCache.set(key,result);return result;
 }
 cacheMisses++;
 let rand=randomFor({...v,auction:null});const rows=v.companies.map(()=>[]);
 const rate=fundingRate(v);
 let decks=keys&&preparations.get(keys.base);
 if(!decks){decks=v.companies.map(c=>{
  const seen=new Set([...c.history,...(v.publicBurns??[]),...(v.revealedDestroyed??[])].map(x=>x.id));
  const note=!blindDeck&&v.players[id].intelKnowledge?.company===c.id&&v.players[id].intelKnowledge.count===c.supplyCount?v.players[id].intelKnowledge:null;
  const known=note?[...note.top,...(note.bottom?[note.bottom]:[])]:[],knownIds=new Set(known.map(x=>x.id));
  const unseen=(blindDeck?growthDeck(c.id).map(x=>({...x,printed:2,effect:undefined,signature:false})):growthDeck(c.id)).filter(x=>!seen.has(x.id)&&!knownIds.has(x.id));
  return {note:clone(note),known:clone(known),unseen};
 });if(keys){preparations.set(keys.base,decks);if(preparations.size>128)preparations.delete(preparations.keys().next().value);}}
 const accelerated=!decks.some(d=>d.note&&!d.note.bottom)&&!['underwritten','tender','public','rights'].includes(v.auction?.mode)&&nativeRollouts({...v,companies:v.companies.map(c=>({...c,forecastSlots:[1,2,3].map(slot=>slotCards(c,slot))}))},id,{samples,auctionOutcome,blindFounders,fundingDelay,rate,sampler,sampleStart,sampleMask,preparationKey:keys?.base},decks);
 if(accelerated){if(cache){forecastCache.set(key,accelerated);if(forecastCache.size>forecastCacheLimit)forecastCache.delete(forecastCache.keys().next().value);}return accelerated;}
 for(let sample=0;sample<samples;sample++) {
  if(sampleMask&&!(sampleMask&(1<<sample)))continue;
  if(sampler==='independent')rand=randomFor({...v,auction:null},Math.imul(sample+sampleStart,0x9e3779b9));
  // Historical card records are immutable during search; copy their arrays,
  // while independently copying every mutable company field.
  const companies=v.companies.map(c=>({...c,tokens:c.tokens.map(t=>({...t})),lastBuy:[...c.lastBuy],history:[...c.history],flags:{...c.flags}}));
  const w={rules:v.rules,leg:v.leg,first:v.first,players:clone(v.players),companies,ipoCompany:v.ipoCompany,returningCards:clone(v.returningCards??[]),removed:clone(v.discarded??[]),pile:[],fast:true,forecast:true,forecastOwners:[],metrics:{purchased:0,entered:0,wasted:0,wastedPaid:0,revealed:0,growthMovement:0,founderBonus:0,fumbles:0}};
  // Visible rival hand counts matter for Anya; sample anonymous fuel, never private identities.
  for(const p of w.players)if(!p.intel)p.intel=Array.from({length:p.intelCount??0},(_,i)=>({id:`forecast:${p.id}:${i}`,kind:'unknown'}));
  const pile=[],paths=w.companies.map(()=>[]),wholePaths=w.companies.map(()=>[]);
  const available=w.companies.map(c=>{
   const {note,known}=decks[c.id],unseen=mix(decks[c.id].unseen.map(card=>({...card})),rand);
   pile.push(...unseen.splice(0,v.poolWeights[c.id]));
   c.supply=note?[...clone(note.top),...unseen.slice(0,c.supplyCount-known.length),...(note.bottom?[clone(note.bottom)]:[])]:unseen.slice(0,c.supplyCount);return c.supply;
  });
  if(v.poolWeightsAreUpperBounds){mix(pile,rand);pile.splice(0,Math.max(0,pile.length-v.pileCount));}
  if(blindFounders)w.companies.forEach(c=>c.founder=-1);
  w.pile=pile;w.founderUsed=clone(v.founderUsed??[]);
  const capital=v.players.map(p=>p.capital??0),cash=v.players.map(p=>p.cash),futureSpending=v.players.map(()=>0);
  if(auctionOutcome?.winner!=null){
   const c=w.companies[v.auction.company],existing=holdings(c,auctionOutcome.winner)>0,previousLead=lead(c);delete c.mandate;c.tokens.push({owner:auctionOutcome.winner});c.lastBuy[auctionOutcome.winner]=Math.max(0,...c.lastBuy)+1;
   pile.push(...c.supply.splice(0,fundedCards(fundingBand(c.position),auctionOutcome.paid,v.rules)));
   if(v.auction.mode==='underwritten'&&auctionOutcome.winner!==v.auction.host)pile.push(...c.supply.splice(0,2));
   cash[auctionOutcome.winner]-=auctionOutcome.paid;
   resolveSharePurchase(w,c.id,auctionOutcome.winner,{auction:true,existing,previousLead});
  }
  if(['underwritten','tender','public','rights'].includes(v.auction?.mode)){const actions=shareholderReactions(w,v.auction.host,[v.auction.company]);if(actions.length)resolveIntelActions(w,actions,null,{interactive:false});}
  const initialShares=w.companies.map(c=>v.players.map(p=>c.tokens.filter(t=>t.owner===p.id).length));
  let endLeg=2, elapsedRounds=0;
  for(let leg=v.leg;leg<3;leg++){
   w.leg=leg;

   // At settlement the first prices are already public and locked.
   const locked=leg===v.leg&&v.phase==='settle';
   if(!locked)for(let cycle=0;cycle<v.rules.maxCycles;cycle++) {
    const currentRound=leg===v.leg&&cycle===0;
    w.founderUsed=currentRound?clone(v.founderUsed??[]):[];
    w.harryUsed=currentRound?clone(v.harryUsed??[]):[];
    elapsedRounds++;
    // Funding is an action; every funded company deploys automatically afterward.
    const candidates=w.companies.filter(c=>available[c.id].length&&c.tokens.length<w.rules.shareLimit);
    let forecastView,needs;
    const need=cid=>{
     if(!forecastView){
      const weights=w.companies.map(()=>0);for(const card of pile)weights[card.company]++;
      forecastView={companies:w.companies,poolWeights:weights,poolWeightsAreUpperBounds:false};needs=[];
     }
     return needs[cid]??=fundingNeed(forecastView,cid);
    };
    for(const player of mix([...v.players],rand)) {
     // Future capital increases liquidity and its exit deduction equally.
     if(cash[player.id]<10&&capital[player.id]<6){cash[player.id]+=CAPITAL_CASH;capital[player.id]++;futureSpending[player.id]+=CAPITAL_DEDUCTION-CAPITAL_CASH;}
     const raise=mix(candidates.filter(c=>(lead(c)===null||lead(c)===player.id)&&need(c.id)>0&&c.tokens.length<w.rules.shareLimit),rand)[0];
     if(raise&&elapsedRounds>fundingDelay&&rand()<rate){
       const minimum=minimumBid(raise,v.rules),buyers=v.players.filter(p=>cash[p.id]>=minimum);
       if(!buyers.length)continue;
       const owner=buyers[Math.floor(rand()*buyers.length)].id;
       const useful=Math.ceil(need(raise.id))*FUNDING_DIVISOR;
       const pay=floorMoney(Math.min(cash[owner],Math.max(minimum,useful)),v.rules);
       pile.push(...raise.supply.splice(0,fundedCards(fundingBand(raise.position),pay,v.rules)));
       cash[owner]-=pay;futureSpending[owner]+=pay;
       const existing=holdings(raise,owner)>0,previousLead=lead(raise);delete raise.mandate;raise.tokens.push({owner});raise.lastBuy[owner]=cycle+100;
       w.forecastOwners=[];
       resolveSharePurchase(w,raise.id,owner,{auction:true,existing,previousLead});
       forecastView=needs=null;
     }
    }
    for(const c of w.companies) {
     c.revealedCycle=0;c.boughtCycle=0;

    }
    if(v.rules.intelMode!=='off'&&w.companies.some(c=>c.founder===17))for(const player of v.players){
      // Forecast a played card about every other turn, targeting one of that player's holdings.
      const portfolio=w.companies.filter(c=>c.tokens.some(t=>t.owner===player.id));
      if(portfolio.length&&rand()<.5&&!(leg===v.leg&&cycle===0&&v.valueUsed?.includes(player.id))){
        const target=portfolio[Math.floor(rand()*portfolio.length)].id;
        resolveIntelActions(w,shareholderReactions(w,player.id,[target]),null,{interactive:false});
      }
    }
    w.players.forEach(p=>p.cash=cash[p.id]);w.forecastSpending=w.players.map(()=>0);
    w.pile=pile;w.purchaseSummary=[];deployReserves(w);mix(pile,rand);resolveRevealPhase(w,'start');mix(pile,rand);
    for(let draw=0;draw<v.rules.revealsPerRound&&pile.length;draw++){const card=pile.shift();resolveCard(w,card);}
    burnPile(w,rand);returnGrowthCards(w);resolveRevealPhase(w,'end');resolveRevealPhase(w,'catchUp');
    w.players.forEach(p=>{const cost=w.forecastSpending[p.id]??0;cash[p.id]-=cost;futureSpending[p.id]+=cost;});w.ipoCompany=ipoFinisher(w);
    if(w.ipoCompany!=null||checkpointReached(w)||!pile.length&&candidates.length===0)break;
   }
   w.companies.forEach((c,i)=>{wholePaths[i].push(settlementValue(c,w.companies,v.rules));paths[i].push(locked?v.settlement.prices[i]:sharePayout(settlementValue(c,w.companies,v.rules),dilution(c),v.rules));});
   if(w.ipoCompany!=null||!pile.length&&w.companies.every(c=>!c.supply.length||c.tokens.length>=w.rules.shareLimit)){endLeg=leg;break;}
  }
  const top=podium(w.companies,v.rules.payoutPlaces);
  w.companies.forEach((c,i)=>rows[i].push({roundsToExit:elapsedRounds,path:paths[i],whole:wholePaths[i][0],position:c.position,endLeg,futureSpending:[...futureSpending],futureShares:v.players.map(p=>c.tokens.filter(t=>t.owner===p.id).length-initialShares[i][p.id]),finalShares:c.tokens.length,final:canExit(c,top,w.companies)?sharePayout(settlementValue(c,w.companies,v.rules),dilution(c),v.rules):0}));
 }
 const result=rows.map((a,company)=>{
  const legPrices=Array.from({length:3-v.leg},(_,l)=>a.map(x=>x.path[l]??x.path.at(-1))),legMeans=legPrices.map(avg);
  const retained=a.map(x=>x.final),expected=avg(retained),risk=Math.sqrt(avg(retained.map(x=>(x-expected)**2)));
  return{roundsToExit:a.map(x=>x.roundsToExit),futureSpending:v.players.map(p=>a.map(x=>x.futureSpending[p.id])),futureShares:v.players.map(p=>a.map(x=>x.futureShares[p.id])),expectedFinalShares:avg(a.map(x=>x.finalShares)),finalPrices:retained,endLegs:a.map(x=>x.endLeg),company,expected,risk,value:Math.max(0,expected-INVESTMENT_RISK_DISCOUNT*risk),position:avg(a.map(x=>x.position)),whole:avg(a.map(x=>x.whole)),prices:legPrices[0],legPrices,legMeans};
 });
 if(sampleMask){
  const indices=Array.from({length:samples},(_,i)=>i).filter(i=>sampleMask&(1<<i));
  const scatter=a=>{const out=new Array(samples);indices.forEach((index,i)=>out[index]=a[i]);return out;};
  for(const r of result){r.roundsToExit=scatter(r.roundsToExit);r.futureSpending=r.futureSpending.map(scatter);r.futureShares=r.futureShares.map(scatter);r.finalPrices=scatter(r.finalPrices);r.endLegs=scatter(r.endLegs);r.legPrices=r.legPrices.map(scatter);r.prices=r.legPrices[0];}
 }
 if(cache){forecastCache.set(key,result);if(forecastCache.size>forecastCacheLimit)forecastCache.delete(forecastCache.keys().next().value);}
 return result;
}
// Public results remain independently mutable; bot search reads private results.
export function forecasts(game,id=currentPlayer(game),options={}){return clone(forecastResult(game,id,options));}
const portfolioOutcomes=(v,id,values)=>portfolioSamples(v,id,values);
export function portfolioUtility(v,id,values){return riskUtility(portfolioOutcomes(v,id,values));}
function capitalActionValue(v,id,forecast,options,baseline){if(v.players[id].capital>=6)return -Infinity;const s=clone(v);s.players[id].cash+=CAPITAL_CASH;s.players[id].capital++;return (portfolioUtility(s,id,forecast(s,id,options))-portfolioUtility(v,id,baseline??forecast(v,id,options)))/3;}

// Comparing many founders can select Monte Carlo noise. Require a credible gain
// over keeping the current founder, including the lost funding turn.
function founderImprovement(v,id,baseline,next) {
 // Common random samples compare keeping versus hiring directly. A separate
 // one-standard-error penalty reduces selection of noisy solo hires.
 const before=portfolioOutcomes(v,id,baseline),diffs=portfolioOutcomes(v,id,next).map((x,i)=>x-before[i]),mean=avg(diffs);
 return portfolioUtility(v,id,next)-portfolioUtility(v,id,baseline)-Math.sqrt(avg(diffs.map(x=>(x-mean)**2))/Math.max(1,diffs.length-1));
}
// Price the marginal exit proceeds forgone, including the dilution released to remaining shares.
export function saleValue(v,id,cid,values) {
 const c=v.companies[cid],held=holdings(c,id),denom=dilution(c);
 if(held===1&&(v.turnHires??[]).includes(cid))return -Infinity;
 const price=avg(values[cid].finalPrices);
 const loss=price; // The bank retains the sold share, so dilution does not change.
 const options=held===1?portfolioOptions(v,id)-portfolioOptions({...v,companies:v.companies.map(x=>x.id===cid?{...x,tokens:x.tokens.filter(t=>t.owner!==id)}:x)},id):0;
 return (v.rules.sellPayouts[fundingBand(c.position)]-loss-options)/3;
}
export function secondaryValue(v,id,cid,values) {
 const c=v.companies[cid],row=values[cid],denom=Math.max(1,row.expectedFinalShares);
 const held=holdings(c,id)+avg(row.futureShares?.[id]??[]);
 const gain=avg(row.finalPrices)*Math.max(0,denom-held)/(denom+1);
 const runway=Math.min(slotCards(c,c.reserve),c.supplyCount??c.supply?.length??0)*.35;
 return (gain-v.rules.secondaryCost)/3-runway;
}
// Full valuations use every sample. Auction utility can request just the
// independent sample it reads, without simulating seven unused continuations.
function auctionForecasts(forecast,view,id,options,sampler){
 const complete=new Map(),partial=new Map();
 const get=(winner,paid,sample)=>{
  const key=`${winner}:${paid}`;
  if(complete.has(key))return complete.get(key);
  if(sample!==undefined&&partial.has(key))return partial.get(key);
  const values=forecast(view,id,{...options,auctionOutcome:{winner,paid}});complete.set(key,values);return values;
 };
 if(sampler==='independent'&&options.samples<=30)get.prepare=requests=>{
  for(const {winner,paid,mask} of requests){
   const key=`${winner}:${paid}`;if(complete.has(key))continue;
   const all=mask===2**options.samples-1;
   const values=forecast(view,id,{...options,sampleMask:all?0:mask,auctionOutcome:{winner,paid}});
   (all?complete:partial).set(key,values);
  }
 };
 return get;
}
// Public-state lookahead for choices whose value depends on ownership or hiring.
export function cardScenario(v,id,kind,cid,target,extra={}) {
 const s=clone(v),c=s.companies[cid];
 const change=company=>{delete company.mandate;company.lastBuy[id]=Math.max(0,...company.lastBuy)+1;};
 if(kind==='transfer'){
  c.tokens.splice(c.tokens.findIndex(t=>t.owner===id),1);delete c.mandate;
  if(!holdings(c,id))c.lastBuy[id]=0;
  const dest=s.companies[target];dest.tokens.push({owner:id});change(dest);
 }
 if(kind==='stake'){
  const price=[6,12,18][fundingBand(c.position)];s.players[id].cash-=price;s.players[extra.seller].cash+=price;
  c.tokens.find(t=>t.owner===extra.seller).owner=id;change(c);
  if(!holdings(c,extra.seller))c.lastBuy[extra.seller]=0;
 }
 if(kind==='mandate'){s.players[id].cash-=2;c.mandate=id;}
 if(kind==='session'){c.founder=s.founderMarket[extra.founder];c.hiringFumble=true;}
 if(kind==='coup')c.mandate=id;
 if(kind==='headhunt')[c.founder,s.companies[target].founder]=[s.companies[target].founder,c.founder];
 // Resolve movement, fumble chains and shareholder reactions through the rules helpers.
 s.forecast=true;s.forecastOwners=[];s.metrics={...s.metrics};
 const actions=['coup','session'].includes(kind)?[{kind:'fumble',company:cid}]:kind==='swap'?[{kind:'batch',moves:[{kind:'move',company:cid,destination:s.companies[target].position},{kind:'move',company:target,destination:c.position}]}]:[];
 actions.push(...shareholderReactions(s,id,[cid,target].filter(x=>x>=0),v.companies.filter(x=>holdings(x,id)>0).map(x=>x.id)));
 if(actions.length)resolveIntelActions(s,actions,null,{interactive:false});
 return s;
}

function founderPlans(v,id,forecast,options){
 const baseline=forecast(v,id,options),plans=[],swapOpportunity=new Map();
 for(const c of v.companies.filter(c=>lead(c)===id&&!(v.turnHires??[]).includes(c.id)))for(const [choice,founder] of v.founderMarket.entries()){
  if(!canHireFounder(founder,v.leg))continue;
  const s=clone(v);s.companies[c.id].founder=founder;
  s.forecast=true;s.forecastOwners=[];s.metrics={...s.metrics};
  let gain=founderImprovement(s,id,baseline,forecast(s,id,options))/3;
  // A hire on a led company can supply a founder to a larger non-led holding.
  if((v.actionsLeft??1)>1&&v.players[id].intel.some(x=>x.kind==='headhunt'))for(const target of intelSecondTargets(v,id,'headhunt',c.id)){
   const key=`${c.id}:${target}`;
   if(!swapOpportunity.has(key)){const alone=resolvedCard(v,id,'headhunt',c.id,target);swapOpportunity.set(key,Math.max(0,(portfolioUtility(alone,id,forecast(alone,id,options))-portfolioUtility(v,id,baseline))/3));}
   const combined=resolvedCard(s,id,'headhunt',c.id,target);
   gain=Math.max(gain,(portfolioUtility(combined,id,forecast(combined,id,options))-portfolioUtility(v,id,baseline))/3-swapOpportunity.get(key));
  }
  plans.push({company:c.id,founder,choice,gain});
 }
 return plans;
}

// Control has concrete value when it unlocks a profitable hire with the next action.
function hireFollowup(v,id,forecast,options){
 if((v.actionsLeft??1)<2)return 0;
 const alternative=Math.max(0,...v.players[id].intel.flatMap(card=>intelTargets(v,id,card.kind).map(cid=>intelValue(v,id,card.kind,cid))));
 return Math.max(0,...founderPlans({...v,actionsLeft:v.actionsLeft-1},id,forecast,options).map(x=>x.gain-alternative));
}
export function weekendGain(actions,actionsLeft=1,cash=Infinity){
 // Search order matters: capital can fund a later action. Unique keys prevent
 // replaying cards, while explicit prerequisites permit successive capital calls.
 const list=actions.map((x,i)=>typeof x==='number'?{value:x,key:i,cost:0,companies:[]}:x).filter(x=>Number.isFinite(x.value)&&(x.value>0||(x.cashDelta??0)>0));
 function best(slots){
  let result=0;
  function visit(left,money,value,keys,companies){
   result=Math.max(result,value);if(!left)return;
   for(const a of list){
    const consumed=a.keys??[a.key];
    if((a.cost??0)>money||consumed.some(key=>keys.has(key))||(a.requires??[]).some(key=>!keys.has(key))||(a.companies??[]).some(c=>companies.has(c)))continue;
    visit(left-1,money-(a.cost??0)+(a.cashDelta??0),value+a.value,new Set([...keys,...consumed]),new Set([...companies,...(a.companies??[])]));
   }
  }
  visit(slots,cash,0,new Set(),new Set());return result;
 }
 return best(actionsLeft+1)-best(actionsLeft);
}
function plannedCard(v,id,forecast,options,score=(kind,cid,target)=>intelValue(v,id,kind,cid,target)){
 const special=new Set(Object.keys(INTEL_CARDS));
 const best=bestIntelPlay(v,id,(kind,cid,target)=>special.has(kind)?-Infinity:score(kind,cid,target));
 const candidates=[],cardValues=v.players[id].intel.map(item=>special.has(item.kind)?0:Math.max(0,...intelTargets(v,id,item.kind).flatMap(cid=>item.kind==='focused'?intelSecondTargets(v,id,item.kind,cid).map(target=>score(item.kind,cid,target)):[score(item.kind,cid)])));let baseline,base,controlBaseline;
 const init=()=>{baseline??=forecast(v,id,options);base??=portfolioUtility(v,id,baseline);};
 for(const [card,item] of v.players[id].intel.entries()){
  if(item.disabled||!special.has(item.kind)||item.kind==='weekend')continue;
  for(const company of intelTargets(v,id,item.kind)){
   if(item.kind==='session'&&(v.turnHires??[]).includes(company))continue;
   init();const seconds=intelSecondTargets(v,id,item.kind,company);
   for(const target of item.kind==='move'?[undefined,...seconds]:seconds.length?seconds:[undefined]){
    let extras=expansionChoices(v,id,card,company);
    if(item.kind==='rights'){
     const cap=availableCash(v.players[id]);
     extras=[...new Set([1,cap,...Array.from({length:Math.floor(cap/FUNDING_DIVISOR)},(_,i)=>(i+1)*FUNDING_DIVISOR),...baseline.map(x=>Math.floor(x.value))])].filter(price=>price>=1&&price<=cap).sort((a,b)=>a-b).map(price=>({price}));
    }
    for(const extra of extras){
     let value;
     if(['underwritten','public','tender'].includes(item.kind)){
      const s=clone(v);s.auction={company,host:id,reserve:1,mode:item.kind};
      const plan=adaptiveBid(s,id,baseline,randomFor(s,917),auctionForecasts(forecast,s,id,options,'independent'),true);
      value=(plan.value-plan.baselineValue)/3;
     }else if(item.kind==='rights'){
      const s=clone(v);s.auction={company,host:id,reserve:1,mode:'rights'};
      const buyer=Array.from({length:v.players.length-1},(_,i)=>(id+i+1)%v.players.length).find(other=>availableCash(v.players[other])>=extra.price&&baseline[company].value+portfolioOptions(v,other,company)-portfolioOptions(v,other)>=extra.price)??id;
      const projected=forecast(s,id,{...options,auctionOutcome:{winner:buyer,paid:extra.price}});
      s.companies[company].tokens.push({owner:buyer});delete s.companies[company].mandate;s.companies[company].lastBuy[buyer]=Math.max(...s.companies[company].lastBuy)+1;s.players[buyer].cash-=extra.price;
      value=(portfolioUtility(s,id,projected)-base)/3;
     }else{
      const s=resolvedCard(v,id,item.kind,company,target,extra);
      value=(portfolioUtility(s,id,forecast(s,id,options))-base)/3;
      if(item.kind==='advice')value-=Math.max(0,...intelTargets(v,id,v.players[id].intel[extra.discard].kind).map(cid=>intelValue(v,id,v.players[id].intel[extra.discard].kind,cid)))*.35;
      if(['mandate','coup','transfer','stake','fresh'].includes(item.kind)){
       controlBaseline??=hireFollowup(v,id,forecast,options);
       value+=hireFollowup(s,id,forecast,options)-controlBaseline;
      }
     }
     const candidate={value,card,company,target,extra};candidates.push(candidate);cardValues[card]=Math.max(cardValues[card],value);
     if(value>best.value)Object.assign(best,candidate);
    }
   }
  }
 }
 const weekend=v.players[id].intel.findIndex(x=>x.kind==='weekend');
 if(weekend>=0&&intelTargets(v,id,'weekend').length){
  const after=clone(v);after.weekendUsed=true;
  const gains=[];
  const add=(value,key,companies=[],cost=0,keys=[key])=>gains.push({value,key,keys,companies:companies.filter(x=>x>=0),cost});
  for(const [card,item] of after.players[id].intel.entries())if(card!==weekend){
   const legal=intelTargets(after,id,item.kind);
   if(special.has(item.kind))for(const x of candidates.filter(x=>x.card===card&&legal.includes(x.company))){
    const cost=item.kind==='stake'?[6,12,18][fundingBand(after.companies[x.company].position)]:item.kind==='rights'?x.extra.price:item.kind==='matching'?3:item.kind==='mandate'?2:0;
    add(x.value,`card:${card}`,[x.company,x.target],cost,item.kind==='advice'?[`card:${card}`,`card:${x.extra.discard}`]:[`card:${card}`]);
   }else for(const cid of legal){
    if(item.kind==='focused')for(const target of intelSecondTargets(after,id,item.kind,cid))add(score(item.kind,cid,target),`card:${card}`,[cid,target]);
    else add(score(item.kind,cid),`card:${card}`,[cid],item.kind==='matching'?3:item.kind==='mandate'?2:0);
   }
  }
  init();const afterValues=forecast(after,id,options),afterBase=portfolioUtility(after,id,afterValues);
  for(const c of after.companies)if(holdings(c,id)>0)add(saleValue(after,id,c.id,afterValues),`sale:${c.id}`,[c.id]);
  const capitalState=clone(after);
  for(let step=0;step<Math.min((v.actionsLeft??1)+1,6-after.players[id].capital);step++){
   gains.push({value:capitalActionValue(capitalState,id,forecast,options),key:`capital:${step}`,requires:step?[`capital:${step-1}`]:[],cost:0,cashDelta:CAPITAL_CASH,companies:[]});
   capitalState.players[id].cash+=CAPITAL_CASH;capitalState.players[id].capital++;
  }
  for(const cid of eligibleCompanies(after,id)){
   let state=after;
   // Bounded continuation: re-evaluate subsequent calls in the most frequent
   // sampled first-round outcome. Ownership, payment and supply change first.
   // This is a modal branch, not an exhaustive multi-auction game tree.
   for(let depth=0;depth<Math.min((v.actionsLeft??1)+1,after.rules.shareLimit-after.companies[cid].tokens.length);depth++){
    if(!eligibleCompanies(state,id).includes(cid)||fundingNeed(state,cid)===0)break;
    const s=clone(state);s.auction={company:cid,host:id,reserve:1};
    const values=depth?forecast(state,id,options):afterValues;
    const plan=adaptiveBid(s,id,values,randomFor(s,917),auctionForecasts(forecast,s,id,options,'independent'),true);
    const key=`raise:${cid}:${depth}`;
    gains.push({value:(plan.value-plan.baselineValue)/3,key,requires:depth?[`raise:${cid}:${depth-1}`]:[],companies:[],cost:plan.amount});
    const counts=new Map();for(const o of plan.outcomes??[]){const k=`${o.winner}:${o.paid}`;const row=counts.get(k)??{...o,count:0};row.count++;counts.set(k,row);}
    const likely=[...counts.values()].sort((a,b)=>b.count-a.count)[0];if(likely?.winner==null)break;
    const next=sampledGame(state,id,127+depth),c=next.companies[cid],previousLead=lead(c);
    next.players[likely.winner].cash-=likely.paid;
    next.pile.push(...c.supply.splice(0,fundedCards(fundingBand(c.position),likely.paid,next.rules)));
    delete c.mandate;c.tokens.push({id:c.tokens.length+1,owner:likely.winner,paid:likely.paid});c.lastBuy[likely.winner]=Math.max(0,...c.lastBuy)+1;
    next.forecast=true;next.forecastOwners=[];resolveSharePurchase(next,cid,likely.winner,{auction:true,previousLead});
    state=observation(next,id);
   }
  }
  for(const c of after.companies.filter(c=>lead(c)===id&&!(after.turnHires??[]).includes(c.id)))for(const founder of after.founderMarket){
   const s=clone(after);s.companies[c.id].founder=founder;
   add((portfolioUtility(s,id,forecast(s,id,options))-afterBase)/3,`founder:${c.id}`,[c.id]);
  }
  const value=weekendGain(gains,v.actionsLeft??1,after.players[id].cash);
  best.weekendEvaluation={value,opportunities:gains.map(({value,key,cost,cashDelta,requires})=>({value,key,cost,cashDelta,requires}))};
  cardValues[weekend]=Math.max(0,value);
  if(value>best.value)Object.assign(best,{value,card:weekend,company:-1,target:undefined,extra:{}});
 }
 const replacement=replacementOption(v,id);
 best.value+=replacement;
 best.cardValues=cardValues.map(value=>value+replacement);best.candidates=candidates;return best;
}

// Replacement value is an option on a public random card, not a free productive action.
function replacementOption(v,id){
 const horizon=optionHorizon(v);
 return Math.min(2,Math.max(0,expectedIntelValue(v,id)))*.35*horizon;
}
export function exchangePlan(v,id,score=(kind,cid,target)=>intelValue(v,id,kind,cid,target),knownValues=null){
 const hand=v.players[id].intel;
 if(!hand?.length||!canExchangeIntel(v,id))return {value:-Infinity,card:-1};
 const horizon=optionHorizon(v);
 const replacement=replacementOption(v,id);
 const values=knownValues?.map(value=>Math.max(0,value-replacement))??hand.map(card=>Math.max(0,...intelTargets(v,id,card.kind).map(cid=>score(card.kind,cid))));
 const card=values.indexOf(Math.min(...values));
 return {card,value:replacement-.35*values[card]*horizon};
}

function decideBot(
  game,
  id = currentPlayer(game),
  { samples = 20, policy = "normal", sampler='independent',audit=null } = {},
) {
  if(!['legacy','independent'].includes(sampler))throw Error('Choose legacy or independent forecast sampling.');
  const forecast=(state,player,options)=>forecastResult(state,player,{...options,sampler});
  const v = game.playerId === id ? game : observation(game, id),
    p = {...v.players[id],cash:availableCash(v.players[id]),locked:0};
  if(v.phase==='rights'){
    const fs=forecast(v,id,{samples}),c=v.companies[v.auction.company];
    return {type:'rights',accept:availableCash(p)>=v.auction.price&&fs[c.id].value+portfolioOptions(v,id,c.id)-portfolioOptions(v,id)>=v.auction.price};
  }
  if(v.phase==='openBid'){
    const fs=forecast(v,id,{samples}),a=v.auction,min=a.highBidder==null?a.reserve:a.price+1;
    const plan=adaptiveBid(v,id,fs,randomFor(v,917),auctionForecasts(forecast,v,id,{samples},sampler),true);
    return {type:'openBid',amount:plan.amount>=min?min:0};
  }
  if(v.phase==='intelPlay'){

    const best=plannedCard(v,id,forecast,{samples}),exchange=exchangePlan(v,id,undefined,best.cardValues);
    audit?.push({action:{type:'playIntel'},card:best,exchange});
    const canDraw=canDrawIntel(v,id);

    const canExchange=canExchangeIntel(v,id);
    if(canExchange&&policy!=='randomValue'&&exchange.value>=best.value-1e-9)return {type:'exchangeValue',card:exchange.card};
    if(!canDraw&&!canExchange&&best.card<0)return {type:'passValue'};
    if(policy==='randomValue'){
      const options=[];
      if(canExchange)options.push(...p.intel.map((_,card)=>({type:'exchangeValue',card})));
      for(const [card,item] of p.intel.entries())for(const company of intelTargets(v,id,item.kind)){
        const targets=intelSecondTargets(v,id,item.kind,company);
        for(const target of item.kind==='move'?[undefined,...targets]:targets.length?targets:[undefined])for(const extra of NEW_CARDS[item.kind]?expansionChoices(v,id,card,company):[{}])options.push({type:'playIntel',card,company,target,...extra});
      }
      return options[Math.floor(randomFor(v,135)()*options.length)];
    }
    return {type:'playIntel',card:best.card,company:best.company,target:best.target,...(best.extra??(NEW_CARDS[p.intel[best.card]?.kind]?expansionChoices(v,id,best.card,best.company)[0]:{}))};
  }
  if(v.phase==='intelScout'){
    const scores=v.intelScout.cards.map(card=>{if(v.intelScout.kind==='inside')return -discardValue(v,id,card);const c=v.companies[card.company],own=c.tokens.filter(t=>t.owner===id).length/Math.max(1,c.tokens.length),value=card.effect==='fumble'?(c.founder===11?2:-3):card.effect==='setback'?-1:card.printed+(card.signature?.5:0);return value*(v.intelScout.kind==='inside'?own-.3*(1-own):1);});
    if(v.intelScout.kind==='inside')return {type:'scoutIntel',choices:scores.map((score,i)=>({score,i})).sort((a,b)=>a.score-b.score||a.i-b.i).slice(0,1).map(x=>x.i)};
    if(v.intelScout.kind==='launch')return {type:'scoutIntel',choice:scores.indexOf(Math.max(...scores))};
    const order=scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);return {type:'orderIntel',order};
  }
  if (v.phase === "power") return {type:"power",choice:policy==="randomPower"?Math.floor(randomFor(v,83)()*v.powerChoice.options.length):choosePower(v)};
  const options={samples,blindDeck:policy==="blindDeck",blindFounders:policy==="blindFounders"};
  if(v.phase==="call") {
    if(!hasTurnAction(v,id))return {type:"pass"};
    if(policy==="passive"&&p.capital<6)return {type:"raiseMoney"};
    const ids=eligibleCompanies(v,id);
    if(canDrawEmptyHand(v,id))return {type:'drawValue'};
    if(policy==="randomCall"&&p.capital<6){
      const actions=[...ids.map(company=>({type:"call",company})),...v.companies.filter(c=>lead(c)===id).map(c=>({type:"changeFounder",company:c.id})),{type:"raiseMoney"}];
      return actions[Math.floor(randomFor(v,52)()*actions.length)];
    }
    const actionOptions={...options};
    const fs=forecast(v,id,actionOptions);
    const fallback=p.capital<6?{type:"raiseMoney"}:v.rules.intelMode!=="off"&&p.intel.length?{type:"valueAction"}:ids.length?{type:"call",company:ids[0]}:{type:"sellShare",company:v.companies.find(c=>holdings(c,id)>0).id};
    let best={gain:capitalActionValue(v,id,forecast,actionOptions,fs),command:fallback};
    audit?.push({action:fallback,gain:best.gain});
    if(v.rules.intelMode!=='off'){
      const card=plannedCard(v,id,forecast,options);audit?.push({action:{type:"valueAction"},card,gain:card.value});
      const exchange=exchangePlan(v,id,undefined,card.cardValues),gain=Math.max(card.value,exchange.value);
      audit?.push({action:{type:'valueAction'},exchange,gain});
      if(p.intel.length&&gain>best.gain)best={gain,command:{type:'valueAction'}};
    }
    for(const c of v.companies.filter(c=>holdings(c,id)>0)){
      const gain=saleValue(v,id,c.id,fs);audit?.push({action:{type:"sellShare",company:c.id},gain});
      if(gain>best.gain)best={gain,command:{type:'sellShare',company:c.id}};
    }
    for(const cid of ids){
     const c=v.companies[cid],scenario=clone(v);
     if(lead(c)===id&&fundingNeed(v,cid)===0)continue;
     scenario.auction={company:cid,host:id,reserve:minimumBid(c,v.rules)};
     const projected=auctionForecasts(forecast,scenario,id,actionOptions,sampler);
     const plan=adaptiveBid(scenario,id,fs,randomFor(scenario,917),projected,true);
     const gain=(plan.value-plan.baselineValue)/3;
     audit?.push({action:{type:"call",company:cid},gain,ownBid:plan.amount,ceiling:plan.ceiling,saleProbability:plan.saleProbability,otherWin:plan.otherWin,expectedPayment:plan.expectedPayment,opportunityCost:best.gain});
     if(gain>best.gain)best={gain,command:{type:"call",company:cid}};

    }
    const led=v.companies.filter(c=>lead(c)===id);
    if(v.rules.intelMode==="off"&&policy==="randomFounder"&&led.length&&randomFor(v,87)()<.5)return{type:"changeFounder",company:led[Math.floor(randomFor(v,88)()*led.length)].id};
    if(policy!=="noFounder"&&policy!=="blindFounders")for(const plan of founderPlans(v,id,forecast,actionOptions)){
     audit?.push({action:{type:'changeFounder',company:plan.company},founder:plan.founder,gain:plan.gain});
     if(plan.gain>best.gain)best={gain:plan.gain,command:{type:'changeFounder',company:plan.company}};
    }
    return best.command;
  }

  if (v.phase === "founder") {
    if (policy === "randomFounder" || policy === "adaptiveRandomFounder" || policy === "randomChoices")
      {const choices=v.founderMarket.map((f,i)=>canHireFounder(f,v.leg)?i:-1).filter(i=>i>=0);return {type:'founder',choice:choices.length?choices[Math.floor(randomFor(v,v.company+41)()*choices.length)]:-1};}
    const plans=founderPlans(v,id,forecast,options).filter(x=>x.company===v.company).sort((a,b)=>b.gain-a.gain);
    return {type:'founder',choice:plans[0]?.choice??-1};
  }

  if (v.phase === "bid" || v.phase === "tie") {
    if (policy === "passive" || (policy === "concentrated" && v.auction.company !== (id % v.companies.length)))
      return { type: v.phase === "bid" ? "bid" : "tie", amount: 0 };
    const a = v.auction,
      c = v.companies[a.company],
      projected = forecast(v, id, options);
    if (policy === "allIn" || policy === "concentrated")
      return {
        type: v.phase === "bid" ? "bid" : "tie",
        amount: v.phase === "bid" ? (p.cash>=a.reserve?p.cash:0) : p.cash > a.price ? p.cash : 0,
      };
    if(policy==="randomBid"){const minimum=v.phase==="bid"?a.reserve:Math.max(a.reserve,a.price+currencyUnit(v.rules)),amount=floorMoney(randomFor(v,957)()*(p.cash+currencyUnit(v.rules)),v.rules);return{type:v.phase,amount:amount>=minimum?amount:0};}
    // Price ownership and immediate growth together.
    const outcomeForecast=auctionForecasts(forecast,v,id,options,sampler);
    if(v.phase==='bid'){
      const normal=adaptiveBid(v,id,projected,randomFor(v,917),outcomeForecast,true);
      return {type:'bid',amount:normal.amount};
    }
    if(v.phase==='tie'){
      const ceiling=investmentCeiling(v,id,projected,outcomeForecast);
      return {type:'tie',amount:a.price+currencyUnit(v.rules)<=ceiling?a.price+currencyUnit(v.rules):0};
    }
  }
  if (v.phase === "settle") return {type:"sell",shares:v.companies.map(c=>holdings(c,id))};
  if (v.phase === "reveal") return { type: "reveal" };
  return { type: "continue" };
}

// Each decision owns its observations/scenarios until evaluation finishes.
// Scope identity memoization here; the public forecast API remains mutation-safe.
export function botCommand(...args){const previous=decisionKeys;decisionKeys=new WeakMap();try{return decideBot(...args);}finally{decisionKeys=previous;}}
