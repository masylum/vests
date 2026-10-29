import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,assertGame,observation,resolveCard,deployReserves} from '../src/engine.js';
import {INTEL_CARDS,intelDeck,intelTargets,canDrawIntel} from '../src/intel.js';
import {resolveRevealPhase,returnDiscarded} from '../src/racing.js';
const act=(g,cmd)=>command(g,currentPlayer(g),cmd);
function fixture(kind){
 const g=createGame({seed:123,rules:{intelMode:'mixed'}}),id=currentPlayer(g);
 for(const p of g.players)g.intelDeck.push(...p.intel.splice(0));
 const i=g.intelDeck.findIndex(c=>c.kind===kind);g.players[id].intel.push(...g.intelDeck.splice(i,1));
 g.companies.forEach(c=>c.down=true);const c=g.companies[0];c.tokens=[{id:1,owner:id,paid:0}];c.lastBuy[id]=1;
 act(g,{type:'call',company:null});return {g,c,id};
}
function discard(g,c,count=1,burned=false){const cards=c.supply.splice(0,count);for(const card of cards){g.removed.push({...card,...(burned?{burned:true}:{revealed:true})});if(!burned)c.history.push({...card});}return cards;}
function founder(g,c,founder){const other=g.companies.find(x=>x.founder===founder),old=c.founder;if(other)other.founder=old;else{const list=g.founderMarket.includes(founder)?g.founderMarket:g.founderSupply;list[list.indexOf(founder)]=old;}c.founder=founder;}
test('14 unique value cards, one of each, and a hard hand limit of 3',()=>{
 const deck=intelDeck();assert.equal(deck.length,14);assert.equal(new Set(deck.map(c=>c.kind)).size,14);assert.equal(Object.keys(INTEL_CARDS).length,14);
 const {g,id}=fixture('bridge');g.players[id].intel.push(...g.intelDeck.splice(0,2));assert(!canDrawIntel(g,id));const before=structuredClone(g);assert.throws(()=>act(g,{type:'drawValue'}),/at most 3/);assert.deepEqual(g,before);assertGame(g);
});

test('Financial advisor requires exactly two public discards and returns them without revealing unseen burns',()=>{
 const {g,c,id}=fixture('advisor');c.position=9;const burned=discard(g,c,1,true)[0];assert(!intelTargets(g,id,'advisor').includes(0));
 const cards=discard(g,c,2),stock=c.supply.length;assert(intelTargets(observation(g,id),id,'advisor').includes(0));
 act(g,{type:'playIntel',card:0,company:0});assert.equal(c.position,10);assert.equal(c.supply.length,stock+2);assert.deepEqual(c.supply.slice(-2).map(c=>c.id),cards.map(c=>c.id));assert(g.removed.some(c=>c.id===burned.id));assert.equal(c.history.length,0);assertGame(g);
});
test('a returned paid card can be funded again without breaking supply or paid-deployment conservation',()=>{
 const {g,c}=fixture('advisor');c.reserve=1;g.purchaseSummary=[];deployReserves(g);const card=g.pile.find(c=>c.paid&&c.company===0);g.pile.splice(g.pile.indexOf(card),1);c.down=false;resolveCard(g,card);
 returnDiscarded(g,0,1);assert.equal(c.supply.at(-1).id,card.id);assert(!c.supply.at(-1).paid);assertGame(g);
 c.supply.unshift(c.supply.pop());c.reserve=1;deployReserves(g);assertGame(g);assert.equal(g.pile.find(c=>c.id===card.id).fundingCount,2);
});

test('Melania reacts once when targeted second by a multi-company card, never on an unrelated target or draw',()=>{
 const {g,c,id}=fixture('move'),m=g.companies[1];founder(g,m,17);m.down=false;m.position=5;m.tokens=[{id:1,owner:id}];m.lastBuy[id]=1;c.position=5;
 act(g,{type:'playIntel',card:0,company:0,target:1});assert.equal(c.position,6);assert.equal(m.position,8);assert.equal(g.valueResult.reactions.filter(r=>r.founder===17&&r.kind==='move').length,1);assertGame(g);
});
