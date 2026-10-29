import {availableParallelism} from 'node:os';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';

// Keep workers alive across games so modules and the JIT stay warm.
export async function parallel(jobs,{moduleURL,workers=availableParallelism(),onResult=()=>{}}) {
 if(!Number.isInteger(workers)||workers<1)throw Error('Workers must be a positive integer.');
 const pool=[],results=new Array(jobs.length);let next=0;
 try {
  await Promise.all(Array.from({length:Math.min(workers,jobs.length)},()=>new Promise((resolve,reject)=>{
   const worker=new Worker(new URL(import.meta.url),{workerData:{moduleURL:String(moduleURL)}});pool.push(worker);
   let index,done=false;
   const dispatch=()=>{if(next===jobs.length){done=true;resolve();return;}index=next++;worker.postMessage(jobs[index]);};
   worker.on('error',reject);worker.on('exit',code=>{if(!done)reject(Error(`Worker exited ${code} before completing its job`));});
   worker.on('message',message=>{if(message.error){reject(Error(message.error));return;}try{results[index]=message.result;onResult(message.result,index);dispatch();}catch(e){reject(e);}});
   dispatch();
  })));
 } finally {await Promise.all(pool.map(worker=>worker.terminate()));}
 return results;
}
if(!isMainThread&&workerData?.moduleURL){
 const {run}=await import(workerData.moduleURL);
 parentPort.on('message',async job=>{try{parentPort.postMessage({result:await run(job)});}catch(e){parentPort.postMessage({error:e.stack??String(e)});}});
}
