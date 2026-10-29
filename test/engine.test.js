import {createGame as currentGame} from '../src/engine.js';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,RULES,TRACK_COORDS,growthDeck,companyValue,fundingPrices,fundedCards,fundingBand,fixedLP} from './legacy-config.js';
import {createGame,command,currentPlayer,eligibleCompanies,lead,holdings,quote,clone,observation,assertGame,replayGame,resolveCardBase,resolveCard} from './legacy-engine.js';
import {simulate} from '../simulate.js';
function act(g,cmd){command(g,currentPlayer(g),cmd);assertGame(g)}
function bids(g,amounts){while(g.phase==='bid')act(g,{type:'bid',amount:amounts[currentPlayer(g)]});}
function through(g,phase){for(let i=0;g.phase!==phase&&i<1000;i++){if(g.phase==='call')act(g,{type:'call',company:null});else if(g.phase==='founder')act(g,{type:'founder',choice:-1});else act(g,{type:'continue'});}assert.equal(g.phase,phase)}
test('3–5 players receive fixed public pockets/obligations; no Market decks or private hands',()=>{
 for(const players of [3,4,5]){const g=createGame({players});assertGame(g);assert.equal(g.phase,'call');assert.equal(g.companies.length,players+2);assert.equal(g.pile.length,players+2);for(const c of g.companies)assert.equal(g.pile.filter(card=>card.company===c.id).length,1);assert.equal(g.marketDraw,undefined);assert(g.players.every(p=>p.cash===40&&p.obligation===46&&!p.hand&&!p.offers));assert.equal(new Set(g.companies.map(c=>c.founder)).size,g.companies.length);}
 assert.throws(()=>createGame({players:2}));assert.throws(()=>createGame({seed:-1}));
});
test('companies start on space 1 without an opening deal',()=>{
 const g=createGame();for(const c of g.companies){assert.equal(c.position,1);assert.equal(c.supply.length,growthDeck(c.id).length-1);assert.equal(c.purchased,0);assert.equal(c.treasury,undefined);assert.equal(c.openingCard,null);}assert.equal(g.metrics.purchased,0);
});
test('printed stocks, exits and leg funding thresholds are exact',()=>{
 const d=growthDeck(0);assert.equal(d.length,20);assert.equal(d.filter(x=>!x.effect&&x.printed===0).length,0);assert.equal(d.filter(x=>x.printed===1).length,12);assert.equal(d.filter(x=>x.printed===2).length,7);assert.equal(d.filter(x=>x.effect==='fumble').length,1);
 assert.equal(companyValue(3),0);assert.equal(companyValue(10),1);assert.equal(companyValue(16),13);assert.equal(companyValue(24),50);
 assert.deepEqual(fundingPrices(0),[1,3,6]);assert.deepEqual(fundingPrices(2),[3,5,10]);
 assert.deepEqual([0,0,1,2,3,5,6,20].map(n=>fundedCards(0,n)),[0,0,1,1,2,2,3,3]);
});
test('one optional auction call per player, no more than N, caller controls highest ties',()=>{
 const g=createGame({seed:42}),host=currentPlayer(g),cid=eligibleCompanies(g,host)[0];act(g,{type:'call',company:cid});assert.equal(g.auction.host,host);
 bids(g,g.players.map(()=>30));assert.equal(g.auction.winner,host);assert.equal(g.auction.paid,30);assert.equal(lead(g.companies[cid]),host);
 act(g,{type:'continue'});assert.equal(g.phase,'call');assert.notEqual(currentPlayer(g),host);assert(!eligibleCompanies(g,currentPlayer(g)).includes(cid));
 through(g,'purchaseResult');assert.equal(g.metrics.auctions,1);assert.equal(g.called.length,1);
});
test('other investors cannot call a led company, repeated calls and invalid commands reject atomically',()=>{
 const g=createGame(),id=currentPlayer(g),cid=0,c=g.companies[cid];c.tokens=[{id:1,owner:(id+1)%4}];c.lastBuy[(id+1)%4]=1;
 const before=clone(g);assert.throws(()=>command(g,id,{type:'call',company:cid}));assert.deepEqual(g,before);
 assert.throws(()=>command(g,id,{type:'call',company:99}));act(g,{type:'call',company:null});
});
test('second price, sole bidder, pass, affordability and sealed privacy',()=>{
 for(const amounts of [[2,5,3,1],[0,0,1,0],[0,0,0,0]]){const g=createGame();act(g,{type:'call',company:0});const before=clone(g);assert.throws(()=>command(g,currentPlayer(g),{type:'bid',amount:1000}));assert.deepEqual(g,before);const id=currentPlayer(g);act(g,{type:'bid',amount:amounts[id]});const v=observation(g,(id+1)%4);assert.equal(v.auction.bids[0].amount,undefined);bids(g,amounts);assert.equal(g.auction.paid,amounts[1]===5?3:amounts[2]>0?amounts[2]:0);}
});
test('growth-band minimum applies and second price funds projects',()=>{
 const g=createGame();g.companies[0].position=8;g.companies[0].boughtCycle=2;
 act(g,{type:'call',company:0});assert.equal(g.auction.reserve,1);
 bids(g,[10,4,1,0]);assert.equal(g.auction.paid,4);assert.equal(g.players[0].cash,36);assert.equal(g.bank.burn,4);
 const h=createGame();act(h,{type:'call',company:0});bids(h,[1,2,3,0]);assert.equal(h.auction.winner,2);assert.equal(h.auction.paid,2);assert.equal(h.companies[0].tokens.length,1);
});
test('non-caller highest ties retain clockwise open raises',()=>{
 const g=createGame();const host=currentPlayer(g);act(g,{type:'call',company:0});bids(g,g.players.map(p=>p.id===host?0:20));assert.equal(g.phase,'tie');const eventual=g.queue.at(-1);while(g.phase==='tie')act(g,{type:'tie',amount:0});assert.equal(g.auction.winner,eventual);assert.equal(g.auction.paid,20);
});
test('auction stores three charges without adding cards immediately',()=>{
 const g=createGame();act(g,{type:'call',company:0});bids(g,g.players.map(()=>10));
 assert.equal(g.companies[0].reserve,3);assert.equal(g.auction.cards,5);assert.equal(g.pile.length,6);
 act(g,{type:'continue'});through(g,'purchaseResult');assert.equal(g.drawsLeft,5);assert.equal(g.metrics.purchased,2);assert.equal(g.companies[0].reserve,2);assertGame(g);
});
test('all-pass opening cycles use only seeded cards without free-card founders',()=>{
 const g=createGame({seed:45});through(g,'purchaseResult');assert.equal(g.poolSize,6);assert.equal(g.drawsLeft,5);act(g,{type:'continue'});let revealed=0;while(['reveal','power'].includes(g.phase)){if(g.phase==='power')act(g,{type:'power',choice:0});else{act(g,{type:'reveal'});revealed++;}}assert.equal(revealed,5);if(g.phase==='afterRevealReady')command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');act(g,{type:'continue'});assert.equal(g.cycle,2);assert.equal(g.phase,'call');
});
test('fumble and go back do not dilute shares',()=>{
 const g=createGame(),c=g.companies[0];g.companies.forEach(x=>x.founder=-1);c.position=8;c.tokens=[{id:1,owner:0}];
 resolveCard(g,{kind:'growth',company:0,id:'unit',effect:'fumble'});assert(c.down);assert.equal(c.tokens.length,1);
 resolveCard(g,{kind:'growth',company:0,id:'unit2',effect:'setback'});assert.equal(c.position,8);assert(!c.down);
 resolveCard(g,{kind:"growth",company:0,id:"another-setback",effect:"setback"});assert.equal(c.position,7);
 resolveCard(g,{kind:'growth',company:0,id:'unit3',printed:2});assert.equal(c.position,9);assert(!c.down);
});
test('exact replay, stock and cash conservation, paid-card ledger, and independent score identity',()=>{
 for(const seed of [120001,120002,120003]){const g=simulate({seed,samples:4,trace:true});assert.deepEqual(replayGame(g.replay).scores,g.scores);assertGame(g);assert.equal(g.metrics.purchased,g.metrics.revealedPaid+g.metrics.wastedPaid+g.pile.filter(c=>c.paid).length+g.removed.filter(c=>c.burned&&c.paid).length);assert(g.metrics.auctions<=g.metrics.cycles*4);assert(g.metrics.revealed<=g.metrics.cycles*6);
 for(const p of g.players){let receipts=0,premiums=0;for(const s of g.settlements){const a=s.accounts.find(x=>x.player===p.id);receipts+=a.sold.reduce((sum,n,i)=>sum+n*s.prices[i],0);premiums+=s.contracts[p.id].repayment-s.contracts[p.id].cash;}const payments=g.log.filter(e=>e.type==='auction'&&e.winner===p.id).reduce((sum,e)=>sum+e.paid,0);assert.equal(g.scores[p.id],receipts-payments-premiums-p.fees-g.log.filter(e=>e.type==='raiseMoney'&&e.player===p.id).reduce((n,e)=>n+e.obligation-e.cash,0));}
 }
 assert.throws(()=>replayGame({version:VERSION-1,setup:{},commands:[]}));
});
test('observations omit deck order, removed values, unrevealed races and other sale plans',()=>{
 const g=createGame(),v=observation(g,0);for(const k of ['seed','rng','pile','removed','founderSupply','race','salePlans'])assert.equal(v[k],undefined);assert(v.companies.every(c=>!c.supply&&c.supplyCount===growthDeck(c.id).length-1));
});

