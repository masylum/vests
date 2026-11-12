import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,resolveCard,resolveCardBase,observation,assertGame} from '../src/engine.js';
import {resolveRevealPhase,resolveIntelActions,resolveSharePurchase,resumeRace} from '../src/racing.js';
import {DECK_PROFILES,growthDeck,ACTIVE_FOUNDERS,FOUNDERS} from '../src/config.js';
import {intelTargets} from '../src/intel.js';
import {expansionChoices} from '../src/card-expansion.js';
import {effectPoints,CARD_EFFECTS,revealChance,expectedTokenMovement} from '../src/balance.js';
function founder(g,cid,id){const c=g.companies[cid],old=c.founder,other=g.companies.find(x=>x.founder===id);if(other)other.founder=old;else{const pool=[g.founderMarket,g.founderSupply].find(x=>x.includes(id));pool[pool.indexOf(id)]=old;}c.founder=id;}
function give(g,id,kind){const hand=g.players[id].intel;if(!hand.some(c=>c.kind===kind)){const zone=[g.intelDeck,g.intelDiscard,...g.players.filter(p=>p.id!==id).map(p=>p.intel)].find(z=>z.some(c=>c.kind===kind)),i=zone.findIndex(c=>c.kind===kind);[zone[i],hand[0]]=[hand[0],zone[i]];}return hand.findIndex(c=>c.kind===kind);}
function fixture(kind){const g=createGame({players:4,seed:19}),id=currentPlayer(g),c=g.companies[0];founder(g,0,13);c.position=10;c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;g.companies.slice(1).forEach(c=>c.down=true);give(g,id,kind);return {g,id,c};}
function play({g,id},kind,extra={}){const card=g.players[id].intel.findIndex(c=>c.kind===kind);command(g,id,{type:'valueAction'});command(g,id,{type:'playIntel',card,company:0,...expansionChoices(g,id,card,0)[0],...extra});}
function discard(g,c,select=()=>true){const i=c.supply.findIndex(select),t=c.supply.splice(i,1)[0];g.removed.push({...t,discarded:true});c.history.push(t);return t;}
test('all six company sets have fifteen tokens and compensated recovery-adjusted movement',()=>{
 assert.equal(new Set(DECK_PROFILES.map(x=>x.join(','))).size,6);
 for(let i=0;i<6;i++){const ts=growthDeck(i);assert.equal(ts.length,15);assert.ok(expectedTokenMovement(DECK_PROFILES[i])>=25.5&&expectedTokenMovement(DECK_PROFILES[i])<=26.5);}
 assert.equal(expectedTokenMovement(DECK_PROFILES[1]),26);assert.ok(expectedTokenMovement(DECK_PROFILES[2])>=24);
});
test('Inside Information returns one chosen discard to the bag and never to supply',()=>{
 const f=fixture('inside'),{g,id,c}=f,ts=[discard(g,c),discard(g,c),discard(g,c)];const supply=c.supply.map(t=>t.id),bag=g.pile.length;
 play(f,'inside');assert.equal(g.intelScout.cards.length,3);command(g,id,{type:'scoutIntel',choices:[0]});
 assert.equal(g.pile.length,bag+1);assert.ok(g.pile.some(t=>t.id===ts[0].id));assert.ok(g.removed.some(t=>t.id===ts[2].id));assert.ok(g.removed.some(t=>t.id===ts[1].id));assert.deepEqual(c.supply.map(t=>t.id),supply);assertGame(g);
});
for(const choice of [0,1])test(`Launch Campaign deploys top-two choice ${choice} and leaves the other on top`,()=>{
 const f=fixture('launch'),{g,id,c}=f,before=c.supply.map(t=>t.id);play(f,'launch');assert.equal(g.intelScout.cards.length,2);command(g,id,{type:'scoutIntel',choice});assert.equal(c.supply[0].id,before[1-choice]);assert.deepEqual(c.supply.slice(1).map(t=>t.id),before.slice(2));assert.ok(g.pile.some(t=>t.id===before[choice]));assert.equal(g.players[id].intelKnowledge.top[0].id,before[1-choice]);assertGame(g);
});
test('Executive Hire deploys exactly two tokens and fumbles',()=>{const f=fixture('smear'),n=f.c.supply.length;play(f,'smear');assert.equal(f.c.supply.length,n-2);assert.equal(f.c.down,true);assertGame(f.g);});
test('Inventory Clearance reveals two random removals, pays five, and excludes them from recycling',()=>{const f=fixture('clearance'),cash=f.g.players[f.id].cash;play(f,'clearance');assert.equal(f.g.players[f.id].cash,cash+5);assert.equal(observation(f.g,f.id).revealedDestroyed.length,2);assert.equal(f.g.valueResult.destroyedCards.length,2);assert.ok(!intelTargets(f.g,f.id,'inside').includes(0));assertGame(f.g);});
test('Share Consolidation may retire a sole portfolio share and reopen issuance',()=>{const f=fixture('consolidation');f.g.players[f.id].capital=1;play(f,'consolidation');assert.equal(f.c.tokens.length,0);assert.equal(f.g.players[f.id].capital,0);assertGame(f.g);});
test('Paid Advice moves one, pays three, and loses only the extra card',()=>{const f=fixture('advice'),n=f.c.supply.length,hand=f.g.players[f.id].intel.length;const cash=f.g.players[f.id].cash;play(f,'advice');assert.equal(f.c.position,11);assert.equal(f.c.supply.length,n);assert.equal(f.g.players[f.id].cash,cash+3);assert.equal(f.g.players[f.id].intel.length,hand-1);assertGame(f.g);});
test('Bridge Financing moves two, deploys one, and adds capital without cash',()=>{const f=fixture('financing'),n=f.c.supply.length,cash=f.g.players[f.id].cash;play(f,'financing');assert.equal(f.c.position,12);assert.equal(f.c.supply.length,n-1);assert.equal(f.g.players[f.id].capital,1);assert.equal(f.g.players[f.id].cash,cash);assertGame(f.g);});
test('Board Mandate costs two and all named investment cards remain portfolio-only',()=>{const f=fixture('mandate'),cash=f.g.players[f.id].cash;f.c.tokens.push({id:2,owner:(f.id+1)%f.g.players.length},{id:3,owner:(f.id+1)%f.g.players.length});play(f,'mandate');assert.equal(f.g.players[f.id].cash,cash-2);for(const kind of ['underwritten','rights','public','tender','matching','stake','mandate'])assert.ok(!intelTargets(f.g,f.id,kind).includes(1));assertGame(f.g);});

