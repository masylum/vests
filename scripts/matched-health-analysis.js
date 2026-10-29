import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mean,ratio,interval,contrast,holm} from './statistics.js';
import {founderCluster,founderCredits} from './founder-credit.js';
const out=process.argv[2],base=process.argv[3]??'docs/v92-health-1000';
const read=(dir,file)=>JSON.parse(fs.readFileSync(path.join(dir,file)));
const s=read(out,'summary.json'),previous=read(base,'summary.json');
const a=read(base,'study/raw.json').sort((a,b)=>a.seed-b.seed),b=read(out,'study/raw.json').sort((a,b)=>a.seed-b.seed);
assert.equal(a.length,1000);assert.deepEqual(a.map(r=>r.seed),b.map(r=>r.seed));
assert(a.every((r,i)=>r.samples===b[i].samples&&r.players===b[i].players));
const oldFounders=s.founders.map(f=>{const rows=a.map(r=>founderCluster(r,f.id));return {id:f.id,name:f.name,users:rows.reduce((n,r)=>n+r[0],0),games:rows.filter(r=>r[0]).length,mean:ratio(rows),ci:interval(rows)};});
const companyChanges=holm(s.companies.map(c=>({id:c.id,name:c.name,before:previous.companies[c.id].mean,after:c.mean,...contrast(b.map(r=>[1,r.exit.companies[c.id].revenue]),a.map(r=>[1,r.exit.companies[c.id].revenue]))})));
const founderChanges=holm(s.founders.map(f=>({id:f.id,name:f.name,before:oldFounders[f.id].mean,after:f.mean,beforeUsers:oldFounders[f.id].users,afterUsers:f.served,...contrast(b.map(r=>founderCluster(r,f.id)),a.map(r=>founderCluster(r,f.id)))})));
const healthSpecs={rounds:r=>r.roundCount,money:r=>mean(r.scores),defaults:r=>r.defaults/4,spread:r=>Math.max(...r.final.positions)-Math.min(...r.final.positions),passRate:r=>r.actions.pass/(r.actions.pass+r.actions.auction+r.actions.hire)};
const healthChanges=Object.entries(healthSpecs).map(([name,fn])=>({name,before:mean(a.map(fn)),after:mean(b.map(fn)),...contrast(b.map(r=>[1,fn(r)]),a.map(r=>[1,fn(r)]))}));
// The association includes supporters and never selects only winning investors.
const founderAssociations=holm(s.founders.map(f=>{
 const used=b.map(r=>founderCluster(r,f.id)),unused=used.map(([n,w],i)=>[4-n,b[i].scores.reduce((s,x)=>s+x,0)-w]);
 return {id:f.id,name:f.name,userMoney:ratio(used),nonuserMoney:ratio(unused),...contrast(used,unused)};
}));
const csv=[['version','seed','investor','founder','final_net_money_credit']];
for(const [version,runs] of [[92,a],[s.version,b]])for(const r of runs)for(const f of founderCredits(r.scores,r.concurrent))csv.push([version,r.seed,f.player+1,s.founders[f.founder].name,f.money]);
fs.writeFileSync(path.join(out,'matched-founder-credits.csv'),csv.map(row=>row.map(x=>JSON.stringify(x)).join(',')).join('\n')+'\n');
const matched={baseline:base,baselineSourceHash:previous.manifest.hashes??previous.manifest.signature,baselineRawSha256:createHash('sha256').update(fs.readFileSync(path.join(base,'study/raw.json'))).digest('hex'),games:a.length,oldFounders,companyChanges,founderChanges,founderAssociations,healthChanges,baselineHealth:previous.health};
fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(matched,null,2)+'\n');
console.log(JSON.stringify({companyChanges,harry:founderChanges[9],healthChanges,founders:[...s.founders].sort((a,b)=>b.mean-a.mean).map(f=>({name:f.name,money:f.mean,users:f.served,ci:f.ci})),founderChangesSignificant:founderChanges.filter(f=>f.significant),companyPairs:s.companyTests.filter(c=>c.significant),cardAssociations:s.valueCards.filter(c=>c.significant).map(c=>({name:c.name,estimate:c.estimate,ci:c.ci}))},null,2));
