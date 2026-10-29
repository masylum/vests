import {INVESTMENT_RISK_DISCOUNT} from "./config.js";
import {availableCash,minimumBid,fundingPrices,fundingBand,reserveCards} from './config.js';
import {portfolioWealth,portfolioOptions} from './valuation.js';
export function settlementWealth(assets, player, leg, defaultFee) {
  const balance=assets-player.obligation;
  return balance+(player.savedCash??0)-player.debt-player.fees-(balance<0?defaultFee*(leg+1):0);
}
// Learn from public revealed history, never current sealed bids.
export function opponentBids(view, id, company, expected, random, count = 48) {
  return Array.from({length:count}, () => view.players.map(p => {
    if(p.id===id)return 0;
    const history=(view.auctionHistory??[]).slice(-16).flatMap(a=>a.bids.filter(b=>b.player===p.id).map(b=>({amount:b.amount,weight:a.company===company?2:1})));
    const weighted=history.flatMap(h=>Array(h.weight).fill(h.amount));
    const empirical=weighted.length&&random()>3/(3+weighted.length);
    const estimate=empirical?weighted[Math.floor(random()*weighted.length)]:[0,expected*.6,expected,expected*1.5,availableCash(p)][Math.floor(random()*5)];
    return Math.min(availableCash(p),Math.max(0,Math.round(estimate)));
  }));
}
// Diagnostic only: money above this threshold buys ownership, but no extra growth.
export function productiveFundingLimit(view,company) {
 const c=view.companies[company],room=3-(c.reserve??0);
 if(room<=0||(c.supplyCount??c.supply?.length??1)===0)return 0;
 return Math.max(minimumBid(c,view.rules),fundingPrices(fundingBand(c.position),view.rules)[room-1]);
}
// Count cards already in the pile and treasury before requesting more financing.
export function fundingNeed(view,company) {
 const c=view.companies[company],weights=view.poolWeights??[],total=weights.reduce((s,n)=>s+n,0);
 const pending=(weights[company]??0)*(view.poolWeightsAreUpperBounds&&total?view.pileCount/total:1);
 const supply=c.supplyCount??c.supply?.length??0;
 if(!supply||c.reserve>=3)return 0;
 const rounds=Math.max(1,(24-Math.max(...view.companies.map(x=>x.position)))/2);
 const target=Math.min(supply,Math.max(2,Math.min(4,rounds)));
 return Math.max(0,target-pending-reserveCards(c));
}
// Never pay more than the risk-adjusted incremental value to our own portfolio.
// Denying a rival a stake is not an investment return.
export function investmentCeiling(view,id,forecasts,outcomeForecast) {
 const cid=view.auction.company;
 const cap=availableCash(view.players[id]);
 if(!cap)return 0;
 if(!outcomeForecast)return Math.min(cap,Math.max(0,Math.floor(forecasts[cid].value)));
 const baseline=outcomeForecast(null,0);
 const values=[...new Set([minimumBid(view.companies[cid],view.rules),...fundingPrices(fundingBand(view.companies[cid].position),view.rules),cap])].map(p=>Math.max(p,minimumBid(view.companies[cid],view.rules))).filter(p=>p<=cap).map(payment=>{
  const projected=outcomeForecast(id,payment);
  const gains=projected[0].prices.map((_,sample)=>portfolioWealth(view,id,projected,sample,{company:cid})-portfolioWealth(view,id,baseline,sample)+portfolioOptions(view,id,cid)-portfolioOptions(view,id));
  const mean=gains.reduce((a,b)=>a+b,0)/gains.length;
  const risk=Math.sqrt(gains.reduce((s,x)=>s+(x-mean)**2,0)/gains.length);
  return Math.max(0,mean-INVESTMENT_RISK_DISCOUNT*risk);
 });
 return Math.min(cap,Math.floor(Math.max(0,...values)));
}
export function adaptiveBid(view, id, forecasts, random, outcomeForecast=null) {
  const a=view.auction,p=view.players[id],cid=a.company;
  const samples=opponentBids(view,id,cid,forecasts[cid].expected,random);
  const tops=samples.map(bs=>Math.max(...bs)).sort((a,b)=>a-b);
  const ceiling=Math.min(availableCash(p),investmentCeiling(view,id,forecasts,outcomeForecast));
  const choices=[...new Set([0,a.reserve,ceiling,Math.floor(forecasts[cid].value),...Array.from({length:9},(_,i)=>tops[Math.floor(i*(tops.length-1)/8)]+1)].map(x=>Math.max(0,Math.min(ceiling,x))))].sort((a,b)=>a-b);
  function utility(bid) {
    const outcomes=samples.map((rivals,i)=>{
      const bids=rivals.map((amount,player)=>({player,amount:player===id?bid:amount})).filter(b=>b.amount>=a.reserve).sort((x,y)=>y.amount-x.amount);
      const tied=bids.filter(b=>b.amount===bids[0]?.amount);
      // Rival-only tied bids forecast clockwise priority; actual ties still use open raises.
      const winner=tied.find(b=>b.player===a.host)??tied.sort((x,y)=>(x.player-a.host+view.players.length)%view.players.length-(y.player-a.host+view.players.length)%view.players.length)[0];
      const paid=winner?(bids.length===1?bids[0].amount:Math.max(a.reserve,bids[1].amount)):0, sample=i%forecasts[0].prices.length;
      const projected=outcomeForecast?outcomeForecast(winner?.player??null,paid):forecasts;
      const wealth=view.players.map(q=>portfolioWealth(view,q.id,projected,sample,{payment:winner?.player===q.id?paid:0,company:winner?.player===q.id?cid:null}));
      const optionGain=winner?.player===id?portfolioOptions(view,id,cid)-portfolioOptions(view,id):0;
      // Unpaid winning bids lock cash that may be needed in the remaining auctions.
      const turnsLeft=Math.max(0,view.players.length-(view.callIndex??view.players.length));
      const lockCost=winner?.player===id?Math.max(0,bid-paid)*.12*turnsLeft/view.players.length:0;
      return wealth[id]+optionGain-lockCost-.35*Math.max(...wealth.filter((_,j)=>j!==id));
    });
    const mean=outcomes.reduce((a,b)=>a+b,0)/outcomes.length;
    return mean-.25*Math.sqrt(outcomes.reduce((s,x)=>s+(x-mean)**2,0)/outcomes.length);
  }
  let best=0,bestScore=-Infinity;
  for(const bid of choices){const score=utility(bid);if(score>bestScore+.0001){best=bid;bestScore=score;}}
  return best>=a.reserve?best:0;
}
