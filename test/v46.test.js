import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,command,currentPlayer,resolveCard,resolveCardBase} from './legacy-engine.js';
import {canHireFounder} from './legacy-config.js';
import {resolveRevealPhase,resumeRace} from '../src/racing.js';
function race(positions){const g=createGame();g.fast=true;g.phase='reveal';g.queue=[];g.priority=0;g.companies=g.companies.slice(0,positions.length);g.companies.forEach((c,i)=>{c.founder=-1;c.position=positions[i];c.tokens=[{owner:0}];c.lastBuy=[1,0,0,0];});return g;}
const fumble=company=>({id:'hazard',company,kind:'growth',effect:'fumble',printed:0});
test('Jerry may be hired in every leg under his shareholder movement power',()=>{
 for(const leg of [0,1,2]){assert(canHireFounder(7,leg));let g;for(let seed=0;seed<100;seed++){g=createGame({seed});if(g.founderMarket.includes(7))break;}
 g.leg=leg;g.phase='founder';g.company=0;g.queue=[0];const choice=g.founderMarket.indexOf(7);
 command(g,0,{type:'founder',choice});assert.equal(g.companies[0].founder,7);}
});
test('Melania no longer shares neighboring fumbles',()=>{
 for(const positions of [[5,5],[5,5,5],[5,6]]){const g=race(positions);g.companies[0].founder=17;resolveCard(g,fumble(1));assert.equal(g.companies[0].down,false);}
 const g=race([5,5]);g.companies[0].founder=17;g.companies[1].founder=11;resolveCard(g,fumble(1));assert(!g.companies[0].down);assert.equal(g.companies[0].position,5);
});
test('Spatial pull stops at the founder rather than overshooting from one space away',()=>{
 for(const target of [4,6]){const g=race([5,target]);g.companies[0].founder=15;resolveRevealPhase(g,'start',true);resumeRace(g,1,resolveCardBase);assert.equal(g.companies[1].position,5);}
});
