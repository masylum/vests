import fs from'node:fs';import path from'node:path';import{parallel}from'./parallel.js';
const out=path.resolve('docs/v112-training');fs.mkdirSync(out,{recursive:true});
const jobs=[];
for(const [name,opponent,penalty]of[['margin',1,0],['balanced',.5,0],['cautious',.5,1],['paired',.2,1]]){
 const source=out+'/'+name;fs.mkdirSync(source,{recursive:true});for(const f of fs.readdirSync('src').filter(x=>x.endsWith('.js')))fs.copyFileSync('src/'+f,source+'/'+f);
 let v=fs.readFileSync(source+'/valuation.js','utf8');v=v.replace('wealth(id,sample)-.2*view.players.filter(p=>p.id!==id).reduce((sum,p)=>sum+wealth(p.id,sample),0)/(view.players.length-1)',`wealth(id,sample)-${opponent}*Math.max(...view.players.filter(p=>p.id!==id).map(p=>wealth(p.id,sample)))`);fs.writeFileSync(source+'/valuation.js',v);
 let b=fs.readFileSync(source+'/bots.js','utf8');b=b.replace('return portfolioUtility(v,id,next)-portfolioUtility(v,id,baseline);',`const diffs=portfolioOutcomes(v,id,next).map((x,i)=>x-portfolioOutcomes(v,id,baseline)[i]),mean=avg(diffs);return portfolioUtility(v,id,next)-portfolioUtility(v,id,baseline)-${penalty}*Math.sqrt(avg(diffs.map(x=>(x-mean)**2))/Math.max(1,diffs.length-1));`);fs.writeFileSync(source+'/bots.js',b);
 for(let i=0;i<24;i++)for(let seat=0;seat<2;seat++)jobs.push({id:`${name}-${i}-${seat}`,variant:name,players:2,seed:112000+i,samples:12,source,botSource:path.resolve('docs/v112-health/baseline'),seat,out,health:true});
}
fs.writeFileSync(out+'/protocol.json',JSON.stringify({purpose:'Training only; repeated pilot setups; no confirmatory claim.',variants:['opponent 1 / no founder SE','opponent .5 / no SE','opponent .5 / 1 SE','opponent .2 / 1 SE'],jobs},null,2));
await parallel(jobs,{moduleURL:new URL('./health-game.js',import.meta.url),workers:4,onResult:r=>{fs.appendFileSync(out+'/games.jsonl',JSON.stringify(r)+'\n');console.log(r.id,r.status);}});
