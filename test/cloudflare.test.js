import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../cloudflare/worker.js';

test('Cloudflare serves the asset binding without accepting API writes',async()=>{
 const request=new Request('https://vests.example/'),env={ASSETS:{fetch:async r=>{assert.equal(r,request);return new Response('game');}}};
 assert.equal(await (await worker.fetch(request,env)).text(),'game');
 const response=await worker.fetch(new Request('https://vests.example/api/bot',{method:'POST'}),env);
 assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET, HEAD');
});
test('deployed bots decide in the browser; localhost keeps the native bot API',async()=>{
 const source=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8').replace(/^import .*\n/,'');
 for(const hostname of ['vests.example','localhost']){
  let network=0,local=0,finish;const done=new Promise(resolve=>finish=resolve),data={ticket:7,game:{},id:1};
  const self={location:{hostname},postMessage:finish};
  vm.runInNewContext(source,{self,botCommand:()=>{local++;return{type:'browser'};},fetch:async()=>{network++;return{ok:true,json:async()=>({cmd:{type:'native'}})};}});
  self.onmessage({data});const result=await done;
  assert.equal(result.ticket,7);assert.equal(network,Number(hostname==='localhost'));assert.equal(local,Number(hostname!=='localhost'));
  assert.equal(result.cmd.type,hostname==='localhost'?'native':'browser');
 }
});
