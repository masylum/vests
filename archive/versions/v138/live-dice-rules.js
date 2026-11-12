export const LIVE_DICE_VERSION = '138-discard-growth-preview';
export const DICE = Object.freeze({
  bland: Object.freeze([0, 1, 1, 1, 2, 2]),
  mild: Object.freeze(['x', 0, 1, 2, 2, 3]),
  spicy: Object.freeze(['x', 'x', 1, 2, 3, 3]),
});
export const LEG_ENDS = Object.freeze([8, 16, 24]);
// Doubled $16 ceiling, with increasing rewards for the final stretch.
export const PROGRESSIVE_EXITS = Object.freeze([0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,4,4,6,6,9,9,12,12,16,16]);
export function exitPrice(position) {
  return PROGRESSIVE_EXITS[Math.max(0,Math.min(24,Math.floor(position)))];
}
export function rollDie(random, kind) {
  if (!Object.hasOwn(DICE,kind)) throw Error('Choose bland, mild, or spicy dice.');
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
