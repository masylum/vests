import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const candidates=[process.env.RUSTC,'rustc',path.join(os.homedir(),'.cargo/bin/rustc')].filter(Boolean);
let compiler,version;
for(const candidate of candidates){const result=spawnSync(candidate,['--version'],{encoding:'utf8'});if(result.status===0){compiler=candidate;version=result.stdout.trim();break;}}
if(!compiler)throw Error('Rust compiler not found. Install Rust or set RUSTC. JavaScript fallback remains available.');
fs.mkdirSync('native/build',{recursive:true});
const flags=['--edition=2021','--crate-type','cdylib','-C','opt-level=3','-C','codegen-units=1','-C','lto=fat','-C','target-cpu=native',...(process.platform==='darwin'?['-C','link-arg=-undefined','-C','link-arg=dynamic_lookup']:[]),'native/forecast.rs','-o','native/build/forecast-next.node'];
const result=spawnSync(compiler,flags,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
const verification=spawnSync(process.execPath,['--test','test/native-forecast.test.js'],{stdio:'inherit',env:{...process.env,VESTS_NATIVE_ADDON:path.resolve('native/build/forecast-next.node')}});
if(verification.status!==0){fs.unlinkSync('native/build/forecast-next.node');throw Error('Native parity checks failed; previous binary preserved.');}
fs.renameSync('native/build/forecast-next.node','native/build/forecast.node');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const engine=createHash('sha256');for(const name of ['bots.js','engine.js','racing.js','config.js','movement.js','ownership.js','native-forecast.js'])engine.update(name+'\0').update(fs.readFileSync('src/'+name));
fs.writeFileSync('native/build/build.json',JSON.stringify({language:'Rust',platform:process.platform,arch:process.arch,node:process.version,compiler:version,flags,parityVerified:true,engineHash:engine.digest('hex'),sourceHash:hash('native/forecast.rs'),binaryHash:hash('native/build/forecast.node')},null,2)+'\n');
console.log('Built and verified Rust forecast accelerator.');
