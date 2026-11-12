import test from 'node:test';import assert from 'node:assert/strict';
import{createGame,command,currentPlayer,observation,resolveCard,assertGame}from'../src/engine.js';
import{resolveIntelActions,resolveSharePurchase,resolveRevealPhase}from'../src/racing.js';
import{weekendGain,botCommand,saleValue,forecasts}from'../src/bots.js';
function positioned(){const g=createGame({players:4,seed:127});g.companies.forEach((c,i)=>{c.founder=-1;c.position=i===0?10:20;c.down=false;});return g;}
test('Patricio: a two-space move gains exactly one extra, and a new move can trigger again',()=>{
 const g=positioned(),c=g.companies[0];c.founder=25;
 for(const expected of[13,16]){resolveIntelActions(g,[{kind:'move',company:0,amount:2}],null,{interactive:false});assert.equal(c.position,expected);}
});
test('Patricio gets no extra step when leading or when the destination is occupied',()=>{
 for(const occupied of[false,true]){const g=positioned(),c=g.companies[0];c.founder=25;g.companies.slice(1).forEach(x=>x.position=occupied?12:5);resolveIntelActions(g,[{kind:'move',company:0,amount:2}],null,{interactive:false});assert.equal(c.position,12);}
});
test('Jerry uses the lead before purchase, even when the buyer takes leadership',()=>{
 const g=createGame({players:4,seed:127}),id=currentPlayer(g),other=(id+1)%4,c=g.companies[0];const old=c.founder,otherCompany=g.companies.find(x=>x.founder===7);if(otherCompany)otherCompany.founder=old;else {const pool=[g.founderMarket,g.founderSupply].find(a=>a.includes(7));pool[pool.indexOf(7)]=old;}c.founder=7;c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;c.position=10;
 command(g,id,{type:'call',company:0});while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===other?1:0});assert.equal(c.position,12);assertGame(g);
});
test('Jerry is inactive while fumbled and has no automatic reveal movement',()=>{
 const g=positioned(),c=g.companies[0];c.founder=7;c.down=true;resolveSharePurchase(g,0,1,{previousLead:0});assert.equal(c.position,10);c.down=false;resolveRevealPhase(g,'start');assert.equal(c.position,10);
});
test('Working Weekend can call capital twice, respecting the ordered six-step capacity',()=>{
 const actions=[{value:2,key:'cap0',cashDelta:10,cost:0,companies:[]},{value:2,key:'cap1',requires:['cap0'],cashDelta:10,cost:0,companies:[]}];assert.ok(weekendGain(actions,1,0)>1);assert.equal(weekendGain(actions.slice(0,1),1,0),0);
});
test('Working Weekend can call capital before a funded action; idle liquidity alone earns no bonus',()=>{
 const a=[{value:0,key:'capital',cashDelta:10,cost:0,companies:[]},{value:5,key:'raise',cost:8,companies:[0]}];assert.ok(weekendGain(a,1,0)>4);assert.equal(weekendGain(a.slice(0,1),1,0),0);assert.equal(weekendGain([0,0],1),0);
});
test('bots preserve a just-hired last stake and do not rehire that company this turn',()=>{
 const g=createGame({players:4,seed:127}),id=currentPlayer(g),c=g.companies[0];c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;
 command(g,id,{type:'changeFounder',company:0});command(g,id,{type:'founder',choice:0});assert.deepEqual(g.turnHires,[0]);const v=observation(g,id),values=forecasts(v,id,{samples:4});assert.equal(saleValue(v,id,0,values),-Infinity);const audit=[];botCommand(v,id,{samples:4,audit});assert.ok(!audit.some(x=>x.action?.type==='changeFounder'&&x.action.company===0));assert.equal(g.actionsLeft,1);assertGame(g);
});
test('Bridge Financing moves Patricio exactly three spaces and deploys one token',()=>{
 const g=createGame({players:4,seed:127}),id=currentPlayer(g),c=g.companies[0],old=c.founder;
 const co=g.companies.find(x=>x.founder===25);if(co)co.founder=old;else{const pool=[g.founderMarket,g.founderSupply].find(a=>a.includes(25));pool[pool.indexOf(25)]=old;}c.founder=25;c.position=11;g.companies.slice(1).forEach(x=>x.position=23);c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;
 const hand=g.players[id].intel;let card=hand.findIndex(c=>c.kind==='financing');if(card<0){const pool=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)].find(a=>a.some(c=>c.kind==='financing')),i=pool.findIndex(c=>c.kind==='financing');[pool[i],hand[0]]=[hand[0],pool[i]];card=0;}
 const supply=c.supply.length;command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:0});assert.equal(c.position,14);assert.equal(c.supply.length,supply-1);assert.equal(g.players[id].capital,1);assertGame(g);
});
test('Working Weekend can fundraise twice for the same company without reusing a card',()=>{
 const raises=[{value:4,key:'raise:0:0',companies:[],cost:2},{value:3,key:'raise:0:1',requires:['raise:0:0'],companies:[],cost:2}];assert.ok(weekendGain(raises,1,4)>2);assert.equal(weekendGain(raises,1,2),0);
});
