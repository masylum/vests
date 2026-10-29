export const VERSION = 70;
export const REVEALS_PER_ROUND = 5;
export const INVESTMENT_RISK_DISCOUNT = 0.25;
export const FUNDS = [
  "Saul Grayam",
  "Marek Anderson",
  "Pieter Deal",
  "Reed Kaufman",
  "Mary Meeker",
  "John Doerr",
];
export const SYMBOLS = ["●", "▲", "■", "◆", "⬟", "✚"];
export const COMPANIES = [
  "Gogol", "Amazin", "Weta", "Novidia", "Testra", "Obenay", "Orbix", "Airnest",
].map((name, id) => ({
  id,
  name,
  slots: [[2,1,2],[3,1,1],[2,2,1],[2,2,1],[2,1,1],[2,1,2],[2,2,1],[2,2,1]][id],
  short: ["Go", "Am", "We", "No", "Te", "Ob", "Or", "Ai"][id],
  color: [
    "#eb6964",
    "#edbd39",
    "#64b5df",
    "#62bb89",
    "#aa8bdf",
    "#e982aa",
    "#a9c545",
    "#e8a45b",
  ][id],
}));
export const FOUNDERS = [
 ["Stefan Hobbes", "Once per round", "When another company lands on my space, I **move 2**.", "✦"],
 ["Matt Sikaberg", "After reveal", "If I am **not leading**, I may **move 2, then fumble**.", "⚡"],
 ["Jess Bazos", "Before reveal", "I may **swap spaces** with a company **within 3 spaces**.", "▰"],
 ["Gill Bates", "After reveal", "I may move another company that **has not moved this round** **1 space**, then **move 1**.", "⊞"],
 ["Jenkins Wang", "At game end", "If I finish **4th or 5th**, I **exit for $140**.", "⌁"],
 ["Aidan Newman", "When a company fumbles", "I **move 1**.", "∞"],
 ["Ryan Chelsea", "Before reveal", "If I am **trailing**, I **move 2** and **fumble another company**.", "⌂"],
 ["Jerry Edison", "At game end", "Count **1 fewer share** for dilution. I **cannot be hired in leg 3**.", "➤"],
 ["Liza Helms", "On my numbered growth cards", "**Add 1** unless I am **leading**.", "◇"],
 ["Harry Cage", "When another company fumbles", "I may **recover it** and add **2 supply cards** to the growth pile.", "☀"],
 ["Leon Mask", "When another company passes me", "They **fumble**.", "↗"],
 ["Dan Saltman", "When I would fumble", "I **move 2 instead**.", "▦"],
 ["Max Bahnhof", "When I land on an occupied space", "I **move 1 more**.", "◎"],
 ["Zack Darcy", "Before reveal", "I **move 1**.", "✴"],
 ["Mura Mirati", "Before reveal", "I add **1 supply card** to the growth pile.", "✹"],
 ["Jei-Jei Lee", "Before reveal", "I may **pull another company within 3 spaces** to my space and **fumble it**.", "◎"],
 ["Julie Hats", "After reveal", "If I share a space, **each company there** adds **1 supply card** to the growth pile and **moves 1**.", "⌂"],
 ["Melania Parkens", "When one of my shareholders plays a value card", "I may **move 1**.", "≈"],
 ["Mark Ja", "Before reveal", "I may transfer **1 treasury slot** to another company and **move 2**.", "⇄"],
 ["Brittney Wolfheart", "Before reveal", "I may move to the next company ahead. All companies there **fumble**, including me.", "↗"]
].map(([name, trigger, action, icon], id) => ({id, name, trigger: trigger.replace(' · ', ', ').replace(', If ', ', if ').replace(', Unless ', ', unless ').replace(', Another ', ', another '), action, text: `${trigger.replace(' · ', ', ')}: ${action.replaceAll('**','')}`, icon,
 inspiredBy: ["Steve Jobs", "Mark Zuckerberg", "Jeff Bezos", "Bill Gates", "Jensen Huang", "Adam Neumann", "Brian Chesky", "Larry Ellison", "Elizabeth Holmes", "Larry Page", "Elon Musk", "Sam Altman", "Marc Benioff", "Jack Dorsey", "Mira Murati", "Fei-Fei Li", "Julia Hartz", "Melanie Perkins", "Jack Ma", "Whitney Wolfe Herd"][id],
}));
export const RULES = Object.freeze({
  intelMode: "off",
  checkpoints: [8, 16, 24],
  maxCycles: 12, // Bot forecast horizon; never a settlement deadline.
  shareLimit: 5,
  payoutPlaces: 3,
  hedgeFund: false,
  catchUp: true,
  burnPerRound: 2,
  moneyScale: 2,
  muraMinimum: 10,
  wangExit: 140,
  revealsPerRound: REVEALS_PER_ROUND,
  projectPrices: [[3,8,15],[6,12,24],[10,16,30]],
  startingCash: 100,
  obligation: 100,
  purchaseStep: 8,
  defaultFee: 0,
  exitScale: 10,
  purchaseBase: 8,
  checkpointCount: 2,
  exitLinear: 5,
  exitCurve: "quadratic",
  ipoValue: 100,
  exitMultiplier: 2,
  growthDivisor: 32,
  costAcceleration: 1,
});
// Whole-company proceeds, not a guaranteed per-share return.
export const companyValue = (growth, rules = RULES) => {
  if(rules.exitCurve==="quadratic")return (rules.exitMultiplier??1)*(rules.moneyScale??1)*Math.round((rules.ipoValue??100)/(rules.moneyScale??1)*(Math.max(0,Math.min(24,growth)-8)/16)**2);
  if(rules.exitLinear)return Math.round(rules.exitLinear*Math.max(0,growth-4));
  const g = Math.max(0, growth - 3);
  return rules.exitScale * Math.floor((g * g + 3 * g) / 2 / 5) * 5;
};
export const availableCash = p => p.cash - (p.locked ?? 0);
export const fundingBand = growth => Math.min(2, Math.max(0, Math.floor((growth - 1) / 8)));
export const fundingPrices = (leg, rules = RULES) => [...rules.projectPrices[leg]];
export const minimumBid = (c, rules = RULES) => fundingPrices(fundingBand(c.position),rules)[0];
export const fundedCards = (leg, payment, rules = RULES) => fundingPrices(leg,rules).filter(n => payment >= n).length;
export const SPECIALS = [
 ["Ad revenue flywheel", "Add one supply card to the growth pile, then shuffle it.", "add"],
 ["Cash conversion", "Add 1 treasury slot (maximum 3).", "swapCard"],
 ["Audience capture", "Discard 1 supply card from each leading rival, face down.", "discard"],
 ["Developer ecosystem", "Add 1 supply card for each trailing rival, then shuffle the pile.", "ecosystem"],
 ["Overtake", "After moving, swap spaces with all companies exactly 1 space ahead.", "swap"],
 ["Breakthrough", "Move 3 if not leading; otherwise move 0.", "breakthrough"],
];
// Counts: 0, +1, +2, +3, fumble, setback. Three +2 cards are signatures.
export const DECK_PROFILES = [
 [0,8,6,1,1,1], [1,8,6,1,1,1], [1,6,6,1,2,1],
 [1,5,6,3,2,0], [1,3,6,4,2,2], [3,2,8,2,2,0],
 [1,6,4,3,1,1], [0,8,4,2,1,3],
];
export const DECK_THEMES = [
 ["Ad-funded growth", "Mostly +1s. Signature cards add supply to the growth pile and shuffle it, growing your presence but draining finite supply."],
 ["Cash conversion", "Mostly +1s and +2s. Signature cards add treasury slots, sustaining growth without new funding."],
 ["Competition for attention", "Steady growth with extra fumbles. Signature cards remove supply from leading rivals; cards already in the growth pile are safe."],
 ["Platform ecosystem", "Three +3s, one +0 and two fumbles. Signature cards add supply for trailing rivals, helping competitors catch up."],
 ["Production ramp", "Four +3s, two fumbles and two setbacks. Signature cards swap with companies exactly 1 space ahead."],
 ["Research moonshots", "Three +0s and two +3s. Signature cards move 3 when not leading, but 0 when leading."],
 ["Orbital launches", "Three +3s among smaller moves. Signature cards add supply to the growth pile and shuffle it."],
 ["Bumpy expansion", "Mostly +1s, with three setbacks and two +3s. Signature cards add treasury slots."]
];
export const slotCards = (company, slot, companies = []) => slot === 0 ? 0 : COMPANIES[company.id].slots[slot-1];
export const reserveCards = company => Array.from({length:company.reserve},(_,i)=>slotCards(company,i+1)).reduce((a,b)=>a+b,0);
export const fixedLP = (players, leg, rules = RULES) => {
  const cash = leg === 0 ? rules.startingCash : 0;
  return {cash, repayment: leg === 0 ? rules.obligation : 0};
};
export function growthDeck(company) {
 const cards=[];
 DECK_PROFILES[company].forEach((count,n)=>{
  for(let i=0;i<count;i++)cards.push({id:`g${company}:${cards.length}`,kind:"growth",company,printed:n<4?n:0,signature:false,...(n>=4?{effect:n===4?"fumble":"setback"}:{})});
 });
 for(const special of cards.filter(c=>c.printed===2).slice(0,3))special.signature=SPECIALS[company%6][2];
 return cards;
}

