import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,currentPlayer,command,assertGame,observation,holdings,lead} from '../src/engine.js';
import {NEW_CARDS,expansionChoices} from '../src/card-expansion.js';
import {intelTargets} from '../src/intel.js';
import {resolveRevealPhase,resolveSharePurchase} from '../src/racing.js';
function founder(g,cid,id){const c=g.companies[cid],old=c.founder,other=g.companies.find(x=>x.founder===id);if(other)other.founder=old;else {const zone=[g.founderMarket,g.founderSupply].find(a=>a.includes(id));zone[zone.indexOf(id)]=old;}c.founder=id;}
function give(g,id,kind){const zones=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)];const hand=g.players[id].intel;if(!hand.some(c=>c.kind===kind)){const zone=zones.find(z=>z.some(c=>c.kind===kind)),i=zone.findIndex(c=>c.kind===kind);[zone[i],hand[0]]=[hand[0],zone[i]];}return hand.findIndex(c=>c.kind===kind);}
function fixture(kind){const g=createGame({players:2,seed:101}),id=currentPlayer(g),other=1-id;founder(g,0,13);founder(g,1,14);g.companies.slice(2).forEach(c=>c.down=true);for(const c of g.companies.slice(0,2)){c.position=10;c.tokens=[{id:1,owner:id,paid:0},{id:2,owner:id,paid:0},{id:3,owner:other,paid:0}];c.lastBuy[id]=++g.serial;}g.players[id].capital=1;g.players[id].cash+=10;g.bank.issued+=10;give(g,id,kind);return {g,id,other,c:g.companies[0]};}
function play(f,kind,extra={}){const {g,id}=f;const card=g.players[id].intel.findIndex(x=>x.kind===kind);command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:['weekend','fresh'].includes(kind)?-1:0,...expansionChoices(g,id,card,['weekend','fresh'].includes(kind)?-1:0)[0],...extra});}
function finish(f){const {g,id}=f;assert.equal(g.phase,'valueResult');command(g,id,{type:'continue'});assertGame(g);}
for(const kind of Object.keys(NEW_CARDS).filter(k=>!['underwritten','rights','public','tender'].includes(k)))test('card: '+kind,()=>{
 const f=fixture(kind),{g,id,other,c}=f,p=g.players[id],startCash=p.cash,startSupply=c.supply.length,startHand=p.intel.length;let extra={};
 if(kind==='insurance'){c.down=true;extra.target=1;}
 if(['transfer','focused'].includes(kind))extra.target=1;
 if(['mandate','coup'].includes(kind)){c.tokens[1].owner=other;}
 play(f,kind,extra);
 if(kind==='clearance'){assert.equal(g.destroyed.length,2);assert.equal(c.supply.length,startSupply-2);assert.equal(p.cash,startCash+5);assert.equal(observation(g,id).destroyed,undefined);assert.equal(g.log.filter(e=>e.type==='clearance')[0].cards.length,2);}
 if(kind==='consolidation'){assert.equal(holdings(c,id),1);assert.equal(c.tokens.length,2);assert.equal(p.capital,0);}
 if(kind==='session')assert.ok(c.down&&c.hiringFumble);
 if(kind==='insurance'){assert.equal(c.down,false);assert.equal(g.companies[1].down,true);}
 if(kind==='weekend'){assert.equal(g.actionsLeft,4);assert.equal(p.cash,startCash);assert.deepEqual(intelTargets(g,id,'weekend'),[]);}
 if(['mandate','coup'].includes(kind))assert.equal(lead(c),id);
 if(kind==='matching'){assert.equal(p.cash,startCash-3);assert.equal(c.supply.length,startSupply-2);}
 if(kind==='dividend'){assert.equal(c.position,8);assert.equal(p.cash,startCash+6);assert.equal(g.players[other].cash,23);}
 if(kind==='stake'){assert.equal(holdings(c,id),3);assert.equal(p.cash,startCash-12);assert.equal(g.players[other].cash,32);}
 if(kind==='focused'){assert.equal(c.position,8);assert.equal(g.companies[1].position,12);assert.equal(c.supply.length,startSupply);}
 if(kind==='advice'){assert.equal(c.position,11);assert.equal(p.cash,startCash+3);assert.equal(p.intel.length,startHand-1);}
 if(kind==='sweat'){assert.equal(c.position,8);assert.equal(c.tokens.length,4);}
 if(kind==='fresh'){assert.equal(p.intel.length,startHand+1);assert.equal(p.cash,startCash);}
 if(kind==='restructure'){assert.equal(c.position,7);assert.equal(p.capital,0);}
 if(kind==='financing'){assert.equal(p.capital,2);assert.equal(p.cash,startCash);assert.equal(c.supply.length,startSupply-1);}
 if(kind==='transfer'){assert.equal(c.tokens.length,2);assert.equal(g.companies[1].tokens.length,4);}
 finish(f);assert.equal(g.actionsLeft,kind==='weekend'?3:1);
});
for(const kind of ['underwritten','tender','rights','public'])test('fundraise card: '+kind,()=>{
 const f=fixture(kind),{g,id,other,c}=f,supply=c.supply.length;play(f,kind,{price:5});
 if(kind==='rights'){command(g,other,{type:'rights',accept:false});assert.equal(g.auction.winner,id);assert.equal(g.auction.paid,5);}
 else if(kind==='public'){command(g,id,{type:'openBid',amount:3});command(g,other,{type:'openBid',amount:4});command(g,id,{type:'openBid',amount:0});assert.equal(g.auction.winner,other);assert.equal(g.auction.paid,4);}
 else {while(g.phase==='bid'){const bidder=currentPlayer(g);command(g,bidder,{type:'bid',amount:bidder===other?9:5});}assert.equal(g.auction.paid,kind==='tender'?9:5);}
 assert.equal(g.phase,'auctionResult');assert.equal(c.supply.length,supply-Math.ceil(g.auction.paid/5)-(kind==='underwritten'?2:0));
 command(g,id,{type:'continue'});finish(f);assert.equal(g.actionsLeft,1);
});
test('invalid choices reject atomically; targets remain portfolio-only',()=>{
 const f=fixture('advice'),{g,id}=f;command(g,id,{type:'valueAction'});const card=g.players[id].intel.findIndex(x=>x.kind==='advice'),before=JSON.stringify(g);
 assert.throws(()=>command(g,id,{type:'playIntel',card,company:0,discard:card}));assert.equal(JSON.stringify(g),before);
 for(const kind of Object.keys(NEW_CARDS).filter(k=>!['weekend','fresh'].includes(k)))assert.ok(!intelTargets(g,id,kind).includes(2));
});
test('mandates end at ownership change and returned shares can be reissued',()=>{const f=fixture('mandate'),{g,id,c,other}=f;c.tokens[1].owner=other;play(f,'mandate');finish(f);command(g,id,{type:'sellShare',company:0});assert.equal(c.mandate,undefined);assert.equal(lead(c),other);});
test('replaced purchase and sale powers stay inactive; Mack does not deploy at reveal start',()=>{
 const f=fixture('focused'),{g,id,c}=f;founder(g,0,23);c.down=true;c.hiringFumble=true;resolveSharePurchase(g,0,id);assert.equal(c.position,10);assert.equal(c.down,true);assert.equal(c.hiringFumble,true);
 founder(g,0,25);resolveSharePurchase(g,0,id,{auction:true,existing:false});assert.equal(c.position,10);resolveSharePurchase(g,0,id,{auction:true,existing:true});assert.equal(c.position,10);
 founder(g,0,24);const before=c.supply.length;command(g,id,{type:'sellShare',company:0});assert.equal(c.position,10);assert.equal(c.supply.length,before);command(g,id,{type:'sellShare',company:0});assert.equal(c.position,10);
 const h=fixture('focused');founder(h.g,0,22);const a=h.c.supply.length,b=h.g.companies[1].supply.length;h.g.companies[1].down=true;resolveRevealPhase(h.g,'start');assert.equal(h.c.supply.length,a);assert.equal(h.g.companies[1].supply.length,b);
});
test('Anya discards exactly one card without replacement',()=>{const f=fixture('focused'),{g,id,c}=f;founder(g,0,26);const hand=g.players[id].intel.length,n=c.supply.length;resolveRevealPhase(g,'start',true);assert.equal(g.phase,'power');command(g,id,{type:'power',choice:1});assert.equal(g.players[id].intel.length,hand-1);assert.equal(c.position,12);assert.equal(c.supply.length,n);});

