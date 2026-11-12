import json,sys,statistics,random,html
from pathlib import Path
from collections import Counter
D=Path(sys.argv[1]); rows=[json.loads(l) for l in (D/'games.jsonl').read_text().splitlines()]; good=[r for r in rows if r['status']=='complete']; M=json.loads((D/'manifest.json').read_text()); arms=[a['id'] for a in M['arms']]
mean=lambda a:statistics.mean(list(a))
def table(h,rs):return '<table><tr>'+''.join('<th>'+str(v)+'</th>' for v in h)+'</tr>'+''.join('<tr>'+''.join('<td>'+str(v)+'</td>' for v in r)+'</tr>' for r in rs)+'</table>'
def ci(v):
 rng=random.Random(150);a=sorted(mean(rng.choices(v,k=len(v))) for _ in range(4000));return a[100],a[3899]
summaries={}; main=[]; actions=[]; pairs=[]
for p in [2,3,4]:
 for arm in arms:
  rs=[r for r in good if r['players']==p and r['arm']==arm]; prices=[v for r in rs for v in r['prices']]; fin=[r for r in rs if r['endReason']=='finish']
  s=dict(games=len(rs),finish=mean(r['endReason']=='finish' for r in rs),spread=mean(r['spread'] for r in rs),price=mean(prices),concentration=mean(r['concentration'] for r in rs),rounds=mean(r['rounds'] for r in rs),noSale=sum(r['noSales'] for r in rs)/sum(r['auctions'] for r in rs),finishSpread=mean(r['spread'] for r in fin) if fin else None)
  summaries[f'{p}-{arm}']=s
  main.append([p,arm,len(rs),f"{s['finish']:.1%}",f"{s['spread']:.2f}",f"${s['price']:.2f}",f"{s['concentration']:.1%}",f"{s['rounds']:.2f}",f"{s['noSale']:.1%}"])
  actions.append([p,arm,*[f"{mean(r['actions'][k] for r in rs):.2f}" for k in ['raiseMoney','valueAction','changeFounder','passAction']],f"{s['finishSpread']:.2f}"])
 for a,b in [('24-legacy','20-legacy'),('20-legacy','20-planner')]:
  for metric in ['finish','spread','meanPaid','concentration']:
   v=[]
   for seed in M['seeds']:
    ds=[]
    for cohort in M['cohorts']:
     group={r['arm']:r for r in good if r['players']==p and r['seed']==seed and r['cohort']==cohort}
     f=lambda r:float(r['endReason']=='finish') if metric=='finish' else r[metric]
     if a in group and b in group:ds.append(f(group[b])-f(group[a]))
    if len(ds)==2:v.append(mean(ds))
   lo,hi=ci(v); scale=100 if metric in ['finish','concentration'] else 1
   pairs.append([p,b+' minus '+a,metric,f'{scale*mean(v):+.2f}',f'{scale*lo:+.2f} to {scale*hi:+.2f}'])
