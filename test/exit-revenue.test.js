import test from 'node:test';import assert from 'node:assert/strict';
import {exitRevenue} from '../scripts/exit-revenue.js';
const settlement=()=>({final:true,prices:[12,0,7],holdings:[[2,3,0],[1,0,1]],outstanding:[4,3,2],accounts:[{player:0,before:10,paid:30,cash:4,sold:[2,3,0]},{player:1,before:4,paid:23,cash:0,sold:[1,0,1]}]});
test('exit attribution uses actual investor sales, excluding non-player shares, debt and unsold positions',()=>{
 const r=exitRevenue(settlement(),[[0,1,0],[2],[1,3]]);
 assert.deepEqual(r.byPlayer,[[24,0,0],[12,0,7]]);assert.equal(r.total,43);
 assert.deepEqual(r.companies.map(c=>c.revenue),[36,0,7]);
 assert.deepEqual(r.founders.find(f=>f.founder===1),{founder:1,companies:[0,2],receipts:[24,19],revenue:43});
 assert.equal(r.founders.find(f=>f.founder===0).revenue,36);assert.equal(r.founders.find(f=>f.founder===2).revenue,0);
});
test('exit attribution rejects incomplete sales, duplicate accounts and unreconciled cash',()=>{
 for(const alter of [s=>s.accounts.pop(),s=>s.accounts.push(s.accounts[0]),s=>s.accounts[0].sold[0]--,s=>s.accounts[0].cash++]){const s=settlement();alter(s);assert.throws(()=>exitRevenue(s,[[0],[1],[2]]));}
});

test('actual final settlement honors ordinary Jerry dilution, Jenkins extra exit and fumbled Jenkins',async()=>{
 const {createGame,command,currentPlayer}=await import('../src/engine.js');
 const g=createGame();g.companies.forEach((c,id)=>{c.position=[24,23,22,20,21,19][id];c.founder=id===0?7:id===3||id===4?3:0;c.down=id===4;c.tokens=[{owner:0},{owner:1},{owner:null}];});
 // Jenkins Wang's identity is looked up to keep this test about accounting, not IDs.
 const {FOUNDERS}=await import('../src/config.js');const jenkins=FOUNDERS.findIndex(f=>f.name==='Jenkins Wang');g.companies[3].founder=g.companies[4].founder=jenkins;
 g.ipoCompany=0;g.phase='cycleResult';g.cycleEnd='ipo';g.queue=[];
 command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'settle');
 while(g.phase==='settle'){const id=currentPlayer(g);command(g,id,{type:'sell',shares:g.companies.map(c=>c.tokens.filter(t=>t.owner===id).length)});}
 const r=exitRevenue(g.settlement,g.companies.map(c=>[c.founder]));
 assert.equal(r.companies[0].price,33);assert.equal(r.companies[0].revenue,66); // Non-player shares dilute actual investor receipts.
 assert.equal(r.companies[3].price,25);assert.equal(r.companies[3].revenue,50);
 assert.equal(r.companies[4].revenue,0);assert.equal(r.total,g.bank.payout);
});
