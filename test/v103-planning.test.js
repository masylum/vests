import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,currentPlayer,command,observation,holdings,lead,assertGame} from '../src/engine.js';
import {botCommand,cardScenario,weekendGain} from '../src/bots.js';
import {portfolioOptions} from '../src/valuation.js';
import {intelTargets} from '../src/intel.js';
import {resolveRevealPhase,resolveIntelActions,shareholderReactions} from '../src/racing.js';
function fixture(kind,rules={}){
 const g=createGame({players:2,seed:4,rules}),id=currentPlayer(g),other=1-id,c=g.companies[0];
 c.tokens=[{id:1,owner:id,paid:0},{id:2,owner:other,paid:0}];c.lastBuy[other]=2;c.lastBuy[id]=1;c.position=18;
 const hand=g.players[id].intel,zones=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)];
 if(!hand.some(x=>x.kind===kind)){const zone=zones.find(z=>z.some(x=>x.kind===kind)),i=zone.findIndex(x=>x.kind===kind);[zone[i],hand[0]]=[hand[0],zone[i]];}
 return {g,id,other,c,card:hand.findIndex(x=>x.kind===kind)};
}
function founder(g,c,id){const old=c.founder,other=g.companies.find(x=>x.founder===id);if(other)other.founder=old;else{const zone=[g.founderMarket,g.founderSupply].find(x=>x.includes(id));zone[zone.indexOf(id)]=old;}c.founder=id;}
for(const [name,position] of [['last rival stake',6],['stealing lead',12],['just before exit',23]])test(`Stake Purchase: ${name}`,()=>{
 const {g,id,other,c,card}=fixture('stake');c.position=position;founder(g,c,13);const cash=g.players[other].cash;
 const predicted=cardScenario(observation(g,id),id,'stake',0,undefined,{seller:other});
 command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:0,seller:other});
 assert.equal(holdings(c,other),0);assert.equal(lead(c),id);assert.equal(g.players[other].cash-cash,[6,12,18][Math.floor((position-1)/8)]);assert.equal(predicted.players[id].cash,g.players[id].cash);assert.equal(lead(predicted.companies[0]),id);assertGame(g);
});
test('Transfer forecast retires and issues shares, changes lead and preserves cash',()=>{
 const {g,id,c}=fixture('transfer');const d=g.companies[1];d.tokens=[{owner:id},{owner:1-id}];const s=cardScenario(observation(g,id),id,'transfer',0,1);
 assert.equal(holdings(s.companies[0],id),0);assert.equal(s.companies[0].tokens.length,1);assert.equal(holdings(s.companies[1],id),2);assert.equal(lead(s.companies[1]),id);assert.equal(s.players[id].cash,g.players[id].cash);assert.equal(c.tokens.length,2);
});
test('last portfolio stake retains future-card access even with no remaining supply',()=>{
 const {g,id,c}=fixture('focused');c.position=5;g.companies.forEach(x=>x.position=5);const v=observation(g,id);v.companies.forEach(x=>{x.supplyCount=0;});v.poolWeights=v.poolWeights.map(()=>0);
 assert.ok(portfolioOptions(v,id)>0);v.companies[0].tokens=[];assert.equal(portfolioOptions(v,id),0);
});
test('Weekend pays its cost and cannot earn value from discards, duplicate cards or overspending',()=>{
 assert.equal(weekendGain([0,0,0],1),0);
 assert.ok(weekendGain([4,4],1)>0);
 const same=[{value:4,key:'same',cost:0,companies:[]},{value:4,key:'same',cost:0,companies:[]}];assert.equal(weekendGain(same,1),0);
 assert.equal(weekendGain([{value:4,key:1,cost:4,companies:[]},{value:4,key:2,cost:4,companies:[]}],1,4),0);
});
test('financing requires one supply token and costs a capital step',()=>{
 const {g,id,c,card}=fixture('financing');const before=c.supply.length;command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:0});assert.equal(c.supply.length,before-1);assert.equal(g.players[id].capital,1);assertGame(g);
 const v=observation(g,id);v.companies[0].supplyCount=1;assert.ok(intelTargets(v,id,'financing').includes(0));assert.ok(!intelTargets(v,id,'matching').includes(0));
});
test('Anya moves two with discard/no replacement and no deployment',()=>{
 {const {g,id,c}=fixture('focused');founder(g,c,26);c.position=10;c.tokens=[{owner:id}];g.companies.slice(1).forEach(x=>x.down=true);const hand=g.players[id].intel.length,supply=c.supply.length;resolveRevealPhase(g,'start',true);command(g,id,{type:'power',choice:1});assert.equal(c.position,12);assert.equal(c.supply.length,supply);assert.equal(g.players[id].intel.length,hand-1);}
});
test('shareholder reaction preserves the card backward cost',()=>{
 {const {g,id,c,card}=fixture('dividend');founder(g,c,17);c.position=12;command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:0});assert.equal(c.position,11);assertGame(g);}
});
test('proposal own bid is the bid the bot submits under the same public state',()=>{
 const g=createGame({players:2,seed:103}),id=currentPlayer(g),v=observation(g,id),audit=[];
 botCommand(v,id,{samples:4,audit});const plans=audit.filter(x=>x.action.type==='call');assert.ok(plans.length);
 for(const plan of plans){const s=structuredClone(v);s.phase='bid';s.auction={company:plan.action.company,host:id,reserve:1,bids:[]};assert.equal(botCommand(s,id,{samples:4}).amount,plan.ownBid);}
});
test('bot deliberately purchases a rival share immediately before exit',()=>{
 const {g,id,other,c,card}=fixture('stake');founder(g,c,13);c.position=23;g.companies.slice(1).forEach(x=>{x.position=1;x.down=true;});
 const v=observation(g,id);v.phase='intelPlay';v.players[id].intel=[v.players[id].intel[card]];
 const cmd=botCommand(v,id,{samples:12});assert.equal(cmd.type,'playIntel');assert.equal(cmd.company,0);assert.equal(cmd.seller,other);
});