summary={'groups':summaries,'pairedDeltas':pairs};(D/'summary.json').write_text(json.dumps(summary,indent=2))
b='<h1>$20 per share and situational support decisions</h1><p>Vests v150 · 10 November 2026 · 360 games · 20 seeds × 2 cohorts × 3 player counts × 3 arms.</p>'
b+='<p><strong>The fixed priority is gone. Founder changes increased from 0.60 to 3.54 per game at $20/share. This did not establish a balance improvement: mean spread increased from 8.46 to 9.48 spaces, while reaching 24 stayed near 52%.</strong></p>'
b+='<p>The new default pays $20 per share on space 24. Earlier prices scale the prior $24 curve by 20/24, rounded to whole coins; spaces 0–10 still pay zero. Jenkins retains his special $75 total alternative. All other rules remain unchanged.</p><nav><a href="#results">Results</a> · <a href="#actions">Actions</a> · <a href="#uncertainty">Paired changes</a> · <a href="#reviews">Ten replay reviews</a></nav>'
b+='<h2 id="results">Controlled results</h2><p>24-legacy and 20-legacy use the old support priority. 20-planner compares complete support choices. Each row contains 20 self-play and 20 mixed-policy games. Self-play uses diversification; mixed seats alternate diversification/concentration.</p>'+table(['Players','Arm','Games','Reached 24','Spread','Paid/auction','Largest holding','Rounds','No sales'],main)
b+='<p>Spread is the first-to-last distance at settlement. Largest holding is the fraction of an investor’s shares in their largest company, averaged across investors and games. Auction price pools sold auctions only. No-sales are auctions with no winner. These are simulated policy outcomes, not predictions of expert human play.</p>'
b+='<h2 id="actions">Support actions per game</h2>'+table(['Players','Arm','Capital calls','Value actions','Founder changes','Passes','Spread in finishes'],actions)
b+='<p>Across all player counts, lowering the payout with the old policy reduced mean auction price from $8.33 to $7.41 and finish rate from 60.8% to 51.7%. Changing the policy at $20 reduced price further to $6.64 and raised finish rate slightly to 52.5%. Capital calls fell from 5.79 to 3.87 and value actions from 13.52 to 10.30 per game. This is a changed allocation of actions, not evidence that more founder changes automatically improve play.</p>'
b+='<h2 id="uncertainty">Paired changes and uncertainty</h2>'+table(['Players','Comparison','Metric','Change','95% interval'],pairs)
b+='<p>Intervals bootstrap 20 matched seed clusters, averaging the self/mixed cohorts within each seed. Finish and concentration are percentage-point changes; meanPaid compares game-average prices, unlike the pooled main table. Same starting seeds do not preserve later dice once choices diverge. Small exploratory sample, no multiple-comparison adjustment. Read each player count separately; pooled figures above weight counts equally.</p>'
b+='<h2>How the bot now compares choices</h2><p>Each legal card/target combination, each led-company/public-founder replacement, calling capital and passing are evaluated on the same two sampled hidden states. The real engine resolves each candidate and continues through the round. The score is projected net wealth minus the strongest opponent’s projected wealth, including called-capital obligations and the selected payout curve. The follow-up card/founder drawer uses the same samples and ranking. Private opponent hands and actual RNG/deck order are not consulted.</p><p>Limits: two samples, one-round lookahead, at most 240 continuation commands, neutral $20 estimates for opponents’ hidden cash, and cheap continuation heuristics. Remaining investment values are forecasts, not full-game searches. Price-setting cards currently use their minimum legal price. Close half-point differences can be noise. This study compares whole tables using each policy; it does not prove the new planner beats the old one head-to-head.</p>'
b+='<h2>What still prevents tight races</h2><p>The reviewed traces show three recurring causes: repeated rows can fund leaders several times; Anya, Mura and reactive powers add movement outside those auctions; zero-bid auctions remove potential growth from low-value companies. The planner calls capital less often, and several reviewed seats remain cash-poor while choosing other actions. Its neutral opponent-cash estimate and short horizon can underestimate the need to replenish liquidity. Catch-up still executes, but +1 cannot necessarily match several pairs of dice or recurring founder powers.</p><p>Next useful bot test: improve hidden-cash estimates from public cash flows and compare a deeper search on the same decision fixtures. Then run mixed old/new-policy tables. Avoid changing race mechanics solely because this bounded planner selects more founders.</p>'
names=json.loads(Path('docs/dice-payout-v149/run-01/card-names.json').read_text()) if Path('docs/dice-payout-v149/run-01/card-names.json').exists() else {}
counts={a:Counter(v for r in good if r['arm']==a for v in r['values']) for a in arms}; exposure={a:Counter(v for r in good if r['arm']==a for v in r['valueExposures']) for a in arms}
b+='<h2>Value-card usage</h2><p>Each cell is plays / hand appearances at support-action opportunities across 120 games. The same held card can appear repeatedly; this is not a unique-card probability or a strength ranking.</p>'+table(['Card',*arms],[[html.escape(names.get(k,k)),*[f'{counts[a][k]} / {exposure[a][k]}' for a in arms]] for k in sorted(set().union(*(set(v) for v in counts.values())))])
reviews=json.loads((D/'reviews.json').read_text());b+='<h2 id="reviews">Ten complete replay reviews</h2>'
for r in reviews:b+='<article><h3>'+r['game']+'</h3><p>'+html.escape(r['review'])+'</p><a href="samples/'+r['game']+'.json">Full commands, candidate scores and events</a> · <a href="samples/'+r['game']+'.compact.txt">Chronological transcript</a></article>'
plans=[p for f in (D/'samples').glob('*.json') for d in json.loads(f.read_text())['decisions'] for p in d.get('plans',[])]; ev=[e for p in plans for e in p['evaluations']]
b+=f'<h2>Reliability</h2><p>{len(good)}/{len(rows)} completed; {sum(r["status"]=="failed" for r in rows)} failed; {sum(r["status"]=="censored" for r in rows)} censored. Ten preselected full games independently replayed commands, logs and scores. Their {len(plans)} logged planning calls evaluated {len(ev)} candidates; {sum(e["censored"] for e in ev)} sampled continuations hit the search cap. Planner cap counts apply only to those ten traces. The seven-round game cap is a normal ending, not censoring.</p>'
b+='<p><a href="manifest.json">Frozen protocol</a> · <a href="games.jsonl">All game records</a> · <a href="summary.json">Summary</a> · <a href="runtime.json">Runtime</a> · <a href="source/src/dice-planner.js">Frozen planner</a></p><pre>node scripts/support-study.js NEW_DIRECTORY\nnode scripts/payout-compact.mjs RUN_DIRECTORY\npython3 scripts/support-report.py RUN_DIRECTORY</pre><p>The report generator also requires reviews.json (human-readable replay analysis). Source SHA-256: '+M['source']+'</p>'
(D/'report.html').write_text('<!doctype html><meta charset="utf-8"><title>Vests · $20 and support planner</title><style>body{font:17px/1.5 system-ui;margin:40px auto;padding:0 25px;max-width:1200px;background:#faf9f5;color:#232923}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}th,td{text-align:left;padding:9px;border-bottom:1px solid #d5dcd5}th,nav{background:#e2ece5}tr:nth-child(even),article{background:white}h2{margin-top:45px}a{color:#285845}article,nav{padding:20px;margin:15px 0}pre{white-space:pre-wrap}</style>'+b)
print(json.dumps(summary,indent=2))