test('race has three eight-space bands and at most five issued shares',()=>{
 assert.deepEqual(RULES.checkpoints,[8,16,24]);assert.equal(RULES.shareLimit,5);
 assert.deepEqual([0,1,8,9,16,17,24].map(fundingBand),[0,0,0,1,1,2,2]);
 for(let id=0;id<8;id++){const cards=growthDeck(id);assert.equal(cards.length,[20,21,19,16,18,19,18,20][id]);assert.equal(cards.filter(c=>c.signature).length,id===3?2:3);assert(cards.every(c=>c.printed<=3));}
});

test('browser fixtures are legal current-version states, including hidden founder prompts',()=>{
 const phases={'public-burn':'afterRevealReady','melania-value':'valueResult','ryan-target':'phaseResult','ipo-move':'cycleResult','value-played':'valueResult','value-choice':'intelPlay',jerry:'bid',call:'call',bid:'bid',receipt:'auctionResult',purchase:'purchaseResult',reveal:'reveal',checkpoint:'cycleResult',settlement:'settle',founder:'founder',tie:'tie','power-swap':'power','power-after':'power','power-repair':'power',fumble:'reveal'};
 for(const [name,phase] of Object.entries(phases)){
  const g=replayGame(JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url))));assert.equal(g.phase,phase,name);assertGame(g);

 }
});
test('investors without an eligible company still receive a borrowing opportunity',()=>{
 const g=createGame(),first=g.first,other=(first+1)%4;
 for(const c of g.companies){c.tokens=[{id:1,owner:first}];c.lastBuy[first]=1;}
 assert.equal(eligibleCompanies(g,other).length,0);
 act(g,{type:'call',company:null});assert.equal(g.phase,'call');assert.equal(currentPlayer(g),other);assert.equal(g.metrics.auctions,0);
});