test('Underwritten self-win grants no extra tokens; all-pass consumes card once',()=>{
 for(const winner of ['self','none']){const f=fixture('underwritten'),{g,id,c}=f,n=c.supply.length;play(f,'underwritten');while(g.phase==='bid'){const player=currentPlayer(g);command(g,player,{type:'bid',amount:winner==='self'&&player===id?8:0});}assert.equal(c.supply.length,n-(winner==='self'?2:0));command(g,id,{type:'continue'});finish(f);assert.equal(g.actionsLeft,1);}
});
test('Rights acceptance pays seller bank price and rejects unaffordable offers atomically',()=>{
 const f=fixture('rights'),{g,id,other,c}=f;command(g,id,{type:'valueAction'});const card=g.players[id].intel.findIndex(x=>x.kind==='rights'),before=JSON.stringify(g);assert.throws(()=>command(g,id,{type:'playIntel',card,company:0,price:31}));assert.equal(JSON.stringify(g),before);command(g,id,{type:'playIntel',card,company:0,price:7});command(g,other,{type:'rights',accept:true});assert.equal(g.auction.winner,other);assert.equal(g.players[other].cash,13);command(g,id,{type:'continue'});finish(f);
});
test('Public Offering passing is final and all-pass produces no share',()=>{
 const f=fixture('public'),{g,id,c}=f;play(f,'public');while(g.phase==='openBid')command(g,currentPlayer(g),{type:'openBid',amount:0});assert.equal(g.auction.winner,null);assert.equal(c.tokens.length,3);command(g,id,{type:'continue'});finish(f);
});
test('sealed first-price tie keeps normal host preference and privacy',()=>{
 const f=fixture('tender'),{g,id,other}=f;play(f,'tender');const bidder=currentPlayer(g);command(g,bidder,{type:'bid',amount:7});const view=observation(g,1-bidder);assert.equal(view.auction.bids[0].amount,undefined);command(g,currentPlayer(g),{type:'bid',amount:7});assert.equal(g.auction.winner,id);assert.equal(g.auction.paid,7);command(g,id,{type:'continue'});finish(f);
});
test('capital and exact movement costs prevent invalid plays',()=>{
 const f=fixture('financing'),{g,id,c}=f;g.players[id].capital=6;assert.deepEqual(intelTargets(g,id,'financing'),[]);g.players[id].capital=0;assert.deepEqual(intelTargets(g,id,'restructure'),[]);c.position=1;assert.deepEqual(intelTargets(g,id,'sweat').filter(x=>x===0),[]);assert.deepEqual(intelTargets(g,id,'dividend').filter(x=>x===0),[]);c.position=24;assert.deepEqual(intelTargets(g,id,'advice').filter(x=>x===0),[]);
});
test('clearance publicly reveals the removed tokens',()=>{
 const f=fixture('clearance');play(f,'clearance');const v=observation(f.g,f.id);assert.equal(v.revealedDestroyed.length,2);assert.equal(f.g.valueResult.destroyedCards.length,2);assertGame(f.g);
});
test('new deck remains conserved after repeated Fresh Perspectives and paid advice',()=>{
 const f=fixture('fresh'),{g,id}=f;play(f,'fresh');finish(f);give(g,id,'fresh');play(f,'fresh');finish(f);assert.equal(g.players[id].intel.length,5);assertGame(g);
});

