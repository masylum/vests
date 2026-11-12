import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,RULES,growthDeck,fundedCards} from '../src/config.js';
import {createGame,assertGame,burnPile} from '../src/engine.js';
import {investorIcon,investorSharesHTML} from '../src/share-icons.js';
test('current build ships the requested 15-token, six-reveal, one-discard flow',()=>{
 assert.equal(VERSION,128);assert.equal(RULES.revealsPerRound,6);assert.equal(RULES.burnPerRound,1);
 const g=createGame({players:4,seed:42});
 for(const c of g.companies){assert.equal(growthDeck(c.id).length,15);assert.equal(c.supply.length,14);assert.equal(g.pile.filter(t=>t.company===c.id).length,1);}
 for(const [payment,count] of [[1,1],[5,1],[6,2],[9,2],[10,2],[11,3]])assert.equal(fundedCards(0,payment),count);
 const positions=g.companies.map(c=>c.position);burnPile(g,()=>0);
 assert.equal(g.pile.length,5);assert.equal(g.removed.length,1);assert.ok(g.removed.every(t=>t.discarded&&!t.burned));assert.deepEqual(g.companies.map(c=>c.position),positions);assertGame(g);
});
test('the lead spot replaces exactly one owned share, including a mandate leader',()=>{
 const c={tokens:[{owner:0},{owner:0},{owner:1},{owner:null}]};
 const count=html=>(html.match(/data-share-owner=/g)??[]).length;
 assert.equal(count(investorSharesHTML(c,0)),2);assert.equal(count(investorSharesHTML(c,1)),2);assert.equal(count(investorSharesHTML(c,null)),3);
 assert.equal(count(investorSharesHTML({tokens:[{owner:0}]},0)),0);
 for(let id=0;id<4;id++)assert.match(investorIcon(id),/class="investor-icon lucide/);
});
