import fs from 'node:fs';import {parallel} from './parallel.js';import {VERSION} from '../src/config.js';import {parseArgs} from 'node:util';
const {values:a}=parseArgs({options:{out:{type:'string',default:`docs/v${VERSION}-health/bot-audit`},source:{type:'string',default:'src'},seed:{type:'string',default:String(VERSION*10000+5000)},workers:{type:'string',default:'2'}}});
const out=a.out,jobs=Array.from({length:10},(_,i)=>({seed:Number(a.seed)+i,samples:24,out,source:a.source}));
const rows=await parallel(jobs,{moduleURL:new URL('./audit-game.js',import.meta.url),workers:Number(a.workers),onResult:r=>console.log(JSON.stringify({seed:r.seed,rounds:r.rounds,scores:r.scores,review:Object.fromEntries(Object.entries(r.review).map(([k,v])=>[k,v.length]))}))});
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(rows,null,2));
