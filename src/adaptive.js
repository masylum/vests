import {INVESTMENT_RISK_DISCOUNT,capitalPenalty} from "./config.js";
import {currencyUnit,floorMoney,availableCash,minimumBid,fundingPrices,fundingBand,reserveCards} from './config.js';
import {portfolioWealth,portfolioOptions,portfolioSamples,riskUtility} from './valuation.js';
import {shareCount} from './ownership.js';
export function settlementWealth(assets, player, leg, defaultFee) {
  const balance=assets-player.obligation;
  return balance+(player.savedCash??0)-player.debt-player.fees-capitalPenalty(player)-(balance<0?defaultFee*(leg+1):0);
}
// Learn from public revealed history, never current sealed bids.
export function opponentBids(view, id, company, expected, random, count = 48, ceilings=null) {
  const histories=view.players.map(p=>{
    if(p.id===id)return [];
    return (view.auctionHistory??[]).slice(-16).flatMap(a=>a.bids.filter(b=>b.player===p.id).flatMap(b=>Array(a.company===company?2:1).fill(b.amount)));
  });
  return Array.from({length:count}, () => view.players.map(p => {
    if(p.id===id)return 0;
    const last=(view.auctionHistory??[]).findLast(a=>a.company===company),context=last?.context;
    const unchanged=context&&(context.mode??'sealed')===(view.auction?.mode??'sealed')&&(!context.poolWeights||JSON.stringify(context.poolWeights)===JSON.stringify(view.poolWeights))&&JSON.stringify(context.positions)===JSON.stringify(view.companies.map(c=>c.position))&&JSON.stringify(context.founders)===JSON.stringify(view.companies.map(c=>c.founder))&&JSON.stringify(context.owners)===JSON.stringify(view.companies.map(c=>c.tokens.map(t=>t.owner)))&&JSON.stringify(context.down)===JSON.stringify(view.companies.map(c=>!!(c.down||c.hiringFumble)));
    if(unchanged&&last.bids.some(b=>b.player===p.id&&b.amount===0)&&availableCash(p)<=last.cash[p.id])return 0;
    const weighted=histories[p.id];
    const empirical=weighted.length&&random()>3/(3+weighted.length);
    const estimate=empirical?weighted[Math.floor(random()*weighted.length)]:[0,expected*.6,expected,expected*1.5,availableCash(p)][Math.floor(random()*5)];
    return Math.min(availableCash(p),ceilings?.[p.id]??Infinity,Math.max(0,Math.round(estimate/currencyUnit(view.rules))*currencyUnit(view.rules)));
  }));
}
// Diagnostic only: money above this threshold buys ownership, but no extra growth.
export function productiveFundingLimit(view,company) {
 const c=view.companies[company],supply=c.supplyCount??c.supply?.length??0;
 return supply?Math.max(minimumBid(c,view.rules),supply*4):0;
}
// Count tokens already in the bag before requesting more financing.
export function fundingNeed(view,company) {
 const c=view.companies[company],weights=view.poolWeights??[],total=weights.reduce((s,n)=>s+n,0);
 const pending=(weights[company]??0)*(view.poolWeightsAreUpperBounds&&total?view.pileCount/total:1);
 const supply=c.supplyCount??c.supply?.length??0;
 if(!supply)return 0;
 const rounds=Math.max(1,(24-Math.max(...view.companies.map(x=>x.position)))/2);
 const target=Math.min(supply,Math.max(2,Math.min(4,rounds)));
 return Math.max(0,target-pending);
}
// Never pay more than the risk-adjusted incremental value to our own portfolio.
// Denying a rival a stake is not an investment return.
export function investmentCeiling(view,id,forecasts,outcomeForecast) {
 const cid=view.auction.company;
 const cap=availableCash(view.players[id]);
 if(!cap)return 0;
 if(!outcomeForecast)return Math.min(cap,Math.max(0,floorMoney(forecasts[cid].value,view.rules)));
 const baseline=outcomeForecast(null,0);
 const shareCounts=view.companies.map(c=>shareCount(c,id));
 const baselineWealth=baseline[0].prices.map((_,sample)=>portfolioWealth(view,id,baseline,sample,{shareCounts}));
 const optionsAfter=portfolioOptions(view,id,cid),optionsBefore=portfolioOptions(view,id);
 const values=[...new Set([minimumBid(view.companies[cid],view.rules),...fundingPrices(fundingBand(view.companies[cid].position),view.rules),cap])].map(p=>Math.max(p,minimumBid(view.companies[cid],view.rules))).filter(p=>p<=cap).map(payment=>{
  const projected=outcomeForecast(id,payment);
  const gains=projected[0].prices.map((_,sample)=>portfolioWealth(view,id,projected,sample,{company:cid,shareCounts})-baselineWealth[sample]+optionsAfter-optionsBefore);
  const mean=gains.reduce((a,b)=>a+b,0)/gains.length;
  const risk=Math.sqrt(gains.reduce((s,x)=>s+(x-mean)**2,0)/gains.length);
  return Math.max(0,mean-INVESTMENT_RISK_DISCOUNT*risk);
 });
 return Math.min(cap,floorMoney(Math.max(0,...values),view.rules));
}
export function adaptiveBid(view, id, forecasts, random, outcomeForecast=null, withUtility=false, modelOpponents=true) {
  const a=view.auction,p=view.players[id],cid=a.company;
  // A historical bid cannot justify a price above this bidder's current marginal return.
  const ceilings=outcomeForecast?view.players.map(q=>{
    if(q.id===id)return 0;
    if(!modelOpponents)return investmentCeiling(view,q.id,forecasts,outcomeForecast);
    let state=(view.cycle*1301+view.leg*10007+q.id*71+cid*431+918)>>>0;
    const rng=()=>{state=Math.imul(state^(state>>>15),2246822519)>>>0;return state/4294967296;};
    // One public-policy response layer; never recurse into another belief model.
    return adaptiveBid(view,q.id,forecasts,rng,outcomeForecast,false,false);
  }):null;
  const samples=opponentBids(view,id,cid,forecasts[cid].expected,random,48,ceilings);
  const tops=samples.map(bs=>Math.max(...bs)).sort((a,b)=>a-b);
  const ceiling=Math.min(availableCash(p),investmentCeiling(view,id,forecasts,outcomeForecast));
  const choices=[...new Set([0,a.reserve,ceiling,floorMoney(forecasts[cid].value,view.rules),...Array.from({length:9},(_,i)=>tops[Math.floor(i*(tops.length-1)/8)]+currencyUnit(view.rules))].map(x=>Math.max(0,Math.min(ceiling,x))))].sort((a,b)=>a-b);
  const utilities=new Map(),wealthCache=new Map(),plans=new Map(),requests=new Map();
  for(const bid of choices){
    plans.set(bid,samples.map((rivals,i)=>{
      const bids=rivals.map((amount,player)=>({player,amount:player===id?bid:amount})).filter(b=>b.amount>=a.reserve).sort((x,y)=>y.amount-x.amount);
      const tied=bids.filter(b=>b.amount===bids[0]?.amount);
      // Rival-only tied bids forecast clockwise priority; actual ties still use open raises.
      const winner=tied.find(b=>b.player===a.host)??tied.sort((x,y)=>(x.player-a.host+view.players.length)%view.players.length-(y.player-a.host+view.players.length)%view.players.length)[0];
      const paid=winner?(a.mode==='tender'||bids.length===1?bids[0].amount:a.mode==='public'?Math.min(bids[0].amount,Math.max(a.reserve,bids[1].amount+1)):Math.max(a.reserve,bids[1].amount)):0, sample=i%forecasts[0].prices.length;
      const key=`${winner?.player??null}:${paid}`;
      const request=requests.get(key)??{winner:winner?.player??null,paid,mask:0};request.mask|=1<<sample;requests.set(key,request);
      return {winner,paid,sample};
    }));
  }
  outcomeForecast?.prepare?.(requests.values());
  function utility(bid) {
    if(utilities.has(bid))return utilities.get(bid);
    const outcomes=plans.get(bid).map(({winner,paid,sample})=>{
      const key=`${winner?.player??null}:${paid}:${sample}`;
      let wealth=wealthCache.get(key);
      if(!wealth){
        const projected=outcomeForecast?outcomeForecast(winner?.player??null,paid,sample):forecasts;
        wealth=portfolioSamples(view,id,projected,{winner:winner?.player??null,paid,company:cid});wealthCache.set(key,wealth);
      }
      return wealth[sample];
    });
    const result=riskUtility(outcomes);utilities.set(bid,result);return result;
  }
  let best=0,bestScore=-Infinity;
  for(const bid of choices){const score=utility(bid);if(score>bestScore+.0001){best=bid;bestScore=score;}}
  const amount=best>=a.reserve?best:0;
  const baselineValue=riskUtility(portfolioSamples(view,id,forecasts));
  const outcomes=plans.get(amount),saleProbability=outcomes.filter(x=>x.winner).length/outcomes.length;
  const ownWin=outcomes.filter(x=>x.winner?.player===id).length/outcomes.length;

  return withUtility?{amount,value:utility(amount),passValue:utility(0),baselineValue,ceiling,saleProbability,ownWin,otherWin:saleProbability-ownWin,expectedPayment:avgPayment(outcomes),outcomes:outcomes.map(x=>({winner:x.winner?.player??null,paid:x.paid}))}:amount;
}

const avgPayment=outcomes=>outcomes.reduce((sum,x)=>sum+x.paid,0)/outcomes.length;
