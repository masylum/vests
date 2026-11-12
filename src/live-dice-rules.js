import {companyValue,raceRank} from './config.js';
export const LIVE_DICE_VERSION = '157-immediate-rolls';
export const DICE = Object.freeze({
  bland: Object.freeze([0, 1, 1, 1, 2, 2]),
  mild: Object.freeze(['x', 0, 1, 2, 2, 3]),
});
export const LEG_ENDS = Object.freeze([8, 16, 24]);
// Classic total-company curve; settlement divides this among issued shares.
export const PROGRESSIVE_EXITS=Object.freeze(Array.from({length:25},(_,position)=>companyValue(position)));
export function exitPrice(position){return PROGRESSIVE_EXITS[Math.max(0,Math.min(24,Math.floor(position)))];}
export function shareExitPrice(company,position=company.position){return Math.floor(exitPrice(position)/Math.max(1,company.tokens.length));}
export function rollDie(random, kind) {
  if (!Object.hasOwn(DICE,kind)) throw Error('Choose bland or mild dice.');
  const sample=random();
  if (!Number.isFinite(sample)||sample<0||sample>=1) throw Error('Invalid die randomness.');
  const face=Math.floor(sample*6),value=DICE[kind][face],printed=value==='x'?0:value;
  return {kind,face,printed,fumble:value==='x'};
}
export function validateDice(kinds,count=2) {
  if(!Array.isArray(kinds)||kinds.length!==count||!kinds.every(k=>Object.hasOwn(DICE,k)))
    throw Error(`Choose ${count} dice.`);
  return [...kinds];
}

export const DEAL_COPIES = 8;

export function diceCompanyValue(g,c){return Math.max(exitPrice(c.position),c.founder===4&&!c.down&&!c.hiringFumble&&raceRank(c,g.companies)===g.companies.length-1?75:0);}
export function diceSharePrice(g,c){return projectedSharePrice(g,c);}

export const PER_SHARE_EXITS=Object.freeze([0,0,0,0,0,0,0,0,0,0,0,1,2,3,4,5,6,8,10,12,14,16,18,21,24]);
export function trackExitPrice(g,position){
 // The current curve rewards every space from 4 onward; retain old study curves.
 if(g.payoutMode==='perShare'&&g.exitCurve==='early5')return Math.max(0,Math.min(24,Math.floor(position))-4);
 if(g.payoutMode==='perShare'&&g.exitCurve==='early4')return Math.max(0,Math.min(24,Math.floor(position))-3);
 return g.payoutMode==='perShare'?Math.round(PER_SHARE_EXITS[Math.max(0,Math.min(24,Math.floor(position)))]*(g.perShareMax??24)/24):exitPrice(position);}
export function projectedSharePrice(g,c,position=c.position,shares=c.tokens.length){
 const ordinary=g.payoutMode==='perShare'?trackExitPrice(g,position):Math.floor(exitPrice(position)/Math.max(1,shares));
 const secondLast=c.founder===4&&!c.down&&!c.hiringFumble&&raceRank(c,g.companies)===g.companies.length-1;
 const special=secondLast?(g.diceRevision>=156&&g.payoutMode==='perShare'?16:Math.floor(75/Math.max(1,shares))):0;
 return Math.max(ordinary,special);
}

export function secretBonusDeck(companies){return Array.from({length:companies},(_,company)=>({id:company,plus5:company,plus3:(company+1)%companies}));}
export function secretBonusPerShare(g,player,company){const card=g.players[player]?.secretBonus;return card?(card.plus5===company?5:card.plus3===company?3:0):0;}
export function investorSharePrice(g,c,player,position=c.position,shares=c.tokens.length){return projectedSharePrice(g,c,position,shares)+secretBonusPerShare(g,player,c.id);}