export const checkpointTarget = g => g.leg === 2 ? 1 : g.rules.checkpointCount;
export const checkpointReached = g => g.companies.filter(c=>c.position >= g.rules.checkpoints[g.leg]).length >= checkpointTarget(g);

// Economic founder powers share the same valuation in settlement and forecasts.
export function settlementValue(c, companies, rules = RULES) {
 const rank=raceRank(c,companies);
 return c.founder===4&&!c.down&&!c.hiringFumble&&[4,5].includes(rank)?rules.wangExit:companyValue(c.position,rules);
}
export const canExit = (c, winners, companies = [c]) => winners.includes(c.id) || (c.founder===4&&!c.down&&!c.hiringFumble&&[4,5].includes(raceRank(c,companies)));
export const dilution = c => Math.max(1,c.tokens.length-Number(c.founder===7&&!c.down&&!c.hiringFumble));

export const TRACK_COORDS = Array.from({length:24}, (_,i) =>
 i<9 ? [i+1,1] : i<12 ? [9,i-7] : i<21 ? [21-i,5] : [1,25-i]);

export const raceRank = (company, companies) => 1 + companies.filter(c=>c.position>company.position).length;
export const podium = (companies, places=3) => companies.filter(c=>raceRank(c,companies)<=places).sort((a,b)=>b.position-a.position).map(c=>c.id);

export const canHireFounder = (founder, leg) => founder !== 7 || leg < 2;

export const sharePayout = (value, shares, rules = RULES) => (rules.moneyScale??1)*Math.floor(value/shares/(rules.moneyScale??1));
