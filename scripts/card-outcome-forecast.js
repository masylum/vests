// Apply the real card first, then measure with the exact live bot utility function.
import fs from 'node:fs';import {pathToFileURL}from 'node:url';import{inject}from './card-outcome-game.js';
import{portfolioUtility}from '../src/bots.js';
const root=process.argv[2]??'docs/v108-card-study';
const E=await import(pathToFileURL(process.cwd()+'/'+root+'/source/engine.js')),B=await import(pathToFileURL(process.cwd()+'/'+root+'/source/bots.js')),V=await import(pathToFileURL(process.cwd()+'/'+root+'/source/valuation.js'));
const frozenUtility=fs.readFileSync(root+'/source/bots.js','utf8').match(/function portfolioUtility\(v, id, values\) \{[\s\S]*?\n\}/)?.[0];
if(frozenUtility!==portfolioUtility.toString())throw Error('Production utility differs from frozen study');
const pairs=['pairs.jsonl','extra-pairs.jsonl','matched-pairs.jsonl'].filter(f=>fs.existsSync(root+'/'+f)).flatMap(f=>fs.readFileSync(root+'/'+f,'utf8').trim().split('\n').map(JSON.parse)).filter(x=>x.status==='completed');
const results=[];
for(const pair of pairs){
 const trace=JSON.parse(fs.readFileSync(root+'/pairs/'+pair.id+'.json')),g=E.createGame(trace.setup);for(const x of trace.prefix)E.command(g,x.id,x.cmd);inject(g,trace.injection.actor,trace.injection.kind);
 const views=[];
 for(const o of trace.outcomes){const w=E.clone(g);let complete=false;for(const [i,x]of o.commands.entries()){E.command(w,x.id,x.cmd);if(o.mode==='discard'&&i===1||o.mode==='play'&&w.phase==='valueResult'){complete=true;break;}}if(!complete)throw Error('No immediate card resolution '+pair.id);views.push(E.observation(w,pair.actor));}
 if(views[0].valueResult?.kind!==pair.card)throw Error('Wrong card resolution '+pair.id);
 const [play,discard]=views,row={id:pair.id,card:pair.card,game:pair.game,step:pair.step,band:pair.band,botEstimate:pair.botEstimate};
 for(const samples of [20,64]){
  const pa=B.forecasts(play,pair.actor,{samples,sampler:'independent'}),da=B.forecasts(discard,pair.actor,{samples,sampler:'independent'});
  const avg=a=>a.reduce((s,n)=>s+n,0)/a.length;
  row['utility'+samples]=portfolioUtility(play,pair.actor,pa)-portfolioUtility(discard,pair.actor,da);
  row['score'+samples]=avg(pa[0].prices.map((_,i)=>V.portfolioWealth(play,pair.actor,pa,i)-V.portfolioWealth(discard,pair.actor,da,i)));
 }
 results.push(row);console.log(row.id,row.utility20.toFixed(2),row.utility64.toFixed(2));
}
fs.writeFileSync(root+'/forecast-gains.json',JSON.stringify(results,null,2));
