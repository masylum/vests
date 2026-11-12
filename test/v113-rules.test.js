import test from'node:test';import assert from'node:assert/strict';
import{createGame,currentPlayer,command,assertGame,observation}from'../src/engine.js';
import{botCommand,forecasts}from'../src/bots.js';import{ACTIVE_FOUNDERS}from'../src/config.js';
for(const down of[false,true])test(`ordinary founder hire preserves fumble=${down} and costs one action only`,()=>{
 const g=createGame({players:2,seed:113}),id=currentPlayer(g),c=g.companies[0];c.tokens=[{id:1,owner:id}];c.down=down;const cash=g.players[id].cash;
 command(g,id,{type:'changeFounder',company:0});command(g,id,{type:'founder',choice:0});assert.equal(c.down,down);assert.ok(!c.hiringFumble);assert.equal(g.players[id].cash,cash);assert.equal(g.actionsLeft,1);assertGame(g);
});
test('rival Anya forecasts use visible hand counts, not hidden identities',()=>{
 const g=createGame({players:2,seed:113}),id=currentPlayer(g),other=1-id,c=g.companies[0];c.founder=26;c.tokens=[{owner:other}];c.position=18;
 const v=observation(g,id),empty=structuredClone(v);empty.players[other].intelCount=0;const a=forecasts(v,id,{samples:12,sampler:'independent'}),b=forecasts(empty,id,{samples:12,sampler:'independent'});assert.notDeepEqual(a,b);
 const copy=structuredClone(g);copy.players[other].intel.reverse();assert.deepEqual(botCommand(g,id,{samples:4}),botCommand(copy,id,{samples:4}));
});
test('Jess swaps for a majority holding, but passes when the same swap hurts the portfolio',async()=>{
 const{resolveRevealPhase}=await import('../src/racing.js');
 for(const majorityHere of[true,false]){
  const g=createGame({players:2,seed:113}),id=currentPlayer(g),rival=1-id;
  g.companies.forEach((c,i)=>{c.founder=[2,13,4,3][i];c.position=[21,23,3,4][i];c.tokens=[];});
  g.founderMarket=ACTIVE_FOUNDERS.filter(f=>!g.companies.some(c=>c.founder===f)).slice(0,3);g.founderSupply=ACTIVE_FOUNDERS.filter(f=>!g.founderMarket.includes(f)&&!g.companies.some(c=>c.founder===f));
  g.companies[0].tokens=Array.from({length:4},(_,i)=>({id:i+1,owner:majorityHere?id:i===0?id:rival}));
  g.companies[1].tokens=Array.from({length:4},(_,i)=>({id:i+1,owner:majorityHere?(i===0?id:rival):id}));
  g.companies[0].mandate=id;
  resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.founder,2);const action=botCommand(g,id,{samples:8});assert.equal(action.choice,majorityHere?1:0);
 }
});
test('a healthy newly hired Zack acts at the next reveal without a recovery card',async()=>{
 const{resolveRevealPhase}=await import('../src/racing.js');const g=createGame({players:2,seed:113}),id=currentPlayer(g),c=g.companies[0];
 let choice=g.founderMarket.indexOf(13);if(choice<0){const active=g.companies.find(x=>x.founder===13);if(active)active.founder=g.founderMarket[0];else g.founderSupply[g.founderSupply.indexOf(13)]=g.founderMarket[0];g.founderMarket[0]=13;choice=0;}
 c.tokens=[{id:1,owner:id}];c.position=10;g.companies.slice(1).forEach(x=>x.down=true);const cards=g.players[id].intel.length;
 command(g,id,{type:'changeFounder',company:0});command(g,id,{type:'founder',choice});resolveRevealPhase(g,'start');assert.equal(c.position,11);assert.equal(c.down,false);assert.equal(g.players[id].intel.length,cards);assertGame(g);
});
test('a fumbled company at 24 retains recovery-card and portfolio access value',async()=>{
 const{optionHorizon,portfolioOptions}=await import('../src/valuation.js');const{exchangePlan}=await import('../src/bots.js');
 const g=createGame({players:2,seed:113}),id=currentPlayer(g),c=g.companies[0];c.position=24;c.down=true;c.tokens=[{owner:id}];const v=observation(g,id);
 assert.ok(optionHorizon(v)>0);assert.ok(portfolioOptions(v,id)>0);assert.ok(exchangePlan(v,id).value>0);v.companies[0].down=false;assert.equal(optionHorizon(v),0);
});
