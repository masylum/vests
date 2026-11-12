import {auctionReceipt,sealedAuctionPrompt} from './tabletop-auction.js';
import {createPawnMotion} from './tabletop-motion.js';
import {createTimeline} from './tabletop-timeline.js';
import {founderDescription,founderCard,intelCardHTML} from './tabletop-components.js';
import {investorIcon,investorSharesHTML} from "./share-icons.js";
import {expectedTokenMovement} from './balance.js';
import {NEW_CARDS,TWO_COMPANY_CARDS,expansionChoices} from './card-expansion.js';
let handPage=0,valuePage=0,valueCompany=null;
let announcedAction=null,effectPages=[],inputDrafts={};
let scoutPage=0,scoutKey='',scoutPicks=new Set();
import {INTEL_MODES,INTEL_CARDS,canDrawIntel,canExchangeIntel,intelTargets,intelSecondTargets,playableIntel,intelLead} from './intel.js';
import {canHireFounder,capitalPenalty,ACTIVE_FOUNDERS} from './config.js';
import {movementSteps} from './movement.js';
import {TRACK} from './track.js';
import {choosePower} from './racing.js';
import {
  VERSION,UI_VERSION,podium,companyOrder,currencyUnit, availableCash, slotCards, checkpointTarget, sharePayout,
  COMPANIES,
  FUNDS,
    FOUNDERS,
  companyValue,
  fundingPrices, fundingBand, SPECIALS, growthDeck, DECK_THEMES, DECK_PROFILES,
} from "./config.js";
import {
  createGame, canRaiseMoney, canDrawEmptyHand,
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
  KEY = preview ? `venture-sequential-preview-${VERSION}${new URLSearchParams(location.search).has("qa")?"-qa-"+new URLSearchParams(location.search).get("qa"):""}` : `venture-sequential-${VERSION}`;
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
  co = (id) => COMPANIES[id]?.name??"Your fund",
  fund = (id) => `${investorIcon(id)} ${FUNDS[id]}`,
  button = (text, attrs = "", disabled = false) =>
    `<button ${attrs} ${disabled ? "disabled" : ""}>${text}</button>`;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) {
    game = replayGame(saved);
    setup = saved.setup;
    commands = saved.commands;
    const ui=saved.ui??{};
    announcedAction=ui.announcedAction??null;effectPages=ui.effectPages??[];inputDrafts=ui.inputDrafts??{};
    revealedCardAccepted=!!ui.revealedCardAccepted;phaseLogAccepted=ui.phaseLogAccepted??0;
    handPage=ui.handPage??0;valuePage=ui.valuePage??0;valueCompany=ui.valueCompany??null;
    scoutPage=ui.scoutPage??0;scoutKey=ui.scoutKey??'';scoutPicks=new Set(ui.scoutPicks??[]);
    auto=ui.auto??true;
  }
} catch (e) {
  notice = "Could not load this save: " + e.message;
}
game ??= createGame(setup);
function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: VERSION, setup, commands, ui:{announcedAction,effectPages,inputDrafts,revealedCardAccepted,phaseLogAccepted,handPage,valuePage,valueCompany,scoutPage,scoutKey,scoutPicks:[...scoutPicks],auto} }),
  );
}
function act(cmd,actor=currentPlayer(game),announced=false) {
  if(!announced&&(['call','changeFounder','sellShare','raiseMoney','exchangeValue','drawValue'].includes(cmd.type)||cmd.type==='playIntel'&&cmd.card>=0)){
    announcedAction={cmd,actor,card:cmd.type==='playIntel'||cmd.type==='exchangeValue'?game.players[actor].intel[cmd.card]:null};
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
    commands.push({ id, cmd });effectPages=[];inputDrafts={};
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
function fumbleBadge() { return '<span class="fumble-badge" title="Discard the next drawn token to recover"><span aria-hidden="true">×</span> Fumbled</span>'; }
function fumbleIcon() {
 return `<svg class="fumble-icon" viewBox="0 0 64 64" role="img" aria-label="Fumble"><g transform="rotate(-35 32 32)" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M19 25v20c0 10 26 10 26 0V25" fill="white"/><ellipse cx="32" cy="25" rx="13" ry="8" fill="white"/><path d="m28 22 8 6m0-6-8 6"/></g><path d="M8 54h17M49 10l5-5M54 22h7" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function cardHTML(c, compact=false) {
 const meta=COMPANIES[c.company];
 return `<article class="growth-token-display" style="--card:${meta.color}" aria-label="${meta.name} growth token: ${c.effect==='fumble'?'fumble':'+'+c.printed}"><b>${meta.name}</b><strong>${c.effect==='fumble'?fumbleIcon():`${c.printed>0?'+':''}${c.printed}`}</strong>${c.effect==='fumble'?'<small>Fumble</small>':''}</article>`;
}
function auctionCompany() {
 return ["bid","tie","rights","openBid","auctionResult"].includes(game.phase) ? game.auction.company : null;
}
function companyPilesHTML(c){
 const used=game.removed.filter(t=>t.company===c.id).length;
 return `<dl class="company-counts"><div><dt>Supply</dt><dd>${c.supply.length}</dd></div><div><dt>Used</dt><dd>${used}</dd></div></dl>`;
}
function companyHTML(c) {
  const owner=lead(c),f=FOUNDERS[c.founder];
  const shareholders=investorSharesHTML(c,owner);
  const hedge=c.tokens.filter(t=>t.hedge).length,bank=bankHeld(c)-hedge;
  return `<article class="company ${c.id===auctionCompany()?"auction-active":""}" style="--company:${COMPANIES[c.id].color};--tilt:${((c.id*7)%5-2)*.7}deg"><header><h3>${co(c.id)}</h3><div class="lead-space" aria-label="Lead investor: ${owner===null?'none':FUNDS[owner]}"><span class="lead-token ${owner===null?'empty':''}" title="${owner===null?'No lead investor':`One share · Lead investor · ${FUNDS[owner]}`}">${owner===null?'':investorIcon(owner)}</span></div></header>${founderCard(f,'tabletop-card')}<aside class="company-details"><div class="company-status">${c.down?fumbleBadge():""}</div><div class="shareholders">${shareholders?`${shareholders}`:''}${hedge?`<span class="share hedge-share" title="Non-player investor · shares dilute the exit payout">Hedge fund${hedge>1?` ×${hedge}`:""}</span>`:""}${Array.from({length:bank},()=>'<span class="share bank-share" title="Bank share · still dilutes exit proceeds">🏦</span>').join('')}</div>${companyPilesHTML(c)}</aside></article>`;
}
const {positionTrack,roundTrack,movementTrack,movementBox,reactionTimeline}=createTimeline({getGame:()=>game,co,esc,cardHTML,intelCardHTML,FOUNDERS,founderCard,founderDescription,COMPANIES,fundingBand});
function valueReceipt(result){
 if(!result)return '';
 if(result.returnedCards||result.destroyedCards){
  const tokens=result.returnedCards??result.destroyedCards,returned=!!result.returnedCards;
  return `<p>${fund(result.player)} · <b>${INTEL_CARDS[result.kind].name}</b> · ${co(result.company)}</p><div class="token-receipt"><div><b>${returned?'Returned to growth bag':'Removed from game · +$5'}</b><div class="receipt-tokens">${tokens.map(t=>cardHTML(t,true)).join('')}</div></div><div>${reactionTimeline(result.reactions??[])}</div></div>`;
 }

 const changes=(result.after??[]).flatMap((c,i)=>{const before=result.before[i],rows=[];
  if(c.shares!==before.shares&&before.shares!==undefined)rows.push(`${co(i)}: your shares ${before.shares} → ${c.shares}`);
  if(c.founder!==before.founder&&before.founder!==undefined)rows.push(`${co(i)}: hired ${FOUNDERS[c.founder].name}`);

  if(c.down!==before.down&&!result.reactions?.some(r=>r.intel&&(r.target??r.company)===i))rows.push(`${co(i)}: ${c.down?'fumbled':'recovered'}`);
  return rows;
 });
 if(result.marketAfter)changes.push(`New public founders: ${result.marketAfter.map(id=>FOUNDERS[id].name).join(', ')}`);
 if(result.cashChange)changes.push(`${FUNDS[result.player]}: ${result.cashChange>0?'+':''}$${Math.abs(result.cashChange)} ${result.cashChange>0?'from':'to'} the bank`);
 const resources=(result.after??[]).flatMap((c,i)=>c.supply!==result.before[i].supply?[`<div class="supply-change" style="--company:${COMPANIES[i].color}"><b>${co(i)} supply</b><div><span class="supply-stack">${Array.from({length:3},()=>'<i></i>').join('')}<strong>${result.before[i].supply}</strong></span><span aria-hidden="true">→</span><span class="supply-stack">${Array.from({length:3},()=>'<i></i>').join('')}<strong>${c.supply}</strong></span></div><small>${Math.abs(c.supply-result.before[i].supply)} token${Math.abs(c.supply-result.before[i].supply)===1?'':'s'} ${c.supply<result.before[i].supply?'left supply':'returned to supply'}</small></div>`]:[]).join('');
 const reactions=result.reactions??[];
 return `<p>${fund(result.player)} played <b>${INTEL_CARDS[result.kind].name}</b>${result.company>=0?` on <b style="color:${COMPANIES[result.company].color}">${co(result.company)}</b>`:''}.</p>${!reactions.some(r=>r.intel)?`<div class="value-receipt">${intelCardHTML({kind:result.kind})}<div>${result.noEffect?'<p>No eligible company. The card had no effect.</p>':resources+changes.map(t=>`<p>${esc(t)}</p>`).join('')}</div></div>`:resources+changes.map(t=>`<p>${esc(t)}</p>`).join('')}${result.discardedCards?.length?`<div class="discarded-growth-receipt"><b>Discarded from the bag</b><div>${result.discardedCards.map(card=>cardHTML(card,true)).join('')}</div></div>`:''}${result.destroyedCards?.length?`<div class="destroyed-receipt"><b>Removed from the game · gain $5</b><div>${result.destroyedCards.map(t=>cardHTML(t,true)).join('')}</div></div>`:''}${reactionTimeline(reactions)}`;
}

function revealHTML() {
  const e = game.lastRevealed;
  if (!e) return "<p>No card revealed yet.</p>";
  if(e.value)return valueReceipt(e.value);
  if(e.pending)return `<div class="reveal-card">${cardHTML(e.card)}<div><h3>${co(e.card.company)}</h3><p>Token revealed. Julie may use its printed effect and power for her company.</p></div></div>`;
  if(e.returned)return `<div class="reveal-card">${cardHTML(e.card)}<div><h3>${co(e.card.company)} · returned to supply</h3><p>This draw is used. The card’s effects did not resolve.</p>${reactionTimeline(e.reactions)}</div></div>`;
  if(e.reviewed)return `<p>${e.stage==='start'?'Before-reveal':'After-reveal'} powers complete.</p>`;
  if(!e.card)return reactionTimeline(e.reactions)||'<p>No founder powers triggered in this step.</p>';
  return `<div class="reveal-card ${e.deferred?'discarded':''}">${cardHTML(e.card)}<div><h3>${co(e.effect?.company??e.card.company)} ${e.deferred?'· card discarded':''}</h3>${!e.deferred&&e.effect&&e.effect.before!==e.effect.after?movementBox(e.effect.before,e.effect.after,e.effect.company??e.card.company):''}${e.deferred?'<p><span class="summary-fumble">Recovered</span> This draw is used.</p>':e.card.effect==='fumble'?(game.companies[e.effect?.company??e.card.company].down?`<p>${fumbleBadge()} Discard the next token to recover. No extra draw.</p>`:'<p><span class="summary-fumble">Recovered / prevented</span></p>'):e.card.effect==='setback'?'<p>Moved back by the token.</p>':''}${e.effect?.recovered?'<p><span class="summary-fumble">Recovered</span> This token still moves.</p>':''}${e.card.signature==='recycle'&&!e.deferred?'<p>Returns to its company’s supply after the reveal.</p>':''}${e.effect?.founder&&FOUNDERS[game.companies[e.effect?.company??e.card.company].founder]?`<div class="power-prompt">${founderCard(FOUNDERS[game.companies[e.effect?.company??e.card.company].founder])}<p>Founder movement modifier: ${e.effect.founder>0?'+':''}${e.effect.founder}.</p></div>`:''}${reactionTimeline(e.reactions)}</div></div>`;
}
function revealSummaryHTML() {
 const start=game.log.findLastIndex(e=>e.type==='cycle');
 const events=game.log.slice(start+1), cards=events.filter(e=>e.type==='reveal'||e.type==='deferred');
 const before=game.revealStartPositions ?? cards.find(e=>e.positions)?.positions;
 const reactions=events.flatMap(e=>e.reactions??[]);
 const hedge=events.filter(e=>e.type==='hedge');
 return `<p>${cards.filter(e=>e.type==='reveal').length} cards resolved · ${cards.filter(e=>e.type==='deferred').length} discarded to recover from fumbles${events.filter(e=>e.type==='returned').length?` · ${events.filter(e=>e.type==='returned').length} returned by Julie`:''}${events.filter(e=>e.type==='burn').map(e=>` · ${e.count} bag tokens discarded face up`).join('')}</p>${events.filter(e=>e.type==='burn').map(e=>`<p>Discarded from the bag: ${burnSummary(e)}</p>`).join('')}${roundTrack(before)}
 <details class="round-details"><summary>Round timeline</summary><ol class="round-event-timeline">${events.filter(e=>e.stage!=='intel'&&(e.card||e.reactions?.length||e.type==='valueResolved')).map(e=>`<li>${e.type==='valueResolved'?valueReceipt(e.value):''}${e.card?`<div class="timeline-growth">${cardHTML(e.card,true)}<div>${e.type==='deferred'?'<b>Discarded · recovered</b>':e.effect?movementBox(e.effect.before,e.effect.after,e.effect.company??e.card.company):''}</div></div>`:''}${e.type==='valueResolved'?'':reactionTimeline(e.reactions??[])}</li>`).join('')}</ol></details>`;
}
function intelHandHTML(){
 if(game.rules.intelMode==='off')return '';
 return `<section class="intel-hand"><h2>Your value cards</h2><div class="hand-pages">${game.players[0].intel.length>3?`${button("←","data-hand-prev",handPage===0)}<span>${handPage+1} / ${Math.ceil(game.players[0].intel.length/3)}</span>${button("→","data-hand-next",(handPage+1)*3>=game.players[0].intel.length)}`:""}</div><div class="intel-cards">${game.players[0].intel.slice(handPage*3,handPage*3+3).map((c,i)=>`<div class="hand-slot"><button class="hand-card ${game.phase==='intelPlay'&&valuePage===handPage*3+i?'selected':''}" data-select-value="${handPage*3+i}" aria-label="Select ${INTEL_CARDS[c.kind].name}" ${announcedAction||currentPlayer(game)!==0||!['call','intelPlay'].includes(game.phase)?'disabled':''}>${intelCardHTML(c)}</button></div>`).join('')||'<p>No cards in hand.</p>'}</div></section>`;
}
function decision() {
  const id = currentPlayer(game),
    human = id === 0,
    p = game.players[id ?? 0];
  if(announcedAction){
    const {cmd,actor,card}=announcedAction;
    const name=card?(cmd.type==='exchangeValue'?'Discard '+INTEL_CARDS[card.kind].name:INTEL_CARDS[card.kind].name):({call:'Fundraise',changeFounder:'Change founder',sellShare:'Sell share',raiseMoney:'Get $10 · advance capital',drawValue:'Draw one value card'}[cmd.type]);
    return `<h2>${fund(actor)} · ${name}</h2><div class="action-announcement">${card?intelCardHTML(card):''}<div>${cmd.company>=0?`<h3>${co(cmd.company)}</h3>`:''}<p>${cmd.type==='exchangeValue'?'Discard this value card and draw one replacement.':card?founderDescription(INTEL_CARDS[card.kind].text):cmd.type==='call'?'Sealed bids · second price. A sole bidder pays their own bid.':''}</p><b>The action has not resolved yet.</b></div></div>${button('Resolve action →','data-resolve-action')}`;
  }
  if (game.ended)
    return `<h2>${game.winners.map(fund).join(" & ")} wins</h2><div class="bids">${game.players.map((p) => `<article>${fund(p.id)}<strong>${coin(game.scores[p.id])}</strong><small>Cash + exits $${p.savedCash+p.cash} − capital $${capitalPenalty(p)}</small></article>`).join("")}</div>`;
  if(needsPhaseReview())return `<h2>Effects resolved · ${game.race.stage==='start'?'before the reveal':'reaction chain'}</h2>${reactionTimeline(game.race.log.slice(Math.max(phaseLogAccepted,game.race.lastPhaseLogIndex??0)))}${button('Choose reaction →','data-phase-reviewed')}`;
  if(needsCardReveal())return `<h2>Token revealed · ${co(game.lastRevealed.card.company)}</h2>${revealHTML()}${button('Resolve reactions →','data-show-reactions')}`;
  switch (game.phase) {
    case "call": {
      const ids=eligibleCompanies(game,id);
      return `<h2>${human?'Choose an action':fund(id)+' chooses an action'} · ${game.actionsLeft} left</h2>${human?`<div class="turn-companies" style="--company-count:${game.companies.length}">${game.companies.map(c=>`<article style="--company:${COMPANIES[c.id].color}"><h3>${co(c.id)}</h3>${button('Fundraise',`data-call="${c.id}"`,!ids.includes(c.id))}${button(`Sell share · $${game.rules.sellPayouts[fundingBand(c.position)]}`,`data-sell-share="${c.id}"`,!holdings(c,id))}${button('Change founder',`title="Change founder" aria-label="Change founder for ${co(c.id)}" data-change-founder="${c.id}"`,lead(c)!==id)}</article>`).join('')}</div>${button(p.capital<6?'Get $10 · −10 final score':'Capital limit reached','data-raise-money',!canRaiseMoney(game))}${canDrawEmptyHand(game,id)?button('Draw 1 value card','data-draw-value'):''}${game.rules.intelMode!=='off'?button('Play / discard a card','data-value-action',!p.intel.length):''}${!hasTurnAction(game,id)?button('End turn · no actions available','data-pass-turn'):''}`:''}`;
    }
    case "intelPlay": {
      if(!human)return `<h2>${fund(id)} chooses a value card</h2><p>Their hand is private.</p>`;
      valuePage=Math.min(valuePage,Math.max(0,p.intel.length-1));
      const card=p.intel[valuePage],targets=card?intelTargets(game,id,card.kind):[],cid=targets.includes(valueCompany)?valueCompany:targets[0];
      const seconds=card?intelSecondTargets(game,id,card.kind,cid):[],requiresSecond=card&&['swap','headhunt',...TWO_COMPANY_CARDS].includes(card.kind);
      const targetChoices=(requiresSecond?[]:[undefined]).concat(seconds);
      const options=targets.map(company=>`<option value="${company}" ${company===cid?'selected':''}>${co(company)}</option>`).join('');
      const secondary=seconds.length?`<label>Then <select data-value-second>${targetChoices.map(t=>`<option value="${t??''}">${t===undefined?'No second company':co(t)}</option>`).join('')}</select></label>`:'';
      const actions=`${targets.length?`<label>Target <select data-value-company>${options}</select></label>${secondary}${button('Play card',`data-play-intel="${valuePage}" data-intel-company="${cid}" ${requiresSecond?`data-intel-target="${seconds[0]}"`:''}`)}`:'<p>No legal target right now.</p>'}${button('Discard & draw 1',`data-exchange-value="${valuePage}"`,!canExchangeIntel(game,id))}`;
      return `<h2>Value card · ${valuePage+1} / ${p.intel.length}</h2>${button('← Previous','data-value-prev',valuePage===0)}${button('Next →','data-value-next',valuePage>=p.intel.length-1)}${button('Back to actions','data-cancel-value')}${card?`<h3>${INTEL_CARDS[card.kind].name}</h3><div class="value-selection"><p>${founderDescription(INTEL_CARDS[card.kind].text)}</p>${actions}</div>`:button('Continue · no card action','data-pass-value')}`;
    }
    case "intelScout": {
      const peek=game.intelScout,key=[game.cycle,peek.player,peek.kind,peek.cards.map(c=>c.id).join(',')].join(':');
      if(key!==scoutKey){scoutKey=key;scoutPage=0;scoutPicks=new Set();}
      const pageCards=peek.kind==='inside'?peek.cards.slice(scoutPage*6,scoutPage*6+6):peek.cards;
      const permutations=a=>a.length<=1?[a]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));
      return `<h2>${INTEL_CARDS[peek.kind].name}</h2><p>${peek.kind==='launch'?'Deploy 1 token into the growth bag. Leave the other on top of its supply.':'Choose 1 discarded token to return to the growth bag.'}</p>${human?`<div class="intel-cards ${peek.kind==='inside'?'scout-cards':''}">${pageCards.map((card,j)=>{const i=peek.kind==='inside'?scoutPage*6+j:j;return `<article>${peek.kind==='inside'?'':`<b>Card ${i+1}</b>`}${cardHTML(card)}${peek.kind==='inside'?`<label><input type="checkbox" name="discard-growth" value="${i}" ${scoutPicks.has(i)?'checked':''}> Return to growth bag</label>`:peek.kind==='launch'?button('Deploy this token',`data-scout-intel="${i}"`):''}</article>`;}).join('')}</div>${peek.kind==='inside'?`${peek.cards.length>6?`<div class="scout-pagination">${button('← Previous',`data-scout-page="${scoutPage-1}"`,scoutPage===0)}<span>Page ${scoutPage+1} / ${Math.ceil(peek.cards.length/6)} · ${scoutPicks.size} selected</span>${button('Next →',`data-scout-page="${scoutPage+1}"`,(scoutPage+1)*6>=peek.cards.length)}</div>`:''}${button(`Return 1 token`,'data-discard-growth',scoutPicks.size!==1)}`:peek.kind==='launch'?'':permutations(peek.cards.map((_,i)=>i)).map(order=>button(order.map((x,i)=>`Card ${x+1}${i===order.length-1?(peek.kind==='inside'?' (remove)':' (bottom)'):''}`).join(' → '),`data-order-intel="${order.join(',')}"`)).join('')}`:'<p>Private inspection.</p>'}`;
    }
    case "founder": {
      const c = game.companies[game.company];
      return `<h2>${human ? "Your founder choice" : `${fund(id)} chooses`} · ${co(c.id)}</h2><p>Choose a new founder. This uses one action.</p><div class="founder-options">${[c.founder, ...game.founderMarket].map((f, i) => `<article>${founderCard(FOUNDERS[f])}${human && (i || game.rules.intelMode==='off') ? button(i ? "Choose founder" : "Keep founder", `data-founder="${i - 1}"`,i>0&&!canHireFounder(f,game.leg)) : ""}</article>`).join("")}</div>`;
    }
    case "power": {
      const q=game.powerChoice, f=FOUNDERS[q.founder];
      const text=q.text.replace(/company (\d+)/gi,(_,n)=>co(Number(n)));
      const reidChoices=q.founder===21?`<label>Discarded growth token <select id="reid-token">${q.options.slice(1).map((o,i)=>`<option value="${i+1}">${esc(o.label.replace(/company (\d+)/gi,(_,n)=>co(Number(n))))}</option>`).join('')}</select></label>${button('Pass','data-power="0"')}${button('Return token and move back 2','data-use-reid')}`:null;
      return `${game.race?.card?.kind==='growth'&&!q.signature&&q.founder!==21?`<div class="reaction-source">${cardHTML(game.race.card,true)}<p>Reaction to ${co(game.race.card.company)}’s revealed token.</p></div>`:''}<div class="title"><h2>${human ? (q.signature?"Your token effect":"Your founder decision") : fund(id)} · ${co(q.company)}</h2><small>${game.race?.stage === "start" ? "Before the reveal" : game.race?.stage === "end" ? "After the reveal" : game.race?.stage === "intel" ? "Value card reaction" : "Reaction chain"}</small></div>${game.race?.stage==='intel'&&game.valueResult?`<p>${fund(game.valueResult.player)} played <b>${INTEL_CARDS[game.valueResult.kind].name}</b>.</p>`:''}<div class="power-prompt">${q.signature?cardHTML(q.signature):founderCard(f)}<div><b>${q.signature?SPECIALS[q.signature.company%6][0]:f.name}</b>${q.signature?movementBox(game.race.event.effect.before,game.companies[q.company].position,q.company):''}<p>${esc(text)}</p>${human ? `<div class="power-options ${reidChoices?'reid-options':''}">${(reidChoices??q.options.map((o,i)=>button(o.label.replace(/company (\d+)/gi,(_,n)=>co(Number(n)))+(q.signature?` · space ${game.companies[o.actions[0].target].position}`:''),`data-power="${i}"`)).join(""))}</div>` : `<p>${fund(id)} controls this choice.</p>${button("Let AI decide", "data-ai-power")}`}</div></div>`;
    }
    case 'rights': {
      const a=game.auction;return `<h2>Rights Issue · ${co(a.company)}</h2><p>${fund(a.host)} offers one new share for ${coin(a.price)}. First acceptance wins.</p>${human?button('Buy share', 'data-accept-rights',availableCash(p)<a.price)+button('Pass','data-pass-rights'):''}`;
    }
    case 'openBid': {
      const a=game.auction,min=a.highBidder==null?a.reserve:a.price+1;return `<h2>Convertible Notes · ${co(a.company)}</h2><p>${a.highBidder==null?'No bid yet':`${fund(a.highBidder)} leads at $${a.price}`}. Passing is final.</p>${human?`<form id="open-bid"><label>Your bid<input name="amount" type="number" min="${min}" max="${availableCash(p)}" step="1" value="${min}" required></label><button type="submit" ${availableCash(p)<min?'disabled':''}>Raise</button><button type="button" data-open-pass>Pass permanently</button></form>`:''}`;
    }
    case "bid": {
      const a=game.auction;
      const extra=human&&a.equityControl&&a.equityController===id?`<p><strong>Other bids:</strong> ${a.bids.map(b=>`${fund(b.player)}: ${b.amount?'$'+b.amount:'Passed'}`).join(' · ')}</p>`:'';
      return sealedAuctionPrompt({auction:a,co,fund,companies:COMPANIES,cards:INTEL_CARDS,human,cash:availableCash(p),unit:currencyUnit(game.rules),extra});
    }
    case "tie":
      return `<h2>${human ? "Your open bid" : `${fund(id)} bids openly`} · ${co(game.auction.company)}</h2><p>Tied rivals · current price ${coin(game.auction.price)} · in: ${game.auction.contenders.map(fund).join(", ")}</p><div class="bids">${game.auction.bids.map(b=>`<article>${fund(b.player)}<strong>${b.amount?coin(b.amount):"Passed"}</strong></article>`).join("")}</div>${human ? `<form id="tie"><label>Raise to<input aria-label="Open tie bid" name="amount" type="number" min="${game.auction.price + currencyUnit(game.rules)}" max="${availableCash(p)}" value="${game.auction.price + currencyUnit(game.rules)}" step="${currencyUnit(game.rules)}"></label>${button("Raise", 'type="submit"', availableCash(p) <= game.auction.price)}${button("Withdraw", 'type="button" data-withdraw')}</form>` : ""}`;
    case "auctionResult":
      return auctionReceipt({auction:game.auction,co,fund,coin,companies:COMPANIES,cards:INTEL_CARDS,reactionTimeline,button});
    case "purchaseResult": {
      const grouped=game.companies.map(c=>({company:c.id,count:game.purchaseSummary.filter(d=>d.company===c.id).reduce((sum,d)=>sum+d.count,0)}));
      return `<h2>${game.purchaseSummary.reduce((s,c)=>s+c.count,0)} tokens deployed this round</h2><div class="deployment-summary">${grouped.filter(d=>d.count>0).map(d=>`<article style="--company:${COMPANIES[d.company].color}"><h3>${co(d.company)}</h3><div class="deployed-cards" role="img" aria-label="${d.count} face-down deployed ${d.count===1?'token':'tokens'} for ${co(d.company)}"><span class="deployed-card" aria-hidden="true">${co(d.company).slice(0,2).toUpperCase()}</span></div><small>${d.count} ${d.count===1?'token':'tokens'}</small></article>`).join('')||'<p>No investment tokens deployed this round.</p>'}</div>${button("Reveal pile →","data-continue")}`;
    }
    case "reveal":
      return `<div class="title"><h2>${game.lastRevealed?.card ? `Reveal · ${game.drawsLeft} draw${game.drawsLeft===1?'':'s'} left` : "Before the reveal"}</h2>${button("Reveal next token →", "data-reveal")}</div>${revealHTML()}`;
    case "afterRevealReady":
      return `<h2>The reveal · last token resolved</h2><p>Unrevealed tokens stay in the bag.</p>${revealHTML()}${button('After the reveal powers →','data-continue')}`;
    case "phaseResult":
      return `<h2>${game.lastRevealed.stage==='start'?'Before the reveal':'After the reveal'} · ${co(game.lastRevealed.company)}</h2>${reactionTimeline(game.lastRevealed.reactions)}${button('Continue →','data-continue')}`;
    case "catchUpReady":
      return `<h2>${game.lastRevealed?.stage==='end'?'After reveal powers resolved':'Reveal · last card resolved'}</h2>${revealHTML()}${button('Catch-up →','data-continue')}`;
    case "catchUpResult":
      return `<h2>Catch-up · resolved</h2>${reactionTimeline(game.catchUpResult?.reactions??[])}${button('Finish round →','data-continue')}`;
    case "cycleResult":
      return `<div class="title"><h2>${game.ipoCompany!=null ? "IPO reached" : "Reveal complete"}</h2>${button(game.ipoCompany!=null ? "Resolve IPO →" : "Next round →", "data-continue")}</div>${revealSummaryHTML()}<small>${game.ipoCompany!=null ? `Final round complete. First arrival ranks first on a shared space. ${game.pile.length} undrawn tokens are unused; resolve the final exit.` : game.cycleEnd ? `${game.pile.length} undrawn tokens stay in the growth pile for the next round. Shares and cash carry into the next leg. Jenkins can also exit at IPO.` : `${game.pile.length} undrawn tokens stay in the growth pile. First player rotates clockwise; founder powers reset.`}</small>`;
    case "valueResult":
      return `<h2>Value card played</h2>${valueReceipt(game.valueResult)}${button('Continue →','data-continue')}`;
    case "settle":
      return `<h2>Final exit · ${human?"Your portfolio":fund(id)}</h2><p>The top ${game.rules.payoutPlaces} pay (Jenkins can also exit): ${game.settlement.podium.map(co).join(", ")}. On a shared space, the first arrival ranks first. </p><div class="bids">${game.companies.filter(c=>holdings(c,id)).map(c=>`<article>${co(c.id)}<strong>${holdings(c,id)} share${holdings(c,id)===1?'':'s'} × $${game.settlement.prices[c.id]}</strong></article>`).join("")}</div>${human?button("Collect exit proceeds →","data-final-sale"):""}`;
    case "legResult":
      if(!game.finalExit)return `<div class="title"><h2>Continue the race</h2>${button("Continue the race →","data-continue")}</div><p>Keep all shares and cash. Your accumulated obligation carries forward; repayment waits until the final exit.</p>`;
      return `<div class="title"><h2>Final accounts</h2>${button("Final scores →","data-continue")}</div><div class="bids">${game.settlement.accounts.map(a=>`<article>${fund(a.player)}<strong>${coin(a.cash-a.unpaid-capitalPenalty(game.players[a.player]))}</strong><small>Capital deduction $${capitalPenalty(game.players[a.player])}</small></article>`).join("")}</div>`;
    default:
      return "";
  }
}
const burnSummary=e=>e?.cards?.map(c=>`${co(c.company)} ${c.effect==='fumble'?'Fumble':c.signature?SPECIALS[c.company%6][0]:`+${c.printed}`}`).join(' · ')??'';
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
function capitalTrackHTML(p) {
 return `<ol class="capital-steps" aria-label="Capital track for ${FUNDS[p.id]}">${Array.from({length:7},(_,step)=>`<li class="${step===p.capital?'current':''}" ${step===p.capital?'aria-current="step"':''} title="−$${step*10} at exit">${step*10}</li>`).join('')}</ol>`;
}
function boardHTML() {
 return `<div class="table-layout"><div class="board-scroll"><main class="board">
 <svg class="race-track" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">${TRACK.map((cell,i)=>`<path class="band-${fundingBand(i+1)}" d="${cell.path}"/>`).join("")}</svg>
 ${TRACK.map((cell,i)=>`<div data-space="${i+1}" class="track-label band-${fundingBand(i+1)} ${cell.x<8||cell.x>92?'side-lane':''}" style="left:${cell.x}%;top:${cell.y}%"><header><b>${i+1}</b><span class="track-value">$${companyValue(i+1,game.rules)}</span></header><div class="space-pawns">${game.companies.filter(c=>(pinPower()?game.race?.startPositions?.[c.id]??c.position:c.position)===i+1).sort((a,b)=>pawnArrival(a)-pawnArrival(b)).map(pawnHTML).join("")}</div></div>`).join("")}

 <section class="centre">
 <div class="companies" style="--company-cols:${Math.ceil(game.companies.length/2)}">${game.companies.map(companyHTML).join("")}</div>
 ${game.companies.some(c=>c.position===0)?`<section class="start-area" aria-label="Start">Start · ${game.companies.filter(c=>c.position===0).map(pawnHTML).join("")}</section>`:""}
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
 const main=footer.querySelector('button[type="submit"], [data-continue], [data-reveal], [data-ai-power], [data-final-sale], [data-use-reid]')
  ?? (game.phase==='power'?footer.querySelector('[data-power="1"]'):null);
 if(main){main.classList.add('primary');footer.append(main);}
 const content=document.createElement('div');content.className='decision-content';
 while(panel.firstChild)content.append(panel.firstChild);
 panel.append(content,footer);
}
function paginateReactions(){
 const panel=document.querySelector('.decision');
 for(const [index,timeline] of [...panel.querySelectorAll('.reaction-timeline')].entries()){
  const items=[...timeline.children];if(items.length<2)continue;
  let page=Math.min(effectPages[index]??0,items.length-1);const nav=document.createElement('nav');nav.className='effect-pages';
  const prev=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span');
  prev.textContent='← Effect';next.textContent='Next effect →';
  const show=()=>{items.forEach((item,i)=>item.hidden=i!==page);count.textContent=`${page+1} / ${items.length}`;prev.disabled=page===0;next.disabled=page===items.length-1;};
  prev.onclick=()=>{page--;effectPages[index]=page;show();save();};next.onclick=()=>{page++;effectPages[index]=page;show();save();};nav.append(prev,count,next);
  (panel.querySelector('.decision-actions')??panel).prepend(nav);show();
 }
}
const pawnMotion=createPawnMotion(),animatePawns=pawnMotion.animatePawns,motionCleanup=pawnMotion.cancel;
function alignDrawer(){
 const scene=root.querySelector('.game-layout'),panel=root.querySelector('.decision'),table=root.querySelector('.tabletop');if(!scene||!panel||!table)return;
 const width=1450,minimumHeight=560;
 const availableHeight=Math.max(180,root.clientHeight-root.querySelector('.top').offsetHeight-root.querySelector('.funds').offsetHeight-panel.offsetHeight-32);
 const scale=Math.max(.1,Math.min((table.clientWidth-16)/width,(availableHeight-12)/minimumHeight));
 const height=(availableHeight-12)/scale;
 scene.style.setProperty('--table-height',`${height}px`);
 scene.style.setProperty('--mat-height','205px');
 scene.style.setProperty('--founder-width','129.285px');
 scene.style.width=`${width}px`;scene.style.height=`${height}px`;scene.style.left='50%';scene.style.top='6px';
 table.style.flex='1 1 0';table.style.height='auto';
 scene.style.setProperty('--scene-scale',scale);
 scene.style.transform=`translateX(-50%) scale(${scale})`;
 panel.style.width=`${Math.min(920,scene.querySelector('.board').offsetWidth*scale*.84)}px`;
 root.querySelector('.funds').style.width=`${Math.min(root.clientWidth-16,1200)}px`;
}
const layoutObserver=new ResizeObserver(alignDrawer);
function render() {
 if(game.phase!=='power'){revealedCardAccepted=false;phaseLogAccepted=0;}
 const oldScroll=document.querySelector('.tabletop');const scroll={top:oldScroll?.scrollTop??0,left:oldScroll?.scrollLeft??0};
 motionCleanup();
 clearTimeout(timer);
 const id=currentPlayer(game);
 const activeFund=game.phase==="auctionResult"?game.auction.host:id;
 root.innerHTML=`<header class="top"><div class="brand"><h1>Vests</h1><span class="version" aria-label="Loaded game version">v${UI_VERSION}</span></div><div class="status"><b>Round ${game.metrics.cycles}</b><span>${game.ipoCompany!=null?"Final round · IPO reached":"Finish the round at IPO"}</span></div><nav><a href="?variant=dice" class="variant-link">Dice version</a>${button("Supply","data-supply")}${button("Value cards","data-intel-catalogue")}${button("Founders","data-founders")}${button("Exit values","data-exits")}${button("Rules","data-rules")}${button("New game",'data-new class="primary"')}${button("History","data-history")}<label class="auto-control"><input type="checkbox" id="auto" ${auto?"checked":""}>Auto-play AI</label></nav></header><section class="funds" aria-label="Investors">${game.players.map(p=>`<article style="--tilt:${((p.id*3)%5-2)*.65}deg" class="fund ${p.id===0?"you":""} ${p.id===activeFund?"active":""}"><header><b>${fund(p.id)} ${p.id===0?"<em>YOU</em>":""}${p.id===activeFund?'<span class="turn-label">TURN</span>':""}${p.id===game.first?'<span class="turn-label">FIRST</span>':""}</b>${p.id===0 || game.ended ? coin(game.ended?game.scores[p.id]:availableCash(p)) : ""}</header>${!game.ended?`<small class="cash-status">Capital · −$${capitalPenalty(p)} at exit${game.rules.intelMode!=="off"?` · ${p.intel.length} card${p.intel.length===1?'':'s'}`:""}</small>${capitalTrackHTML(p)}`:""}</article>`).join("")}</section>${notice?`<p class="notice" role="alert">${esc(notice)}</p>`:""}<div class="tabletop"><div class="game-layout">${intelHandHTML()}<div class="board-column">${boardHTML()}</div><aside class="founder-market" aria-label="Available founders"><h2>Available founders</h2><div class="market-cards">${game.founderMarket.map(f=>founderCard(FOUNDERS[f],'tabletop-card')).join("")}</div></aside></div></div><section class="decision ${game.ended?'game-over':''} ${['reveal','afterRevealReady','catchUpReady','catchUpResult','valueResult'].includes(game.phase)?'movement-decision':game.phase.startsWith('intel')?'intel-decision':''}">${decision()}</section>`;
 const scroller=document.querySelector('.tabletop');scroller.scrollTop=scroll.top;scroller.scrollLeft=scroll.left;
 for(const label of root.querySelectorAll('.decision h2,.decision .title small'))label.innerHTML=label.innerHTML.replace(/(?:Before|After) the reveal|Reveal (?:start|end)|During (?:the )?reveal|Once per reveal/gi,'<mark class="reveal-timing">$&</mark>');
 arrangeDecision();paginateReactions();alignDrawer();layoutObserver.disconnect();layoutObserver.observe(document.querySelector('.tabletop'));layoutObserver.observe(root);bind();for(const input of root.querySelectorAll('.decision form input[name]')){const key=`${game.phase}:${commands.length}:${input.form.id}:${input.name}`;if(key in inputDrafts)input.value=inputDrafts[key];}save();schedule();
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
 const rows=COMPANIES.map((c,id)=>{
  const tokens=growthDeck(id),counts=new Map();
  for(const t of tokens){const label=t.effect==='fumble'?'Fumble':`${t.printed>0?'+':''}${t.printed}`;counts.set(label,(counts.get(label)??0)+1);}
  return `<article class="supply-reference" style="--company:${c.color}"><h3>${c.name}</h3><div>${[...counts].map(([label,count])=>`<span class="token-definition" title="${label==='Fumble'?'Fumble':label+' movement'}"><span class="growth-token used">${label==='Fumble'?'×':label}</span><b>× ${count}</b></span>`).join('')}</div><p>${tokens.length} tokens · ${tokens.reduce((sum,t)=>sum+t.printed,0)} printed · ${expectedTokenMovement(DECK_PROFILES[id]).toFixed(2)} expected movement</p></article>`;
 }).join('');
 const d=dialog("Company token mixes",`<p>Each company’s original 15-token set. These quantities stay the same in this reference throughout the game. × = Fumble. Expected movement accounts for tokens discarded to recover; it excludes founders and value cards.</p><div class="supply-reference-grid">${rows}</div>`);
 d.classList.add('token-guide');
}
function componentCatalogue(title,items,renderItem,className){
 const d=dialog(title,`<div class="catalogue-page"></div>`);d.classList.add(className,'paged-catalogue');
 const rows=4,columns=8,gap=10;
 const cardWidth=Math.floor(Math.min((innerWidth*.94-60-gap*(columns-1))/columns,(innerHeight*.94-92-gap*(rows-1))/rows/1.4));
 d.style.setProperty('--catalogue-card-width',`${cardWidth}px`);
 d.querySelector('.catalogue-page').innerHTML=items.map((item,i)=>`<button class="catalogue-item" data-inspect="${i}" aria-label="Inspect ${esc(className==='founder-guide'?FOUNDERS[item].name:INTEL_CARDS[item].name)}">${renderItem(item)}</button>`).join('');
 d.querySelectorAll('[data-inspect]').forEach(el=>el.onclick=()=>inspectCard(renderItem(items[Number(el.dataset.inspect)])));

}
function inspectCard(html){
 worker?.terminate();worker=null;clearTimeout(timer);const wasModal=modal;modal=true;
 const overlay=document.createElement('dialog');overlay.className='catalogue-inspector';
 overlay.innerHTML=`<header><h2>Card detail</h2>${button('Close detail','data-back')}</header>${html}`;
 document.body.append(overlay);overlay.showModal();const back=()=>{overlay.remove();modal=wasModal;if(!modal)schedule();};overlay.querySelector('[data-back]').onclick=back;overlay.addEventListener('cancel',e=>{e.preventDefault();back();});
}
function founders(){componentCatalogue('Meet the founders',ACTIVE_FOUNDERS,id=>founderCard(FOUNDERS[id]),'founder-guide');}

function rules() {
 const pawn=(cid,label=COMPANIES[cid].short)=>`<span class="rule-pawn" style="--company:${COMPANIES[cid].color}">${label}</span>`;
 const back=()=>'<span class="deployed-card rule-card-back" aria-label="Face-down growth token"></span>';
 const arrow='<span class="rule-arrow" aria-hidden="true">→</span>';
 const figure=(visual,caption)=>`<figure><div class="rulebook-illustration">${visual}</div><figcaption>${caption}</figcaption></figure>`;
 const pages=[
 ['The goal',`<p class="rulebook-lead">Build a portfolio. Finish with the most money.</p><p>Start with $20 and 3 random private value cards. Companies start on space 1, with one token each in the bag. A company is in your portfolio whenever you own a share.</p><p>No loans or repayments. Cash plus exit proceeds minus $10 per capital step determines your score.</p>`,figure(`${coin(20)}<span>+ 3 value cards</span>`,'Your starting fund.')],
 ['Your turn',`<p class="rulebook-lead">Take 2 actions, in any combination. Repeats are allowed.</p><p>Propose a fundraise for a company you lead (or one without a leader); change a founder in a company you lead; play or discard a value card and draw a replacement; gain $10 and advance your capital track once; or sell one share to the bank. If your hand is empty, spend one action to draw one value card.</p><p>A share sale pays $3 / $6 / $9 according to the company’s current leg. The bank keeps the share, which still dilutes exit proceeds.</p><p>Capital stops at 6. Each capital action grants $10; cards that lower the track reopen capacity. You start with $20. Each capital step subtracts $10 from your final score. Capital supplies liquidity, not victory points. Card effects target portfolio companies only. There are 2 copies of each card. Fresh Perspectives can grow your hand; there is no three-card hand limit. Recycle discards when needed.</p>`,figure('<strong>Action 1 → Action 2</strong>','A replacement card can be played with your next action.')],
 ['Fundraising',`<p class="rulebook-lead">Only the lead may propose funding. Everyone may bid.</p><p>Anyone may start a fundraise for a company without a leader. The proposal costs an action, whether or not you win. The winner receives one new share and pays the second-highest positive bid. A sole bidder pays their own bid. A tied proposer wins a top tie; other ties use open raises.</p><p>Immediately deploy payment ÷ 5, rounded up, from that company’s supply into the bag. If supply is short, deploy what remains. Five issued shares maximum. Any positive whole-dollar bid is valid at every position; $0 means pass. Only the payment is spent; the rest of a winning bid stays available.</p><p>Most shares leads the company; latest purchase breaks ties. Leadership controls founder replacement and optional powers.</p>`,figure(`${coin(9)}${arrow}<strong>2 tokens</strong>`,'Payment directly funds growth.')],
 ['The reveal',`<p class="rulebook-lead">Resolve before-reveal founders, mix the bag, then draw ${game.rules.revealsPerRound} tokens.</p><p>After the draws, discard ${game.rules.burnPerRound} random token${game.rules.burnPerRound===1?'':'s'} from the remaining bag, face up, without resolving it. If the bag is empty, skip the burn.</p><p>Numbered tokens move their company. Fumble tokens fumble it. Discard the next token drawn for a fumbled company to recover it; this uses a draw without replacement. Company special powers are removed.</p><p>Unrevealed tokens stay in the bag. Resolve after-reveal founders, then move companies on the lowest occupied space forward 1.</p>`,figure(`${back()}${arrow}<strong>${game.rules.revealsPerRound} draws</strong>`,'Undrawn tokens stay in the bag.')],
 ['Tokens & founders',`<p class="rulebook-lead">15 growth tokens per company, with recovery-adjusted movement close to 26.</p><p>Each company has a face-down supply pile and a used pile. Keep the two piles separate. Supply and Used counts are shown on the company mat; the reference screen shows the original token mix.</p><p>The steps before and after the token draws belong to the reveal phase. Harry may help once per round during this phase. Dan converts only one fumble per reveal. Fumbled founders are inactive unless their text says otherwise.</p><p>Replacing a founder costs one action and does not fumble the company. Founders resolve clockwise around the table. All companies on the furthest space lead; first arrival breaks rank ties.</p>`,figure('<strong>Used<br>↕ Bag gap<br>Supply</strong>','Keep token faces visually distinct.')],
 ['Shared terms',`<p><b>Portfolio company:</b> a company where you own at least 1 share.</p><p><b>Leading company:</b> a company on the furthest occupied space; ties count. <b>Lead investor:</b> the investor controlling a company.</p><p><b>Deploy:</b> move the stated number of face-down growth tokens from that company’s supply into the growth bag; mix the bag. All costs must be fulfilled: have enough money, supply tokens, value cards, capital steps and share slots.</p><p><b>Reveal:</b> draw a growth token from the bag and resolve it. A token discarded to recover still uses one of the ${game.rules.revealsPerRound} draws.</p><p><b>Discarded token:</b> a face-up token in a company’s used pile. Tokens removed from the game cannot be returned by a card.</p><p><b>Return to supply:</b> put returned growth tokens on the bottom of that company’s supply, unless a card says otherwise. Reid puts his chosen token on top.</p><p><b>Add 1 share:</b> place 1 of your round share tokens in the company. It must have a free slot below the 5-share limit. <b>Return 1 share:</b> remove your token to your own supply, reopening that slot.</p><p><b>Before / After the reveal:</b> the founder steps immediately before / after drawing tokens. Both are part of the reveal phase.</p>`,figure('<strong>Supply → Growth bag → Used</strong>','Every card names the destination when returning tokens.')],
 ['IPO & money',`<p class="rulebook-lead">Finish the full round, then check IPO.</p><p>If an unfumbled company finishes on space 24, settle. Otherwise play another round. Use two more companies than investors; the top half, rounded down, pay their track value divided among all issued shares. Jenkins can also exit for $75 from penultimate place.</p><p>Round each share payout down. Final cash plus proceeds minus $10 per capital step wins; tied scores share victory.</p>`,figure(`${coin(100)}<span>÷ 4 =</span>${coin(25)}`,'Four issued shares divide a $100 company equally.')]
 ];
 const d=dialog('How to play',`<nav class="rules-tabs" aria-label="Rules chapters">${pages.map(([title],i)=>button(`${i+1}. ${title}`,`data-rule-page="${i}"`)).join('')}</nav><section class="rules-page"></section><footer class="rules-paging">${button('← Previous','data-rule-prev')}<span data-rule-progress></span>${button('Next →','data-rule-next')}</footer>`);
 d.classList.add('rules-guide');let index=0;
 const show=i=>{index=i;const [title,text,art]=pages[i];d.querySelector('.rules-page').innerHTML=`<header class="rulebook-heading"><span>${String(i+1).padStart(2,'0')}</span><h2>${title}</h2></header><div class="rulebook-spread"><div class="rulebook-text">${text}</div><aside class="rulebook-art" aria-label="Examples">${art}</aside></div>`;d.querySelector('[data-rule-progress]').textContent=`${i+1} / ${pages.length}`;d.querySelector('[data-rule-prev]').disabled=i===0;d.querySelector('[data-rule-next]').disabled=i===pages.length-1;d.querySelectorAll('[data-rule-page]').forEach((b,n)=>b.setAttribute('aria-current',n===i?'page':'false'));};
 d.querySelectorAll('[data-rule-page]').forEach((b,i)=>b.onclick=()=>show(i));d.querySelector('[data-rule-prev]').onclick=()=>show(index-1);d.querySelector('[data-rule-next]').onclick=()=>show(index+1);show(0);
}
function newGame() {
  const d = dialog(
    "Set the table",
    `<form id="new"><label>Investors<select name="players">${[2, 3, 4].map((n) => `<option ${n === 4 ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Seed<input type="number" min="0" max="4294967295" name="seed" value="${Date.now() % 4294967295}"></label>${button("Start new game", 'type="submit"')}</form><div class="save-tools">${button("Save replay", "data-save")}<label class="file-button">Load replay<input type="file" accept="application/json" data-load></label></div><small>This version has its own save slot; earlier games are untouched.</small>`,
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
    announcedAction=null;effectPages=[];inputDrafts={};handPage=0;valuePage=0;valueCompany=null;scoutPicks.clear();
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
      announcedAction=null;effectPages=[];inputDrafts={};handPage=0;valuePage=0;valueCompany=null;scoutPicks.clear();
      setup = data.setup;
      commands = data.commands;
      game = next;
      revealedCardAccepted=false;phaseLogAccepted=0;
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
          `<p><small>Leg ${e.leg + 1} · cycle ${e.cycle}</small> ${e.type === "raiseMoney" ? `${fund(e.player)} gained $${e.cash} · capital track ${e.capital}` : e.type === "returnGrowth" ? `${e.count} Supply chain tokens returned to supply` : e.type === "auction" ? `${co(e.company)} · ${e.winner === null ? "no sale" : `${fund(e.winner)} paid $${e.paid}`}` : e.type === "returned" ? `${co(e.card.company)} · Julie returned the card to supply; draw used` : e.type === "deferred" ? `${co(e.card.company)} · card discarded to recover; draw used` : e.type === "reveal" ? (e.card.effect ? `${co(e.card.company)} · ${e.card.effect === "fumble" ? `Fumble` : `Go back · ${e.effect.before} → ${e.effect.after}`}` : `${co(e.card.company)} ✳ ${e.card.printed} · ${e.effect.before} → ${e.effect.after}`) : e.type === "purchases" ? `Deployed ${e.companies.reduce((s, c) => s + c.count, 0)} growth tokens` : e.type === "deploy" ? `${co(e.company)} deployed ${e.count} growth tokens` : e.type === "hedge" ? `Hedge fund backed ${co(e.company)} · reserve 3 · one bank share` : e.type === "burn" ? `${e.count} bag tokens discarded face up: ${burnSummary(e)}` : e.type === "carry" ? `${e.count} undrawn tokens retained in the pile` : e.type === "intelExchange" ? `${fund(e.player)} discarded ${INTEL_CARDS[e.discard].name} and drew a replacement` : e.type === "intelDraw" ? `${fund(e.player)} drew a private value card` : e.type === "intelPlay" ? `${fund(e.player)} played ${INTEL_CARDS[e.kind].name}${e.noEffect?' without effect':e.company===undefined?'':` on ${co(e.company)}`}` : e.type === "founderSwap" ? `${e.companies.map(co).join(" ↔ ")} swapped founders` : e.type === "founder" ? `${co(e.company)} hired ${FOUNDERS[e.founder].name}` : e.type === "opening" ? `Opening deal: ${e.cards.map(c=>`${co(c.company)} ✳${c.printed}`).join(" · ")}` : e.type === "cycle" ? "Funding cycle starts" : e.type === "checkpoint" ? (e.snapshot?.final ? "IPO settlement" : "Funding band advanced") : "Final obligation settled"}</p>`,
      )
      .reverse()
      .join("")}</div>`,
  );
}
function bind() {
  root.querySelector('[data-resolve-action]')?.addEventListener('click',()=>{const action=announcedAction;announcedAction=null;act(action.cmd,action.actor,true);});
  root.querySelectorAll('[data-select-value]').forEach(b=>b.onclick=()=>{valuePage=Number(b.dataset.selectValue);valueCompany=null;if(game.phase==='call')act({type:'valueAction'});else render();});
  const on = (s, fn) => root.querySelector(s)?.addEventListener("click", fn);
  on('[data-accept-rights]',()=>act({type:'rights',accept:true}));
  on('[data-pass-rights]',()=>act({type:'rights',accept:false}));
  on('[data-open-pass]',()=>act({type:'openBid',amount:0}));
  const openForm=root.querySelector('#open-bid');if(openForm)openForm.onsubmit=e=>{e.preventDefault();act({type:'openBid',amount:Number(new FormData(e.target).get('amount'))});};
  on('[data-hand-prev]',()=>{handPage--;render();});on('[data-hand-next]',()=>{handPage++;render();});
  on('[data-value-prev]',()=>{valuePage--;valueCompany=null;render();});on('[data-value-next]',()=>{valuePage++;valueCompany=null;render();});
  const targetSelect=root.querySelector('[data-value-company]');if(targetSelect)targetSelect.onchange=()=>{valueCompany=Number(targetSelect.value);render();};
  on("[data-rules]", rules);
  root.querySelectorAll("[data-supply]").forEach(b=>b.addEventListener("click",supply));
  on("[data-intel-catalogue]",()=>componentCatalogue('Value cards · 2 copies each',Object.keys(INTEL_CARDS),kind=>intelCardHTML({kind}),'value-catalogue'));
  on("[data-exits]", exits);
  on("[data-founders]", founders);
  on("[data-final-sale]",()=>act({type:"sell",shares:game.companies.map(c=>holdings(c,0))}));
  root.querySelectorAll("[data-change-founder]").forEach(b=>b.onclick=()=>act({type:"changeFounder",company:Number(b.dataset.changeFounder),discard:Number($("#turn-discard")?.value)}));
  root.querySelectorAll('[data-order-intel]').forEach(b=>b.onclick=()=>act({type:'orderIntel',order:b.dataset.orderIntel.split(',').map(Number)}));
  root.querySelectorAll('[data-exchange-value]').forEach(b=>b.onclick=()=>act({type:'exchangeValue',card:Number(b.dataset.exchangeValue)}));
  on('[data-phase-reviewed]',()=>{phaseLogAccepted=game.race.log.length;render();});
  on('[data-show-reactions]',()=>{revealedCardAccepted=true;render();});
  root.querySelectorAll('[data-scout-page]').forEach(b=>b.onclick=()=>{scoutPage=Number(b.dataset.scoutPage);render();});
  root.querySelectorAll('input[name="discard-growth"]').forEach(input=>input.onchange=()=>{input.checked?scoutPicks.add(Number(input.value)):scoutPicks.delete(Number(input.value));render();});
  on('[data-discard-growth]',()=>act({type:'scoutIntel',choices:[...scoutPicks]}));
  on("[data-pass-value]",()=>act({type:'passValue'}));
  root.querySelectorAll('[data-play-intel]').forEach(b=>b.onclick=()=>{
 const cmd={type:'playIntel',card:Number(b.dataset.playIntel),company:Number(b.dataset.intelCompany),target:b.dataset.intelTarget===undefined?undefined:Number(b.dataset.intelTarget)},id=currentPlayer(game),kind=game.players[id].intel[cmd.card].kind;
 const secondChoice=root.querySelector('[data-value-second]');if(secondChoice)cmd.target=secondChoice.value===''?undefined:Number(secondChoice.value);
 if(!['session','advice','stake','rights'].includes(kind)){act(cmd);return;}
 const second=root.querySelector('[data-value-second]');if(second)cmd.target=second.value===''?undefined:Number(second.value);
 const choices=expansionChoices(game,id,cmd.card,cmd.company);
 if(kind==='rights'){
  const min=choices[0].price,d=dialog('Name your Rights Issue price',`<p>Name a price you can pay. If everybody passes, you must buy at that price.</p><form id="rights-price"><label>Price <input name="price" type="number" min="${min}" max="${availableCash(game.players[id])}" step="1" value="${min}" required></label><button type="submit">Offer shares</button></form>`);
  d.querySelector('form').onsubmit=e=>{e.preventDefault();const price=Number(new FormData(e.target).get('price'));close();act({...cmd,price});};return;
 }
 const label=choice=>kind==='session'?FOUNDERS[game.founderMarket[choice.founder]].name:kind==='advice'?INTEL_CARDS[game.players[id].intel[choice.discard].kind].name:FUNDS[choice.seller];
 const d=dialog(kind==='session'?'Choose a public founder':kind==='advice'?'Discard an additional card':'Choose the seller',`<select data-card-extra>${choices.map((choice,i)=>`<option value="${i}">${esc(label(choice))}</option>`).join('')}</select><button data-confirm-extra>Confirm</button>`);
 d.querySelector('[data-confirm-extra]').onclick=()=>{const extra=choices[Number(d.querySelector('[data-card-extra]').value)];close();act({...cmd,...extra});};
 });
  root.querySelectorAll('[data-scout-intel]').forEach(b=>b.onclick=()=>act({type:'scoutIntel',choice:Number(b.dataset.scoutIntel)}));
  on("[data-new]", newGame);
  on("[data-history]", history);
  on("[data-continue]", () => act({ type: "continue" }));
  on("[data-ai-power]", () => {worker?.terminate();worker=null;act({type:"power",choice:choosePower(game)});});
  on("[data-reveal]", () => act({ type: "reveal" }));
  on("[data-pass]", () => act({ type: "bid", amount: 0 }));
  on("[data-withdraw]", () => act({ type: "tie", amount: 0 }));
  root.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>act({type:'call',company:Number(b.dataset.call),discard:Number($("#turn-discard")?.value)}));
  on('[data-pass-turn]',()=>act({type:'pass'}));
  on('[data-raise-money]',()=>act({type:'raiseMoney'}));
  on('[data-draw-value]',()=>act({type:'drawValue'}));
  on('[data-value-action]',()=>act({type:'valueAction'}));
  on('[data-cancel-value]',()=>act({type:'cancelValue'}));
  root.querySelectorAll('[data-sell-share]').forEach(b=>b.onclick=()=>act({type:'sellShare',company:Number(b.dataset.sellShare)}));
  root
    .querySelectorAll("[data-founder]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          act({ type: "founder", choice: Number(b.dataset.founder) })),
    );
  root.querySelector("[data-use-reid]")?.addEventListener("click",()=>act({type:"power",choice:Number(root.querySelector("#reid-token").value)}));
  root.querySelectorAll("[data-power]").forEach(b=>b.onclick=()=>act({type:"power",choice:Number(b.dataset.power)}));
  root.querySelector("#auto").onchange = (e) => {
    auto = e.target.checked;save();
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
  if (announcedAction || modal || game.ended || !auto || worker || needsCardReveal() || needsPhaseReview()) return;
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
root.addEventListener('input',e=>{const input=e.target;if(input.matches('.decision form input[name]')){inputDrafts[`${game.phase}:${commands.length}:${input.form.id}:${input.name}`]=input.value;save();}});
render();

document.fonts.ready.then(alignDrawer);

document.addEventListener('click',e=>{const el=e.target.closest('[data-read-founder]');if(el&&!el.closest('.catalogue-page,.catalogue-inspector')){e.preventDefault();e.stopPropagation();inspectCard(founderCard(FOUNDERS[Number(el.dataset.readFounder)]));}});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-read-founder]')){e.preventDefault();e.target.click();}});
