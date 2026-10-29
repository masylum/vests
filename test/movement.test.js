import test from 'node:test';
import assert from 'node:assert/strict';
import {movementSteps} from '../src/movement.js';
import {createGame,observation} from './legacy-engine.js';
import {forecasts} from '../src/bots.js';
test('animation preserves card and chained movement order, including backwards moves',()=>{
 const events=[{card:{company:0},effect:{before:3,after:5},reactions:[{text:'1: 6 → 5'},{text:'0: 5 → 6'}]}];
 assert.deepEqual(movementSteps(events,[3,6],[6,5]),[{company:0,from:3,to:5},{company:1,from:6,to:5},{company:0,from:5,to:6}]);
});
test('animation includes swaps and movement without a log entry once',()=>{
 assert.deepEqual(movementSteps([{moves:[{company:0,after:8},{company:1,after:2}]}],[2,8,1],[8,2,3]),[{company:0,from:2,to:8},{company:1,from:8,to:2},{company:2,from:1,to:3}]);
});
test('auction labels alone cannot change forecast random samples',()=>{
 const v=observation(createGame(),0);v.called=v.companies.map(c=>c.id);
 const a=forecasts(v,0,{samples:5});v.auction={company:2};
 assert.deepEqual(forecasts(v,0,{samples:5}),a);
});