test('an exhausted supply never creates an impossible reveal decision',()=>{
 const g=createGame();g.removed.push(...g.pile.splice(0));for(const c of g.companies)g.removed.push(...c.supply.splice(0).map(x=>({...x,revealed:false})));
 while(g.phase==='call')act(g,{type:'call',company:null});assert.equal(g.phase,'purchaseResult');assert.equal(g.drawsLeft,0);act(g,{type:'continue'});while(['power','afterRevealReady'].includes(g.phase))act(g,g.phase==='power'?{type:'power',choice:0}:{type:'continue'});if(g.phase==='afterRevealReady')command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');
});

test('undrawn cards survive cycle and checkpoint boundaries, with public weights but hidden values',()=>{
 const g=createGame();act(g,{type:'call',company:0});bids(g,g.players.map(()=>10));act(g,{type:'continue'});through(g,'purchaseResult');
 // Guarantee spare cards independently of the seeded hazard mix.
 g.pile.push(...g.companies[0].supply.splice(0,6));g.metrics.entered+=6;
 for(const card of g.pile)card.signature=false;
 const ids=new Set(g.pile.map(c=>c.id));
 act(g,{type:'continue'});
 while(['reveal','power'].includes(g.phase))act(g,g.phase==='power'?{type:'power',choice:0}:g.phase==='reveal'?{type:'reveal'}:{type:'continue'});
 assert(g.pile.length>0);assert(g.pile.every(c=>ids.has(c.id)));assert.equal(g.metrics.wasted,g.metrics.deferred??0);
 const retained=g.pile.map(c=>c.id),v=observation(g,0);
 assert.equal(v.poolWeights.reduce((a,b)=>a+b,0),retained.length);assert(!v.pile);
 act(g,{type:'continue'});through(g,'purchaseResult');
 assert(retained.every(id=>g.pile.some(c=>c.id===id)));assertGame(g);
 // Force a legal checkpoint from the current pile; the rest must survive leg settlement.
 g.companies.forEach(c=>{c.position=11;});
 g.pile.push(...g.companies[0].supply.splice(0,6));g.metrics.entered+=6;
 act(g,{type:'continue'});
 for(let i=0;g.phase!=='cycleResult'&&i<100;i++)act(g,g.phase==='power'?{type:'power',choice:0}:g.phase==='reveal'?{type:'reveal'}:{type:'continue'});
 assert.equal(g.cycleEnd,'checkpoint');const carried=g.pile.map(c=>c.id);assert(carried.length>0);
 act(g,{type:'continue'});
 while(g.phase==='settle')act(g,{type:'sell',shares:g.companies.map(c=>holdings(c,currentPlayer(g)))});
 assert.equal(g.phase,'legResult');act(g,{type:'continue'});through(g,'purchaseResult');
 assert(carried.every(id=>g.pile.some(c=>c.id===id)));assertGame(g);
});

