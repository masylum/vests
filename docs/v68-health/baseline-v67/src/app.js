import {INTEL_MODES,INTEL_CARDS,canGetIntel,intelTargets,intelSecondTargets,playableIntel,intelLead} from './intel.js';
import {canHireFounder} from './config.js';
import {movementSteps} from './movement.js';
import {TRACK} from './track.js';
import {choosePower} from './racing.js';
import {
  VERSION, availableCash, slotCards, checkpointTarget, sharePayout,
  COMPANIES,
  FUNDS,
  SYMBOLS,
  FOUNDERS,
  companyValue,
  fundingPrices, fundingBand, SPECIALS, growthDeck, DECK_THEMES,
} from "./config.js";
import {
  createGame,
  eligibleCompanies, hasTurnAction,
  command,
  currentPlayer,
  observation,
  holdings,
  bankHeld,
  lead,
  quote,
  replayGame,
} from "./engine.js";
const $ = (s) => document.querySelector(s),
  root = $("#app"),
  preview = new URLSearchParams(location.search).has("preview"),
  KEY = preview ? "venture-sequential-preview-67" : "venture-sequential-67";
let setup = { seed: 42, players: 4, rules:{intelMode:'mixed'} },
  game,
  commands = [],
  auto = true,
  worker = null,
  timer = null,
  notice = "",
  modal = false;
