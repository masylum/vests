import fs from 'node:fs';

const folder = 'docs/v128-health';
const read = name => JSON.parse(fs.readFileSync(folder + '/' + name));
const study = read('metrics.json');
const reviews = read('reviews.json');
const previous = study.cohorts['127-4'];
const current = study.cohorts['128-4'];
const number = (n, digits = 1) => n.toFixed(digits);
const percent = n => number(n * 100) + '%';
const cash = n => '$' + number(n, 2);
const rate = (key, denominator = 'completed', digits = 1) => g => number(g[key] / g[denominator], digits);
const ratio = (numerator, denominator) => g => percent(g[numerator] / g[denominator]);
const fraction = (numerator, denominator) => g => `${g[numerator]}/${g[denominator]} · ${percent(g[numerator] / g[denominator])}`;
const card = (cohort, kind) => cohort.cards.find(c => c.kind === kind);
const founder = (cohort, name) => cohort.founders.find(f => f.name === name);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const row = (label, get) => `<tr><th scope="row">${escape(label)}</th><td>${get(previous)}</td><td>${get(current)}</td></tr>`;
const table = (label, rows) => `<div class="table"><table aria-label="${label}"><thead><tr><th scope="col">Measure</th><th scope="col">v127</th><th scope="col">v128</th></tr></thead><tbody>${rows.map(([name, get]) => row(name, get)).join('')}</tbody></table></div>`;
const tile = (label, value, baseline, note) => `<article class="tile"><p>${label}</p><strong>${value}</strong><small>${baseline} · ${note}</small></article>`;
const paired = [...study.pairs].sort((a,b) => a.seed - b.seed);
const gameRows = fs.readFileSync(folder + '/games.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const currentGames = gameRows.filter(g => g.version === 128 && g.players === 4).sort((a,b) => a.seed - b.seed);
const bar = (value, max, type, label) => `<div class="barline"><span>${label}</span><i class="${type}" style="--width:${100 * value / max}%"></i><b>${number(value)}</b></div>`;
const bars = (label, a, b, max) => `<div class="barblock"><h3>${label}</h3>${bar(a,max,'old','v127')}${bar(b,max,'new','v128')}</div>`;
const cardRows = current.cards.map(c => {
  const before = card(previous, c.kind);
  return `<tr><th scope="row">${escape(c.name)}</th><td>${before.plays}</td><td>${c.plays}</td><td>${c.games}/10</td><td>${c.discards}</td><td>${c.eligible}/${c.held}</td></tr>`;
}).join('');
const founderRows = current.founders.map(f =>
  `<tr><th scope="row">${escape(f.name)}</th><td>${f.exposure}</td><td>${f.used}/${f.offered}</td><td>+${f.forward} / −${f.backward}</td></tr>`).join('');
const sampleCards = currentGames.map((g,i) => {
  const [title, note] = reviews[i];
  const top = [...g.scores].sort((a,b)=>b-a);
  return `<article class="sample"><p class="eyebrow">Game ${i+1} · Seed ${g.seed}</p><h3>${escape(title)}</h3><p class="data">${paired[i].before} → ${g.roundCount} rounds · $${top[0]}–$${top[1]}</p><p>${escape(note)}</p><div class="links"><a href="samples/sample-${i+1}-timeline.txt">Timeline</a><a href="samples/sample-${i+1}.json">Replay data</a></div></article>`;
}).join('');
const cohorts = [2,3,4].flatMap(players => [127,128].map(version => {
  const g = study.cohorts[`${version}-${players}`];
  return `<tr><th scope="row">${players} players · v${version}</th><td>${g.completed}</td><td>${number(g.avgRounds)}</td><td>${number(g.bag)}</td><td>${percent(g.draws/g.requested)}</td><td>${g.incomplete}/${g.rounds}</td></tr>`;
})).join('');
const cardVolume = [
  ['Value cards played per game', rate('cardPlays')],
  ['Value cards played per investor turn', rate('cardPlays', 'turns', 2)],
  ['Cards voluntarily discarded and replaced per game', rate('exchanges')],
  ['Value cards drawn in play per game', rate('cardDraws')],
  ['Total value cards dealt or drawn per game', g => number((g.cardDraws + g.openingHands) / g.completed)],
  ['Cards remaining per investor at finish', g => number(g.finalHand, 2)],
  ['Working Weekend plays across 10 games', g => card(g,'weekend').plays],
];
const actionNames = {
  call:'Normal fundraise', playIntel:'Play a value card', exchangeValue:'Discard and replace a value card',
  changeFounder:'Change founder', raiseMoney:'Call capital', sellShare:'Sell a share', drawValue:'Draw with an empty hand',
};
const actionRows = Object.entries(actionNames).map(([key, label]) => [label, g => number((g.actions[key]??0) / g.completed)]);
const gill = [previous, current].map(g => founder(g, 'Gill Bates'));
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vests v128 · Playtest health</title>
<style>
:root{color-scheme:light;--ink:#202c27;--muted:#50635a;--paper:#f5f7f2;--white:#fff;--line:#d9e2d9;--forest:#173c31;--green:#27715a;--light:#e8f4eb;--yellow:#ffe083;--rust:#854a2c}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,sans-serif}a{color:#185b47;text-underline-offset:.2em}a:hover{text-decoration-thickness:.14em}a:focus-visible,summary:focus-visible{outline:3px solid #ad6b00;outline-offset:4px}.wrap{max-width:1130px;margin:auto;padding:0 28px}
header{background:var(--forest);color:#f7fbf7;padding:49px 0 35px;border-bottom:6px solid var(--yellow)}header a{color:#fff}h1,h2,h3,p{margin:0}h1{font-size:clamp(2.7rem,6vw,4.75rem);letter-spacing:-.065em;line-height:1.02;margin:12px 0 16px}h2{font-size:clamp(1.7rem,4vw,2.35rem);line-height:1.12;letter-spacing:-.045em}h3{line-height:1.2;font-size:1.11rem}.intro{max-width:790px;font-size:1.15rem;color:#e1efe6}.eyebrow{font-size:.77rem;letter-spacing:.13em;font-weight:800;text-transform:uppercase}.hero-links,nav,.links{display:flex;flex-wrap:wrap;gap:.4rem 1rem}.hero-links{margin-top:18px;font-size:.9rem}
nav{padding:17px 0;border-bottom:1px solid var(--line);font-size:.9rem;font-weight:650}.tiles,.split,.sample-grid{display:grid;gap:14px}.tiles{grid-template-columns:repeat(4,1fr);margin-top:22px}.split,.sample-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tile,.panel,.sample{background:var(--white);border:1px solid var(--line);border-radius:14px;padding:17px 20px}.tile p{color:var(--muted);font-size:.9rem;font-weight:650}.tile strong{display:block;letter-spacing:-.05em;font-size:2.4rem;line-height:1.25;color:var(--forest)}small,.muted{color:var(--muted)}small{display:block;font-size:.82rem}.data,td,.barline{font-variant-numeric:tabular-nums}.section-head{margin-bottom:15px}.section-head .eyebrow{color:var(--green);margin-bottom:4px}.section-head p:last-child{margin-top:6px;color:var(--muted)}section{margin:38px 0;scroll-margin-top:15px}.panel h3,.sample h3{margin-bottom:7px}.panel p+p,.sample p+p{margin-top:8px}.summary{margin-top:14px}.summary .panel:first-child{background:var(--light)}.summary .panel:last-child{background:#fff8e5}.charts{margin:15px 0}.barblock + .barblock{margin-top:13px}.barline{display:grid;grid-template-columns:34px 1fr;align-items:center;position:relative;isolation:isolate;gap:8px;font-size:.77rem;min-height:24px}.barline i{display:block;height:13px;width:var(--width);border-radius:4px}.barline b{position:absolute;right:0;top:2px;background:white;padding-left:4px}.old{background:#9dad9f}.new{background:#298468}.lineage{margin:12px 0 0;font-size:.9rem}.table{overflow-x:auto;border:1px solid var(--line);background:white;border-radius:11px}table{border-collapse:collapse;width:100%;min-width:415px;font-size:.93rem}th,td{padding:7px 12px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}tr:last-child>*{border-bottom:0}thead{background:#e5eee5;color:var(--forest)}th:first-child{text-align:left;white-space:normal}tbody th{font-weight:600}tbody tr:nth-child(even){background:#f6f9f5}.callout{margin-top:12px;padding:11px 15px;border-left:4px solid var(--green);background:var(--light)}.callout.warm{border-color:#d0993a;background:#fff8e5}.note{font-size:.88rem;color:var(--muted);margin:8px 0 12px}
details{background:#fff;border:1px solid var(--line);border-radius:11px;margin-top:12px;padding:10px 13px}summary{cursor:pointer;color:var(--forest);font-weight:750}details[open] summary{margin-bottom:8px}.sample p{font-size:.93rem}.sample .eyebrow{color:var(--green);font-size:.72rem}.sample .data{font-weight:700;color:var(--rust)}.sample .links{margin-top:10px;font-size:.87rem}.method li{margin:.4rem 0}.method ul{padding-left:20px}footer{padding:0 0 32px;font-size:.85rem;color:var(--muted)}@media(max-width:860px){.tiles{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.wrap{padding:0 15px}.split,.sample-grid{grid-template-columns:1fr}.tile,.panel,.sample{padding:13px}header{padding:28px 0 22px}.tile strong{font-size:1.9rem}section{margin:28px 0}}
</style>
</head>
<body>
<header><div class="wrap"><p class="eyebrow">Vests · v128 · November 2026</p><h1>Playtest health</h1><p class="intro">Six growth draws, one Gill move, and a free Working Weekend. Four-player games finished sooner and carried fewer tokens between rounds. Smaller tables struggled to fill six draw slots.</p><div class="hero-links"><a href="../../?preview">Play v128</a><a href="../v128-rules.md">Rules changes</a></div></div></header>
<main class="wrap">
<nav aria-label="Report sections"><a href="#pace">Pace and bag</a><a href="#actions">Actions and capital</a><a href="#cards">Value cards</a><a href="#founders">Founders and fumbles</a><a href="#samples">Game reviews</a><a href="#method">Study method</a></nav>
<div class="tiles" aria-label="Four-player results">
${tile('Rounds per game',number(current.avgRounds),`vs ${number(previous.avgRounds)}`,'range 5–10')}
${tile('Tokens left per round',number(current.bag),'vs 8.4','after cleanup')}
${tile('Incomplete reveals',percent(current.incomplete/current.rounds),'vs 5.0%','11 of 66 rounds')}
${tile('Capital deduction per investor',cash(current.debtMean),'vs $4.25','at final scoring')}
</div>
<div class="split summary">
<article class="panel"><h3>Four players had more growth per round</h3><p>Five games ended in round 5. Card plays per investor turn held steady and the no-bid rate fell to 2.2%. Across the ten games, 29 of 30 value card types saw play.</p></article>
<article class="panel"><h3>The table still handles more tokens</h3><p>Actual draws rose from 31.3 to 37.1 per game and fundraises stayed near 18. Fewer action phases save turns, while the extra draws add token handling. Time both phases in the next four-player playtest.</p></article>
</div>
<section id="pace"><div class="section-head"><p class="eyebrow">01 · Pace</p><h2>Faster finish, thinner bag</h2><p>Ten matched four-player games per build.</p></div>
<div class="split charts">
<div class="panel">${bars('Rounds per game',previous.avgRounds,current.avgRounds,10)}${bars('Tokens left at round end',previous.bag,current.bag,12)}</div>
<div class="panel">${bars('Tokens introduced per investor turn',previous.turnEntries/previous.turns,current.turnEntries/current.turns,1.6)}${bars('Draws per round',previous.draws/previous.rounds,current.draws/current.rounds,6.5)}</div>
</div>
<p class="lineage">Seven games got shorter, one tied, and two got longer. Average change −1.4 rounds, with a paired 95% bootstrap interval of −2.5 to −0.3.</p>
<div class="split charts">
${table('Growth token flow',[
 ['Tokens introduced per investor turn',rate('turnEntries','turns',2)],['Tokens introduced per table round',rate('entries','rounds',2)],['Opening-round token entries',g=>number(g.firstEntries)],['Investor turns introducing zero tokens',ratio('emptyTurns','turns')],['Round-end backlog',g=>number(g.bag,2)],['Average bag at game end',g=>number(g.finalBag)],['Rounds ending with empty bag',fraction('emptyBags','rounds')],
])}
${table('Reveal completion',[
 ['Filled draw slots',fraction('draws','requested')],['Incomplete reveals',fraction('incomplete','rounds')],['Missing draw slots',g=>g.requested-g.draws],['Entirely empty reveals',g=>g.drawHistogram[0]??0],['Draws per game',rate('draws')],['Face-up discards per game',rate('discarded')],['Recorded growth spaces per round',rate('growth','rounds',2)],
])}
</div>
<p class="note">Entries include tokens returned directly to the bag and exclude setup. Backlog counts tokens after reveal and cleanup. Recovery uses a draw slot. The separate face-up discard uses none.</p>
<div class="table"><table aria-label="Round-end backlog by round"><thead><tr><th scope="col">Round</th><th scope="col">1</th><th scope="col">2</th><th scope="col">3</th><th scope="col">4</th><th scope="col">5</th></tr></thead><tbody>
${[previous,current].map((g,i)=>`<tr><th scope="row">v${127+i} backlog</th>${g.bagByRound.slice(0,5).map(r=>`<td>${number(r.mean)}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>
<p class="note">Every four-player game reached round 5. v128 draws per reveal ranged from zero to six. Four rounds drew five and four drew four. Three more drew zero, two, or three.</p>
<h3>Six draws at smaller tables</h3>
<div class="table"><table aria-label="Pace by player count"><thead><tr><th scope="col">Table</th><th scope="col">Games</th><th scope="col">Avg rounds</th><th scope="col">Avg backlog</th><th scope="col">Slots filled</th><th scope="col">Incomplete reveals</th></tr></thead><tbody>${cohorts}</tbody></table></div>
<p class="callout warm">The six-draw rule hit the 4–8 token backlog target at four players. Two-player games filled barely half the slots. If that pattern repeats at the table, test a draw limit that scales with player count.</p></section>
<section id="actions"><div class="section-head"><p class="eyebrow">02 · Decisions</p><h2>What players did with their turns</h2><p>Actions per four-player game, including repeat actions.</p></div>
<div class="split">
${table('Actions taken per game',actionRows)}
${table('Choice and financing',[
 ['Actions per investor turn',rate('decisions','turns',2)],['Fundraises of all types per game',rate('fundraises')],['Fundraises without bids',fraction('noBid','fundraises')],['Contested fundraises',fraction('contested','fundraises')],['Decisions with ≤2 legal action types',g=>percent(g.limitedChoice)],['Decisions with no portfolio',g=>percent(g.noPortfolio)],['Average winning margin',g=>cash(g.winnerMargin)],
])}
</div>
<h3 style="margin-top:18px">Capital and final scores</h3>
${table('Capital calls and score deductions',[
 ['Capital actions per game',rate('capitalCalls')],['Cash from capital calls per table per game',g=>cash(10*g.capitalCalls/g.completed)],['Final capital deduction per investor',g=>cash(g.debtMean)],['Investors finishing with $0 / $10 / $20 / $30 deduction',g=>[0,10,20,30].map(n=>g.debtHistogram[n]??0).join(' / ')],['Unpaid loan debt',g=>cash(g.actualDebt)],
])}
<p class="note">Capital adds cash now and deducts $10 per step at final scoring. In v128, 19 calls and five Bridge Financing plays added steps. Three Share Consolidation plays removed steps. Forty investor seats ended at $0–$20 in deductions.</p>
</section>
<section id="cards"><div class="section-head"><p class="eyebrow">03 · Value cards</p><h2>Working Weekend found a use</h2><p>Seven plays across ${card(current,'weekend').games} games, up from one play in v127.</p></div>
${table('Value card volume',cardVolume)}
<p class="callout">Free Weekend gave a low-cash investor time to call capital, run a Rights Issue, and fundraise. It also bought time to cycle two cards in another game. The increase in plays supports leaving the card free for this playtest.</p>
<details open><summary>All 30 value cards · sorted by v128 plays</summary>
<p class="note">“Cycled” counts voluntary discard-and-replace actions. “Playable / held” counts action snapshots, so one card can appear several times. Eligibility shows how often a legal play existed.</p>
<div class="table"><table aria-label="Value card usage by kind"><thead><tr><th scope="col">Value card</th><th scope="col">v127 plays</th><th scope="col">v128 plays</th><th scope="col">Games played</th><th scope="col">Cycled</th><th scope="col">Playable / held</th></tr></thead><tbody>${cardRows}</tbody></table></div></details>
<p class="note">Illicit Funding was the only unplayed card. It was legal in 2 of 55 held snapshots and cycled 9 times. Its capital and board-position constraints make it a candidate to watch in human play.</p>
</section>
<section id="founders"><div class="section-head"><p class="eyebrow">04 · Founders</p><h2>One Gill move still matters</h2><p>Gill’s direct move can set up a different founder’s reaction, as it did with Danilo Egg in game 9.</p></div>
<div class="split">
${table('Founder and ownership changes',[
 ['Normal founder hires per game',rate('hires')],['Value-card hires per game',rate('cardHires')],['Founder swaps per game',rate('swaps')],['Lead handovers per game',rate('leadChanges')],['Gill activations / spaces credited',g=>{const f=gill[g===current?1:0];return `${f.used} / ${f.forward}`;}],['Gill active company-rounds',g=>gill[g===current?1:0].exposure],
])}
${table('Fumbles and recovery',[
 ['New fumbles per game',rate('fumbles')],['New fumbles per round',rate('fumbles','rounds',2)],['Printed fumble tokens drawn',g=>g.fumbleTokens],['Draw slots spent recovering',fraction('recovery','draws')],['Recovery on printed fumble',g=>g.converted],['Companies fumbled at cleanup',g=>number(g.down,2)],
])}
</div>
<p class="note">New fumbles count actual status changes from any cause. Printed fumble tokens can be spent on recovery. A printed fumble used for recovery appears in both token counts.</p>
<details><summary>Founder exposure and movement · four players</summary><p class="note">Exposure counts company-rounds at cleanup. Optional uses and offers exclude automatic triggers. Spaces are direct credited movement. Starting assignments and board states affect all figures.</p>
<div class="table"><table aria-label="Founder exposure and movement"><thead><tr><th scope="col">Founder</th><th scope="col">Company-rounds</th><th scope="col">Optional uses / offers</th><th scope="col">Spaces forward / back</th></tr></thead><tbody>${founderRows}</tbody></table></div></details>
</section>
<section id="samples"><div class="section-head"><p class="eyebrow">05 · Table stories</p><h2>Ten complete games</h2><p>Each review links to its round timeline and replay commands. Scores show the winner and runner-up.</p></div><div class="sample-grid">${sampleCards}</div></section>
<section id="method" class="method"><div class="section-head"><p class="eyebrow">06 · Reproducibility</p><h2>Study method</h2></div><ul>
<li>${study.completed} of ${study.scheduled} games completed. Four-player comparison uses ten matched opening seeds at 24 forecast samples per decision with the live adaptive bot policy.</li>
<li>Three paired two-player games and three paired three-player games used eight forecast samples. Treat those twelve runs as exploratory.</li>
<li>The experiment changed all three rules together. Matched seeds fix the opening setup. Subsequent decisions and draws can diverge.</li>
<li>Ten current four-player games were replayed through the rules engine. Final scores and state invariants were verified. Per-round bag flow reconciles entries, draws, discards and backlog.</li>
<li>Bot games measure pace, cash use, and decisions made by this policy. They cannot establish human enjoyment or table time.</li>
</ul><p class="links"><a href="manifest.json">Study manifest and source hashes</a><a href="metrics.json">Aggregated metrics</a><a href="games.jsonl">All game records</a></p></section>
</main><footer class="wrap">Vests · Playtest build 128</footer>
</body></html>`;
fs.writeFileSync(folder + '/report.html', html);
