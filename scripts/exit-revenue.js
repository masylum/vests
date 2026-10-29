import assert from 'node:assert/strict';

// Founder credits overlap: each distinct founder receives the company's full payout.
export function exitRevenue(settlement, history) {
 assert.equal(settlement.final, true, 'Expected the final settlement');
 const byPlayer=settlement.holdings.map(()=>settlement.prices.map(()=>0));
 const seen=new Set();
 for(const account of settlement.accounts){
  assert(!seen.has(account.player),'Duplicate investor settlement');seen.add(account.player);
  assert.deepEqual(account.sold,settlement.holdings[account.player],'Final exit must sell every investor share');
  byPlayer[account.player]=account.sold.map((shares,cid)=>shares*settlement.prices[cid]);
  const gross=byPlayer[account.player].reduce((a,b)=>a+b,0);
  assert.equal(account.before+gross-account.paid,account.cash,'Exit cash must reconcile before debt repayment');
 }
 assert.equal(seen.size,byPlayer.length,'Every investor must settle');
 const companies=settlement.prices.map((price,cid)=>({company:cid,price,investorShares:settlement.holdings.reduce((n,row)=>n+row[cid],0),receipts:byPlayer.map(row=>row[cid]),revenue:byPlayer.reduce((n,row)=>n+row[cid],0),founders:[...new Set(history[cid])]}));
 assert(companies.every(c=>Number.isInteger(c.revenue)&&c.revenue>=0),'Exit revenue must be nonnegative whole dollars');
 const founders=[];
 for(const c of companies)for(const founder of c.founders){
  assert(Number.isInteger(founder)&&founder>=0,'Missing founder history');
  const row=founders[founder]??={founder,companies:[],receipts:byPlayer.map(()=>0),revenue:0};
  row.companies.push(c.company);row.revenue+=c.revenue;
  row.receipts=row.receipts.map((cash,id)=>cash+c.receipts[id]);
 }
 return {byPlayer,companies,founders:founders.filter(Boolean),total:companies.reduce((n,c)=>n+c.revenue,0)};
}
