// Shares pay once, at the final top-three exit; grants and obligations accumulate.
export function portfolioWealth(view,id,values,sample,{payment=0,company=null}={}) {
 const p=view.players[id];
 let wealth=p.cash-payment-(values[0].futureSpending?.[id]?.[sample]??0)+(p.savedCash??0)-(p.debt??0)-(p.fees??0)-p.obligation;
 for(const c of view.companies){const held=c.tokens.filter(t=>t.owner===id).length+Number(company===c.id)+(values[c.id].futureShares?.[id]?.[sample]??0);wealth+=held*(values[c.id].finalPrices?.[sample]??values[c.id].legPrices?.at(-1)?.[sample]??values[c.id].prices[sample]);}
 return wealth;
}
