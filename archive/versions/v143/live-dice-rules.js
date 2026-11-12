import {companyValue} from './config.js';
export const LIVE_DICE_VERSION = '143-support-first';
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

export const DEAL_COPIES = 9;
