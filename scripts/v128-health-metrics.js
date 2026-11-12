import fs from 'node:fs';
import assert from 'node:assert/strict';
import {INTEL_CARDS} from '../docs/v128-health/source/v128/intel.js';
import {FOUNDERS} from '../docs/v128-health/source/v128/config.js';

const out = 'docs/v128-health';
const manifest = JSON.parse(fs.readFileSync(out + '/manifest.json'));
const games = fs.readFileSync(out + '/games.jsonl','utf8').trim().split('\n').map(JSON.parse);
const sum = (items, get = x => x) => items.reduce((total, item) => total + get(item), 0);
const mean = items => items.length ? sum(items) / items.length : null;
const tally = items => Object.fromEntries([...new Set(items)].sort((a,b)=>a-b).map(x=>[x,items.filter(y=>y===x).length]));
const quantile = (items, q) => [...items].sort((a,b)=>a-b)[Math.ceil(q*items.length)-1];
for (const game of games.filter(g=>g.status==='completed')) {
  const rounds = game.flow.rounds;
  assert.equal(rounds.length, game.roundCount, game.id);
  assert.equal(sum(rounds,r=>r.entered) + game.flow.initialTokens, game.metrics.entered, game.id);
  assert.equal(sum(rounds,r=>r.draws), game.metrics.revealed+(game.metrics.deferred??0), game.id);
  assert.equal(sum(rounds,r=>r.fumbles), game.metrics.founderFumbles??0, game.id);
  let backlog = game.flow.initialTokens;
  for(const round of rounds){
    assert.equal(round.turns.length, game.players, game.id);
    assert.ok(round.turns.every(x=>Number.isInteger(x) && x>=0), game.id);
    assert.ok(sum(round.turns)<=round.entered, game.id);
    assert.ok(round.draws<=game.flow.requestedDraws, game.id);
    backlog += round.entered - round.draws - round.discarded;
    assert.equal(round.bag, backlog, game.id);
  }
}
function aggregate(group) {
  const complete = group.filter(g=>g.status==='completed');
  if (!complete.length) return {attempted:group.length, completed:0};
  const rounds = complete.flatMap(g=>g.flow.rounds);
  const turns = rounds.flatMap(r=>r.turns);
  const actions = {};
  for (const game of complete) for (const [key,n] of Object.entries(game.actions)) actions[key]=(actions[key]??0)+n;
  const total = f => sum(complete,f);
  const perGame = f => total(f)/complete.length;
  const debt = complete.flatMap(g=>g.flow.capitalDeduction);
  const fundraises = total(g=>g.health.auctionCount);
  const decisions = complete.flatMap(g=>g.health.agency);
  const played = total(g=>g.health.cardPlays.length);
  const exchange = actions.exchangeValue??0;
  const cards = Object.entries(INTEL_CARDS).map(([kind,card])=>({
    kind,name:card.name, plays:total(g=>g.cardPlays[kind]??0),
    discards:total(g=>g.flow.cardDiscards[kind]??0),
    held:total(g=>g.cardExposure[kind]??0), eligible:total(g=>g.cardEligible[kind]??0),
    games:complete.filter(g=>g.cardPlays[kind]).length
  })).sort((a,b)=>b.plays-a.plays||a.name.localeCompare(b.name));
  const founders=FOUNDERS.map((founder,id)=>({
    id,name:founder.name??founder[0], exposure:total(g=>g.founderExposure[id]??0),
    offered:total(g=>g.powerOffers[id]??0), used:total(g=>g.powerUses[id]??0),
    forward:total(g=>g.flow.founderMovement[id]?.forward??0),
    backward:total(g=>g.flow.founderMovement[id]?.backward??0)
  })).filter(f=>f.exposure||f.offered||f.forward).sort((a,b)=>b.forward-a.forward);
  return {
    attempted:group.length, completed:complete.length, rounds:rounds.length, turns:turns.length,
    avgRounds:perGame(g=>g.roundCount), range:[Math.min(...complete.map(g=>g.roundCount)),Math.max(...complete.map(g=>g.roundCount))],
    medianRounds:quantile(complete.map(g=>g.roundCount),.5), roundHistogram:tally(complete.map(g=>g.roundCount)),
    decisions:decisions.length, actions, cardPlays:played, exchanges:exchange, cardDraws:total(g=>g.flow.valueDraws),
    openingHands:total(g=>g.players*3), finalHand:mean(complete.flatMap(g=>g.flow.finalHands)),
    capitalCalls:actions.raiseMoney??0, debtMean:mean(debt), debtHistogram:tally(debt),
    actualDebt:total(g=>sum(g.flow.debt)), zeroDebt:debt.filter(x=>x===0).length,
    hires:total(g=>g.flow.ordinaryHires), cardHires:total(g=>g.flow.replacements-g.flow.ordinaryHires),
    swaps:total(g=>g.flow.founderSwaps), leadChanges:total(g=>g.health.leadChanges),
    sold:total(g=>g.health.sales.length), noPortfolio:decisions.filter(x=>!x.portfolio).length/decisions.length,
    limitedChoice:decisions.filter(x=>x.families<=2).length/decisions.length,
    fundraises, noBid:total(g=>g.health.noBid), contested:total(g=>g.health.contested),
    firstEntries:mean(complete.map(g=>g.flow.rounds[0].entered)),
    entries:sum(rounds,r=>r.entered), turnEntries:sum(turns), nonTurnEntries:sum(rounds,r=>r.entered)-sum(turns),
    emptyTurns:turns.filter(x=>!x).length, bag:mean(rounds.map(r=>r.bag)),
    bagByRound:Array.from({length:Math.max(...complete.map(g=>g.roundCount))},(_,i)=>{
      const bags=complete.flatMap(g=>g.flow.rounds[i]?[g.flow.rounds[i].bag]:[]);
      return {round:i+1,mean:mean(bags),n:bags.length};
    }),
    emptyBags:rounds.filter(r=>r.bag===0).length, finalBag:mean(complete.map(g=>g.flow.rounds.at(-1).bag)),
    maxBag:Math.max(...rounds.map(r=>r.bag)), discarded:sum(rounds,r=>r.discarded),
    requested:total(g=>g.roundCount*g.flow.requestedDraws), draws:sum(rounds,r=>r.draws),
    drawHistogram:tally(rounds.map(r=>r.draws)),
    incomplete:total(g=>g.flow.rounds.filter(r=>r.draws<g.flow.requestedDraws).length),
    recovery:sum(rounds,r=>r.recovery), fumbles:sum(rounds,r=>r.fumbles),
    fumbleTokens:total(g=>g.flow.tokenFumbles), converted:sum(rounds,r=>r.converted),
    growth:sum(rounds,r=>r.growth), down:mean(rounds.map(r=>r.down)),
    winnerMargin:perGame(g=>{const scores=[...g.scores].sort((a,b)=>b-a);return scores[0]-scores[1];}),
    tiedWins:complete.filter(g=>g.winners.length>1).length,
    seatCredit:complete[0].scores.map((_,offset)=>total(g=>g.winners.includes((g.health.first+offset)%g.players)?1/g.winners.length:0)),
    cards, founders
  };
}
const cohorts={};
for(const version of [127,128]) for(const players of [2,3,4]){
  const group=games.filter(g=>g.version===version&&g.players===players);
  if(group.length)cohorts[`${version}-${players}`]=aggregate(group);
}
const pairs=games.filter(g=>g.version===128&&g.players===4&&g.status==='completed').flatMap(game=>{
  const before=games.find(g=>g.version===127&&g.players===4&&g.seed===game.seed&&g.status==='completed');
  return before?[{seed:game.seed,before:before.roundCount,after:game.roundCount}]:[];
});
let state=128;
const next=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
const changes=pairs.map(p=>p.after-p.before);
const bootstrap=changes.length?Array.from({length:4000},()=>mean(changes.map(()=>changes[Math.floor(next()*changes.length)]))):[];
const result={version:128,attempted:games.length,scheduled:manifest.jobs.length,completed:games.filter(g=>g.status==='completed').length,failures:games.filter(g=>g.status!=='completed').map(g=>({id:g.id,status:g.status,error:g.error})),cohorts,pairs,
  roundDelta:mean(changes),roundDeltaInterval:bootstrap.length?[quantile(bootstrap,.025),quantile(bootstrap,.975)]:null};
fs.writeFileSync(out+'/metrics.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({attempted:result.attempted,completed:result.completed,pairs:result.pairs,roundDelta:result.roundDelta,summary:Object.fromEntries(Object.entries(cohorts).map(([key,g])=>[key,{n:g.completed,rounds:g.avgRounds,bag:g.bag,fill:g.draws/g.requested,weekends:g.cards?.find(c=>c.kind==='weekend')?.plays}]))},null,2));
