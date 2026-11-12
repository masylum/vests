import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiceGame,diceCommand,diceObservation,currentPlayer,FOUNDERS} from '../archive/versions/v135/live-dice-engine.js';
import {diceBot,diceEvaluations} from '../archive/versions/v135/live-dice-bots.js';
import {resolveRevealPhase} from '../archive/versions/v135/racing.js';
function opening(){const g=createDiceGame({seed:42,players:4,dealCopies:9});while(g.round===0){const id=currentPlayer(g);diceCommand(g,id,diceBot(diceObservation(g,id),id));}for(const c of g.companies){c.down=true;c.hiringFumble=false;}g.founderUsed=[];return g;}
function assign(g,cid,f){const old=g.companies[cid].founder,c=g.companies.find(c=>c.founder===f);if(c)c.founder=old;else {const pool=g.founderMarket.includes(f)?g.founderMarket:g.founderSupply;pool[pool.indexOf(f)]=old;}g.companies[cid].founder=f;g.companies[cid].down=false;}
test('Gill waits for her own activation and is limited across purchases until the next round',()=>{
 const g=opening();const cid=g.companies.find(c=>c.tokens.length)?.id??0;const turn={phase:g.phase,queue:[...g.queue],active:g.active};
 assign(g,cid,3);
 resolveRevealPhase(g,'start',true,(cid+1)%6);
 assert.equal(g.powerChoice,undefined);assert.deepEqual(g.founderUsed,[]);
 resolveRevealPhase(g,'start',false,cid);assert.ok(g.founderUsed.includes(cid));
 const positions=g.companies.map(c=>c.position);
 resolveRevealPhase(g,'start',false,cid);assert.deepEqual(g.companies.map(c=>c.position),positions);
 // A full round of legal non-funding actions resets the same limit used by purchases.
 Object.assign(g,turn);for(let i=0;i<4;i++)diceCommand(g,currentPlayer(g),{type:'raiseMoney',deal:0});
 assert.equal(g.round,2);assert.deepEqual(g.founderUsed,[]);
 resolveRevealPhase(g,'start',true,cid);assert.ok(g.founderUsed.includes(cid));
});
test('purchase command only runs its own timed founder, and bot forecasts agree',()=>{
 const g=opening();assign(g,0,13);
 const id=currentPlayer(g);let deal=g.players[id].dealFlow.findIndex(c=>c.company!==0);
 assert.ok(deal>=0);const company=g.players[id].dealFlow[deal].company;
 const withFounder=diceEvaluations(diceObservation(g,id),id,company);
 const without=structuredClone(g);without.companies[0].founder=-1;
 assert.deepEqual(withFounder,diceEvaluations(diceObservation(without,id),id,company));
 diceCommand(g,id,{type:'call',deal,company});
 while(g.phase!=='chooseDice'){const p=currentPlayer(g);diceCommand(g,p,diceBot(diceObservation(g,p),p));}
 const before=g.companies[0].position;
 diceCommand(g,currentPlayer(g),{type:'chooseDice',dice:['safe','safe']});
 assert.equal(g.phase,'flowRoll');assert.equal(g.companies[0].position,before);assert.ok(!g.founderUsed.includes(0));
});
test('own activation still runs automatic hooks and text defines the round limit',()=>{
 const g=opening();assign(g,0,13);const before=g.companies[0].position;
 resolveRevealPhase(g,'start',false,0);assert.equal(g.companies[0].position,before+1);
 assert.equal(FOUNDERS[3].trigger,'Once per round, before I activate');
 assert.equal(FOUNDERS[11].trigger,'Once per round');
});
