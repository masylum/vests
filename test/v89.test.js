import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,quote} from '../src/engine.js';
import {secondaryValue} from '../src/bots.js';
import {canHireFounder,dilution} from '../src/config.js';
function setup(owners,position=10){const g=createGame();g.fast=true;g.companies.forEach(c=>{c.founder=-1;c.position=15;});const c=g.companies[0];c.founder=7;c.position=position;c.tokens=owners.map(owner=>({owner}));return{g,c};}
test('Jerry has ordinary dilution and is eligible for hiring in every leg',()=>{
 const{g,c}=setup([0,1,2],24);assert.equal(dilution(c),3);assert.equal(quote(c,g.rules,g.companies),33);
 assert([0,1,2].every(leg=>canHireFounder(7,leg)));
 const rows=g.companies.map(()=>({expectedFinalShares:3,finalPrices:[12],futureShares:[[0]]}));c.reserve=0;
 const withJerry=secondaryValue(g,0,0,rows);c.founder=-1;assert.equal(secondaryValue(g,0,0,rows),withJerry);
});
