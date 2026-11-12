import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame} from '../src/engine.js';
import {COMPANIES,FOUNDERS,ACTIVE_FOUNDERS} from '../src/config.js';
import {intelTargets,intelSecondTargets,INTEL_CARDS,intelValue} from '../src/intel.js';
function fixture(kind){
 const g=createGame({players:4,seed:109}),id=currentPlayer(g),hand=g.players[id].intel;
 if(!hand.some(x=>x.kind===kind)){const zone=[g.intelDeck,...g.players.filter(p=>p.id!==id).map(p=>p.intel)].find(z=>z.some(x=>x.kind===kind)),i=zone.findIndex(x=>x.kind===kind);[zone[i],hand[0]]=[hand[0],zone[i]];}
 for(const c of g.companies){c.down=true;c.position=10;c.tokens=[];}
 for(const c of g.companies.slice(0,2)){c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;}
 return {g,id,card:hand.findIndex(x=>x.kind===kind)};
}
test('setup accepts two to four investors and only the six retained companies',()=>{
 assert.equal(COMPANIES.length,6);assert.ok(!COMPANIES.some(c=>['Orbix','Airnest'].includes(c.name)));
 for(const players of [2,3,4]){const g=createGame({players});assert.equal(g.companies.length,players+2);assertGame(g);}
 assert.throws(()=>createGame({players:5}),/2 to 4/);
});
test('Focused Execution requires two different portfolio companies and pays the backward cost',()=>{
 const {g,id,card}=fixture('focused');g.companies[0].position=1;assert.ok(!intelTargets(g,id,'focused').includes(0));
 g.companies[0].position=10;assert.deepEqual(intelSecondTargets(g,id,'focused',0),[1]);
 command(g,id,{type:'valueAction'});const before=JSON.stringify(g);
 for(const target of [0,2,undefined]){assert.throws(()=>command(g,id,{type:'playIntel',card,company:0,target}));assert.equal(JSON.stringify(g),before);}
 const supply=g.companies.map(c=>c.supply.length);command(g,id,{type:'playIntel',card,company:0,target:1});
 assert.equal(g.companies[0].position,8);assert.equal(g.companies[1].position,12);assert.deepEqual(g.companies.map(c=>c.supply.length),supply);assertGame(g);
});
test('Focused Execution scoring accounts for the stake moved backward as well as forward',()=>{
 const {g,id}=fixture('focused');g.companies[0].tokens.push({owner:id});g.companies[1].tokens.push({owner:1-id},{owner:1-id});
 assert.ok(intelValue(g,id,'focused',0,1)<0);assert.ok(intelValue(g,id,'focused',1,0)>0);
});
test('Matching Funds can spend exactly three coins; Weekend can spend exactly two',()=>{
 for(const [kind,cost] of [['matching',3],['weekend',0]]){
  const {g,id,card}=fixture(kind),p=g.players[id];g.bank.issued-=p.cash-cost;p.cash=cost;
  assert.ok(intelTargets(g,id,kind).length);command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:kind==='weekend'?-1:0});assert.equal(p.cash,0);assertGame(g);
 }
});
test('Bridge Financing requires one token and a free capital step, without granting cash',()=>{
 const {g,id,card}=fixture('financing'),c=g.companies[0];g.pile.push(...c.supply.splice(1));const cash=g.players[id].cash;
 g.players[id].capital=6;assert.ok(!intelTargets(g,id,'financing').includes(0));g.players[id].capital=5;
 command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:0});assert.equal(c.position,12);assert.equal(c.supply.length,0);assert.equal(g.players[id].capital,6);assert.equal(g.players[id].cash,cash);assertGame(g);
});
test('card and founder identities and typography use the requested names',()=>{
 assert.equal(INTEL_CARDS.session.name,'Infamous Ousting');assert.equal(INTEL_CARDS.public.name,'Convertible Notes');
 for(const [id,name] of [[23,'Bony Ma'],[24,'Danilo Egg'],[25,'Patricio Colson']]){assert.equal(FOUNDERS[id].name,name);assert.ok(ACTIVE_FOUNDERS.includes(id));}
 for(const card of Object.values(INTEL_CARDS)){assert.ok(!card.text.includes('**'),card.name);assert.ok(!card.text.includes('Requires '));}
 assert.ok(FOUNDERS.every(f=>!f.trigger.includes('Reveal start')));
});
