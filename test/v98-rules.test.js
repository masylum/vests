import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,eligibleCompanies,assertGame,resolveCard} from '../src/engine.js';
import {growthDeck} from '../src/config.js';
import {intelTargets,intelSecondTargets,INTEL_CARDS} from '../src/intel.js';
import {blockedDestination} from '../src/movement.js';
import {resolveRevealPhase,resolveIntelActions} from '../src/racing.js';

// Core action-economy regressions, updated for v99 lead-only fundraising.
test('setup deals three cards and twenty coins, with fifteen tokens per company',()=>{
 for(const players of [2,3,4]){
  const g=createGame({players});
  assert.ok(g.players.every(p=>p.cash===20&&p.intel.length===3&&p.obligation===0&&p.capital===0));
  assert.equal(g.rules.revealsPerRound,6);
  assert.ok(g.companies.every(c=>c.supply.length===14&&!Object.hasOwn(c,'reserve')));
  assertGame(g);
 }
 const totals=[28,26,32,30,30,30];
 totals.forEach((total,id)=>{
  const tokens=growthDeck(id);assert.equal(tokens.length,15);
  assert.equal(tokens.reduce((sum,t)=>sum+t.printed,0),total);
  assert.ok(tokens.every(t=>!t.signature));
 });
});
test('two repeated cash actions advance capital and pass the turn',()=>{
 const g=createGame(),id=currentPlayer(g);
 command(g,id,{type:'raiseMoney'});assert.equal(currentPlayer(g),id);assert.equal(g.actionsLeft,1);
 command(g,id,{type:'raiseMoney'});assert.notEqual(currentPlayer(g),id);
 assert.equal(g.players[id].cash,40);assert.equal(g.players[id].capital,2);assertGame(g);
});
test('only the lead can fundraise; anyone may bid and payment deploys ceil(payment / 5)',()=>{
 const g=createGame(),id=currentPlayer(g),c=g.companies[0],other=(id+1)%g.players.length;
 c.tokens.push({id:1,owner:id,paid:0});c.lastBuy[id]=++g.serial;
 assert.ok(eligibleCompanies(g,id).includes(0));
 assert.ok(!eligibleCompanies(g,other).includes(0));
 command(g,id,{type:'call',company:0});
 assert.throws(()=>command(g,currentPlayer(g),{type:'raiseMoney'}));
 while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===other?9:0});
 assert.equal(g.auction.winner,other);assert.equal(g.auction.cards,2);assert.equal(c.supply.length,12);
 command(g,id,{type:'continue'});assert.equal(g.phase,'call');assert.equal(g.actionsLeft,1);assertGame(g);
});
test('a bank sale retains dilution and consumes one action',()=>{
 const g=createGame(),id=currentPlayer(g),c=g.companies[0];
 c.tokens.push({id:1,owner:id,paid:0});c.lastBuy[id]=++g.serial;
 command(g,id,{type:'sellShare',company:0});
 assert.equal(c.tokens.length,1);assert.equal(c.tokens[0].owner,null);
 assert.equal(g.players[id].cash,23);assert.equal(g.actionsLeft,1);assertGame(g);
});
test('discard and replacement can be repeated; chooser navigation is free',()=>{
 const g=createGame(),id=currentPlayer(g);
 command(g,id,{type:'valueAction'});command(g,id,{type:'cancelValue'});assert.equal(g.actionsLeft,2);
 for(let i=0;i<2;i++){
  command(g,id,{type:'valueAction'});const discarded=g.players[id].intel[0].id;
  command(g,id,{type:'exchangeValue',card:0});
  assert.equal(g.players[id].intel.length,3);assert.ok(!g.players[id].intel.some(c=>c.id===discarded));
 }
 assert.notEqual(currentPlayer(g),id);assertGame(g);
});
test('retired cards are absent and rebalance requires nearby portfolio companies',()=>{
 for(const kind of ['bridge','learn','waste','secondary','sell'])assert.equal(INTEL_CARDS[kind],undefined);
 const g=createGame(),id=currentPlayer(g);
 for(const c of g.companies.slice(0,2))c.tokens.push({id:1,owner:id,paid:0});
 g.companies[0].position=4;g.companies[1].position=8;
 assert.deepEqual(intelTargets(g,id,'swap'),[]);
 g.companies[1].position=7;assert.deepEqual(intelSecondTargets(g,id,'swap',0),[1]);
});
test('Mario no longer deploys while fumbled; Dan only converts reveal fumbles',()=>{
 const g=createGame(),c=g.companies[0];
 g.companies.forEach(c=>c.founder=-1);c.founder=20;c.down=true;c.position=5;
 assert.equal(blockedDestination(g.companies,1,1,8),8);
 const before=c.supply.length;resolveRevealPhase(g,'start');assert.equal(c.supply.length,before);assert.equal(c.down,true);
 c.founder=11;c.down=false;
 resolveIntelActions(g,[{kind:'fumble',company:0}],{player:0,kind:'smear'});assert.equal(c.down,true);
 c.down=false;const token=c.supply.shift();token.effect='fumble';const position=c.position;
 resolveCard(g,token);assert.equal(c.down,false);assert.equal(c.position,position+2);
});

