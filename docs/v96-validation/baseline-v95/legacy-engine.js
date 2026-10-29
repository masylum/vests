import * as current from './engine.js';
import {RULES} from './legacy-config.js';
export * from './engine.js';
const historical=new WeakSet();
export const createGame=(options={})=>{const g=current.createGame({...options,rules:{...Object.fromEntries(Object.entries(RULES).filter(([key])=>!["checkpoints","maxCycles","shareLimit"].includes(key))),...options.rules}});historical.add(g);return g;};
export const quote=(company,rules=RULES,companies=[company])=>current.quote(company,rules,companies);

export function command(g,id,cmd){
 const result=current.command(g,id,cmd);
 while(historical.has(g)&&g.phase==='phaseResult')current.command(g,current.currentPlayer(g),{type:'continue'});
 return result;
}
