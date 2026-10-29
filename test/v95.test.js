import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../simulate.js';
import {replayGame} from '../src/engine.js';

test('each LP owes 60 at settlement and reduces the same replay score by 5 per LP versus 55',()=>{
 const game=simulate({seed:950001,players:4,samples:2,rules:{intelMode:'mixed'},trace:true});
 const previous=replayGame({...game.replay,setup:{...game.replay.setup,rules:{...game.replay.setup.rules,obligation:55}}});
 for(const account of game.settlement.accounts){
  const count=1+game.replay.commands.filter(c=>c.id===account.player&&c.cmd.type==='raiseMoney').length;
  assert.equal(account.due,60*count);
  assert.equal(game.scores[account.player],previous.scores[account.player]-5*count);
 }
});