test('only two finishers settle, after every scheduled reveal; cycle limits do not settle early',()=>{
 const g=createGame();g.phase='reveal';g.queue=[];g.active=0;g.cycle=99;
 g.companies.forEach(c=>{c.founder=-1;c.position=1;});g.companies[0].position=8;
 const card=company=>({kind:'growth',company,printed:1,id:'unit'+company});
 g.pile=[card(3)];g.drawsLeft=1;command(g,currentPlayer(g),{type:'reveal'});if(g.phase==='afterRevealReady')command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');assert.equal(g.cycleEnd,null);
 g.phase='reveal';g.revealEnded=false;g.drawsLeft=2;g.companies[2].position=7;g.pile=[card(2),card(0)];
 command(g,currentPlayer(g),{type:'reveal'});assert.equal(g.phase,'reveal');assert.equal(g.companies[2].position,8);
 command(g,currentPlayer(g),{type:'reveal'});if(g.phase==='afterRevealReady')command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');assert.equal(g.cycleEnd,'checkpoint');assert.equal(g.companies[0].position,9);
});

test('Starting cash and obligations persist, with only one final settlement',()=>{
 const finished=simulate({seed:200005,samples:3,policy:'adaptive',trace:true});
 const g=currentGame(finished.replay.setup);let checks=0;
 for(const {id,cmd} of finished.replay.commands){
  const previousPhase=g.phase,previousLeg=g.leg;
  const saved=g.players.map(p=>p.savedCash),cash=g.players.map(p=>p.cash),due=g.players.map(p=>p.obligation);
  command(g,id,cmd);assertGame(g);
  if(g.phase==='legResult'&&previousPhase==='settle'){
   for(const p of g.players){const a=g.settlement.accounts[p.id];assert.equal(p.cash,0);assert.equal(p.savedCash,saved[p.id]+a.cash);assert.equal(a.fee,0);assert.equal(p.fees,0);}
   checks++;
  }
  if(g.leg>previousLeg)for(const p of g.players){assert.equal(p.cash,cash[p.id]+fixedLP(g.players.length,g.leg).cash);assert.equal(p.obligation,due[p.id]+fixedLP(g.players.length,g.leg).repayment);assert.equal(p.savedCash,saved[p.id]);}
 }
 assert.equal(checks,1);
 assert.deepEqual(g.scores,g.players.map(p=>p.savedCash-p.debt));
});

test('an uncontested all-in bidder pays the entire offer, while a rival sets second price',()=>{
 for(const [rival,expected] of [[0,18],[3,3]]) {
  const g=createGame();act(g,{type:'call',company:0});bids(g,[18,rival,0,0]);
  assert.equal(g.auction.winner,0);assert.equal(g.auction.paid,expected);assert.equal(g.players[0].cash,40-expected);assert.equal(g.bank.burn,expected);
 }
});

test('fumbled cards are discarded without consuming any of the six reveal slots',()=>{
 const g=createGame();g.companies.forEach(c=>{c.founder=-1;c.position=1;});g.queue=[];g.phase='reveal';g.active=0;
 const take=cid=>{const c=g.companies[cid],i=c.supply.findIndex(x=>!x.effect&&!x.signature);return c.supply.splice(i,1)[0];};
 g.pile=[take(0),take(1),take(2),take(3),take(4),take(5),take(1)];
 const deferred=g.pile[0];g.companies[0].down=true;g.drawsLeft=6;const before=g.metrics.revealed;
 command(g,0,{type:'reveal'});assert.equal(g.drawsLeft,6);assert.equal(g.lastRevealed.card.id,deferred.id);assert.equal(g.metrics.revealed,before);assert(!g.companies[0].down);assert(g.removed.some(x=>x.id===deferred.id&&x.discarded));assert.equal(g.metrics.deferred,1);
 while(g.phase==='reveal')command(g,currentPlayer(g),{type:'reveal'});
 assert.equal(g.metrics.revealed-before,6);assert.equal(g.pile.length,0);assert(g.companies[0].history.some(x=>x.id===deferred.id));assert.equal(g.metrics.wasted,1);
});

