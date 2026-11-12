import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parallel} from './parallel.js';

const out = path.resolve('docs/v128-health');
const jobs = [];
for (const version of [127, 128]) {
  for (const [players, count, samples] of [[4, 10, 24], [3, 3, 8], [2, 3, 8]]) {
    for (let i = 0; i < count; i++) {
      jobs.push({
        id: version === 128 && players === 4 ? `sample-${i + 1}` : `v${version}-p${players}-${i + 1}`,
        seed: 129000 + players * 100 + i,
        version, players, samples, trace: version === 128 && players === 4,
        source: path.join(out, 'source', `v${version}`), out, flow: true, health: true
      });
    }
  }
}
jobs.sort((a,b)=>b.players-a.players || a.seed-b.seed || b.version-a.version);
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHashes = {};
for (const version of [127, 128]) {
  const dir = `source/v${version}`;
  for (const file of fs.readdirSync(path.join(out, dir))) sourceHashes[`${dir}/${file}`] = hash(path.join(out,dir,file));
}
const manifest = {
  version:128, date:'2026-11-07',
  question:'How do six draws, a single Gill move, and free Working Weekend change pace and play?',
  policy:'adaptive', workers:8, startedAt:new Date().toISOString(),
  protocol:'Ten matched four-player seeds at the live 24-sample budget. All ten v128 games retain a full replay and audit. Three paired seeds each at two and three players, at eight samples, are exploratory. An identical seed fixes opening setup only. All outcomes retained. Limits: 80 rounds or 6000 commands.',
  targets:{pace:'fewer rounds than v127',backlog:'4–8 tokens at round end, inherited diagnostic',noBidBelow:0.1},
  rules:{127:{draws:4,discard:1,weekendCost:2,gill:'another company 1, then self 1'},128:{draws:6,discard:1,weekendCost:0,gill:'any one company 1'}},
  sourceHashes, runnerHash:hash(path.join(out,'game.js')), jobs
};
const manifestFile = path.join(out,'manifest.json');
if (fs.existsSync(manifestFile)) {
  const previous=JSON.parse(fs.readFileSync(manifestFile));
  for(const key of ['sourceHashes','runnerHash','jobs']) if(JSON.stringify(previous[key])!==JSON.stringify(manifest[key])) throw Error(`Frozen ${key} changed`);
  manifest.startedAt=previous.startedAt;
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest,null,2));
const file=path.join(out,'games.jsonl');
const done=new Set(fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(row=>JSON.parse(row).id):[]);
await parallel(jobs.filter(job=>!done.has(job.id)),{
  moduleURL:new URL('../docs/v128-health/game.js',import.meta.url), workers:manifest.workers,
  onResult:row=>{
    fs.appendFileSync(file,JSON.stringify(row)+'\n');
    console.log(row.id,row.status,row.roundCount,row.error??'');
  }
});
manifest.completedAt=new Date().toISOString();
fs.writeFileSync(manifestFile, JSON.stringify(manifest,null,2));
