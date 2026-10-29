import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {makeServer} from '../server.js';
import {createGame,currentPlayer,observation} from '../src/engine.js';
import {botCommand,nativeForecastAvailable} from '../src/bots.js';
test('local bot endpoint uses the same public-observation policy and rejects foreign or invalid requests',async()=>{
 const server=makeServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const url=`http://127.0.0.1:${server.address().port}/api/bot`,g=createGame({seed:5128,rules:{intelMode:'mixed'}}),id=currentPlayer(g),game=observation(g,id),body=JSON.stringify({game,id});
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(response.status,200);assert.deepEqual(await response.json(),{cmd:botCommand(game,id,{samples:24,policy:'adaptive'}),accelerated:nativeForecastAvailable});
  assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://example.com'},body})).status,403);
  assert.equal((await fetch(url,{method:'POST',body:'{}'})).status,400);
  assert.equal((await fetch(url,{method:'POST',body:JSON.stringify({game,id:(id+1)%4})})).status,400);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