test('discard recovery stops safely when no replacement remains in the shared pile',()=>{
 const g=createGame();g.companies.forEach(c=>{c.founder=-1;c.position=1;c.down=true;});g.queue=[];g.phase='reveal';g.active=0;g.drawsLeft=6;
 g.pile=g.companies.map(c=>c.supply.shift());const supply=g.companies.map(c=>c.supply.length);
 for(let i=0;i<6;i++)command(g,currentPlayer(g),{type:'reveal'});if(g.phase==='afterRevealReady')command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');assert.equal(g.metrics.revealed,0);assert.equal(g.metrics.wasted,6);assert.equal(g.pile.length,0);assert(g.companies.every(c=>!c.down));assert.deepEqual(g.companies.map(c=>c.supply.length),supply);
});

test('company specials conserve finite cards and never create free cycle refills',()=>{
 for(let cid=0;cid<6;cid++){
  const g=createGame({seed:99}),c=g.companies[cid];
  const source=c.supply.some(x=>x.signature)?c.supply:g.pile;
  const i=source.findIndex(x=>x.company===cid&&x.signature);
  assert(i>=0);const card=source.splice(i,1)[0];
  const before=g.pile.length;
  g.companies.forEach(x=>x.position=5);c.position=2;
  resolveCardBase(g,card);assertGame(g);
  if(cid===0)assert.equal(g.pile.length,before+1);
  if(cid===3)assert.equal(g.pile.length,before);
  if(cid===5)assert.equal(c.position,5);
 }
});
test('funding below threshold is rejected without issuing a share',()=>{
 const g=createGame();act(g,{type:'call',company:0});const before=clone(g);
 assert.throws(()=>command(g,currentPlayer(g),{type:'bid',amount:.5}));assert.deepEqual(g,before);
});
test('an empty unfunded cycle stays playable without creating free cards',()=>{
 const g=createGame({seed:45});g.removed.push(...g.pile.splice(0));through(g,'purchaseResult');
 assert.equal(g.poolSize,0);act(g,{type:'continue'});
 while(['power','afterRevealReady'].includes(g.phase))act(g,g.phase==='power'?{type:'power',choice:0}:{type:'continue'});
 if(g.phase==='afterRevealReady')command(g,currentPlayer(g),{type:'continue'});assert.equal(g.phase,'cycleResult');assert.equal(g.cycleEnd,null);assert.equal(g.metrics.purchased,0);
});

test('signature effects refill treasury, recover Weta and swap one nearby company',()=>{
 const take=(g,cid)=>{for(const source of [g.companies[cid].supply,g.pile]){const i=source.findIndex(c=>c.company===cid&&c.signature);if(i>=0)return source.splice(i,1)[0];}throw Error('Missing signature');};
 const a=createGame({seed:99}),am=take(a,1),next=a.pile.find(c=>c.company===1);resolveCardBase(a,am);assert.equal(a.companies[1].reserve,1);assert(a.pile.some(c=>c.id===next.id));assertGame(a);
 const m=createGame({seed:99}),me=take(m,2);m.companies[2].down=true;const before=m.companies[2].position;resolveCard(m,me);assert(!m.companies[2].down);assert.equal(m.companies[2].position,before+2);assertGame(m);
 const t=createGame({seed:99}),te=take(t,4);t.companies.forEach(c=>c.position=1);t.companies[4].position=3;t.companies[0].position=6;[t.companies[4].founder,t.companies[0].founder]=[t.companies[0].founder,t.companies[4].founder];resolveCard(t,te);assert.equal(t.companies[4].position,6);assert.equal(t.companies[0].position,5);assertGame(t);
});

test('five issued shares closes funding, including bank-held shares',()=>{
 const g=createGame(),c=g.companies[0],id=currentPlayer(g);
 c.tokens=Array.from({length:5},(_,i)=>({id:i+1,owner:null}));
 assert(!eligibleCompanies(g,id).includes(0));
 assert.throws(()=>command(g,id,{type:'call',company:0}));assertGame(g);
});
test('funding thresholds follow company growth rather than current leg',()=>{
 const g=createGame();g.companies[0].position=17;
 act(g,{type:'call',company:0});bids(g,g.players.map((p,i)=>i===0?6:0));
 assert.equal(g.auction.cards,3);assertGame(g);
});

test('24 race spaces form one continuous perimeter',()=>{
 assert.equal(TRACK_COORDS.length,24);assert.equal(new Set(TRACK_COORDS.map(x=>x.join(','))).size,24);
 TRACK_COORDS.forEach(([x,y],i)=>{const [a,b]=TRACK_COORDS[(i+1)%24];assert.equal(Math.abs(a-x)+Math.abs(b-y),1);});
});
