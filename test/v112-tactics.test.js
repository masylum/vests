import test from'node:test';import assert from'node:assert/strict';
import{createGame,currentPlayer,observation,burnPile,assertGame,command}from'../src/engine.js';
import{resolvedCard,sampledGame}from'../src/bot-scenarios.js';import{botCommand}from'../src/bots.js';import{intelTargets,intelDeck}from'../src/intel.js';import{ACTIVE_FOUNDERS}from'../src/config.js';
test('burn is an ordinary returnable discard, without resolving its movement',()=>{
 const g=createGame({players:2,seed:112}),id=currentPlayer(g),token=g.pile[0],c=g.companies[token.company],before=c.position;
 burnPile(g,()=>0);assert.ok(g.removed.some(t=>t.id===token.id&&!t.burned));assert.equal(c.position,before);assert.ok(c.history.some(t=>t.id===token.id));assertGame(g);
 c.tokens=[{id:1,owner:id}];const v=observation(g,id);assert.ok(intelTargets(v,id,'inside').includes(c.id));
 v.players[id].intel=[{id:999,kind:'inside'}];const after=resolvedCard(v,id,'inside',c.id);assert.equal(after.companies[c.id].discardCount,0);assert.equal(after.poolWeights[c.id],v.poolWeights[c.id]+1);
});
test('hypothetical search uses observations, never real hidden orders',()=>{
 const a=createGame({players:3,seed:112}),id=currentPlayer(a),b=structuredClone(a);b.pile.reverse();b.intelDeck.reverse();b.founderSupply.reverse();b.companies.forEach(c=>c.supply.reverse());
 const rival=b.players.find(p=>p.id!==id);[rival.intel[0],b.intelDeck[0]]=[b.intelDeck[0],rival.intel[0]];
 assert.deepEqual(sampledGame(observation(a,id),id),sampledGame(observation(b,id),id));
});
function tactical(){
 const g=createGame({players:2,seed:10}),id=currentPlayer(g);
 g.companies.forEach((c,i)=>{c.position=[18,16,17,3][i];c.founder=[13,0,6,3][i];c.tokens=[];c.down=false;c.hiringFumble=false;});
 g.companies[0].tokens=[{id:1,owner:id},{id:2,owner:id}];g.companies[1].tokens=[{id:1,owner:id}];g.companies[2].tokens=[{id:1,owner:1-id}];
 g.founderMarket=[9,4,20];g.founderSupply=ACTIVE_FOUNDERS.filter(f=>!g.founderMarket.includes(f)&&!g.companies.some(c=>c.founder===f));
 const zones=[g.intelDeck,g.intelDiscard,...g.players.map(p=>p.intel)],zone=zones.find(x=>x.some(c=>c.kind==='recover')),index=zone.findIndex(c=>c.kind==='recover'),card=zone.splice(index,1)[0];
 g.intelDiscard.push(...g.players[id].intel);g.players[id].intel=[card];assertGame(g);
 return{g,v:observation(g,id),id};
}
test('Rebalance moves the majority investment ahead and accounts for the minority moved back',()=>{
 const{v,id}=tactical();v.players[id].intel=[{id:999,kind:'swap'}];v.companies[0].tokens=[{owner:id},{owner:1-id},{owner:1-id},{owner:1-id}];v.companies[1].tokens=[{owner:id}];v.companies[2].founder=5;
 const after=resolvedCard(v,id,'swap',0,1);assert.equal(after.companies[1].position,18);assert.equal(after.companies[0].position,16);
 const audit=[];v.phase='intelPlay';const play=botCommand(v,id,{samples:24,audit});assert.equal(play.type,'playIntel');assert.ok(audit.find(e=>e.card).card.candidates.some(c=>c.value>0));
});
test('Weekend cannot spend a card as Paid Advice fuel and play that same card',async()=>{
 const{weekendGain}=await import('../src/bots.js');
 const actions=[{value:4,key:'advice',keys:['advice','fuel'],cost:0,companies:[]},{value:4,key:'fuel',cost:0,companies:[]}];
 assert.equal(weekendGain(actions,1),0);
});
test('two Paid Advice copies can each be played while discarding the other',()=>{
 const{v,id}=tactical();v.players[id].intel=intelDeck().filter(c=>c.kind==='advice');
 assert.doesNotThrow(()=>botCommand(v,id,{samples:4}));
 assert.deepEqual(resolvedCard(v,id,'advice',0,undefined,{discard:0}),resolvedCard(v,id,'advice',0,undefined,{discard:1}));
 for(const discard of[0,1]){const after=resolvedCard(v,id,'advice',0,undefined,{discard});assert.equal(after.players[id].cash,v.players[id].cash+3);assert.equal(after.players[id].intel.length,1);assert.equal(after.companies[0].position,v.companies[0].position+1);}
});
