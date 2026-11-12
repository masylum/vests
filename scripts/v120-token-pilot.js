import fs from'node:fs';import path from'node:path';import{parallel}from'./parallel.js';import{createHash}from'node:crypto';
const out=path.resolve('docs/v120-token-pilot');fs.mkdirSync(out,{recursive:true});
const profiles={
 baseline:null,
 fifteen:[[0,0,14,0,1,0],[0,4,11,0,0,0],[0,0,4,8,3,0],[0,0,9,4,2,0],[0,2,5,6,2,0],[0,4,1,8,2,0]],
 volatile:[[0,0,9,4,2,0],[0,4,11,0,0,0],[0,0,0,11,4,0],[0,0,4,8,3,0],[0,1,3,8,3,0],[0,2,1,9,3,0]],
};
const hashes={};for(const[v,p]of Object.entries(profiles)){const dir=out+'/'+v;fs.mkdirSync(dir,{recursive:true});hashes[v]={};for(const f of fs.readdirSync('src').filter(f=>/\.(js|css)$/.test(f))){let s=fs.readFileSync('src/'+f,'utf8');if(f==='config.js'&&p)s=s.replace('VERSION = 119','VERSION = 120').replace(/export const DECK_PROFILES = \[[\s\S]*?\n\];/,'export const DECK_PROFILES = '+JSON.stringify(p)+';');if(fs.existsSync(dir+'/'+f)&&fs.readFileSync(dir+'/'+f,'utf8')!==s)throw Error('Frozen pilot source changed');fs.writeFileSync(dir+'/'+f,s);hashes[v][f]=createHash('sha256').update(s).digest('hex');}}
const jobs=[];for(const variant of Object.keys(profiles))for(const players of[2,3,4])for(let i=0;i<4;i++)jobs.push({id:`${variant}-${players}-${i}`,variant,players,seed:120000+players*100+i,samples:12,source:out+'/'+variant,out,health:true});
fs.writeFileSync(out+'/manifest.json',JSON.stringify({purpose:'Exploratory token-only pacing pilot, not final health study',target:9,profiles,hashes,jobs},null,2));
const file=out+'/games.jsonl',prior=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],done=new Set(prior.map(g=>g.id));await parallel(jobs.filter(j=>!done.has(j.id)),{moduleURL:new URL('./health-game.js',import.meta.url),workers:4,onResult:g=>{fs.appendFileSync(file,JSON.stringify(g)+'\n');console.log(g.id,g.status,g.roundCount,g.error??'');}});
