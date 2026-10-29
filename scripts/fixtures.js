import fs from 'node:fs';
import {VERSION} from '../src/config.js';
import {createGame,command,currentPlayer,assertGame} from '../src/engine.js';
import {botCommand} from '../src/bots.js';
const dir='test/fixtures';fs.mkdirSync(dir,{recursive:true});
const wanted=new Set(['public-burn','ipo-move','ai-power','call','bid','receipt','purchase','reveal','checkpoint','settlement','founder','power-swap','power-after','power-repair','one-finisher','two-finishers','fumble']);
function save(name,seed,commands){if(!wanted.delete(name))return;fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify({version:VERSION,setup:{seed},commands}));}
for(let seed=42;seed<150&&wanted.size;seed++) {
 const g=createGame({seed}),commands=[];
 for(let n=0;!g.ended&&n<6000;n++) {
  const names={valueResult:'value-played',intelPlay:'value-choice',call:'call',bid:'bid',auctionResult:'receipt',purchaseResult:'purchase',reveal:'reveal',cycleResult:'checkpoint',settle:'settlement',founder:'founder'};
  if(names[g.phase])save(names[g.phase],seed,commands);
  if(['afterRevealReady','catchUpReady'].includes(g.phase)&&g.log.some(e=>e.type==='burn'&&e.cards?.length))save('public-burn',seed,commands);
  if(g.phase==='cycleResult'&&g.ipoCompany!=null)save('ipo-move',seed,commands);
  if(g.phase==='power'&&currentPlayer(g)!==0)save('ai-power',seed,commands);
  if(g.phase==='power'&&currentPlayer(g)===0){const q=g.powerChoice;save(q.founder===2?'power-swap':q.founder===1?'power-after':q.founder===9?'power-repair':'none',seed,commands);}
  const finishers=g.companies.filter(c=>c.position>=g.rules.checkpoints[g.leg]).length;
  if(g.phase==='reveal'&&finishers===1)save('one-finisher',seed,commands);
  if(g.phase==='cycleResult'&&g.cycleEnd==='checkpoint')save('two-finishers',seed,commands);
  if(g.phase==='reveal'&&g.pile[0]?.effect==='fumble')save('fumble',seed,commands);
  const id=currentPlayer(g),cmd=botCommand(g,id,{samples:3});commands.push({id,cmd});command(g,id,cmd);assertGame(g);
 }
}
for(const name of ['value-played','value-choice'])wanted.add(name);
{
 const setup={seed:42,rules:{intelMode:'mixed'}},g=createGame(setup),commands=[];
 for(let n=0;n<200&&!g.ended&&wanted.size;n++){
  const name={valueResult:'value-played',intelPlay:'value-choice'}[g.phase];
  if(name&&wanted.delete(name))fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify({version:VERSION,setup,commands}));
  const id=currentPlayer(g),cmd=botCommand(g,id,{samples:3});commands.push({id,cmd});command(g,id,cmd);assertGame(g);
 }
}
if(wanted.size)throw Error('Missing fixtures '+[...wanted]);
const seed=42,g=createGame({seed}),commands=[];const host=currentPlayer(g);
const act=cmd=>{const id=currentPlayer(g);commands.push({id,cmd});command(g,id,cmd);assertGame(g);};
act({type:'call',company:0});while(g.phase==='bid')act({type:'bid',amount:currentPlayer(g)===host?g.auction.reserve:0});
act({type:'continue'});
for(let n=0;n<1000;n++){
 if(g.phase==='call'&&currentPlayer(g)===host&&g.companies[0].reserve<3)break;
 act(g.phase==='call'?{type:'call',company:null}:botCommand(g,currentPlayer(g),{samples:1}));
}
act({type:'call',company:0});while(g.phase==='bid')act({type:'bid',amount:currentPlayer(g)===host?0:g.auction.reserve});
fs.writeFileSync(`${dir}/tie.json`,JSON.stringify({version:VERSION,setup:{seed},commands}));console.log('Saved current-version legal fixtures.');

// Ryan's movement is automatic; save a legal resolved phase with his reaction.
for(let seed=0;seed<30;seed++){
 const setup={seed,rules:{intelMode:'mixed'}},g=createGame(setup),commands=[];let saved=false;
 for(let n=0;n<1000&&!g.ended;n++){
  if(g.phase==='phaseResult'&&g.lastRevealed.reactions?.some(r=>r.founder===6)){
   fs.writeFileSync(`${dir}/ryan-target.json`,JSON.stringify({version:VERSION,setup,commands}));saved=true;break;
  }
  const id=currentPlayer(g),cmd=botCommand(g,id,{samples:2});commands.push({id,cmd});command(g,id,cmd);assertGame(g);
 }
 if(saved)break;
}
if(JSON.parse(fs.readFileSync(`${dir}/ryan-target.json`)).version!==VERSION)throw Error('Missing Ryan fixture');
// Melania is automatic: save the receipt, rather than a founder choice that no longer exists.
for(let seed=0;seed<100;seed++){
 const setup={seed,rules:{intelMode:'mixed'}},g=createGame(setup),commands=[];
 let saved=false;
 for(let n=0;n<1500&&!g.ended;n++){
  if(g.phase==='valueResult'&&g.valueResult?.reactions?.some(r=>r.founder===17)){
   fs.writeFileSync(`${dir}/melania-value.json`,JSON.stringify({version:VERSION,setup,commands}));saved=true;break;
  }
  const id=currentPlayer(g),cmd=botCommand(g,id,{samples:2});commands.push({id,cmd});command(g,id,cmd);assertGame(g);
 }
 if(saved)break;
}
// Find a legal opening with Jerry so his shareholder movement placard can be inspected in the browser.
for(let seed=0;seed<500;seed++){
 const g=createGame({seed}),c=g.companies.find(c=>c.founder===7);
 if(!c)continue;
 const id=currentPlayer(g),commands=[{id,cmd:{type:'call',company:c.id}}];
 command(g,id,commands[0].cmd);assertGame(g);
 fs.writeFileSync(`${dir}/jerry.json`,JSON.stringify({version:VERSION,setup:{seed},commands}));break;
}
