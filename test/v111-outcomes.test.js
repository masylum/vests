import test from 'node:test';import assert from 'node:assert/strict';
import{createGame,command,currentPlayer,observation,assertGame}from'../src/engine.js';
import{botCommand,cardScenario,forecasts}from'../src/bots.js';import{opponentBids,adaptiveBid}from'../src/adaptive.js';
for(const players of [2,3,4])test(`six draws then one face-up bag discard (${players} investors)`,()=>{
 const g=createGame({players,seed:111}),host=currentPlayer(g);g.companies.forEach(c=>c.hiringFumble=true);
 command(g,host,{type:'call',company:0});while(g.phase==='bid')command(g,currentPlayer(g),{type:'bid',amount:currentPlayer(g)===host?20:0});command(g,currentPlayer(g),{type:'continue'});
 while(g.phase==='call')command(g,currentPlayer(g),{type:'raiseMoney'});
 const before=g.pile.length;
 for(let n=0;g.phase!=='cycleResult'&&n<100;n++)command(g,currentPlayer(g),g.phase==='reveal'?{type:'reveal'}:g.phase==='power'?{type:'power',choice:0}:{type:'continue'});
 assert.equal(g.phase,'cycleResult');assert.equal(g.rules.revealsPerRound,6);assert.equal(g.rules.burnPerRound,1);
 assert.equal(g.log.filter(e=>['reveal','deferred'].includes(e.type)).length,6);
 assert.equal(g.log.filter(e=>e.type==='burn').length,1);assert.equal(g.pile.length,Math.max(0,before-7));assert.ok(g.log.find(e=>e.type==='burn').cards.every(t=>g.removed.some(x=>x.id===t.id&&!x.burned)));assertGame(g);
});
test('a dry bag does not manufacture a burned token',()=>{
 const g=createGame({players:2});g.companies.forEach(c=>c.hiringFumble=true);g.phase='reveal';g.queue=[];g.active=g.first;g.drawsLeft=5;
 const count=g.pile.length;for(let n=0;g.phase==='reveal'&&n<10;n++)command(g,currentPlayer(g),{type:'reveal'});
 assert.equal(g.pile.length,0);assert.equal(g.removed.filter(t=>t.burned).length,0);assert.equal(g.log.filter(e=>['reveal','deferred'].includes(e.type)).length,count);assertGame(g);
});
function situation(kind){
 const g=createGame({players:2,seed:111,rules:{revealsPerRound:4}}),id=currentPlayer(g);g.companies.forEach((c,i)=>{c.position=i<2?19+i*3:1;c.founder=0;c.tokens=[];c.down=false;});
 g.companies[0].tokens=[{owner:id},{owner:id},{owner:1-id}];g.companies[1].tokens=[{owner:id},{owner:1-id},{owner:1-id}];g.companies[0].lastBuy[id]=2;g.companies[1].lastBuy[1-id]=2;g.companies[1].founder=13;g.founderMarket=[14,3,26];
 if(['mandate','coup'].includes(kind)){g.companies[0].tokens=[{owner:id},{owner:1-id},{owner:1-id}];g.companies[0].lastBuy[1-id]=2;g.companies[0].position=12;g.companies[1].position=1;}
 const v=observation(g,id);v.players[id].intel=[{kind,id:100}];return{v,id};
}
for(const kind of ['headhunt','swap','mandate','coup'])test(`${kind}: action and card selection share the same outcome value`,()=>{
 const {v,id}=situation(kind),before=structuredClone(v),audit=[];botCommand(v,id,{samples:12,audit});const call=audit.find(x=>x.card)?.card;
 v.phase='intelPlay';const playAudit=[];botCommand(v,id,{samples:12,audit:playAudit});const play=playAudit.find(x=>x.card)?.card;
 assert.ok(Number.isFinite(call.value),kind);assert.equal(call.value,play.value);assert.equal(call.company,play.company);assert.equal(call.target,play.target);v.phase=before.phase;assert.deepEqual(v,before);
});
test('control cards account for the reachable follow-up and its opportunity cost',()=>{
 for(const kind of ['mandate','coup']){const {v,id}=situation(kind);v.companies[0].founder=-1;const get=state=>{const audit=[];botCommand(state,id,{samples:12,audit});return audit.find(x=>x.card).card.value;};const two=get(v);v.actionsLeft=1;const one=get(v);assert.ok(two>one+.1,kind);}
});
test('headhunting changes the forecast when a good founder moves to the majority holding',()=>{
 const {v,id}=situation('headhunt'),s=cardScenario(v,id,'headhunt',0,1);assert.equal(s.companies[0].founder,13);assert.equal(s.companies[1].founder,0);
 assert.notDeepEqual(forecasts(s,id,{samples:8}),forecasts(v,id,{samples:8}));
});
test('rival model remembers a pass only while the public opportunity remains unchanged',()=>{
 const {v,id}=situation('swap'),other=1-id;v.auctionHistory=[{company:0,winner:null,bids:[{player:id,amount:0},{player:other,amount:0}],cash:v.players.map(p=>p.cash),context:{positions:v.companies.map(c=>c.position),founders:v.companies.map(c=>c.founder),owners:v.companies.map(c=>c.tokens.map(t=>t.owner)),down:v.companies.map(c=>!!(c.down||c.hiringFumble))}}];
 assert.ok(opponentBids(v,id,0,15,()=>.5).every(row=>row[other]===0));v.companies[0].founder=7;assert.ok(opponentBids(v,id,0,15,()=>.5).some(row=>row[other]>0));
});

test('a proposer may pass while a genuinely profitable rival-funded round retains value',()=>{
 const g=createGame({players:2,seed:111,rules:{revealsPerRound:4}}),id=currentPlayer(g),other=1-id,v=observation(g,id);v.companies[0].tokens=[{owner:id},{owner:id}];v.auction={company:0,host:id,reserve:1,mode:'sealed'};
 const values=price=>v.companies.map(c=>({expected:c.id===0?price:0,value:c.id===0?price:0,prices:[c.id===0?price:0],finalPrices:[c.id===0?price:0],roundsToExit:[0]}));
 const base=values(10),outcome=(winner,paid)=>values(winner===null?10:winner===other?20:3);
 const plan=adaptiveBid(v,id,base,()=>.5,outcome,true);assert.equal(plan.amount,0);assert.ok(plan.otherWin>0);assert.ok(plan.value>plan.baselineValue);assert.ok(plan.expectedPayment>0);
 v.players[other].cash=0;const dry=adaptiveBid(v,id,base,()=>.5,outcome,true);assert.equal(dry.saleProbability,0);assert.ok(Math.abs(dry.value-dry.baselineValue)<1e-9);
});
test('response modeling does not read hidden deck order or rival card identities',()=>{
 const g=createGame({players:3,seed:11177}),id=currentPlayer(g),copy=structuredClone(g);
 for(const c of copy.companies)c.supply.reverse();copy.pile.reverse();copy.intelDeck.reverse();
 const other=copy.players.find(p=>p.id!==id);[other.intel[0],copy.intelDeck[0]]=[copy.intelDeck[0],other.intel[0]];
 assert.deepEqual(observation(g,id),observation(copy,id));assert.deepEqual(botCommand(g,id,{samples:8}),botCommand(copy,id,{samples:8}));
});
