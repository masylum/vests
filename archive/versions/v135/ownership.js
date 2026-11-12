export function shareCount(company,id){
 let count=0;
 for(const token of company.tokens)if(token.owner===id)count++;
 return count;
}

// Latest purchase breaks equal holdings; a complete tie retains player order.
export function shareLeader(company){
 if(company.latestInvestor){
  const latest=Math.max(...company.lastBuy);
  return latest>0?company.lastBuy.indexOf(latest):null;
 }
 if(company.mandate!=null&&shareCount(company,company.mandate)>0)return company.mandate;
 const counts=new Array(company.lastBuy.length).fill(0);
 for(const token of company.tokens)if(token.owner!==null)counts[token.owner]++;
 let leader=null,best=0;
 for(let id=0;id<counts.length;id++)if(counts[id]>best||(counts[id]&&counts[id]===best&&company.lastBuy[id]>company.lastBuy[leader])){
  leader=id;best=counts[id];
 }
 return leader;
}
