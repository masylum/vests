import fs from 'node:fs';import {parallel} from './parallel.js';import {VERSION} from '../src/config.js';import {mean,contrast} from './statistics.js';
const dir=`docs/v${VERSION}-health/bot-audit`,audits=JSON.parse(fs.readFileSync(`${dir}/summary.json`)),jobs=[];
for(const audit of audits){
 const decisions=JSON.parse(fs.readFileSync(`${dir}/${audit.seed}-decisions.json`));
 const candidates=decisions.filter(d=>d.phase==='call'&&d.command.company===null&&d.round>=3&&d.portfolio.some(c=>c.controlled&&c.treasury===0&&c.supply>0&&c.need>0));
 const d=candidates[0];if(!d)continue;
 const c=d.portfolio.filter(c=>c.controlled&&c.treasury===0&&c.supply>0&&c.need>0).sort((a,b)=>b.shares/b.total-a.shares/a.total||b.position-a.position)[0];
 jobs.push({replay:JSON.parse(fs.readFileSync(`${dir}/${audit.seed}-replay.json`)),step:d.step,company:c.company,player:d.player,baseline:audit.scores[d.player]});
}
const rows=await parallel(jobs,{moduleURL:new URL('./pass-check-game.js',import.meta.url),workers:2,onResult:r=>console.log(JSON.stringify(r))});
const effect=rows.length>1?contrast(rows.map(r=>[1,r.forcedScore]),rows.map(r=>[1,r.baseline])):null;
fs.writeFileSync(`${dir}/pass-checks.json`,JSON.stringify({protocol:'At the first round-3-or-later pass with a controlled, dry, nonempty-supply company needing funding, call that company instead. Choose highest owned fraction, then position. All subsequent decisions remain adaptive at 24 samples. One deterministic continuation per branch; exploratory realized outcomes, not expected values.',games:rows.length,meanDifference:mean(rows.map(r=>r.difference)),effect,rows},null,2));