test('capital adds liquidity but no final points, and deductions may make scores negative',()=>{
 const g=createGame(),id=currentPlayer(g);
 command(g,id,{type:'raiseMoney'});command(g,id,{type:'raiseMoney'});
 g.phase='legResult';g.queue=[];g.active=id;g.finalExit=true;
 command(g,id,{type:'continue'});
 assert.equal(g.scores[id],20);
 assert.ok(g.scores.every(score=>score===20));
 const negative=createGame();negative.players[0].capital=3;
 negative.phase='legResult';negative.queue=[];negative.active=0;negative.finalExit=true;
 command(negative,0,{type:'continue'});assert.equal(negative.scores[0],-10);
});

test('Mack is absent from all founder pools',()=>{
 const g=createGame();
 const founders=[...g.companies.map(c=>c.founder),...g.founderMarket,...g.founderSupply];
 assert.equal(founders.length,26);assert.ok(!founders.includes(18));assertGame(g);
});

test('playing twice replaces each card and spends exactly two actions',()=>{
 const g=createGame(),id=currentPlayer(g),c=g.companies[0];
 g.companies.forEach(c=>c.hiringFumble=true);
 c.tokens.push({id:1,owner:id,paid:0});c.lastBuy[id]=++g.serial;
 const giveRecover=()=>{
  const zones=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)];
  if(g.players[id].intel.some(c=>c.kind==='recover'))return;
  const zone=zones.find(z=>z.some(c=>c.kind==='recover')),i=zone.findIndex(c=>c.kind==='recover');
  [zone[i],g.players[id].intel[0]]=[g.players[id].intel[0],zone[i]];
 };
 for(let action=0;action<2;action++){
  giveRecover();command(g,id,{type:'valueAction'});
  command(g,id,{type:'playIntel',card:g.players[id].intel.findIndex(c=>c.kind==='recover'),company:0});
  assert.equal(g.players[id].intel.length,3);assert.equal(g.phase,'valueResult');
  command(g,id,{type:'continue'});assertGame(g);
 }
 assert.notEqual(currentPlayer(g),id);assert.equal(c.position,3);
});

test('Bazos offers a two-space swap but no three-space swap; Hobbes moves two',()=>{
 const g=createGame();g.companies.forEach(c=>c.founder=-1);
 g.companies[0].founder=2;g.companies[0].position=5;g.companies[0].tokens=[{id:1,owner:0,paid:0}];
 g.companies[1].position=7;g.companies[2].position=8;g.companies[3].position=1;
 resolveRevealPhase(g,'start',true);
 assert.equal(g.phase,'power');assert.ok(g.powerChoice.options.some(o=>o.actions.some(a=>a.kind==='batch'&&a.moves.some(m=>m.company===1))));
 assert.ok(!g.powerChoice.options.some(o=>o.actions.some(a=>a.kind==='batch'&&a.moves.some(m=>m.company===2))));
 const h=createGame();h.companies.forEach(c=>c.founder=-1);h.companies[0].founder=0;h.companies[0].position=5;h.companies[1].position=4;
 resolveCard(h,{id:'stefan-regression',kind:'growth',company:1,printed:1});
 assert.equal(h.companies[0].position,7);
});


test('fundraise legality follows leadership, permits unled entry, and enforces issue cap',()=>{
 const g=createGame(),id=currentPlayer(g),other=(id+1)%g.players.length,c=g.companies[0];
 assert.ok(eligibleCompanies(g,id).includes(0));
 c.tokens.push({id:1,owner:other,paid:0});c.lastBuy[other]=++g.serial;
 assert.throws(()=>command(g,id,{type:'call',company:0}),/company you lead/);
 assert.equal(g.actionsLeft,2);
 c.tokens[0].owner=null;assert.ok(eligibleCompanies(g,id).includes(0));
 while(c.tokens.length<g.rules.shareLimit)c.tokens.push({id:c.tokens.length+1,owner:null,paid:0});
 assert.ok(!eligibleCompanies(g,id).includes(0));
});


test('capital stops at six and a rejected seventh use changes nothing',()=>{
 const g=createGame(),id=currentPlayer(g);g.players[id].capital=5;g.players[id].cash=70;g.bank.issued+=50;
 command(g,id,{type:'raiseMoney'});
 assert.equal(g.players[id].cash,80);assert.equal(g.players[id].capital,6);assertGame(g);
 const before=JSON.stringify(g);assert.throws(()=>command(g,id,{type:'raiseMoney'}),/six uses/);assert.equal(JSON.stringify(g),before);
});
test('bank sales pay 3, 6, 9 by leg',()=>{
 for(const [position,payout] of [[1,3],[8,3],[9,6],[16,6],[17,9],[24,9]]){
  const g=createGame(),id=currentPlayer(g),c=g.companies[0];c.position=position;c.tokens.push({id:1,owner:id,paid:0});c.lastBuy[id]=++g.serial;
  command(g,id,{type:'sellShare',company:0});assert.equal(g.players[id].cash,20+payout);assertGame(g);
 }
});

test('only an investor with no legal action may end their turn',()=>{
 const g=createGame({rules:{intelMode:'off'}}),id=currentPlayer(g);
 assert.throws(()=>command(g,id,{type:'pass'}),/action is available/);
 g.players[id].capital=6;g.players[id].cash=80;g.bank.issued+=60;
 for(const c of g.companies)c.tokens=Array.from({length:5},(_,i)=>({id:i+1,owner:null,paid:0}));
 command(g,id,{type:'pass'});assert.notEqual(currentPlayer(g),id);assertGame(g);
});
