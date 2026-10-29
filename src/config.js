import {compareRace} from './movement.js';
export const VERSION = 97;
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
  slots: [[2,1,2],[3,1,1],[2,2,1],[1,3,1],[1,1,3],[1,2,2],[2,2,1],[2,2,1]][id],
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
 ["Matt Sikaberg", "Before the reveal", "If I am **not leading**, I may **move 2, then fumble**.", "⚡"],
 ["Jess Bazos", "Before the reveal", "I may **swap spaces** with a company **1 to 3 spaces away**.", "▰"],
 ["Gill Bates", "After the reveal", "I may **move another company 1**, then **move 1**.", "⊞"],
 ["Jenkins Wang", "At game end", "If I finish **penultimate**, my company may **exit for $75**.", "⌁"],
 ["Aidan Newman", "When a company fumbles", "I **move 1**.", "∞"],
 ["Ryan Chelsea", "Before the reveal", "If I am **not leading**, I **move 1** and **fumble the leaders**. Check leaders before I move.", "⌂"],
 ["Jerry Edison", "After an investor buys a share in my company", "I **move 3 minus my number of different shareholders**. A negative result moves me back.", "➤"],
 ["Liza Helms", "On my numbered growth cards", "**Add 1** unless I am **leading**.", "◇"],
 ["Harry Cage", "Once per reveal, when another company fumbles", "I may **recover it** and **deploy 2 of my cards**.", "☀"],
 ["Leon Dusk", "Once per round, when another company passes me", "They **fumble** and I **move 1**.", "↗"],
 ["Dan Saltman", "During the reveal", "If I would fumble, I **move 2 instead**.", "▦"],
 ["Max Bahnhof", "When I land on an occupied space", "I **move 1 more**.", "◎"],
 ["Zack Darcy", "Before the reveal", "I **move 1**.", "✴"],
 ["Mura Mirati", "Before the reveal", "I **deploy 1 card**.", "✹"],
 ["Lei-Lei Fi", "Before the reveal", "I may **pull a company 1 to 3 spaces away** to my space, then **fumble it**.", "◎"],
 ["Julie Hearts", "Once per reveal", "I may **use a revealed growth card as my company’s card**, including its power.", "⌂"],
 ["Melania Gherkins", "When a shareholder plays a value card on my company", "I **move 2**.", "≈"],
 ["Mack Ja", "Before the reveal", "I may **transfer 1 treasury slot** to another company, then **move 3**.", "⇄"],
 ["Brittney Wolfheart", "Before the reveal", "I may **join the next company ahead**, then **fumble everyone on that space**, including me.", "↗"],
 ["Mario Adonei", "While fumbled", "Companies **cannot pass me**. When I **recover**, my lead investor **draws 1 value card**.", "▰"],
 ["Reid Fastings", "Before discarding my growth card", "I may **return it to my supply**, then **move another company back 1**. Includes recovery discards.", "↶"]
].map(([name, trigger, action, icon], id) => ({id, name, trigger: trigger.replace(' · ', ', ').replace(', If ', ', if ').replace(', Unless ', ', unless ').replace(', Another ', ', another '), action, text: `${trigger.replace(' · ', ', ')}: ${action.replaceAll('**','')}`, icon,
 inspiredBy: ["Steve Jobs", "Mark Zuckerberg", "Jeff Bezos", "Bill Gates", "Jensen Huang", "Adam Neumann", "Brian Chesky", "Larry Ellison", "Elizabeth Holmes", "Larry Page", "Elon Musk", "Sam Altman", "Marc Benioff", "Jack Dorsey", "Mira Murati", "Fei-Fei Li", "Julia Hartz", "Melanie Perkins", "Jack Ma", "Whitney Wolfe Herd", "Dario Amodei", "Reed Hastings"][id],
}));
export const RULES = Object.freeze({
  intelMode: "off",
  checkpoints: [8, 16, 24],
  maxCycles: 12, // Bot forecast horizon; never a settlement deadline.
  shareLimit: 5,
  payoutPlaces: 3,
  hedgeFund: false,
  catchUp: true,
  burnPerRound: 3,
  moneyScale: 1,
  currencyUnit: 1,
  bridgeCost: 3,
  secondaryCost: 5,
  conflictPayout: 5,
  sellPayouts: [6,12,18],
  muraMinimum: 5,
  wangExit: 75,
  revealsPerRound: REVEALS_PER_ROUND,
  projectPrices: [[1,4,7],[3,6,9],[5,8,11]],
  startingCash: 50,
  obligation: 55,
  purchaseStep: 4,
  defaultFee: 0,
  exitScale: 5,
  purchaseBase: 4,
  checkpointCount: 2,
  exitLinear: 2.5,
  exitCurve: "quadratic",
  ipoValue: 50,
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
 ["Ad revenue", "Deploy 1 card from my supply.", "add"],
 ["Reinvest profits", "Add 1 treasury slot (maximum 3).", "swapCard"],
 ["Pivot", "Recover if fumbled, then move 2. This card still moves when fumbled.", "recover"],
 ["Supply chain", "Move 1. After the reveal, return this card to my supply.", "recycle"],
 ["Overtake", "After moving 2, swap spaces with 1 company up to 2 spaces ahead, if any.", "swap"],
 ["Research", "Move 1 if leading; otherwise, move 3. Check before moving.", "breakthrough"],
];
// Final printed counts: 0, +1, +2, +3, fumble, setback. Novidia has 2 signatures; others have 3.
export const DECK_PROFILES = [
 [0,12,7,0,1,0], [3,15,3,0,0,0], [0,5,11,0,3,0],
 [0,3,11,0,2,0], [0,5,11,0,2,0], [0,7,10,0,2,0],
 [2,8,7,0,1,0], [2,10,7,0,1,0],
];
export const DECK_THEMES = [
 ["Steady cash flow", "Gogol turns attention into advertising revenue. A dependable cash cow that keeps growing while flashier rivals make headlines."],
 ["Efficient reinvestment", "Amazin builds an empire on thin margins and relentless reinvestment. Patient investors back a business built to keep the deliveries coming."],
 ["Move fast, break things", "Weta chases the next big idea at full speed. Expect bold pivots, sudden setbacks and a team always ready to try again."],
 ["Speed needs supply", "Novidia sells the hardware everyone wants. Demand is soaring, but keeping the factories supplied is another story."],
 ["Driven to overtake", "Testra has its sights on the company ahead. Ambitious engineering and fierce competition turn a close race into a fight for position."],
 ["Chasing breakthroughs", "Obenay bets on research that could change everything. Chasing the frontier brings spectacular breakthroughs; defending the lead is harder."],
 ["Orbital launches", "Orbix makes big bets on the next launch. It burns through resources quickly, hoping each success will carry it further."],
 ["Bumpy expansion", "Airnest wants a room in every city. Fresh funding keeps expansion going, but local growing pains can slow the journey."]
];
export const slotCards = (company, slot, companies = []) => slot === 0 ? 0 : COMPANIES[company.id].slots[slot-1];
export const reserveCards = company => {
 let count=0;
 for(let slot=1;slot<=company.reserve;slot++)count+=slotCards(company,slot);
 return count;
};
export const fixedLP = (players, leg, rules = RULES) => {
  const cash = leg === 0 ? rules.startingCash : 0;
  return {cash, repayment: leg === 0 ? rules.obligation : 0};
};
export function growthDeck(company) {
 const cards=[];
 DECK_PROFILES[company].forEach((count,n)=>{
  for(let i=0;i<count;i++)cards.push({id:`g${company}:${cards.length}`,kind:"growth",company,printed:n<4?n:0,signature:false,...(n>=4?{effect:n===4?"fumble":"setback"}:{})});
 });
 for(const special of cards.filter(c=>c.printed===(company%6===3?1:2)).slice(0,company%6===3?2:3)){special.signature=SPECIALS[company%6][2];}
 return cards;
}

export const checkpointTarget = g => g.leg === 2 ? 1 : g.rules.checkpointCount;
export const checkpointReached = g => g.companies.filter(c=>c.position >= g.rules.checkpoints[g.leg] && (g.leg!==2 || !c.down)).length >= checkpointTarget(g);

// Economic founder powers share the same valuation in settlement and forecasts.
export function settlementValue(c, companies, rules = RULES) {
 const rank=raceRank(c,companies);
 return c.founder===4&&!c.down&&!c.hiringFumble&&rank===companies.length-1?rules.wangExit:companyValue(c.position,rules);
}
export const canExit = (c, winners, companies = [c]) => winners.includes(c.id) || (c.founder===4&&!c.down&&!c.hiringFumble&&raceRank(c,companies)===companies.length-1);
export const dilution = c => Math.max(1,c.tokens.length);

export const TRACK_COORDS = Array.from({length:24}, (_,i) =>
 i<9 ? [i+1,1] : i<12 ? [9,i-7] : i<21 ? [21-i,5] : [1,25-i]);

export const raceRank = (company, companies) => 1 + companies.filter(c=>compareRace(c,company)<0).length;
export const podium = (companies, places=3) => [...companies].sort(compareRace).slice(0,places).map(c=>c.id);

export const canHireFounder = () => true;

export const sharePayout = (value, shares, rules = RULES) => (rules.moneyScale??1)*Math.floor(value/shares/(rules.moneyScale??1));

export const currencyUnit = rules => rules.currencyUnit ?? 1;
export const floorMoney = (n,rules) => Math.floor(n/currencyUnit(rules))*currencyUnit(rules);

// Panels run left-to-right on top, then right-to-left along the bottom.
export const companyOrder=companies=>{const split=Math.ceil(companies.length/2);return [...companies.slice(0,split),...companies.slice(split).reverse()].map(c=>c.id);};

// IPO is confirmed only after every round effect has resolved.
export const ipoFinisher = g => podium(g.companies.filter(c=>c.position>=g.rules.checkpoints.at(-1)&&!c.down),1)[0]??null;
