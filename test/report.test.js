import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
test('report renders complete tables and consistent statistical contrasts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vests-report-fixture-'));
 try{
  fs.symlinkSync(path.resolve('docs/v71-health/source'),path.join(dir,'source'));
  // Rendering fixture only: historical outcomes exercise the report without
  // presenting them as current simulations. All output stays in this temp directory.
  const old=JSON.parse(fs.readFileSync('docs/v70-health/raw.json'));
  const current=old.map(r=>({...structuredClone(r),version:71,samples:8}));current.find(r=>r.players===4&&r.seed===650039).bids[2].amount-=2;
  fs.writeFileSync(path.join(dir,'raw.json'),JSON.stringify(current));
  fs.writeFileSync(path.join(dir,'v70-raw.json'),JSON.stringify(old.filter(r=>r.players===4).map(r=>({...r,version:70}))));
  fs.writeFileSync(path.join(dir,'v68-raw.json'),JSON.stringify(JSON.parse(fs.readFileSync('docs/v68-health/raw.json')).filter(r=>r.players===4).map(r=>({...r,version:68}))));
  fs.writeFileSync(path.join(dir,'study.json'),JSON.stringify({games:144,samples:8,finished:'rendering fixture',workers:1,availableCpus:1,averageCpuCores:1,cpu:'test fixture'}));
  fs.writeFileSync(path.join(dir,'benchmark.json'),JSON.stringify({games:3,baselineCpuSeconds:2,optimizedCpuSeconds:1,speedup:2}));
  execFileSync(process.execPath,['scripts/balance-report.js',dir],{stdio:'pipe'});
  const html=fs.readFileSync(path.join(dir,'report.html'),'utf8'),summary=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));
  assert(!/undefined|NaN|Infinity|\$\{/.test(html));assert(html.includes('Julie Hearts'));assert(html.includes('Holm'));assert.equal(summary.founders.length,20);assert.equal(summary.changes.length,20);
  assert(summary.harryStefan.ci[0]<=summary.harryStefan.estimate&&summary.harryStefan.ci[1]>=summary.harryStefan.estimate);
  assert.equal(summary.cascade.seed,650039);assert.equal(summary.cascade.oldBid.amount-summary.cascade.newBid.amount,2);
  assert(summary.changes.every(x=>x.estimate===0&&x.adjustedP===1));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