test('Gill offers his power at reveal start',()=>{const f=fixture('focused'),{g}=f;founder(g,0,3);resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.founder,3);assert.equal(g.race.stage,'start');});
test('Ryan chooses one tied leader to fumble',()=>{const f=fixture('focused'),{g,id,c}=f;founder(g,0,6);c.position=1;g.companies.slice(1).forEach(x=>{x.down=false;x.position=3;});g.companies[1].position=10;g.companies[2].position=10;resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.founder,6);assert.equal(g.powerChoice.mandatory,true);assert.equal(g.powerChoice.options.length,2);command(g,id,{type:'power',choice:0});assert.equal(c.position,2);assert.equal([g.companies[1],g.companies[2]].filter(c=>c.down).length,1);});
test('Bony no longer moves or recovers from a share purchase',()=>{const f=fixture('focused'),{g,c,id}=f;founder(g,0,23);c.down=c.hiringFumble=true;resolveSharePurchase(g,0,id);assert.equal(c.position,10);assert.equal(c.down,true);assert.equal(c.hiringFumble,true);});
test('Danilo no longer reacts to bank sales',()=>{const f=fixture('focused'),{g,c,id}=f;founder(g,0,24);c.tokens.push({id:2,owner:id});const n=c.supply.length;command(g,id,{type:'sellShare',company:0});command(g,id,{type:'sellShare',company:0});assert.equal(c.position,10);assert.equal(c.supply.length,n);assertGame(g);});
test('Dan converts only the first fumble of the reveal; Harry can help the second',()=>{
 const f=fixture('focused'),{g,id}=f;founder(g,0,9);founder(g,2,11);const c=g.companies[2];c.down=false;c.position=10;c.tokens=[{owner:id}];
 const tokens=c.supply.filter(t=>t.effect==='fumble');assert.ok(tokens.length>=2);for(const token of tokens.slice(0,2)){c.supply.splice(c.supply.findIndex(t=>t.id===token.id),1);resolveCard(g,token,{interactive:true});}
 assert.equal(c.position,12);assert.equal(c.down,true);assert.equal(g.powerChoice.founder,9);resumeRace(g,1,resolveCardBase);assert.equal(c.down,false);
});
test('Julie requires two coins, charges them once, and uses the token for her company',()=>{
 const f=fixture('focused'),{g,c,id}=f;founder(g,0,16);const other=g.companies[1];other.down=false;const index=other.supply.findIndex(t=>!t.effect),token=other.supply.splice(index,1)[0],cash=g.players[id].cash,burn=g.bank.burn;
 resolveCard(g,token,{interactive:true});assert.equal(g.powerChoice.founder,16);resumeRace(g,1,resolveCardBase);assert.equal(g.players[id].cash,cash-2);assert.equal(g.bank.burn,burn+2);assert.equal(c.position,10+token.printed);assert.ok(g.julieUsed.includes(0));
});
test('Anya deploys no tokens and Mack Ja replaces Indie in the active pool',()=>{const f=fixture('focused'),{g,c,id}=f;founder(g,0,26);const n=c.supply.length,hand=g.players[id].intel.length;resolveRevealPhase(g,'start',true);command(g,id,{type:'power',choice:1});assert.equal(c.position,12);assert.equal(c.supply.length,n);assert.equal(g.players[id].intel.length,hand-1);assert.equal(FOUNDERS[22].name,'Mack Ja');assert.ok(ACTIVE_FOUNDERS.includes(22));assert.ok(!ACTIVE_FOUNDERS.includes(18));});
test('valuation worksheet shows the financing tradeoff and persistent bag',()=>{assert.ok(Math.abs(revealChance()-0.9)<1e-12);assert.ok(Number.isFinite(effectPoints(CARD_EFFECTS.financing)));assert.ok(Number.isFinite(effectPoints(CARD_EFFECTS.matching)));});
test('Julie offers no paid power when its lead has only one coin',()=>{const f=fixture('focused'),{g,id}=f;founder(g,0,16);g.bank.issued-=g.players[id].cash-1;g.players[id].cash=1;const c=g.companies[1];const token=c.supply.splice(c.supply.findIndex(t=>!t.effect),1)[0];resolveCard(g,token,{interactive:true});assert.notEqual(g.powerChoice?.founder,16);assert.equal(g.players[id].cash,1);});
test('Lei-Lei cannot pull a company three spaces away',()=>{const f=fixture('focused'),{g,c}=f;founder(g,0,15);g.companies[1].position=c.position+3;g.companies[2].position=c.position+2;resolveRevealPhase(g,'start',true);assert.equal(g.powerChoice.founder,15);const targets=g.powerChoice.options.flatMap(o=>o.actions.filter(a=>a.kind==='move').map(a=>a.company));assert.ok(!targets.includes(1));assert.ok(targets.includes(2));});
test('Brittney cannot join the nearest company when it is three spaces ahead',()=>{const f=fixture('focused'),{g,c}=f;founder(g,0,19);g.companies.slice(1).forEach(x=>x.position=c.position+3);resolveRevealPhase(g,'start',true);assert.notEqual(g.powerChoice?.founder,19);assert.equal(c.position,10);});
test('Max skips Stefan without triggering his landing power',()=>{const f=fixture('focused'),{g,c}=f;founder(g,0,0);founder(g,1,12);c.position=4;g.companies[1].position=3;g.companies[1].down=false;resolveCard(g,{id:'max-test',kind:'growth',company:1,printed:1});assert.equal(c.position,4);assert.equal(g.companies[1].position,5);});
test('Inside Information targets its company for Melania’s one-space reaction',()=>{const f=fixture('inside'),{g,id,c}=f;founder(g,0,17);discard(g,c);discard(g,c);play(f,'inside');command(g,id,{type:'scoutIntel',choices:[0]});assert.equal(c.position,11);assertGame(g);});