const esc = (x) =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const coin = (n) => `<span class="coin">$${n}</span>`,
  co = (id) => COMPANIES[id].name,
  fund = (id) => `${SYMBOLS[id]} ${FUNDS[id]}`,
  button = (text, attrs = "", disabled = false) =>
    `<button ${attrs} ${disabled ? "disabled" : ""}>${text}</button>`;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) {
    game = replayGame(saved);
    setup = saved.setup;
    commands = saved.commands;
  }
} catch (e) {
  notice = "Could not load this save: " + e.message;
}
game ??= createGame(setup);
function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: VERSION, setup, commands }),
  );
}
function act(cmd) {
  motionCleanup();
  const before=game.companies.map(c=>c.position),logStart=game.log.length;
  const pending=game.race&&{stage:game.race.stage,card:game.race.card.id,count:game.race.log.length};
  const oldPawns=[...document.querySelectorAll('.pawn[data-company]')].map(el=>({id:Number(el.dataset.company),rect:el.getBoundingClientRect()}));
  try {
    const id = currentPlayer(game);
    command(game, id, cmd);
    commands.push({ id, cmd });
    if(game.phase==="legResult"&&!game.finalExit){const id=currentPlayer(game),cmd={type:"continue"};command(game,id,cmd);commands.push({id,cmd});}
    if(game.phase==='reveal'&&!game.lastRevealed?.card&&!game.lastRevealed?.reactions?.length){
      const id=currentPlayer(game),cmd={type:'reveal'};
      command(game,id,cmd);commands.push({id,cmd});
    }
    notice = "";
    save();
  } catch (e) {
    notice = e.message;
  }
  render();
  const events=game.log.slice(logStart);
  if(pending){
    const index=events.findIndex(e=>pending.stage?e.stage===pending.stage:e.card?.id===pending.card);
    const event=index>=0?events[index]:game.lastRevealed;
    const delta={reactions:(event?.reactions??[]).slice(pending.count)};
    if(index>=0)events.splice(index,1,delta);else events.unshift(delta);
  }
  const steps=movementSteps(events,before,game.companies.map(c=>c.position));
  const controls=steps.length?[...document.querySelectorAll('.decision button:not(:disabled),.decision input:not(:disabled)')]:[];
  controls.forEach(el=>el.disabled=true);
  animatePawns(steps,oldPawns).finally(()=>controls.forEach(el=>{if(el.isConnected)el.disabled=false;}));
}
function fumbleIcon() {
 return `<svg class="fumble-icon" viewBox="0 0 64 64" role="img" aria-label="Fumble"><g transform="rotate(-35 32 32)" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M19 25v20c0 10 26 10 26 0V25" fill="white"/><ellipse cx="32" cy="25" rx="13" ry="8" fill="white"/><path d="m28 22 8 6m0-6-8 6"/></g><path d="M8 54h17M49 10l5-5M54 22h7" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function cardHTML(c, compact=false) {
 const meta=COMPANIES[c.company];
 return `<article class="card growth-card ${c.signature?'has-power':''}" style="--card:${meta.color}"><b>${meta.name}</b><strong>${c.effect === "fumble" ? fumbleIcon() : c.effect === "setback" ? "−1" : `${c.printed>0?'+':''}${c.printed}`}</strong>${c.signature?`<small><em>${SPECIALS[c.company%6][0]}:</em>${compact?"":` ${SPECIALS[c.company%6][1]}`}</small>`:""}${c.effect ? `<small>${c.effect === "fumble" ? "Fumble" : "Go back"}</small>` : !c.signature?'<small class="empty-ability" aria-hidden="true"></small>':""}</article>`;
}
function founderPortrait(f) {
 return `<img src="/assets/founders/${f.id}.png" alt="${f.name}" loading="lazy">`;
}
function founderDescription(text) {
 return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function founderCard(f, extra = "") {
 const trigger=founderDescription(f.trigger)+',';
 return `<article class="founder-card ${extra}" style="--tilt:${((f.id*7)%5-2)*.85}deg"><div class="founder-face">${founderPortrait(f)}</div><div class="founder-copy"><small>${f.name}</small><p>${trigger} ${founderDescription(f.action.replace(/^(\*\*)?([A-Z])(?=[a-z])/,(_,mark,letter)=>(mark??'')+letter.toLowerCase()))}</p></div></article>`;
}
function auctionCompany() {
 return ["bid","tie","auctionResult"].includes(game.phase) ? game.auction.company : null;
}
function companyHTML(c) {
  const owner=lead(c),f=FOUNDERS[c.founder];
  const shareholders=game.players.flatMap(p=>Array.from({length:holdings(c,p.id)},(_,i)=>`<span class="share ${p.id===0?'your-share':''}" title="One share · ${FUNDS[p.id]}">${FUNDS[p.id]}${owner===p.id && i===0?" ⚑":""}</span>`)).join("");
  const hedge=c.tokens.filter(t=>t.hedge).length,bank=bankHeld(c)-hedge;
  return `<article class="company ${c.id===auctionCompany()?"auction-active":""}" style="--company:${COMPANIES[c.id].color};--tilt:${((c.id*7)%5-2)*.7}deg"><header><h3>${co(c.id)}</h3><small class="company-tam" title="Supply cards remaining / total deck">${c.supply.length}/${growthDeck(c.id).length}</small>${c.down?'<span class="fumble-badge" title="Discard the next shown card; recover and draw a replacement">Fumbled</span>':""}</header>${founderCard(f)}<aside class="company-details"><div class="reserve-track" aria-label="${c.reserve} treasury slots">${[0,1,2,3].map(n=>`<span class="${c.reserve===n?'occupied':''}">${slotCards(c,n,game.companies)}</span>`).join('')}</div><div class="shareholders">${shareholders?`${shareholders}`:'<small class="unowned">Unowned</small>'}${hedge?`<span class="share hedge-share" title="Non-player investor · shares dilute the exit payout">Hedge fund${hedge>1?` ×${hedge}`:""}</span>`:""}${bank?`<small class="bank-shares" title="Non-player shares, including hedge fund investments. They dilute the exit payout.">+ ${bank} non-player share${bank===1?"":"s"}</small>`:""}</div></aside></article>`;
}
function movementBox(from,to) { return `<strong class="movement-box">${from} → ${to}</strong>`; }
function reactionTimeline(reactions=[]) {
 const groups=[];
 for(const r of reactions){
  if(r.text.startsWith('Used power:'))continue;
  const match=r.text.match(/^(\d+): (\d+) → (\d+)$/),target=r.target??(match?Number(match[1]):r.company);
  if(match&&match[2]===match[3])continue;
  const key=r.intel?`value:${r.intelKind}:${r.intelPlayer}`:r.catchUp?'catchUp':`founder:${r.company}:${r.founder}`;
  let group=groups.at(-1);if(!group||group.key!==key){group={key,r,items:[]};groups.push(group);}
  group.items.push({r,match,target});
 }
 if(!groups.length)return '';
 return `<ol class="reaction-timeline">${groups.map(({r,items})=>{
  const value=r.intel&&r.intelKind,founder=!r.intel&&!r.catchUp&&FOUNDERS[r.founder];
  const source=value?intelCardHTML({kind:r.intelKind}):founder?founderCard(FOUNDERS[r.founder]):'<b class="effect-label">Catch-up</b>';
  return `<li class="${r.intel?'value-effect':''}" style="--company:${COMPANIES[r.company]?.color??'#fff'}">${source}<div class="effect-results">${items.map(({r,match,target},i)=>`<section>${i===0||items[i-1].target!==target?`<b>${co(target)}</b>`:''}${match?movementBox(match[2],match[3]):`<p>${esc(r.text.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</p>`}${r.reason?`<p>${esc(r.reason.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</p>`:''}</section>`).join('')}</div></li>`;
 }).join('')}</ol>`;
}
function valueReceipt(result){
 if(!result)return '';
 const changes=(result.after??[]).flatMap((c,i)=>{const before=result.before[i],rows=[];
  if(c.reserve!==before.reserve)rows.push(`${co(i)}: treasury ${before.reserve} → ${c.reserve}`);
  if(c.supply!==before.supply)rows.push(`${co(i)}: supply ${before.supply} → ${c.supply}`);
  if(c.down!==before.down)rows.push(`${co(i)}: ${c.down?'fumbled':'recovered'}`);
  return rows;
 });
 const reactions=result.reactions??[];
 return `<p>${fund(result.player)} played <b>${INTEL_CARDS[result.kind].name}</b>${result.company!==undefined?` on ${co(result.company)}`:''}.</p>${!reactions.some(r=>r.intel)?`<div class="value-receipt">${intelCardHTML({kind:result.kind})}<div>${result.noEffect?'<p>No eligible company. The card had no effect.</p>':changes.map(t=>`<p>${esc(t)}</p>`).join('')}</div></div>`:changes.map(t=>`<p>${esc(t)}</p>`).join('')}${reactionTimeline(reactions)}`;
}

function revealHTML() {
  const e = game.lastRevealed;
  if (!e) return "<p>No card revealed yet.</p>";
  if(e.value)return valueReceipt(e.value);
  if(!e.card)return reactionTimeline(e.reactions)||'<p>No founder powers triggered in this step.</p>';
  return `<div class="reveal-card ${e.deferred?'discarded':''}">${cardHTML(e.card)}<div><h3>${co(e.card.company)} ${e.deferred?'· card discarded':''}</h3>${!e.deferred&&e.effect&&e.effect.before!==e.effect.after?movementBox(e.effect.before,e.effect.after):''}${e.deferred?'<p><span class="summary-fumble">Recovered</span> Draw a replacement.</p>':e.card.effect==='fumble'?(game.companies[e.card.company].down?'<p><span class="summary-fumble">Fumbled</span> Discard the next card to recover.</p>':'<p><span class="summary-fumble">Recovered / prevented</span></p>'):e.card.effect==='setback'?'<p>Moved back by the card.</p>':`<p>Card: ${e.effect.printed}${e.effect.founder?` · founder: ${e.effect.founder>0?'+':''}${e.effect.founder}`:''}</p>`}${e.effect?.founder&&FOUNDERS[game.companies[e.card.company].founder]?`<div class="power-prompt">${founderCard(FOUNDERS[game.companies[e.card.company].founder])}<p>Founder movement modifier: ${e.effect.founder>0?'+':''}${e.effect.founder}.</p></div>`:''}${reactionTimeline(e.reactions)}</div></div>`;
}
function revealSummaryHTML() {
 const start=game.log.findLastIndex(e=>e.type==='cycle');
 const events=game.log.slice(start+1), cards=events.filter(e=>e.type==='reveal'||e.type==='deferred');
 const before=game.revealStartPositions ?? cards.find(e=>e.positions)?.positions;
 const reactions=events.flatMap(e=>e.reactions??[]);
 const hedge=events.filter(e=>e.type==='hedge');
 return `<p>${cards.filter(e=>e.type==='reveal').length} cards resolved · ${cards.filter(e=>e.type==='deferred').length} discarded to recover from fumbles</p>
 ${events.filter(e=>e.type==='burn').map(e=>`<p>${e.count} random growth-pile cards removed face down.</p>`).join('')}<div class="round-movement">${game.companies.filter(c=>(before?.[c.id]??c.position)!==c.position).map(c=>`<article style="--company:${COMPANIES[c.id].color}"><b>${co(c.id)}</b>${movementBox(before?.[c.id]??c.position,c.position)}${c.down?'<span class="summary-fumble">Fumbled</span>':''}</article>`).join('')}</div>
 <details class="round-details"><summary>Round timeline</summary><ol class="round-event-timeline">${events.filter(e=>e.stage!=='intel'&&(e.card||e.reactions?.length||e.type==='valueResolved')).map(e=>`<li>${e.type==='valueResolved'?valueReceipt(e.value):''}${e.card?`<div class="timeline-growth">${cardHTML(e.card,true)}<div>${e.type==='deferred'?'<b>Discarded · recovered</b>':e.effect?movementBox(e.effect.before,e.effect.after):''}</div></div>`:''}${e.type==='valueResolved'?'':reactionTimeline(e.reactions??[])}</li>`).join('')}</ol></details>`;
}
function intelCardHTML(card,actions='') {
 const info=INTEL_CARDS[card.kind];return `<article class="intel-card"><img class="value-art" src="/assets/value/${card.kind}.png" alt="" loading="lazy"><h3>${info.name}</h3><p>${info.text}</p>${actions?`<div class="intel-actions">${actions}</div>`:''}</article>`;
}
function intelHandHTML(){
 if(game.rules.intelMode==='off')return '';
 return `<section class="intel-hand"><h2>Your value card</h2><div class="intel-cards">${game.players[0].intel.map(c=>intelCardHTML(c)).join('')||'<p>No value cards.</p>'}</div></section>`;
}
function decision() {
  const id = currentPlayer(game),
    human = id === 0,
    p = game.players[id ?? 0];
  if (game.ended)
    return `<h2>${game.winners.map(fund).join(" & ")} wins</h2><div class="bids">${game.players.map((p) => `<article>${fund(p.id)}<strong>${coin(game.scores[p.id])}</strong><small>Saved ${p.savedCash} − debt ${p.debt}</small></article>`).join("")}</div>`;
  switch (game.phase) {
    case "call": {
      const ids=eligibleCompanies(game,id);
      return `<h2>${human?'Choose your turn':fund(id)+' chooses a turn'}</h2>${human?`<div class="turn-companies">${game.companies.map(c=>`<article style="--company:${COMPANIES[c.id].color}"><h3>${co(c.id)}</h3>${button('Auction',`data-call="${c.id}"`,!ids.includes(c.id))}${button('Change founder',`data-change-founder="${c.id}"`,lead(c)!==id)}</article>`).join('')}</div>${game.rules.intelMode!=='off'?button('Let me know how I can help','data-get-intel'):button('Pass','data-call-pass')}`:''}`;
    }
    case "intelPlay": {
      const any=p.intel.some(c=>intelTargets(game,id,c.kind).length);
      const cards=human?p.intel.map((card,i)=>{
        let actions=intelTargets(game,id,card.kind).map(cid=>{
          if(['swap','move','waste'].includes(card.kind))return intelSecondTargets(game,id,card.kind,cid).map(target=>button(`${co(cid)} ${card.kind==='swap'?'↔':card.kind==='waste'?'→':'then'} ${co(target)}`,`data-play-intel="${i}" data-intel-company="${cid}" data-intel-target="${target}"`)).join('');
          return button(co(cid),`data-play-intel="${i}" data-intel-company="${cid}"`);
        }).join('');
        if(!actions)actions=any?'<small>No eligible company.</small>':button('Play without effect',`data-play-intel="${i}"`);
        if(game.intelOptional)actions+=button('Keep this card',`data-keep-value="${i}"`);
        return intelCardHTML(card,actions);
      }).join(''):'';
      return `<h2>${human?(game.intelOptional?'Add value · optional':'Let me know how I can help'):fund(id)+' is adding value'}</h2><p>${game.intelOptional?'Play 1 card, or keep 1 and return the other to the bottom.':'Play 1 card and keep the other.'}</p>${human?`<div class="intel-cards">${cards}</div>`:'<p>Their cards are private.</p>'}`;
    }
    case "intelScout": {
      const peek=game.intelScout;
      const permutations=a=>a.length<=1?[a]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));
      return `<h2>${INTEL_CARDS[peek.kind].name}</h2><p>${peek.kind==='launch'?'Choose 1 to add face down. The other stays on top of supply.':peek.kind==='inside'?'Choose 1 card to remove face down, then shuffle the supply. Only you see these cards.':'Choose the order: first → second → bottom. Only you see these cards.'}</p>${human?`<div class="intel-cards">${peek.cards.map((card,i)=>`<article><b>Card ${i+1}</b>${cardHTML(card)}${peek.kind==='launch'?button('Add to growth pile',`data-scout-intel="${i}"`):peek.kind==='inside'?button('Remove this card',`data-order-intel="${[...peek.cards.map((_,j)=>j).filter(j=>j!==i),i].join(',')}"`):''}</article>`).join('')}</div>${['launch','inside'].includes(peek.kind)?'':permutations(peek.cards.map((_,i)=>i)).map(order=>button(order.map((x,i)=>`Card ${x+1}${i===order.length-1?(peek.kind==='inside'?' (remove)':' (bottom)'):''}`).join(' → '),`data-order-intel="${order.join(',')}"`)).join('')}`:'<p>Private inspection.</p>'}`;
    }
    case "founder": {
      const c = game.companies[game.company];
      return `<h2>${human ? "Your founder choice" : `${fund(id)} chooses`} · ${co(c.id)}</h2><p>Choose a new founder. The company fumbles and your turn ends.</p><div class="founder-options">${[c.founder, ...game.founderMarket].map((f, i) => `<article>${founderCard(FOUNDERS[f])}${human && (i || game.rules.intelMode==='off') ? button(i ? "Choose founder" : "Keep founder", `data-founder="${i - 1}"`,i>0&&!canHireFounder(f,game.leg)) : ""}</article>`).join("")}</div>`;
    }
    case "power": {
      const q=game.powerChoice, f=FOUNDERS[q.founder];
      const text=q.text.replace(/company (\d+)/gi,(_,n)=>co(Number(n)));
      return `<div class="title"><h2>${human ? "Your founder decision" : fund(id)} · ${co(q.company)}</h2><small>${game.race?.stage === "start" ? "Before reveal" : game.race?.stage === "end" ? "After reveal" : "Reaction chain"}</small></div><div class="power-prompt">${founderCard(f)}<div><b>${f.name}</b><p>${esc(text)}</p>${human ? `<div class="power-options">${q.options.map((o,i)=>button(o.label.replace(/company (\d+)/gi,(_,n)=>co(Number(n))),`data-power="${i}"`)).join("")}</div>` : `<p>${fund(id)} controls this choice.</p>${button("Let AI decide", "data-ai-power")}`}</div></div>`;
    }
    case "bid": {
      const a = game.auction;
      return `<div class="title"><h2>${fund(a.host)} is fundraising: <span style="color:${COMPANIES[a.company].color}">${co(a.company)}</span></h2></div><p class="bid-explainer">Minimum $${a.reserve}. Pay the second-highest bid, or your own if no one else bids.<br>Any unpaid part of your winning bid stays locked until round end.</p>${human && a.equityControl && a.equityController===id ? `<p><strong>Other bids:</strong> ${a.bids.map(b=>`${fund(b.player)}: ${b.amount ? "$"+b.amount : "Passed"}`).join(" · ")}</p>` : ""}${human ? `<form id="bid"><label><b>Your bid</b><input aria-label="Your bid" name="amount" type="number" min="${a.reserve}" max="${availableCash(p)}" value="${a.reserve}" step="1"></label>${button("Submit sealed bid", 'type="submit"', availableCash(p) < a.reserve)}${button("Pass", 'type="button" data-pass')}</form>` : ""}`;
    }
    case "tie":
      return `<h2>${human ? "Your open bid" : `${fund(id)} bids openly`} · ${co(game.auction.company)}</h2><p>Tied rivals · current price ${coin(game.auction.price)} · in: ${game.auction.contenders.map(fund).join(", ")}</p><div class="bids">${game.auction.bids.map(b=>`<article>${fund(b.player)}<strong>${b.amount?coin(b.amount):"Passed"}</strong></article>`).join("")}</div>${human ? `<form id="tie"><label>Raise to<input aria-label="Open tie bid" name="amount" type="number" min="${game.auction.price + 1}" max="${availableCash(p)}" value="${game.auction.price + 1}" step="1"></label>${button("Raise", 'type="submit"', availableCash(p) <= game.auction.price)}${button("Withdraw", 'type="button" data-withdraw')}</form>` : ""}`;
    case "auctionResult": {
      const a = game.auction;
      return `<section class="auction-receipt" aria-label="Auction result"><header class="receipt-heading"><small>Auction result · <b style="color:${COMPANIES[a.company].color}">${co(a.company)}</b></small><h2>${a.winner===null?"No sale":`${fund(a.winner)} pays $${a.paid}`}</h2></header><div class="bids" aria-label="Submitted bids">${a.bids.map(b=>`<article class="${b.player===a.winner?"won":""}"><span>${fund(b.player)}${b.player===a.winner?'<small class="winner-label">Winner</small>':""}</span><strong>${b.amount>=a.reserve?`$${b.amount}`:"Passed"}</strong></article>`).join("")}</div><footer class="receipt-footer">${button("Continue →","data-continue")}</footer></section>${a.open?.length?`<details><summary>Open tie bids</summary><small>${a.open.map(b=>`${fund(b.player)} ${b.amount?"$"+b.amount:"withdraws"}`).join(" · ")}</small></details>`:""}`;
    }
    case "purchaseResult":
      return `<div class="title"><h2>${game.purchaseSummary.reduce((s,c)=>s+c.count,0)} deployed cards · ${game.drawsLeft} draws from ${game.poolSize}</h2>${button("Reveal pile →","data-continue")}</div><div class="deployment-summary">${game.companies.filter(c=>game.purchaseSummary.some(d=>d.company===c.id&&d.count>0)).map(c=>{const d=game.purchaseSummary.find(d=>d.company===c.id);return `<article style="--company:${COMPANIES[c.id].color}"><b>${co(c.id)}</b><div class="reserve-track deployment-track" aria-label="Treasury ${d.fromReserve} to ${d.toReserve}">${[0,1,2,3].map(n=>`<span class="${n===d.toReserve?'occupied':''} ${n===d.fromReserve?'previous-slot':''}">${slotCards(c,n,game.companies)}</span>`).join('')}</div><div class="deployment-numbers"><span>${d?.count??0} ${(d?.count??0)===1?'card':'cards'} added</span></div></article>`;}).join('')}</div>`;
    case "reveal":
      return `<div class="title"><h2>${game.lastRevealed?.card ? `Reveal · ${game.drawsLeft} draws left` : "Before reveal"}</h2>${button("Reveal next card →", "data-reveal")}</div>${revealHTML()}`;
    case "afterRevealReady":
      return `<h2>The reveal · last card resolved</h2>${revealHTML()}${button('After-reveal powers →','data-continue')}`;
    case "catchUpReady":
      return `<h2>After reveal</h2>${revealHTML()}${button('Continue →','data-continue')}`;
    case "catchUpResult":
      return `<h2>Catch-up · resolved</h2>${reactionTimeline(game.catchUpResult?.reactions??[])}${button('Finish round →','data-continue')}`;
    case "cycleResult":
      return `<div class="title"><h2>${game.companies.some(c=>c.position>=24) ? "IPO reached" : "Reveal complete"}</h2>${button(game.companies.some(c=>c.position>=24) ? "Resolve IPO →" : "Next round →", "data-continue")}</div>${revealSummaryHTML()}<small>${game.cycleEnd ? `${game.pile.length} undrawn cards stay in the growth pile for the next round. Shares and cash carry into the next leg. Jenkins can also exit at IPO.` : `${game.pile.length} undrawn cards stay in the growth pile. The first player rotates; founder powers reset.`}</small>`;
    case "valueResult":
      return `<h2>Value card played</h2>${valueReceipt(game.valueResult)}${button('Continue →','data-continue')}`;
    case "ipoResult":
      return `<h2>${co(game.ipoCompany)} reached IPO</h2>${revealHTML()}<p>The race stops here. Review the final move, then resolve the exit.</p>${button('Final exit →','data-continue')}`;
    case "settle":
      return `<h2>Final exit · ${human?"Your portfolio":fund(id)}</h2><p>The top ${game.rules.payoutPlaces} pay (Jenkins can also exit): ${game.settlement.podium.map(co).join(", ")}. Companies sharing a position share their place. Final obligation: ${coin(p.due)}.</p><div class="bids">${game.companies.filter(c=>holdings(c,id)).map(c=>`<article>${co(c.id)}<strong>${holdings(c,id)} share${holdings(c,id)===1?'':'s'} × $${game.settlement.prices[c.id]}</strong></article>`).join("")}</div>${human?button("Sell portfolio & repay obligation →","data-final-sale"):""}`;
    case "legResult":
      if(!game.finalExit)return `<div class="title"><h2>Continue the race</h2>${button("Continue the race →","data-continue")}</div><p>Keep all shares and cash. Your starting obligation stays fixed; repayment waits until the final exit.</p>`;
      return `<div class="title"><h2>Final accounts</h2>${button("Final scores →","data-continue")}</div><div class="bids">${game.settlement.accounts.map(a=>`<article>${fund(a.player)}<strong>${coin(a.cash-a.unpaid)}</strong><small>Repaid $${a.paid}${a.unpaid?` · unpaid $${a.unpaid}`:""}</small></article>`).join("")}</div>`;
    default:
      return "";
  }
}
function poolWeight(c) {
 const upper=growthDeck(c.id).length-c.history.length-c.supply.length;
 return game.metrics.burned&&game.pile.length?`≤${Math.min(game.pile.length,upper)}`:game.pile.filter(card=>card.company===c.id).length;
}
function pawnHTML(c) {
 const name=COMPANIES[c.id];
 return `<span data-company="${c.id}" class="pawn ${c.id===auctionCompany()?"auction-active":""} ${c.tokens.length?"":"unfunded-pawn"}" style="--company:${name.color}" title="${name.name}${c.down?' · Fumbled':''} · growth ${c.position} · ${c.tokens.length} issued shares${c.founder===4?` · Jenkins exit $${quote(c,game.rules,game.companies)}/share`:""}"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M3 12v10c0 13 30 13 30 0V12" fill="color-mix(in srgb,var(--company),#000 22%)" stroke="#000" stroke-width="2.5"/><ellipse cx="18" cy="12" rx="15" ry="9" fill="var(--company)" stroke="#000" stroke-width="2.5"/><text x="18" y="16" text-anchor="middle" fill="#000" font-size="11" font-weight="800">${c.down?'×':name.short.toUpperCase()}</text></svg><span class="sr-only">${name.short.toUpperCase()}</span></span>`;
}
function boardHTML() {
 return `<div class="table-layout"><div class="board-scroll"><main class="board">
 <svg class="race-track" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">${TRACK.map((cell,i)=>`<path class="band-${fundingBand(i+1)}" d="${cell.path}"/>`).join("")}</svg>
 ${TRACK.map((cell,i)=>`<div data-space="${i+1}" class="track-label band-${fundingBand(i+1)}" style="left:${cell.x}%;top:${cell.y}%"><header><b>${i+1}</b><span class="track-value">$${companyValue(i+1,game.rules)}</span></header><div class="space-pawns">${game.companies.filter(c=>c.position===i+1).map(pawnHTML).join("")}</div></div>`).join("")}

 <section class="centre"><section class="funding-strip" aria-label="Funding prices"><strong>Funding</strong>${[0,1,2].map(b=>`<span class="funding-band band-${b}"><small>Growth ${b*8+1}–${(b+1)*8}</small><b>${fundingPrices(b,game.rules).map(p=>`$${p}`).join(" / ")}</b></span>`).join("")}</section>
 <div class="companies">${game.companies.map(companyHTML).join("")}</div>
 <section class="growth-pool" aria-label="Growth pool"><b>${game.poolSize!==undefined?`${game.drawsLeft} draws left`:`Next: ${game.rules.revealsPerRound} draws`} · ${game.pile.length} in pile</b><div class="pool-cards">${game.companies.map(c=>`<span style="--company:${COMPANIES[c.id].color}">${co(c.id)} <b>${poolWeight(c)}</b></span>`).join("")}</div>${game.metrics.burned?`<small>${game.metrics.burned} cards burned unseen · company counts are upper bounds.</small>`:''}${game.companies.some(c=>c.position===0)?`<small>Start · ${game.companies.filter(c=>c.position===0).map(pawnHTML).join("")}</small>`:""}</section>
 </section></main></div></div>`;
}
function exits() {
 dialog("Exit per share",`<p>Find the company’s growth and its total issued shares, including non-player shares. The top ${game.rules.payoutPlaces} places pay at IPO, including ties. Payouts round down to $${game.rules.moneyScale} increments. Jenkins pays a $${game.rules.wangExit} company exit in 4th or 5th; Jerry counts 1 fewer issued share. Both powers are inactive while fumbled.</p><div class="lookup"><table class="division-grid"><thead><tr><th scope="col">Growth</th>${Array.from({length:5},(_,i)=>`<th scope="col">${i+1} share${i?"s":""}</th>`).join("")}</tr></thead><tbody>${Array.from({length:24},(_,i)=>`<tr class="${game.rules.checkpoints.includes(i+1)?"checkpoint-row":""}"><th scope="row">${i+1}</th>${Array.from({length:5},(_,n)=>`<td>$${sharePayout(companyValue(i+1,game.rules),n+1,game.rules)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p>Growth 0 pays $0.</p>`);
}
// Keep terminal actions below content without breaking their original form ownership.
function arrangeDecision() {
 const panel=$('.decision'), actions=[...panel.querySelectorAll('button')].filter(b=>!b.closest('.turn-companies, .intel-cards'));
 if(!actions.length){const content=document.createElement('div');content.className='decision-content';while(panel.firstChild)content.append(panel.firstChild);panel.append(content);return;}
 const footer=document.createElement('footer');footer.className='decision-actions';
 for(const action of actions){
  const form=action.closest('form');if(form)action.setAttribute('form',form.id);
  if(action.hasAttribute('data-founder')){
   const choice=Number(action.dataset.founder);
   if(choice>=0)action.textContent=`Hire ${FOUNDERS[game.founderMarket[choice]].name}`;
  }
  const company=action.dataset.call ?? action.dataset.changeFounder ?? game.auction?.company ?? game.powerChoice?.company;
  if(company!==undefined){action.style.setProperty('--action-color',COMPANIES[company].color);action.classList.add('company-action');}
  footer.append(action);
 }
 const main=footer.querySelector('button[type="submit"], [data-continue], [data-reveal], [data-ai-power], [data-final-sale]')
  ?? (game.phase==='power'?footer.querySelector('[data-power="1"]'):null);
 if(main){main.classList.add('primary');footer.append(main);}
 const content=document.createElement('div');content.className='decision-content';
 while(panel.firstChild)content.append(panel.firstChild);
 panel.append(content,footer);
}
let motionCleanup=()=>{};
async function animatePawns(steps, oldPawns) {
 if(!steps.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const scroller=document.querySelector('.tabletop'),scrollBefore=scroller?.scrollTop??0;
 const firstPawn=document.querySelector(`.pawn[data-company="${steps[0].company}"]`);
 if(firstPawn){const r=firstPawn.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)firstPawn.scrollIntoView({block:'center',behavior:'instant'});}
 const scrollDelta=(scroller?.scrollTop??0)-scrollBefore;
 const ghosts=new Map(),hidden=[];
 for(const {company} of steps){
  if(ghosts.has(company))continue;
  const pawn=document.querySelector(`.pawn[data-company="${company}"]`),old=oldPawns.find(p=>p.id===company);
  if(!pawn||!old)continue;
  const ghost=pawn.cloneNode(true);ghost.removeAttribute('data-company');ghost.classList.add('moving-pawn');
  Object.assign(ghost.style,{left:`${old.rect.x}px`,top:`${old.rect.y-scrollDelta}px`,width:`${old.rect.width}px`,height:`${old.rect.height}px`});
  document.body.append(ghost);pawn.style.visibility='hidden';hidden.push(pawn);ghosts.set(company,ghost);
 }
 let cancelled=false;
 motionCleanup=()=>{cancelled=true;ghosts.forEach(g=>g.remove());hidden.forEach(p=>p.style.visibility='');};

 for(const step of steps){
  if(cancelled)break;
  const ghost=ghosts.get(step.company);if(!ghost)continue;
  const rect=ghost.getBoundingClientRect(),points=[{left:`${rect.x}px`,top:`${rect.y}px`}];
  const direction=Math.sign(step.to-step.from);
  for(let n=step.from+direction;n!==step.to+direction;n+=direction){
   const cell=document.querySelector(`[data-space="${n}"] .space-pawns`);if(!cell)continue;
   const r=cell.getBoundingClientRect();points.push({left:`${r.x}px`,top:`${r.y}px`});
  }
  const final=document.querySelector(`.pawn[data-company="${step.company}"]`);
  if(final&&step===steps.findLast(s=>s.company===step.company)){const r=final.getBoundingClientRect();points.push({left:`${r.x}px`,top:`${r.y}px`});}
  if(points.length<2)continue;
  const animation=ghost.animate(points,{duration:Math.min(700,180+Math.abs(step.to-step.from)*60),easing:'ease-in-out',fill:'forwards'});
  await animation.finished.catch(()=>{});
  if(cancelled)break;
  Object.assign(ghost.style,points.at(-1));animation.cancel();
 }
 if(!cancelled)motionCleanup();
}
function render() {
 const oldScroll=document.querySelector('.tabletop');const scroll={top:oldScroll?.scrollTop??0,left:oldScroll?.scrollLeft??0};
 motionCleanup();
 clearTimeout(timer);
 const id=currentPlayer(game);
 const activeFund=game.phase==="auctionResult"?game.auction.host:id;
 root.innerHTML=`<header class="top"><div class="brand"><h1>Vests</h1><span class="version" aria-label="Loaded game version">v${VERSION}</span></div><div class="status"><b>Round ${game.metrics.cycles}</b><span>First to 24 ends play</span></div><nav>${button("Supply","data-supply")}${button("Value cards","data-intel-catalogue")}${button("Founders","data-founders")}${button("Exit values","data-exits")}${button("Rules","data-rules")}${button("New game","data-new")}${button("History","data-history")}<label class="auto-control"><input type="checkbox" id="auto" ${auto?"checked":""}>Auto-play AI</label></nav></header>${notice?`<p class="notice" role="alert">${esc(notice)}</p>`:""}<div class="tabletop"><section class="table-top"><section class="funds" aria-label="Investors">${game.players.map(p=>`<article style="--tilt:${((p.id*3)%5-2)*.65}deg" class="fund ${p.id===0?"you":""} ${p.id===activeFund?"active":""}"><header><b>${fund(p.id)} ${p.id===0?"<em>YOU</em>":""}${p.id===activeFund?'<span class="turn-label">TURN</span>':""}</b>${p.id===0 || game.ended ? coin(game.ended?game.scores[p.id]:availableCash(p)) : ""}</header>${!game.ended?`<small class="cash-status">${p.id===0?'Available · ':''}<b>$${p.locked??0} locked</b>${game.rules.intelMode!=="off"?` · ${p.intel.length} value card${p.intel.length===1?'':'s'}`:""}</small>`:""}</article>`).join("")}</section></section><div class="game-layout">${intelHandHTML()}${boardHTML()}<aside class="founder-market" aria-label="Available founders"><h2>Available founders</h2><div class="market-cards">${game.founderMarket.map(f=>founderCard(FOUNDERS[f])).join("")}</div></aside></div></div><section class="decision ${['reveal','afterRevealReady','catchUpReady','catchUpResult','ipoResult','valueResult'].includes(game.phase)?'movement-decision':game.phase.startsWith('intel')?'intel-decision':''}">${decision()}</section>`;
 const scroller=document.querySelector('.tabletop');scroller.scrollTop=scroll.top;scroller.scrollLeft=scroll.left;
 arrangeDecision();bind();schedule();
}
function close() {
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  modal = false;
  schedule();
}
function dialog(title, body) {
  worker?.terminate();
  worker = null;
  clearTimeout(timer);
  const d = document.createElement("dialog");
  d.innerHTML = `<header><h2>${title}</h2>${button("Close ×", "data-close")}</header>${body}`;
  document.body.append(d);
  d.showModal();
  modal = true;
  d.querySelector("[data-close]").onclick = close;
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  return d;
}
function supply() {
 dialog("Growth supply",`<p>Each company has a finite supply and 3 signature cards. Faded cards have been revealed or discarded. Unseen cards may be in supply or the growth pile; their location is hidden.</p><div class="deck-gallery">${game.companies.map(c=>{
 const used=new Set(c.history.map(card=>card.id));
 return `<section class="company-deck" style="--company:${COMPANIES[c.id].color};--tilt:${((c.id*7)%5-2)*.7}deg"><header><h3>${co(c.id)}</h3><span>${growthDeck(c.id).length-used.size} unseen · ${c.supply.length} in supply</span></header><p class="deck-theme"><b>${DECK_THEMES[c.id][0]}.</b> ${DECK_THEMES[c.id][1]}</p><div class="deck-fan">${growthDeck(c.id).map(card=>`<div class="deck-slot ${used.has(card.id)?"card-used":""} ${card.signature?"signature-slot":""}" tabindex="0" title="${card.signature?SPECIALS[c.id%6][1]+' · ':''}${used.has(card.id)?"Already revealed / discarded":"Unseen — location hidden"}">${cardHTML(card,false)}</div>`).join("")}</div></section>`;
 }).join("")}</div>`);
}
function founders() {
 dialog("Meet the founders", `<p>Powers are inactive while fumbled. “Before reveal” and “After reveal” happen once per round. Leading and last include ties; first and second include tied places. The lead investor chooses optional powers; unowned companies skip them. A fumbled company discards its next growth card, recovers, and draws a replacement.</p><div class="founder-review">${[0,14,6,18,11,19,2,9,4,17,5,16,1,8,15,10,13,7,3,12].map(id=>FOUNDERS[id]).map(f=>`<section>${founderCard(f)}<small>Inspired by ${f.inspiredBy}</small></section>`).join("")}</div>`);
}
function rules() {
 dialog('How to play',`<ol><li>Start with $${game.rules.startingCash}, a $${game.rules.obligation} repayment obligation and one private value card.</li><li>Take one action: auction an unowned company or a company you lead; change a founder you lead and fumble that company; or “Let me know how I can help” — draw 1 value card, play 1, and keep the other. After an auction or founder change, draw 1 value card and optionally play 1. If you skip, keep 1 and return the other to the bottom. </li><li>A portfolio company is any company you own shares in. If neither value card has a legal target, choose one to play without effect.</li><li>Auctions are sealed second-price: the winner pays the next bid, or their own if alone. Any unpaid part of a winning bid stays locked until round end. Funding thresholds: ${game.rules.projectPrices.map(p=>p.map(x=>'$'+x).join('/')).join(' · ')}.</li><li>Each round, funded companies add supply cards to the growth pile, then lose 1 treasury slot. Reveal ${game.rules.revealsPerRound} growth cards. Fumbled companies discard their next draw, recover, and draw a replacement. Resolve movement first, then triggered powers in company order; finish each reaction chain before the next effect.</li><li>After reveal effects, each company tied for last receives one catch-up move. Move all catch-up companies together, then resolve founder reactions in company order. Finish each movement and its reaction chain before the next effect. Then remove up to ${game.rules.burnPerRound} random growth-pile cards face down.</li><li>First to 24 immediately ends play. The top ${game.rules.payoutPlaces} places pay, with ties sharing their place. Jenkins also exits for $${game.rules.wangExit} in fourth or fifth while not fumbled. Repay $${game.rules.obligation}; the investor with the most money left wins.</li></ol>`);
}
function newGame() {
  const d = dialog(
    "Set the table",
    `<form id="new"><label>Investors<select name="players">${[3, 4, 5, 6].map((n) => `<option ${n === 4 ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Seed<input type="number" min="0" max="4294967295" name="seed" value="${Date.now() % 4294967295}"></label>${button("Start new game", 'type="submit"')}</form><div class="save-tools">${button("Save replay", "data-save")}<label class="file-button">Load replay<input type="file" accept="application/json" data-load></label></div><small>This version has its own save slot; earlier games are untouched.</small>`,
  );
  d.querySelector("#new").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setup = {
      seed: Number(fd.get("seed")),
      players: Number(fd.get("players")),
      rules: {intelMode:'mixed'},
    };
    game = createGame(setup);
    commands = [];
    notice = "";
    close();
    save();
    render();
  };
  d.querySelector("[data-save]").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify({ version: VERSION, setup, commands })], {
        type: "application/json",
      }),
    );
    a.download = `vests-${game.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  d.querySelector("[data-load]").onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text()),
        next = replayGame(data);
      setup = data.setup;
      commands = data.commands;
      game = next;
      notice = "";
      close();
      save();
      render();
    } catch (error) {
      notice = error.message;
      close();
      render();
    }
  };
}
function history() {
  dialog(
    "Public history",
    `<div class="history">${game.log
      .filter((e) =>
        [
          "auction",
          "deferred",
          "reveal",
          "purchases",
          "settled",
          "founder",
          "carry",
        ].includes(e.type),
      )
      .map(
        (e) =>
          `<p><small>Leg ${e.leg + 1} · cycle ${e.cycle}</small> ${e.type === "auction" ? `${co(e.company)} · ${e.winner === null ? "no sale" : `${fund(e.winner)} paid $${e.paid}`}` : e.type === "deferred" ? `${co(e.card.company)} · card discarded to clear fumble; replacement drawn` : e.type === "reveal" ? (e.card.effect ? `${co(e.card.company)} · ${e.card.effect === "fumble" ? `Fumble` : `Go back · ${e.effect.before} → ${e.effect.after}`}` : `${co(e.card.company)} ✳ ${e.card.printed} · ${e.effect.before} → ${e.effect.after}`) : e.type === "purchases" ? `Deployed ${e.companies.reduce((s, c) => s + c.count, 0)} growth cards` : e.type === "deploy" ? `${co(e.company)} deployed ${e.count} cards · ${e.reserve} charges remain` : e.type === "hedge" ? `Hedge fund backed ${co(e.company)} · reserve 3 · one non-player share` : e.type === "burn" ? `${e.count} pile cards burned unseen` : e.type === "carry" ? `${e.count} undrawn cards retained in the pile` : e.type === "intelDraw" ? `${fund(e.player)} drew a value card` : e.type === "intelPlay" ? `${fund(e.player)} played ${INTEL_CARDS[e.kind].name}${e.noEffect?' without effect':e.company===undefined?'':` on ${co(e.company)}`}` : e.type === "founder" ? `${co(e.company)} hired ${FOUNDERS[e.founder].name}` : e.type === "opening" ? `Opening deal: ${e.cards.map(c=>`${co(c.company)} ✳${c.printed}`).join(" · ")}` : e.type === "cycle" ? "Funding cycle starts" : e.type === "checkpoint" ? (e.snapshot?.final ? "IPO settlement" : "Funding band advanced") : "Final obligation settled"}</p>`,
      )
      .reverse()
      .join("")}</div>`,
  );
}
function bind() {
 root.querySelectorAll('[data-keep-value]').forEach(b=>b.onclick=()=>act({type:'keepValue',card:Number(b.dataset.keepValue)}));
  const on = (s, fn) => root.querySelector(s)?.addEventListener("click", fn);
  on("[data-rules]", rules);
  on("[data-supply]", supply);
  on("[data-intel-catalogue]",()=>{const d=dialog("Value cards",`<p>After an auction or founder change, draw 1 card. Play 1, or keep 1 and return the other to the bottom. A portfolio company is any company you own shares in.</p><div class="intel-cards">${Object.keys(INTEL_CARDS).map(kind=>intelCardHTML({kind})).join('')}</div>`);d.classList.add('value-catalogue');});
  on("[data-exits]", exits);
  on("[data-founders]", founders);
  on("[data-final-sale]",()=>act({type:"sell",shares:game.companies.map(c=>holdings(c,0))}));
  root.querySelectorAll("[data-change-founder]").forEach(b=>b.onclick=()=>act({type:"changeFounder",company:Number(b.dataset.changeFounder),discard:Number($("#turn-discard")?.value)}));
  on('[data-crisis-play]',()=>act({type:'crisisIntel',play:true}));
  on('[data-crisis-pass]',()=>act({type:'crisisIntel',play:false}));
  root.querySelectorAll('[data-order-intel]').forEach(b=>b.onclick=()=>act({type:'orderIntel',order:b.dataset.orderIntel.split(',').map(Number)}));
  on("[data-get-intel]",()=>act({type:'getIntel'}));
  on("[data-save-intel]",()=>act({type:'playIntel',card:-1}));
  root.querySelectorAll('[data-keep-intel]').forEach(b=>b.onclick=()=>act({type:'keepIntel',choice:Number(b.dataset.keepIntel)}));
  root.querySelectorAll('[data-play-intel]').forEach(b=>b.onclick=()=>act({type:'playIntel',card:Number(b.dataset.playIntel),company:Number(b.dataset.intelCompany),target:b.dataset.intelTarget===undefined?undefined:Number(b.dataset.intelTarget)}));
  root.querySelectorAll('[data-scout-intel]').forEach(b=>b.onclick=()=>act({type:'scoutIntel',choice:Number(b.dataset.scoutIntel)}));
  on("[data-new]", newGame);
  on("[data-history]", history);
  on("[data-continue]", () => act({ type: "continue" }));
  on("[data-ai-power]", () => {worker?.terminate();worker=null;act({type:"power",choice:choosePower(game)});});
  on("[data-reveal]", () => act({ type: "reveal" }));
  on("[data-pass]", () => act({ type: "bid", amount: 0 }));
  on("[data-withdraw]", () => act({ type: "tie", amount: 0 }));
  root.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>act({type:'call',company:Number(b.dataset.call),discard:Number($("#turn-discard")?.value)}));
  on('[data-call-pass]',()=>act({type:'call',company:null}));
  root
    .querySelectorAll("[data-founder]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          act({ type: "founder", choice: Number(b.dataset.founder) })),
    );
  root.querySelectorAll("[data-power]").forEach(b=>b.onclick=()=>act({type:"power",choice:Number(b.dataset.power)}));
  root.querySelector("#auto").onchange = (e) => {
    auto = e.target.checked;
    worker?.terminate();
    worker = null;
    schedule();
  };
  for (const type of ["bid", "tie"]) {
    const form = root.querySelector("#" + type);
    if (form)
      form.onsubmit = (e) => {
        e.preventDefault();
        act({ type, amount: Number(new FormData(form).get("amount")) });
      };
  }
  const sales = root.querySelector("#sales");
  if (sales) {
    const quantities = () =>
      game.companies.map((c) =>
        Number(sales.elements.namedItem(String(c.id))?.value ?? 0),
      );
    const update = () => {
      const sum = quantities().reduce(
          (s, n, i) => s + n * game.settlement.prices[i],
          0,
        ),
        short = Math.max(0, game.players[0].due - game.players[0].cash - sum);
      sales.querySelector("#sale-preview").textContent =
        `Sales $${sum}${short ? ` · $${short} still needed; sell more or all holdings.` : " · repayment covered."}`;
    };
    sales.onchange = update;
    update();
    sales.onsubmit = (e) => {
      e.preventDefault();
      act({ type: "sell", shares: quantities() });
    };
  }
}
function schedule() {
  clearTimeout(timer);
  if (modal || game.ended || !auto || worker) return;
  const id = currentPlayer(game);
  if (
    [
      "power",
      "auctionResult",
      "purchaseResult",
      "reveal",
      "cycleResult",
      "afterRevealReady",
      "catchUpReady",
      "catchUpResult",
      "ipoResult",
      "valueResult",
      "legResult",
    ].includes(game.phase) ||
    id === 0
  )
    return;
  timer = setTimeout(() => {
    worker = new Worker("/src/worker.js", { type: "module" });
    const ticket = commands.length;
    worker.onmessage = ({ data }) => {
      worker?.terminate();
      worker = null;
      if (ticket !== commands.length) return;
      if (data.error) {
        auto = false;
        notice = data.error;
        render();
      } else act(data.cmd);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      auto = false;
      notice = "AI paused after an error.";
      render();
    };
    worker.postMessage({ game: observation(game, id), id, ticket });
  }, 250);
}
render();
