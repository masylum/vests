let scoutPage=0,scoutKey='',scoutPicks=new Set();
import {INTEL_MODES,INTEL_CARDS,canDrawIntel,canExchangeIntel,intelTargets,intelSecondTargets,playableIntel,intelLead} from './intel.js';
import {canHireFounder} from './config.js';
import {movementSteps} from './movement.js';
import {TRACK} from './track.js';
import {choosePower} from './racing.js';
import {
  VERSION,podium,companyOrder,currencyUnit, availableCash, slotCards, checkpointTarget, sharePayout,
  COMPANIES,
  FUNDS,
  SYMBOLS,
  FOUNDERS,
  companyValue,
  fundingPrices, fundingBand, SPECIALS, growthDeck, DECK_THEMES,
} from "./config.js";
import {
  createGame, canRaiseMoney,
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
  KEY = preview ? `venture-sequential-preview-${VERSION}` : `venture-sequential-${VERSION}`;
let revealedCardAccepted=false,phaseLogAccepted=0;
const needsPhaseReview=()=>game.phase==='power'&&game.race?.stage&&game.race.log.length>Math.max(phaseLogAccepted,game.race.lastPhaseLogIndex??0);
const needsCardReveal=()=>game.phase==='power'&&!game.race?.stage&&(game.race?.revealed||game.lastRevealed?.pending)&&game.lastRevealed?.card&&!revealedCardAccepted;
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
function act(cmd,actor=currentPlayer(game)) {
  if(cmd.type==='raiseMoney'){
    worker?.terminate();worker=null;clearTimeout(timer);
    try{command(game,actor,cmd);commands.push({id:actor,cmd});notice='';save();}catch(e){notice=e.message;}
    render();return;
  }
  if(cmd.type!=='power'){revealedCardAccepted=false;phaseLogAccepted=0;}
  motionCleanup();
  const before=game.phase==='power'&&game.race?.stage&&!needsPhaseReview()?game.companies.map(c=>c.position):game.race?.startPositions??game.companies.map(c=>c.position),logStart=game.log.length;
  const pending=!!game.race;
  const oldPawns=[...document.querySelectorAll('.pawn[data-company]')].map(el=>({id:Number(el.dataset.company),rect:el.getBoundingClientRect()}));
  try {
    const id = actor;
    command(game, id, cmd);
    commands.push({ id, cmd });
    if(game.phase==="legResult"&&!game.finalExit){const id=currentPlayer(game),cmd={type:"continue"};command(game,id,cmd);commands.push({id,cmd});}
    if(game.phase==='reveal'&&(game.lastRevealed?.reviewed||!game.lastRevealed?.card&&!game.lastRevealed?.reactions?.length)){
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
  // Choices may partially resolve an effect. Keep pawns at its origin until its timeline is visible.
  const resolvedEvents=pending?[game.lastRevealed]:events;
  const steps=game.phase==='power'?[]:movementSteps(resolvedEvents,before,game.companies.map(c=>c.position));
  const controls=steps.length?[...document.querySelectorAll('.decision button:not(:disabled),.decision input:not(:disabled)')]:[];
  controls.forEach(el=>el.disabled=true);
  animatePawns(steps,oldPawns).finally(()=>controls.forEach(el=>{if(el.isConnected)el.disabled=false;}));
}
function fumbleBadge() { return '<span class="fumble-badge" title="Discard the next drawn card to recover"><span aria-hidden="true">×</span> Fumbled</span>'; }
function fumbleIcon() {
 return `<svg class="fumble-icon" viewBox="0 0 64 64" role="img" aria-label="Fumble"><g transform="rotate(-35 32 32)" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M19 25v20c0 10 26 10 26 0V25" fill="white"/><ellipse cx="32" cy="25" rx="13" ry="8" fill="white"/><path d="m28 22 8 6m0-6-8 6"/></g><path d="M8 54h17M49 10l5-5M54 22h7" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function cardHTML(c, compact=false) {
 const meta=COMPANIES[c.company];
 return `<article class="card growth-card ${c.signature?'has-power':''}" style="--card:${meta.color}"><b>${meta.name}</b><strong>${c.effect === "fumble" ? fumbleIcon() : c.effect === "setback" ? "−1" : c.signature==='breakthrough'?'+3 / +1': `${c.printed>0?'+':''}${c.printed}`}</strong>${c.signature?`<small><em>${SPECIALS[c.company%6][0]}:</em>${compact?"":` ${SPECIALS[c.company%6][1]}`}</small>`:""}${c.effect ? `<small>${c.effect === "fumble" ? "Fumble" : "Go back"}</small>` : !c.signature?'<small class="empty-ability" aria-hidden="true"></small>':""}</article>`;
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
  return `<article class="company ${c.id===auctionCompany()?"auction-active":""}" style="--company:${COMPANIES[c.id].color};--tilt:${((c.id*7)%5-2)*.7}deg"><header><h3>${co(c.id)}</h3><small class="company-tam" title="Supply cards remaining / total deck">${c.supply.length}/${growthDeck(c.id).length}</small></header>${founderCard(f)}<aside class="company-details"><div class="company-status">${c.down?fumbleBadge():""}</div><div class="reserve-track" aria-label="${c.reserve} treasury slots">${[0,1,2,3].map(n=>`<span class="${c.reserve===n?'occupied':''}">${slotCards(c,n,game.companies)}</span>`).join('')}</div><div class="shareholders">${shareholders?`${shareholders}`:'<small class="unowned">Unowned</small>'}${hedge?`<span class="share hedge-share" title="Non-player investor · shares dilute the exit payout">Hedge fund${hedge>1?` ×${hedge}`:""}</span>`:""}${bank?`<small class="bank-shares" title="Non-player shares, including hedge fund investments. They dilute the exit payout.">+ ${bank} non-player share${bank===1?"":"s"}</small>`:""}</div></aside></article>`;
}
function positionTrack(rows,ids,wide=false) {
 const spaces=rows.flatMap(row=>ids.map(id=>row.positions[id])),min=Math.min(...spaces),max=Math.max(...spaces),count=max-min+1;
 const label=ids.map(id=>`${co(id)} ${rows.map(r=>r.positions[id]).join(' to ')}`).join(', ');
 return `<div class="round-track" role="img" aria-label="${esc(label)}" style="--track-spaces:${count};--mini-size:${count>12?11:16}px;--mini-font:${count>12?6:8}px;width:min(100%,${wide?Math.max(560,Math.min(900,count*60+53)):Math.max(260,Math.min(660,count*60+53))}px)">${rows.map(row=>`<div class="round-track-row"><b>${row.label}</b><div class="mini-spaces">${Array.from({length:count},(_,i)=>{const space=min+i;return `<div class="mini-space band-${fundingBand(Math.max(1,space))}"><small>${space}</small><div>${ids.filter(id=>row.positions[id]===space).sort((a,b)=>(row.orders?.[a]??game.companies[a].arrivalOrder)-(row.orders?.[b]??game.companies[b].arrivalOrder)).map(id=>`<span class="mini-pawn" style="--company:${COMPANIES[id].color}" title="${co(id)}: ${space}">${row.label==='After'&&game.companies[id].down?'×':COMPANIES[id].short.toUpperCase()}</span>`).join('')}</div></div>`;}).join('')}</div></div>`).join('')}</div>`;
}
function roundTrack(before) {return positionTrack([{label:'Before',positions:before??game.companies.map(c=>c.position),orders:game.revealStartArrivalOrders},{label:'After',positions:game.companies.map(c=>c.position)}],game.companies.map(c=>c.id),true);}
function movementTrack(moves) {
 const grouped=new Map();for(const m of moves){if(grouped.has(m.company))grouped.get(m.company).to=m.to;else grouped.set(m.company,{...m});}
 const ids=[...grouped.keys()];return positionTrack([{label:'Before',positions:Object.fromEntries(ids.map(id=>[id,grouped.get(id).from]))},{label:'After',positions:Object.fromEntries(ids.map(id=>[id,grouped.get(id).to]))}],ids);
}
function movementBox(from,to,company) {return movementTrack([{company,from:Number(from),to:Number(to)}]);}
function reactionTimeline(reactions=[]) {
 const groups=[];
 for(const r of reactions){
  if(r.text.startsWith('Used power:')||r.text.startsWith('Passed —'))continue;
  const match=r.text.match(/^(\d+): (\d+) → (\d+)$/),target=r.target??(match?Number(match[1]):r.company);
  if(match&&match[2]===match[3])continue;
  const key=r.signature?`signature:${r.company}`:r.intel?`value:${r.intelKind}:${r.intelPlayer}`:r.catchUp?'catchUp':`founder:${r.company}:${r.founder}`;
  let group=r.intel?groups.find(g=>g.key===key):groups.at(-1);if(!group||group.key!==key){group={key,r,items:[]};groups.push(group);}
  group.items.push({r,match,target});
 }
 if(!groups.length)return '';
 return `<ol class="reaction-timeline">${groups.map(({r,items})=>{
  const value=r.intel&&r.intelKind,founder=!r.signature&&!r.intel&&!r.catchUp&&FOUNDERS[r.founder];
  const source=r.signature?cardHTML(r.signature,true):value?intelCardHTML({kind:r.intelKind}):founder?founderCard(FOUNDERS[r.founder]):'<b class="effect-label">Catch-up</b>';
  const moves=items.filter(i=>i.match).map(i=>({company:i.target,from:Number(i.match[2]),to:Number(i.match[3])}));
  return `<li class="${r.intel?'value-effect':r.catchUp?'catch-up-effect':''}" style="--company:${COMPANIES[r.company]?.color??'#fff'}">${source}<div class="effect-results">${moves.length?movementTrack(moves):''}${items.filter(i=>!i.match||i.r.reason).map(({r,match,target},i)=>`<section>${i===0||items[i-1].target!==target?`<b>${co(target)}</b>`:''}${match?'':`<p>${esc(r.text.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</p>`}${r.reason?`<p>${esc(r.reason.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</p>`:''}</section>`).join('')}</div></li>`;
 }).join('')}</ol>`;
}
function valueReceipt(result){
 if(!result)return '';
 if(result.kind==='inside'&&result.discardedCards)return `<p>${fund(result.player)} played <b>Inside information</b> and discarded ${result.discardedCards.length} growth cards.</p><div class="value-receipt inspection-receipt">${intelCardHTML({kind:'inside'})}<div class="inspection-discards">${result.discardedCards.map(card=>cardHTML(card,true)).join('')}</div></div>`;
 const changes=(result.after??[]).flatMap((c,i)=>{const before=result.before[i],rows=[];
  if(c.shares!==before.shares&&before.shares!==undefined)rows.push(`${co(i)}: your shares ${before.shares} → ${c.shares}`);
  if(c.founder!==before.founder&&before.founder!==undefined)rows.push(`${co(i)}: hired ${FOUNDERS[c.founder].name}`);
  if(c.reserve!==before.reserve)rows.push(`${co(i)}: treasury ${before.reserve} → ${c.reserve}`);

  if(c.down!==before.down&&!result.reactions?.some(r=>r.intel&&(r.target??r.company)===i))rows.push(`${co(i)}: ${c.down?'fumbled':'recovered'}`);
  return rows;
 });
 if(result.cashChange)changes.push(`${fund(result.player)}: ${result.cashChange>0?'+':''}$${Math.abs(result.cashChange)} ${result.cashChange>0?'from':'to'} the bank`);
 const resources=(result.after??[]).flatMap((c,i)=>c.supply!==result.before[i].supply?[`<div class="supply-change" style="--company:${COMPANIES[i].color}"><b>${co(i)} supply</b><div><span class="supply-stack">${Array.from({length:3},()=>'<i></i>').join('')}<strong>${result.before[i].supply}</strong></span><span aria-hidden="true">→</span><span class="supply-stack">${Array.from({length:3},()=>'<i></i>').join('')}<strong>${c.supply}</strong></span></div><small>${Math.abs(c.supply-result.before[i].supply)} card${Math.abs(c.supply-result.before[i].supply)===1?'':'s'} ${c.supply<result.before[i].supply?'left supply':'returned to supply'}</small></div>`]:[]).join('');
 const reactions=result.reactions??[];
 return `<p>${fund(result.player)} played <b>${INTEL_CARDS[result.kind].name}</b>${result.company!==undefined&&result.kind!=='inside'?` on <b style="color:${COMPANIES[result.company].color}">${co(result.company)}</b>`:''}.</p>${!reactions.some(r=>r.intel)?`<div class="value-receipt">${intelCardHTML({kind:result.kind})}<div>${result.noEffect?'<p>No eligible company. The card had no effect.</p>':resources+changes.map(t=>`<p>${esc(t)}</p>`).join('')}</div></div>`:resources+changes.map(t=>`<p>${esc(t)}</p>`).join('')}${result.discardedCards?.length?`<div class="discarded-growth-receipt"><b>Discarded from the growth pile</b><div>${result.discardedCards.map(card=>cardHTML(card,true)).join('')}</div></div>`:''}${reactionTimeline(reactions)}`;
}

function revealHTML() {
  const e = game.lastRevealed;
  if (!e) return "<p>No card revealed yet.</p>";
  if(e.value)return valueReceipt(e.value);
  if(e.pending)return `<div class="reveal-card">${cardHTML(e.card)}<div><h3>${co(e.card.company)}</h3><p>Card revealed. Julie may use its printed effect and power for her company.</p></div></div>`;
  if(e.returned)return `<div class="reveal-card">${cardHTML(e.card)}<div><h3>${co(e.card.company)} · returned to supply</h3><p>This draw is used. The card’s effects did not resolve.</p>${reactionTimeline(e.reactions)}</div></div>`;
  if(e.reviewed)return `<p>${e.stage==='start'?'Before-reveal':'After-reveal'} powers complete.</p>`;
  if(!e.card)return reactionTimeline(e.reactions)||'<p>No founder powers triggered in this step.</p>';
  return `<div class="reveal-card ${e.deferred?'discarded':''}">${cardHTML(e.card)}<div><h3>${co(e.effect?.company??e.card.company)} ${e.deferred?'· card discarded':''}</h3>${!e.deferred&&e.effect&&e.effect.before!==e.effect.after?movementBox(e.effect.before,e.effect.after,e.effect.company??e.card.company):''}${e.deferred?'<p><span class="summary-fumble">Recovered</span> This draw is used.</p>':e.card.effect==='fumble'?(game.companies[e.effect?.company??e.card.company].down?`<p>${fumbleBadge()} Discard the next card to recover.</p>`:'<p><span class="summary-fumble">Recovered / prevented</span></p>'):e.card.effect==='setback'?'<p>Moved back by the card.</p>':''}${e.effect?.recovered?'<p><span class="summary-fumble">Recovered</span> This card still moves.</p>':''}${e.card.signature==='recycle'&&!e.deferred?'<p>Returns to its company’s supply after the reveal.</p>':''}${e.effect?.founder&&FOUNDERS[game.companies[e.effect?.company??e.card.company].founder]?`<div class="power-prompt">${founderCard(FOUNDERS[game.companies[e.effect?.company??e.card.company].founder])}<p>Founder movement modifier: ${e.effect.founder>0?'+':''}${e.effect.founder}.</p></div>`:''}${reactionTimeline(e.reactions)}</div></div>`;
}
function revealSummaryHTML() {
 const start=game.log.findLastIndex(e=>e.type==='cycle');
 const events=game.log.slice(start+1), cards=events.filter(e=>e.type==='reveal'||e.type==='deferred');
 const before=game.revealStartPositions ?? cards.find(e=>e.positions)?.positions;
 const reactions=events.flatMap(e=>e.reactions??[]);
 const hedge=events.filter(e=>e.type==='hedge');
 return `<p>${cards.filter(e=>e.type==='reveal').length} cards resolved · ${cards.filter(e=>e.type==='deferred').length} discarded to recover from fumbles${events.filter(e=>e.type==='returned').length?` · ${events.filter(e=>e.type==='returned').length} returned by Julie`:''}${events.filter(e=>e.type==='burn').map(e=>` · ${e.count} pile cards burned face up`).join('')}</p>${events.filter(e=>e.type==='burn').map(e=>`<p>Burned: ${burnSummary(e)}</p>`).join('')}${roundTrack(before)}
 <details class="round-details"><summary>Round timeline</summary><ol class="round-event-timeline">${events.filter(e=>e.stage!=='intel'&&(e.card||e.reactions?.length||e.type==='valueResolved')).map(e=>`<li>${e.type==='valueResolved'?valueReceipt(e.value):''}${e.card?`<div class="timeline-growth">${cardHTML(e.card,true)}<div>${e.type==='deferred'?'<b>Discarded · recovered</b>':e.effect?movementBox(e.effect.before,e.effect.after,e.effect.company??e.card.company):''}</div></div>`:''}${e.type==='valueResolved'?'':reactionTimeline(e.reactions??[])}</li>`).join('')}</ol></details>`;
}
function intelCardHTML(card,actions='') {
 const info=INTEL_CARDS[card.kind],html=`<article class="intel-card"><img class="value-art" src="/assets/value/${card.kind}.png" alt="" loading="lazy"><h3>${info.name}</h3><p>${founderDescription(info.text)}</p></article>`;
 return actions?`<div class="intel-choice">${html}<div class="intel-actions">${actions}</div></div>`:html;
}
function intelHandHTML(){
 if(game.rules.intelMode==='off')return '';
 return `<section class="intel-hand"><h2>Your value cards</h2><div class="intel-cards">${game.players[0].intel.map(c=>intelCardHTML(c)).join('')||'<p>No cards in hand.</p>'}</div></section>`;
}
function decision() {
  const id = currentPlayer(game),
    human = id === 0,
    p = game.players[id ?? 0];
  if (game.ended)
    return `<h2>${game.winners.map(fund).join(" & ")} wins</h2><div class="bids">${game.players.map((p) => `<article>${fund(p.id)}<strong>${coin(game.scores[p.id])}</strong><small>Saved ${p.savedCash} − debt ${p.debt}</small></article>`).join("")}</div>`;
  if(needsPhaseReview())return `<h2>Effects resolved · ${game.race.stage==='start'?'before the reveal':'reaction chain'}</h2>${reactionTimeline(game.race.log.slice(Math.max(phaseLogAccepted,game.race.lastPhaseLogIndex??0)))}${button('Choose reaction →','data-phase-reviewed')}`;
  if(needsCardReveal())return `<h2>Card revealed · ${co(game.lastRevealed.card.company)}</h2>${revealHTML()}${button('Resolve reactions →','data-show-reactions')}`;
  switch (game.phase) {
    case "call": {
      const ids=eligibleCompanies(game,id);
      return `<h2>${human?'Choose your turn':fund(id)+' chooses a turn'}</h2>${human?`<div class="turn-companies" style="--company-count:${game.companies.length}">${game.companies.map(c=>`<article style="--company:${COMPANIES[c.id].color}"><h3>${co(c.id)}</h3>${button('Auction',`data-call="${c.id}"`,!ids.includes(c.id))}${button('Change founder',`title="Change founder" aria-label="Change founder for ${co(c.id)}" data-change-founder="${c.id}"`,lead(c)!==id)}</article>`).join('')}</div>${button('Skip main action','data-call-pass')}`:''}`;
    }
    case "intelPlay": {
      const any=p.intel?.some(c=>intelTargets(game,id,c.kind).length),canDraw=canDrawIntel(game,id),canExchange=canExchangeIntel(game,id);
      const cards=human?p.intel.map((card,i)=>{
        let actions=intelTargets(game,id,card.kind).map(cid=>{
          if(['swap','move','waste','headhunt'].includes(card.kind))return (card.kind==='move'?button(co(cid),`data-play-intel="${i}" data-intel-company="${cid}"`):'')+ intelSecondTargets(game,id,card.kind,cid).map(target=>button(`${co(cid)} ${['swap','headhunt'].includes(card.kind)?'↔':card.kind==='waste'?'→':'then'} ${co(target)}`,`data-play-intel="${i}" data-intel-company="${cid}" data-intel-target="${target}"`)).join('');
          return button(co(cid),`data-play-intel="${i}" data-intel-company="${cid}"`);
        }).join('');
        if(card.kind==='inside'&&actions)actions=button('Inspect growth pile',`data-play-intel="${i}" data-intel-company="${intelTargets(game,id,card.kind)[0]}"`);
        if(!actions)actions='<small>No eligible company.</small>';
        if(canExchange)actions+=button('Discard & draw 1',`data-exchange-value="${i}"`);
        return intelCardHTML(card,actions);
      }).join(''):'';
      return `<h2>${human?'Draw, play or exchange a value card':fund(id)+' chooses a value action'}</h2><p>Draw 1, play 1, or discard 1 to draw a replacement. Your main action is complete. Hand limit: 3.</p>${human?`<div class="intel-cards">${cards}</div>${canDraw?button('Draw 1 card','data-draw-value'):!any&&!canExchange?button('Continue · no available card action','data-pass-value'):canExchange?'':`<p>${p.intel.length>=3?'Hand limit reached':'No cards left to draw'}. Play a card or discard one to draw a replacement.</p>`}`:'<p>Their hand is private.</p>'}`;
    }
    case "intelScout": {
      const peek=game.intelScout,key=[game.cycle,peek.player,peek.kind,peek.cards.map(c=>c.id).join(',')].join(':');
      if(key!==scoutKey){scoutKey=key;scoutPage=0;scoutPicks=new Set();}
      const pageCards=peek.kind==='inside'?peek.cards.slice(scoutPage*6,scoutPage*6+6):peek.cards;
      const permutations=a=>a.length<=1?[a]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));
      return `<h2>${INTEL_CARDS[peek.kind].name}</h2><p>${peek.kind==='launch'?'Choose 1 to deploy face down, then shuffle the supply.':peek.kind==='inside'?'Choose 2 cards to discard. Only you see the growth pile until you discard.':'Choose the order: first → second → bottom. Only you see these cards.'}</p>${human?`<div class="intel-cards ${peek.kind==='inside'?'scout-cards':''}">${pageCards.map((card,j)=>{const i=peek.kind==='inside'?scoutPage*6+j:j;return `<article>${peek.kind==='inside'?'':`<b>Card ${i+1}</b>`}${cardHTML(card)}${peek.kind==='inside'?`<label><input type="checkbox" name="discard-growth" value="${i}" ${scoutPicks.has(i)?'checked':''}> Discard this card</label>`:peek.kind==='launch'?button('Deploy this card',`data-scout-intel="${i}"`):''}</article>`;}).join('')}</div>${peek.kind==='inside'?`${peek.cards.length>6?`<div class="scout-pagination">${button('← Previous',`data-scout-page="${scoutPage-1}"`,scoutPage===0)}<span>Page ${scoutPage+1} / ${Math.ceil(peek.cards.length/6)} · ${scoutPicks.size} selected</span>${button('Next →',`data-scout-page="${scoutPage+1}"`,(scoutPage+1)*6>=peek.cards.length)}</div>`:''}${button(`Discard ${Math.min(2,peek.cards.length)} cards`,'data-discard-growth',scoutPicks.size!==Math.min(2,peek.cards.length))}`:peek.kind==='launch'?'':permutations(peek.cards.map((_,i)=>i)).map(order=>button(order.map((x,i)=>`Card ${x+1}${i===order.length-1?(peek.kind==='inside'?' (remove)':' (bottom)'):''}`).join(' → '),`data-order-intel="${order.join(',')}"`)).join('')}`:'<p>Private inspection.</p>'}`;
    }
    case "founder": {
      const c = game.companies[game.company];
      return `<h2>${human ? "Your founder choice" : `${fund(id)} chooses`} · ${co(c.id)}</h2><p>Choose a new founder, then take your value action.</p><div class="founder-options">${[c.founder, ...game.founderMarket].map((f, i) => `<article>${founderCard(FOUNDERS[f])}${human && (i || game.rules.intelMode==='off') ? button(i ? "Choose founder" : "Keep founder", `data-founder="${i - 1}"`,i>0&&!canHireFounder(f,game.leg)) : ""}</article>`).join("")}</div>`;
    }
    case "power": {
      const q=game.powerChoice, f=FOUNDERS[q.founder];
      const text=q.text.replace(/company (\d+)/gi,(_,n)=>co(Number(n)));
      return `${game.race?.card?.kind==='growth'&&!q.signature?`<div class="reaction-source">${cardHTML(game.race.card,true)}<p>Reaction to ${co(game.race.card.company)}’s revealed card.</p></div>`:''}<div class="title"><h2>${human ? (q.signature?"Your company power":"Your founder decision") : fund(id)} · ${co(q.company)}</h2><small>${game.race?.stage === "start" ? "Before the reveal" : game.race?.stage === "end" ? "After the reveal" : game.race?.stage === "intel" ? "Value card reaction" : "Reaction chain"}</small></div>${game.race?.stage==='intel'&&game.valueResult?`<p>${fund(game.valueResult.player)} played <b>${INTEL_CARDS[game.valueResult.kind].name}</b>.</p>`:''}<div class="power-prompt">${q.signature?cardHTML(q.signature):founderCard(f)}<div><b>${q.signature?SPECIALS[q.signature.company%6][0]:f.name}</b>${q.signature?movementBox(game.race.event.effect.before,game.companies[q.company].position,q.company):''}<p>${esc(text)}</p>${human ? `<div class="power-options">${q.options.map((o,i)=>button(o.label.replace(/company (\d+)/gi,(_,n)=>co(Number(n)))+(q.signature?` · space ${game.companies[o.actions[0].target].position}`:''),`data-power="${i}"`)).join("")}</div>` : `<p>${fund(id)} controls this choice.</p>${button("Let AI decide", "data-ai-power")}`}</div></div>`;
    }
    case "bid": {
      const a = game.auction;
      return `<div class="title"><h2>${fund(a.host)} is fundraising: <span style="color:${COMPANIES[a.company].color}">${co(a.company)}</span></h2></div><p class="bid-explainer">Minimum ${coin(a.reserve)} · Sealed bids, second price.</p>${human && a.equityControl && a.equityController===id ? `<p><strong>Other bids:</strong> ${a.bids.map(b=>`${fund(b.player)}: ${b.amount ? "$"+b.amount : "Passed"}`).join(" · ")}</p>` : ""}${human ? `<form id="bid"><label><b>Your bid</b><input aria-label="Your bid" name="amount" type="number" min="${a.reserve}" max="${availableCash(p)}" value="${a.reserve}" step="${currencyUnit(game.rules)}"></label>${button("Submit sealed bid", 'type="submit"', availableCash(p) < (a.reserve))}${button("Pass", 'type="button" data-pass')}</form>` : ""}`;
    }
    case "tie":
      return `<h2>${human ? "Your open bid" : `${fund(id)} bids openly`} · ${co(game.auction.company)}</h2><p>Tied rivals · current price ${coin(game.auction.price)} · in: ${game.auction.contenders.map(fund).join(", ")}</p><div class="bids">${game.auction.bids.map(b=>`<article>${fund(b.player)}<strong>${b.amount?coin(b.amount):"Passed"}</strong></article>`).join("")}</div>${human ? `<form id="tie"><label>Raise to<input aria-label="Open tie bid" name="amount" type="number" min="${game.auction.price + currencyUnit(game.rules)}" max="${availableCash(p)}" value="${game.auction.price + currencyUnit(game.rules)}" step="${currencyUnit(game.rules)}"></label>${button("Raise", 'type="submit"', availableCash(p) <= game.auction.price)}${button("Withdraw", 'type="button" data-withdraw')}</form>` : ""}`;
    case "auctionResult": {
      const a = game.auction;
      return `<section class="auction-receipt" aria-label="Auction result"><header class="receipt-heading"><small>Auction result · <b style="color:${COMPANIES[a.company].color}">${co(a.company)}</b></small><h2>${a.winner===null?"No sale":`${fund(a.winner)} pays ${coin(a.paid)}`}</h2></header><div class="bids" aria-label="Submitted bids">${a.bids.map(b=>`<article class="${b.player===a.winner?"won":""}"><span>${fund(b.player)}${b.player===a.winner?'<small class="winner-label">Winner</small>':""}</span><strong>${b.amount>=a.reserve?coin(b.amount):"Passed"}</strong></article>`).join("")}</div>${reactionTimeline(a.reactions??[])}<footer class="receipt-footer">${button("Continue →","data-continue")}</footer></section>${a.open?.length?`<details><summary>Open tie bids</summary><small>${a.open.map(b=>`${fund(b.player)} ${b.amount?"$"+b.amount:"withdraws"}`).join(" · ")}</small></details>`:""}`;
    }
    case "purchaseResult":
      return `<h2>${game.purchaseSummary.reduce((s,c)=>s+c.count,0)} cards deployed</h2><div class="deployment-summary">${game.purchaseSummary.filter(d=>d.count>0).map(d=>`<article style="--company:${COMPANIES[d.company].color}"><h3>${co(d.company)}</h3><div class="deployed-cards" role="img" aria-label="${d.count} face-down deployed ${d.count===1?'card':'cards'} for ${co(d.company)}">${Array.from({length:d.count},()=>'<span class="deployed-card" aria-hidden="true"></span>').join('')}</div><small>${d.count} ${d.count===1?'card':'cards'} · treasury ${d.fromReserve} → ${d.toReserve}</small></article>`).join('')||'<p>No cards deployed from treasury.</p>'}</div>${button("Reveal pile →","data-continue")}`;
    case "reveal":
      return `<div class="title"><h2>${game.lastRevealed?.card ? `Reveal · ${game.drawsLeft} draw${game.drawsLeft===1?'':'s'} left` : "Before the reveal"}</h2>${button("Reveal next card →", "data-reveal")}</div>${revealHTML()}`;
    case "afterRevealReady":
      return `<h2>The reveal · last card resolved</h2><p>${game.ipoCompany!=null?'IPO reached · no burn.':`${game.log.findLast(e=>e.type==='burn'&&e.leg===game.leg&&e.cycle===game.cycle)?.count??0} burned face up · ${burnSummary(game.log.findLast(e=>e.type==='burn'&&e.leg===game.leg&&e.cycle===game.cycle))||'No cards removed'}`}</p>${revealHTML()}${button('After-reveal powers →','data-continue')}`;
    case "phaseResult":
      return `<h2>${game.lastRevealed.stage==='start'?'Before the reveal':'After the reveal'} · ${co(game.lastRevealed.company)}</h2>${reactionTimeline(game.lastRevealed.reactions)}${button('Continue →','data-continue')}`;
    case "catchUpReady":
      return `<h2>${game.lastRevealed?.stage==='end'?'After reveal powers resolved':'Reveal · last card resolved'}</h2>${revealHTML()}${button('Catch-up →','data-continue')}`;
    case "catchUpResult":
      return `<h2>Catch-up · resolved</h2>${reactionTimeline(game.catchUpResult?.reactions??[])}${button('Finish round →','data-continue')}`;
    case "cycleResult":
      return `<div class="title"><h2>${game.ipoCompany!=null ? "IPO reached" : "Reveal complete"}</h2>${button(game.ipoCompany!=null ? "Resolve IPO →" : "Next round →", "data-continue")}</div>${revealSummaryHTML()}<small>${game.ipoCompany!=null ? `Final round complete. First arrival ranks first on a shared space. ${game.pile.length} undrawn cards are unused; resolve the final exit.` : game.cycleEnd ? `${game.pile.length} undrawn cards stay in the growth pile for the next round. Shares and cash carry into the next leg. Jenkins can also exit at IPO.` : `${game.pile.length} undrawn cards stay in the growth pile. First player rotates clockwise; founder powers reset.`}</small>`;
    case "valueResult":
      return `<h2>Value card played</h2>${valueReceipt(game.valueResult)}${button('Continue →','data-continue')}`;
    case "settle":
      return `<h2>Final exit · ${human?"Your portfolio":fund(id)}</h2><p>The top ${game.rules.payoutPlaces} pay (Jenkins can also exit): ${game.settlement.podium.map(co).join(", ")}. On a shared space, the first arrival ranks first. Repay ${p.lpObligations} LP obligation${p.lpObligations===1?'':'s'}: ${coin(p.due)}.</p><div class="bids">${game.companies.filter(c=>holdings(c,id)).map(c=>`<article>${co(c.id)}<strong>${holdings(c,id)} share${holdings(c,id)===1?'':'s'} × $${game.settlement.prices[c.id]}</strong></article>`).join("")}</div>${human?button("Sell portfolio & repay obligation →","data-final-sale"):""}`;
    case "legResult":
      if(!game.finalExit)return `<div class="title"><h2>Continue the race</h2>${button("Continue the race →","data-continue")}</div><p>Keep all shares and cash. Your accumulated obligation carries forward; repayment waits until the final exit.</p>`;
      return `<div class="title"><h2>Final accounts</h2>${button("Final scores →","data-continue")}</div><div class="bids">${game.settlement.accounts.map(a=>`<article>${fund(a.player)}<strong>${coin(a.cash-a.unpaid)}</strong><small>Repaid $${a.paid}${a.unpaid?` · unpaid $${a.unpaid}`:""}</small></article>`).join("")}</div>`;
    default:
      return "";
  }
}
const burnSummary=e=>e?.cards?.map(c=>`${co(c.company)} ${c.effect==='fumble'?'Fumble':c.signature?SPECIALS[c.company%6][0]:`+${c.printed}`}`).join(' · ')??'';
function poolWeight(c) {
 return game.pile.filter(card=>card.company===c.id).length;
}
const pinPower=()=>game.phase==='power'&&(!game.race?.stage||needsPhaseReview());
const pawnArrival=c=>pinPower()?(game.race?.startArrivalOrders?.[c.id]??c.arrivalOrder??0):(c.arrivalOrder??0);
function pawnRank(c){
 const companies=pinPower()?game.companies.map(x=>({...x,position:game.race.startPositions[x.id],arrivalOrder:game.race.startArrivalOrders?.[x.id]??x.arrivalOrder})):game.companies;
 return podium(companies,companies.length).indexOf(c.id)+1;
}
function pawnHTML(c) {
 const name=COMPANIES[c.id];
 return `<span data-company="${c.id}" class="pawn ${c.id===auctionCompany()?"auction-active":""} ${c.tokens.length?"":"unfunded-pawn"}" style="--company:${name.color}" title="${name.name} · rank ${pawnRank(c)}${c.down?' · Fumbled':''} · growth ${c.position} · ${c.tokens.length} issued shares${c.founder===4?` · Jenkins exit $${quote(c,game.rules,game.companies)}/share`:""}"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M3 12v10c0 13 30 13 30 0V12" fill="color-mix(in srgb,var(--company),#000 22%)" stroke="#000" stroke-width="2.5"/><ellipse cx="18" cy="12" rx="15" ry="9" fill="var(--company)" stroke="#000" stroke-width="2.5"/><text x="18" y="16" text-anchor="middle" fill="#000" font-size="11" font-weight="800">${c.down?'×':name.short.toUpperCase()}</text></svg><span class="sr-only">${name.short.toUpperCase()}</span></span>`;
}
function boardHTML() {
 return `<div class="table-layout"><div class="board-scroll"><main class="board">
 <svg class="race-track" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">${TRACK.map((cell,i)=>`<path class="band-${fundingBand(i+1)}" d="${cell.path}"/>`).join("")}</svg>
 ${TRACK.map((cell,i)=>`<div data-space="${i+1}" class="track-label band-${fundingBand(i+1)} ${cell.x<8||cell.x>92?'side-lane':''}" style="left:${cell.x}%;top:${cell.y}%"><header><b>${i+1}</b><span class="track-value">$${companyValue(i+1,game.rules)}</span></header><div class="space-pawns">${game.companies.filter(c=>(pinPower()?game.race?.startPositions?.[c.id]??c.position:c.position)===i+1).sort((a,b)=>pawnArrival(a)-pawnArrival(b)).map(pawnHTML).join("")}</div></div>`).join("")}

 <section class="centre"><section class="funding-strip" aria-label="Funding prices">${[0,1,2].map(b=>`<span class="funding-band band-${b}" title="Growth ${b*8+1} to ${(b+1)*8}"><small>${['First','Second','Third'][b]} leg:</small><b>${fundingPrices(b,game.rules).map(p=>`$${p}`).join(" / ")}</b></span>`).join("")}</section>
 <div class="companies" style="--company-cols:${Math.ceil(game.companies.length/2)}">${game.companies.map(companyHTML).join("")}</div>
 <section class="growth-pool" aria-label="Growth pool"><b>${game.pile.length} in pile</b><div class="pool-cards">${game.companies.map(c=>`<span style="--company:${COMPANIES[c.id].color}">${co(c.id)} <b>${poolWeight(c)}</b></span>`).join("")}</div>${game.companies.some(c=>c.position===0)?`<small>Start · ${game.companies.filter(c=>c.position===0).map(pawnHTML).join("")}</small>`:""}</section>
 </section></main></div></div>`;
}
function exits() {
 dialog("Exit per share",`<p>Find the company’s growth and its total issued shares, including non-player shares. The top ${game.rules.payoutPlaces} companies pay after the final round. First arrival ranks first on a shared space. Payouts round down to $${game.rules.moneyScale} increments. Jenkins pays a $${game.rules.wangExit} company exit in penultimate place while not fumbled.</p><div class="lookup"><table class="division-grid"><thead><tr><th scope="col">Growth</th>${Array.from({length:5},(_,i)=>`<th scope="col">${i+1} share${i?"s":""}</th>`).join("")}</tr></thead><tbody>${Array.from({length:24},(_,i)=>`<tr class="${game.rules.checkpoints.includes(i+1)?"checkpoint-row":""}"><th scope="row">${i+1}</th>${Array.from({length:5},(_,n)=>`<td>$${sharePayout(companyValue(i+1,game.rules),n+1,game.rules)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p>Growth 0 pays $0.</p>`);
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
function alignDrawer(){
 const scene=document.querySelector('.game-layout'),panel=document.querySelector('.decision'),table=document.querySelector('.tabletop');if(!scene||!panel||!table)return;
 // Keep the side cards beside the board instead of spreading across wide monitors.
 const sideWidth=scene.querySelector('.founder-market').offsetWidth;
 const sidebarCount=scene.querySelectorAll('.intel-hand,.founder-market').length;
 const width=Math.max(1800,Math.min(1480+sidebarCount*(sideWidth+20),table.clientWidth-16));
 scene.style.width=`${width}px`;
 const board=scene.querySelector('.board'),centre=board.querySelector('.centre');
 // The SVG lane's inner edge is 11.5% from the top/bottom and 7.2% from either side.
 board.style.setProperty('--track-pad-y',`${Math.ceil(centre.offsetHeight*14/72)}px`);
 for(const sidebar of scene.querySelectorAll('.intel-hand,.founder-market')){sidebar.style.marginTop=`${board.offsetTop}px`;sidebar.style.height=`${board.offsetHeight}px`;}
 panel.style.width=`${Math.min(root.clientWidth-16,1120)}px`;
 panel.style.marginLeft='auto';panel.style.marginRight='auto';
 const scale=Math.min(1,(table.clientWidth-16)/width,(table.clientHeight-12)/Math.max(1,scene.scrollHeight));
 scene.style.transform=`translateX(-50%) scale(${Math.max(.1,scale)})`;
 const header=root.querySelector('.top');
 header.style.width=`${Math.min(root.clientWidth,Math.max(1200,width*scale))}px`;
}
const layoutObserver=new ResizeObserver(alignDrawer);
function render() {
 if(game.phase!=='power'){revealedCardAccepted=false;phaseLogAccepted=0;}
 const oldScroll=document.querySelector('.tabletop');const scroll={top:oldScroll?.scrollTop??0,left:oldScroll?.scrollLeft??0};
 motionCleanup();
 clearTimeout(timer);
 const id=currentPlayer(game);
 const activeFund=game.phase==="auctionResult"?game.auction.host:id;
 root.innerHTML=`<header class="top"><div class="brand"><h1>Vests</h1><span class="version" aria-label="Loaded game version">v${VERSION}</span></div><div class="status"><b>Round ${game.metrics.cycles}</b><span>${game.ipoCompany!=null?"Final round · IPO reached":"Finish the round at IPO"}</span></div><nav>${button("Supply","data-supply")}${button("Value cards","data-intel-catalogue")}${button("Founders","data-founders")}${button("Exit values","data-exits")}${button("Rules","data-rules")}${button("New game",'data-new class="primary"')}${button("History","data-history")}${!game.ended?button(`New LP · $${game.rules.startingCash} / owe $${game.rules.obligation}`,'data-raise-money title="Take a new LP without using an action"',!canRaiseMoney(game)):''}<label class="auto-control"><input type="checkbox" id="auto" ${auto?"checked":""}>Auto-play AI</label></nav></header>${notice?`<p class="notice" role="alert">${esc(notice)}</p>`:""}<div class="tabletop"><div class="game-layout">${intelHandHTML()}<div class="board-column"><section class="table-top"><section class="funds" aria-label="Investors">${game.players.map(p=>`<article style="--tilt:${((p.id*3)%5-2)*.65}deg" class="fund ${p.id===0?"you":""} ${p.id===activeFund?"active":""}"><header><b>${fund(p.id)} ${p.id===0?"<em>YOU</em>":""}${p.id===activeFund?'<span class="turn-label">TURN</span>':""}${p.id===game.first?'<span class="turn-label">FIRST</span>':""}</b>${p.id===0 || game.ended ? coin(game.ended?game.scores[p.id]:availableCash(p)) : ""}</header>${!game.ended?`<small class="cash-status">${p.id===0?'Available · ':''}<b>$${p.locked??0} locked</b> · ${p.lpObligations} LP${p.lpObligations===1?'':'s'} · $${p.obligation} owed${game.rules.intelMode!=="off"?` · ${p.intel.length} card${p.intel.length===1?'':'s'}`:""}</small>`:""}</article>`).join("")}</section></section>${boardHTML()}</div><aside class="founder-market" aria-label="Available founders"><h2>Available founders</h2><div class="market-cards">${game.founderMarket.map(f=>founderCard(FOUNDERS[f])).join("")}</div></aside></div></div><section class="decision ${game.ended?'game-over':''} ${['reveal','afterRevealReady','catchUpReady','catchUpResult','valueResult'].includes(game.phase)?'movement-decision':game.phase.startsWith('intel')?'intel-decision':''}">${decision()}</section>`;
 const scroller=document.querySelector('.tabletop');scroller.scrollTop=scroll.top;scroller.scrollLeft=scroll.left;
 arrangeDecision();alignDrawer();layoutObserver.disconnect();layoutObserver.observe(document.querySelector('.game-layout'));layoutObserver.observe(document.querySelector('.decision'));layoutObserver.observe(document.querySelector('.tabletop'));layoutObserver.observe(root);scroller.addEventListener('scroll',alignDrawer,{passive:true});bind();schedule();
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
 const d=dialog("Growth supply",`<p>One preview per card type. Counts show unseen copies / total copies. Unseen cards may be in supply, the growth pile or face-down discards.</p><div class="deck-gallery">${game.companies.map(c=>{
 const deck=growthDeck(c.id),used=new Set([...c.history,...game.removed.filter(card=>card.company===c.id&&card.burned&&card.public)].map(card=>card.id)),groups=new Map();
 for(const card of deck){
  const key=JSON.stringify([card.printed,card.signature,card.effect]),group=groups.get(key)??{card,total:0,unseen:0};
  group.total++;group.unseen+=Number(!used.has(card.id));groups.set(key,group);
 }
 return `<section class="company-deck" style="--company:${COMPANIES[c.id].color};--tilt:${((c.id*7)%5-2)*.7}deg"><header><h3>${co(c.id)}</h3><span>${deck.filter(card=>!used.has(card.id)).length} unseen · ${c.supply.length} in supply</span></header><p class="deck-theme"><b>${DECK_THEMES[c.id][0]}.</b> ${DECK_THEMES[c.id][1]}</p><div class="deck-fan">${[...groups.values()].map(({card,total,unseen})=>`<div class="deck-group"><div class="deck-slot ${unseen?'':'card-used'} ${card.signature?'signature-slot':''}" tabindex="0" title="${unseen} unseen out of ${total} copies">${cardHTML(card,false)}<span class="card-quantity" aria-label="${total} copies">×${total}</span></div><small class="deck-availability">${unseen}/${total}</small></div>`).join('')}</div></section>`;
 }).join("")}</div>`);
 d.classList.add('supply-guide');
}

function founders() {
 const order=[0,14,6,18,11,19,2,9,4,17,5,16,1,8,15,10,13,7,3,12,20,21];
 const d=dialog("Meet the founders",`<p class="founder-guide-tip">Your lead investor chooses “may” powers. Fumbled founders pause, except Mario’s block and Reid’s recovery discard. “Return” means the bottom of supply.</p><div class="founder-review">${order.map(id=>`<section>${founderCard(FOUNDERS[id])}</section>`).join('')}</div>`);
 d.classList.add('founder-guide');
}

function rules() {
 const pawn=(cid,label=COMPANIES[cid].short)=>`<span class="rule-pawn" style="--company:${COMPANIES[cid].color}">${label}</span>`;
 const back=()=>'<span class="deployed-card rule-card-back" aria-label="Face-down growth card"></span>';
 const arrow='<span class="rule-arrow" aria-hidden="true">→</span>';
 const figure=(visual,caption)=>`<figure><div class="rulebook-illustration">${visual}</div><figcaption>${caption}</figcaption></figure>`;
 const treasury=`<div class="rule-treasury" style="--company:${COMPANIES[0].color}"><b>Gogol</b>${[0,...COMPANIES[0].slots].map((n,i)=>`<span class="${i===2?'selected':''}">${n}</span>`).join('')}</div>`;
 const pages=[
  ['The goal',`<p class="rulebook-lead">Invest in companies. Help them grow. Finish with the most money.</p><p>You are an investor, buying shares in companies racing towards IPO. You can back several companies or keep investing in one. Every company you hold shares in is part of your <strong>portfolio</strong>.</p><h3>Set up your fund</h3><p>Each investor starts with ${coin(game.rules.startingCash)}, <strong>one LP obligation</strong> and <strong>one private value card</strong>. Each company starts on space 1 with one of its growth cards in the shared growth pile.</p><h3>Cash now, repayment later</h3><p>You can take another LP at any time before final settlement, without spending an action. Each LP gives you $${game.rules.startingCash} now and adds $${game.rules.obligation} to your final repayment, including during another investor’s turn.</p><p>When the race ends, add your cash and exit receipts, then subtract your LP obligations. <strong>The most money wins.</strong></p>`,
    figure(`${coin(game.rules.startingCash)}<span class="rule-lp">1 LP<br><b>Repay $${game.rules.obligation}</b></span><img class="rule-value-back" src="/assets/value/recover.png" alt="Your starting value card">`,'Your starting fund: spendable cash, one obligation, and one private card.')+figure(`${pawn(0)}<span class="share your-share">● Saul Grayam</span><span class="share">▲ Marek Anderson</span>`,'Both investors have Gogol in their portfolio. They share its exit proceeds.')],
  ['Your turn',`<p class="rulebook-lead">Take one main action, then one value action.</p><h3>1. Main action</h3><p><strong>Call an auction</strong> for an unowned company or a company you lead. Or <strong>change the founder</strong> of a company you lead: choose a replacement from the three available founders. Changing founders does not fumble the company. You can also <strong>skip</strong> your main action.</p><h3>2. Value action</h3><p><strong>Draw one</strong> value card, <strong>play one</strong> from your hand, or <strong>exchange one</strong>: discard a card and draw a different one. You cannot play the replacement this turn.</p><p>Your hand limit is <strong>three cards</strong>. Each value card has one copy; played and discarded cards are shuffled into a new draw deck when needed. A card can affect any eligible portfolio company, even if you are not its lead investor.</p><h3>Then pass the turn clockwise</h3><p>Once every investor has taken a turn, companies deploy from treasury and the reveal begins. The first investor rotates clockwise each round.</p>`,
    figure(`${founderPortrait(FOUNDERS[13])}${arrow}${founderPortrait(FOUNDERS[21])}`,'A new founder replaces the old one. Their printed timing tells you when the new power applies.')+figure(`<div class="rule-hand">${['launch','move','bridge'].map(kind=>intelCardHTML({kind})).join('')}</div>`,'Keep up to 3 value cards. Draw, play or exchange one per turn.')],
  ['Auctions',`<p class="rulebook-lead">Buy a new share and fund the company’s treasury.</p><h3>Submit a sealed bid</h3><p>Every investor may bid privately or pass. The highest bidder gains one share and pays the <strong>second highest bid</strong>, with at least the minimum price. A sole bidder pays their own bid.</p><p>If investors tie for highest, only those investors continue in an open auction, raising by at least $1 or withdrawing. The last remaining investor pays the final price.</p><h3>Turn the payment into treasury</h3><p>The company’s space determines its leg. The prices show the payment needed to add one, two or three treasury slots. A company can hold <strong>at most three slots</strong> and issue <strong>at most five shares</strong>.</p><h3>Who leads a company?</h3><p>The investor with the most shares is its <strong>lead investor</strong>. The most recent purchase breaks a share count tie. The lead investor can call its auctions, change its founder and choose its optional powers.</p>`,
    figure(`<div class="rule-bids"><span><small>● Saul</small><b>$8</b></span><span><small>▲ Marek</small><b>$5</b></span><span><small>■ Pieter</small><b>Pass</b></span></div><div class="rule-bid-payment">Saul wins · pays ${coin(5)}</div>`,'The highest bid wins. Pay the second highest bid.')+`<div class="rulebook-prices" aria-label="Treasury gained from payment">${game.rules.projectPrices.map((row,i)=>`<section class="price-band band-${i}"><h3>Leg ${i+1}<small>Spaces ${i*8+1} to ${(i+1)*8}</small></h3><div>${row.map((n,j)=>`<span class="price-option">${coin(n)}<small>${j+1} slot${j?'s':''}</small></span>`).join('')}</div></section>`).join('')}</div>`],
  ['The reveal',`<p class="rulebook-lead">Build the growth pile, then reveal ${game.rules.revealsPerRound} cards one at a time.</p><h3>Deploy, then use before reveal powers</h3><p>Deploy the number of supply cards shown in each treasury slot, face down, then lose one slot. If supply runs short, deploy what remains. Use before reveal powers.</p><h3>Reveal and resolve</h3><p>Move each company by its card’s number. Power cards also apply their instructions. Finish reactions before the next draw.</p><p>Discard the next card for a fumbled company to <strong>recover</strong>. It uses one of the five draws. Weta’s Pivot recovers and moves instead.</p><h3>Burn, then finish the round</h3><p>After the draws, burn up to <strong>${game.players.length-1} undrawn cards</strong> face up, one fewer than investors. Cards added by powers are protected this round. Keep the rest in the pile.</p><p>Resolve after reveal powers. Then move every company on the <strong>lowest occupied space</strong> forward one space together; finish reactions.</p>`,
    figure(`${treasury}${arrow}${back()}`,'Gogol at treasury slot 2 deploys one card, then drops to slot 1.')+figure(`${cardHTML(growthDeck(0).find(c=>!c.signature&&c.printed===1),true)}${arrow}${pawn(0)}<strong>+1 space</strong>`,'A normal growth card moves its company. Supply and the shared growth pile are different places.')+figure(`${fumbleBadge()}${arrow}${back()}${arrow}${pawn(2)}`,'Discard to recover. That card uses one draw; do not draw a replacement.')],
  ['Powers & positions',`<p class="rulebook-lead">Resolve powers in order. Use the queue to break position ties.</p><h3>Follow the companies clockwise</h3><p>Resolve before and after reveal powers clockwise: start top left, go across the top, then back along the bottom. Finish every reaction and choice before continuing.</p><p>The lead investor chooses <strong>“may”</strong> powers; unowned companies skip them. Fumbled founders pause unless their cards say otherwise.</p><h3>Leading is about the space</h3><p>All companies on the furthest space are <strong>leading</strong>. On a shared space, first arrival ranks ahead; new arrivals join the back. Grouped moves keep their internal order.</p>`,
    figure(`<div class="rule-order" style="grid-template-columns:repeat(${Math.ceil(game.companies.length/2)},1fr)">${game.companies.map(c=>`<span style="background:${COMPANIES[c.id].color}">${companyOrder(game.companies).indexOf(c.id)+1} · ${co(c.id)}</span>`).join('')}</div>`,'Read clockwise around the table: across the top, back along the bottom.')+figure(`<div class="rule-track"><span>7</span><div>${pawn(0)}${pawn(1)}</div><span>9</span><div>${pawn(4)}${pawn(2)}</div></div>`,'Testra and Weta both lead on space 9. Testra ranks ahead because it arrived first.')],
  ['IPO & money',`<p class="rulebook-lead">Finish the full round. Then check for IPO.</p><h3>Finish the race</h3><p>Finish all turns, draws, powers and catch-up. If any unfumbled company is on space 24, the game ends. Otherwise, play another round.</p><h3>Pay the eligible shares</h3><p>Use two more companies than investors. The top half, rounded down, pay: <strong>${game.rules.payoutPlaces} of ${game.companies.length}</strong> this game. Divide each company’s final track value by all issued shares, including bank shares. Round down to whole dollars and pay per share.</p><p>Founder exceptions apply. Active Jenkins can exit for $75 from penultimate place.</p><h3>Repay your LPs</h3><p>Repay $${game.rules.obligation} per LP, including your starting one. Subtract obligations from cash and exit receipts, even if this makes your final money negative.</p><p><strong>The investor with the most money wins.</strong> Equal final money means a shared win.</p>`,
    figure(`${Array.from({length:game.rules.payoutPlaces},(_,i)=>pawn(game.companies[i].id,['1st','2nd','3rd'][i])).join('')}`,'Use the queue to rank companies that finish on the same space.')+figure(`${coin(100)}<span>÷ 4 =</span>${coin(25)}<span>per share</span>`,'A $100 company with four shares pays $25 per share. Two shares pay $50.')+`<p class="rulebook-equation">Cash + exits<br>− LP repayments<br><strong>Your final money</strong></p>`]
 ];
 const d=dialog('How to play',`<nav class="rules-tabs" aria-label="Rules chapters">${pages.map(([title],i)=>button(`${i+1}. ${title}`,`data-rule-page="${i}"`)).join('')}</nav><section class="rules-page"></section><footer class="rules-paging">${button('← Previous','data-rule-prev')}<span data-rule-progress></span>${button('Next →','data-rule-next')}</footer>`);
 d.classList.add('rules-guide');let index=0;
 const show=i=>{index=i;const [title,text,art]=pages[i];d.querySelector('.rules-page').innerHTML=`<header class="rulebook-heading"><span>${String(i+1).padStart(2,'0')}</span><h2>${title}</h2></header><div class="rulebook-spread"><div class="rulebook-text">${text}</div><aside class="rulebook-art" aria-label="Examples">${art}</aside></div>`;d.querySelector('[data-rule-progress]').textContent=`${i+1} / ${pages.length}`;d.querySelector('[data-rule-prev]').disabled=i===0;d.querySelector('[data-rule-next]').disabled=i===pages.length-1;d.querySelectorAll('[data-rule-page]').forEach((b,n)=>b.setAttribute('aria-current',n===i?'page':'false'));};
 d.querySelectorAll('[data-rule-page]').forEach((b,i)=>b.onclick=()=>show(i));d.querySelector('[data-rule-prev]').onclick=()=>show(index-1);d.querySelector('[data-rule-next]').onclick=()=>show(index+1);show(0);
}
function newGame() {
  const d = dialog(
    "Set the table",
    `<form id="new"><label>Investors<select name="players">${[2, 3, 4, 5].map((n) => `<option ${n === 4 ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Seed<input type="number" min="0" max="4294967295" name="seed" value="${Date.now() % 4294967295}"></label>${button("Start new game", 'type="submit"')}</form><div class="save-tools">${button("Save replay", "data-save")}<label class="file-button">Load replay<input type="file" accept="application/json" data-load></label></div><small>This version has its own save slot; earlier games are untouched.</small>`,
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
    revealedCardAccepted=false;phaseLogAccepted=0;
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
      revealedCardAccepted=false;phaseLogAccepted=0;phaseLogAccepted=0;
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
          `<p><small>Leg ${e.leg + 1} · cycle ${e.cycle}</small> ${e.type === "raiseMoney" ? `${fund(e.player)} took a new LP: $${e.cash} received, $${e.obligation} owed` : e.type === "returnGrowth" ? `${e.count} Supply chain cards returned to supply` : e.type === "auction" ? `${co(e.company)} · ${e.winner === null ? "no sale" : `${fund(e.winner)} paid $${e.paid}`}` : e.type === "returned" ? `${co(e.card.company)} · Julie returned the card to supply; draw used` : e.type === "deferred" ? `${co(e.card.company)} · card discarded to recover; draw used` : e.type === "reveal" ? (e.card.effect ? `${co(e.card.company)} · ${e.card.effect === "fumble" ? `Fumble` : `Go back · ${e.effect.before} → ${e.effect.after}`}` : `${co(e.card.company)} ✳ ${e.card.printed} · ${e.effect.before} → ${e.effect.after}`) : e.type === "purchases" ? `Deployed ${e.companies.reduce((s, c) => s + c.count, 0)} growth cards` : e.type === "deploy" ? `${co(e.company)} deployed ${e.count} cards · ${e.reserve} charges remain` : e.type === "hedge" ? `Hedge fund backed ${co(e.company)} · reserve 3 · one non-player share` : e.type === "burn" ? `${e.count} pile cards burned face up: ${burnSummary(e)}` : e.type === "carry" ? `${e.count} undrawn cards retained in the pile` : e.type === "intelExchange" ? `${fund(e.player)} discarded ${INTEL_CARDS[e.discard].name} and drew a replacement` : e.type === "intelDraw" ? `${fund(e.player)} drew a private value card` : e.type === "intelPlay" ? `${fund(e.player)} played ${INTEL_CARDS[e.kind].name}${e.noEffect?' without effect':e.company===undefined?'':` on ${co(e.company)}`}` : e.type === "founderSwap" ? `${e.companies.map(co).join(" ↔ ")} swapped founders` : e.type === "founder" ? `${co(e.company)} hired ${FOUNDERS[e.founder].name}` : e.type === "opening" ? `Opening deal: ${e.cards.map(c=>`${co(c.company)} ✳${c.printed}`).join(" · ")}` : e.type === "cycle" ? "Funding cycle starts" : e.type === "checkpoint" ? (e.snapshot?.final ? "IPO settlement" : "Funding band advanced") : "Final obligation settled"}</p>`,
      )
      .reverse()
      .join("")}</div>`,
  );
}
function bind() {
  const on = (s, fn) => root.querySelector(s)?.addEventListener("click", fn);
  on("[data-rules]", rules);
  on("[data-supply]", supply);
  on("[data-intel-catalogue]",()=>{const d=dialog("Value cards",`<p>14 unique cards, 1 copy each. Start with 1 private card; hold at most 3. After your main action, draw 1, play 1, or discard 1 to draw a replacement. Recycle played cards when the deck empties. A portfolio company is any company you own shares in. Deploy means move cards from supply to the growth pile face down.</p><div class="intel-cards">${Object.keys(INTEL_CARDS).map(kind=>intelCardHTML({kind})).join('')}</div>`);d.classList.add('value-catalogue');});
  on("[data-exits]", exits);
  on("[data-founders]", founders);
  on("[data-final-sale]",()=>act({type:"sell",shares:game.companies.map(c=>holdings(c,0))}));
  root.querySelectorAll("[data-change-founder]").forEach(b=>b.onclick=()=>act({type:"changeFounder",company:Number(b.dataset.changeFounder),discard:Number($("#turn-discard")?.value)}));
  on('[data-crisis-play]',()=>act({type:'crisisIntel',play:true}));
  on('[data-crisis-pass]',()=>act({type:'crisisIntel',play:false}));
  root.querySelectorAll('[data-order-intel]').forEach(b=>b.onclick=()=>act({type:'orderIntel',order:b.dataset.orderIntel.split(',').map(Number)}));
  root.querySelectorAll('[data-exchange-value]').forEach(b=>b.onclick=()=>act({type:'exchangeValue',card:Number(b.dataset.exchangeValue)}));
  on('[data-phase-reviewed]',()=>{phaseLogAccepted=game.race.log.length;render();});
  on('[data-show-reactions]',()=>{revealedCardAccepted=true;render();});
  root.querySelectorAll('[data-scout-page]').forEach(b=>b.onclick=()=>{scoutPage=Number(b.dataset.scoutPage);render();});
  root.querySelectorAll('input[name="discard-growth"]').forEach(input=>input.onchange=()=>{input.checked?scoutPicks.add(Number(input.value)):scoutPicks.delete(Number(input.value));render();});
  on('[data-discard-growth]',()=>act({type:'scoutIntel',choices:[...scoutPicks]}));
  on("[data-draw-value]",()=>act({type:'drawValue'}));
  on("[data-pass-value]",()=>act({type:'passValue'}));
  on("[data-save-intel]",()=>act({type:'playIntel',card:-1}));
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
  on('[data-raise-money]',()=>act({type:'raiseMoney'},0));
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
  if (modal || game.ended || !auto || worker || needsCardReveal() || needsPhaseReview()) return;
  const id = currentPlayer(game);
  if (
    [
      "power",
      "phaseResult",
      "auctionResult",
      "purchaseResult",
      "reveal",
      "cycleResult",
      "afterRevealReady",
      "catchUpReady",
      "catchUpResult",
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

document.fonts.ready.then(alignDrawer);
