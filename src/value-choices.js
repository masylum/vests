import {intelTargets,intelSecondTargets} from './intel.js';
import {expansionChoices} from './card-expansion.js';
export function valueChoices(g,id){
 const choices=[];
 for(const [card,item] of g.players[id].intel.entries())for(const company of intelTargets(g,id,item.kind)){
  const seconds=intelSecondTargets(g,id,item.kind,company);
  const targets=item.kind==='move'?[undefined,...seconds]:seconds.length?seconds:[undefined];
  for(const target of targets)for(const extra of expansionChoices(g,id,card,company))choices.push({type:'playIntel',card,company,...(target===undefined?{}:{target}),...extra});
 }
 return choices;
}