test('Anya options stay private until a card is discarded',()=>{const f=fixture('focused'),{g,id}=f;founder(g,0,26);resolveRevealPhase(g,'start',true);assert.ok(observation(g,id).powerChoice.options.length>1);assert.equal(observation(g,1-id).powerChoice.options,undefined);command(g,id,{type:'power',choice:1});assertGame(g);});
test('empty hands cannot enter the value-card chooser',()=>{const {g,id}=fixture('focused');g.intelDiscard.push(...g.players[id].intel.splice(0));const before=JSON.stringify(g);assert.throws(()=>command(g,id,{type:'valueAction'}),/no value cards/);assert.equal(JSON.stringify(g),before);assertGame(g);});

test('new bidding modes produce affordable bids or pass',async()=>{
 const {botCommand}=await import('../src/bots.js');
 for(const phase of ['rights','openBid','bid']){
  const {g,id,c}=fixture('focused');g.players[id].cash=20;g.players[id].locked=0;c.position=23;c.tokens=[{id:1,owner:id,paid:0}];g.phase=phase;g.queue=[id];g.auction={company:0,host:id,reserve:5,price:6,highBidder:null,bids:[],contenders:[0,1],mode:phase==='bid'?'tender':phase};
  const cmd=botCommand(g,id,{samples:24});if(phase==='rights')assert.equal(cmd.accept,true);else assert.ok(cmd.amount===0||cmd.amount>=5&&cmd.amount<=20,JSON.stringify(cmd));
 }
});
