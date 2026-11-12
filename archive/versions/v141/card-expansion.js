import {availableCash,minimumBid,fundingBand} from './config.js';
import {shareCount,shareLeader} from './ownership.js';
export const NEW_CARDS={
 "clearance": [
  "Inventory Clearance",
  "Reveal 2 random supply tokens from a portfolio company and remove them from the game. Gain $5."
 ],
 "consolidation": [
  "Share Consolidation",
  "Return 1 of your shares from a portfolio company. Lower your capital track by 1."
 ],
 "session": [
  "Infamous Ousting",
  "Replace a portfolio company’s founder with one from the public market, then fumble the company. You need not lead it."
 ],
 "insurance": [
  "Mutual Insurance",
  "Choose 2 portfolio companies, one fumbled and one unfumbled. Recover the first, then fumble the second."
 ],
 "weekend": [
  "Working Weekend",
  "Gain 2 actions this turn. Play at most 1 Working Weekend per turn."
 ],
 "underwritten": [
  "Underwritten Round",
  "Hold a normal fundraise for a portfolio company. If another investor wins, deploy 2 extra supply tokens for that company."
 ],
 "rights": [
  "Rights Issue",
  "Offer 1 new share in a portfolio company at a price you can pay ($1+). Clockwise, first acceptance buys it; if all others pass, you buy."
 ],
 "public": [
  "Convertible Notes",
  "Hold an open fundraise for a portfolio company, starting at $1. Raise by $1 or more; passing is final. Last bidder buys 1 new share at their bid."
 ],
 "tender": [
  "Sealed Tender",
  "Choose a portfolio company. Everyone bids secretly once. Highest bidder buys 1 new share at their own bid. Normal ties apply."
 ],
 "mandate": [
  "Board Mandate",
  "Pay $2 to become a portfolio company’s lead investor until its next ownership change."
 ],
 "coup": [
  "Board Coup",
  "Fumble a portfolio company you do not lead. Become its lead investor until its next ownership change."
 ],
 "matching": [
  "Matching Funds",
  "Pay $3 to deploy 2 supply tokens for a portfolio company. No new share."
 ],
 "dividend": [
  "Secondary Sale",
  "Move a portfolio company back 2 spaces. Its shareholders gain $3 per share. Bank shares pay nobody."
 ],
 "stake": [
  "Stake Purchase",
  "Buy 1 share in a portfolio company from an investor you choose. Pay them $6 / $12 / $18 in leg 1 / 2 / 3. They must sell."
 ],
 "focused": [
  "Focused Execution",
  "Choose 2 portfolio companies. Move one back 2 spaces, then move the other forward 2 spaces."
 ],
 "advice": [
  "Paid Advice",
  "Discard 1 additional value card. Move a portfolio company 1 space and gain $3. Draw only your normal replacement."
 ],
 "sweat": [
  "Sweat Equity",
  "Move a portfolio company back 2 spaces and add 1 of your shares to it. Deploy no tokens."
 ],
 "fresh": [
  "Fresh Perspectives",
  "Replace all 3 public-market founders with new ones. Draw 2 value cards instead of your normal replacement."
 ],
 "restructure": [
  "Illicit Funding",
  "Move a portfolio company back 3 spaces to lower your capital track by 1."
 ],
 "financing": [
  "Bridge Financing",
  "Advance your capital track by 1. Move a portfolio company 2 spaces and deploy 1 of its supply tokens. Gain no cash."
 ],
 "transfer": [
  "Portfolio Transfer",
  "Return 1 of your shares from one portfolio company. Add 1 of your shares to another portfolio company. Deploy no tokens."
 ]
};
export const GLOBAL_CARDS=['weekend','fresh'];
export const FUNDRAISE_CARDS=['underwritten','rights','public','tender'];
export const TWO_COMPANY_CARDS=['insurance','transfer','focused'];
export function expansionSeconds(g,id,kind,cid){
 return g.companies.filter(c=>c.id!==cid&&shareCount(c,id)>0&&(kind==='insurance'?!c.down&&!c.hiringFumble:kind==='transfer'?c.tokens.length<g.rules.shareLimit:kind==='focused'?c.position<24:false)).map(c=>c.id);
}
export function expansionTargets(g,id,kind){
 const p=g.players[id],cash=availableCash(p),supply=c=>c.supplyCount??c.supply.length;
 if(kind==='weekend')return !g.weekendUsed?[-1]:[];
 if(kind==='fresh')return g.players.reduce((n,x)=>n+(x.intelCount??x.intel.length),0)<(g.valueDeckSize??60)?[-1]:[];
 return g.companies.filter(c=>shareCount(c,id)>0).filter(c=>{
  if(kind==='clearance')return supply(c)>=2;
  if(kind==='consolidation')return p.capital>0;
  if(kind==='session')return g.founderMarket.length>0;
  if(kind==='insurance')return (c.down||c.hiringFumble)&&expansionSeconds(g,id,kind,c.id).length>0;
  if(FUNDRAISE_CARDS.includes(kind))return (g.variant==='dice'||supply(c)>0)&&c.tokens.length<g.rules.shareLimit&&(kind!=='rights'||cash>=minimumBid(c,g.rules));
  if(kind==='mandate')return cash>=2&&shareLeader(c)!==id;
  if(kind==='coup')return shareLeader(c)!==id;
  if(kind==='matching')return cash>=3&&supply(c)>=2;
  if(['dividend','sweat'].includes(kind))return c.position>=2&&(kind!=='sweat'||c.tokens.length<g.rules.shareLimit);
  if(kind==='stake')return cash>=[6,12,18][fundingBand(c.position)]&&c.tokens.some(t=>t.owner!==null&&t.owner!==id);
  if(kind==='focused')return c.position>=2&&expansionSeconds(g,id,kind,c.id).length>0;
  if(kind==='advice')return c.position<24&&p.intel.length>=2;
  if(kind==='restructure')return c.position>=3&&p.capital>0;
  if(kind==='financing')return p.capital<6&&supply(c)>=1;
  if(kind==='transfer')return expansionSeconds(g,id,kind,c.id).length>0;
  return false;
 }).map(c=>c.id);
}
// Finite choices shared by UI, bot and audit traces. Rights prices are validated separately.
export function expansionChoices(g,id,card,cid){
 const kind=g.players[id].intel[card].kind,c=g.companies[cid];
 if(kind==='session')return g.founderMarket.map((_,founder)=>({founder}));
 if(kind==='advice')return g.players[id].intel.flatMap((_,discard)=>discard===card?[]:[{discard}]);
 if(kind==='stake')return [...new Set(c.tokens.map(t=>t.owner).filter(x=>x!==null&&x!==id))].map(seller=>({seller}));
 if(kind==='rights')return [{price:minimumBid(c,g.rules)}];
 return [{}];
}
