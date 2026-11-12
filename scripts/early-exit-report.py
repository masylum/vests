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
  s=dict(games=len(rs),finish=mean(r['endReason']=='finish' for r in rs),spread=mean(r['spread'] for r in rs),price=mean(prices),concentration=mean(r['concentration'] for r in rs),diversity=mean(r['diversity'] for r in rs),hhi=mean(r['hhi'] for r in rs),companyFinish=mean(sum(p>=24 for p in r['positions'])/len(r['positions']) for r in rs),rounds=mean(r['rounds'] for r in rs),noSale=sum(r['noSales'] for r in rs)/sum(r['auctions'] for r in rs),finishSpread=mean(r['spread'] for r in fin) if fin else None)
  summaries[f'{p}-{arm}']=s
  main.append([p,arm,len(rs),f"{s['finish']:.1%}",f"{s['spread']:.2f}",f"${s['price']:.2f}",f"{s['concentration']:.1%}",f"{s['diversity']:.2f}",f"{s['rounds']:.2f}",f"{s['noSale']:.1%}"])
  actions.append([p,arm,*[f"{mean(r['actions'][k] for r in rs):.2f}" for k in ['raiseMoney','valueAction','changeFounder','passAction']],f"{s['finishSpread']:.2f}"])
 for a,b in [('late-free','early5-free'),('early4-free','early5-free'),('early5-free','early5-capital')]:
  for metric in ['finish','spread','meanPaid','concentration','diversity']:
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
esc=html.escape
pooled={}
for arm in arms:
 rs=[r for r in good if r['arm']==arm];pooled[arm]={'finish':mean(r['endReason']=='finish' for r in rs),'spread':mean(r['spread'] for r in rs),'price':mean(v for r in rs for v in r['prices']),'concentration':mean(r['concentration'] for r in rs),'diversity':mean(r['diversity'] for r in rs),'rounds':mean(r['rounds'] for r in rs)}
summary['pooled']=pooled;(D/'summary.json').write_text(json.dumps(summary,indent=2))
b='<h1>Paying laggards earlier</h1><p>Vests v152 · 10 November 2026 · '+str(len(rows))+' attempted games · four controlled versions · 2–4 players.</p>'
if (D/'findings.html').exists():b+=(D/'findings.html').read_text()
b+='<nav><a href="#results">Results</a> · <a href="#deltas">Paired comparisons</a> · <a href="#cards">Cards and actions</a> · <a href="#reviews">Ten replay reviews</a></nav>'
b+='<h2>What changed</h2><ul><li><b>late-free:</b> v150’s late-paying curve, $0 through space 10, $20 at space 24; starting cash has no exit obligation.</li><li><b>early4-free:</b> v151’s $1 at space 4, +$1/space, $21 at space 24; no initial obligation.</li><li><b>early5-free:</b> $1 at space 5, +$1/space, $20 at space 24; no initial obligation. Comparing this with late-free isolates the curve at the same maximum payout.</li><li><b>early5-capital:</b> current rules: early5 plus $20 initial called capital. Starting cash remains $20. This obligation may be reduced by the existing capital-reduction cards.</li></ul><p>All arms use the same support planner, auction valuations, founder/value effects, finite eight-card company decks, companies = players + 2, row = companies − 1, sequential dice, last-place catch-up, and seven-round cap. The current UI removes the company Exit/share box; track values remain visible. No old aggregate results are mixed into this new run.</p>'
b+='<h2>Price at selected spaces · per share</h2>'+table(['Space','Late curve','Space-4 curve','Current space-5 curve'],[[4,0,1,0],[5,0,2,1],[8,0,5,4],[12,2,9,8],[16,5,13,12],[20,12,17,16],[24,20,21,20]])+'<p>The current curve lifts middle and lower positions substantially while keeping the late curve’s $20 maximum. It changes the incentive to invest; it does not directly add movement.</p>'
b+='<h2 id="results">Results by player count</h2>'+table(['Players','Arm','Games','Games reaching 24','Mean spread','Paid/auction','Largest holding','Companies owned','Rounds','No sales'],main)
b+='<p>Each row contains 12 self-play and 12 mixed-policy games. Spread = max minus min final spaces. Largest holding = each investor’s largest company share count divided by all their shares, averaged across investors and games; lower means less concentrated. Companies owned counts distinct holdings. Price pools sold auctions; no-sales are excluded from price and reported separately.</p>'
b+='<h2 id="deltas">Paired differences</h2>'+table(['Players','Comparison','Metric','Change','95% interval'],pairs)
b+='<p>Paired bootstrap over 12 matched seed clusters, averaging self/mixed cohorts within each seed. Finish and concentration differences are percentage points; meanPaid uses per-game mean sold price, unlike the pooled main table. These small exploratory intervals are imprecise and not corrected for multiple comparisons. Same setup seed does not preserve later rolls once choices diverge. Higher prices are not automatically healthier unless investors also earn adequate returns.</p>'
pace=[]
for p in [2,3,4]:
 for arm in arms:
  rs=[r for r in good if r['players']==p and r['arm']==arm];s=summaries[f'{p}-{arm}'];sp=sorted(r['spread'] for r in rs)
  pace.append([p,arm,f"{s['companyFinish']:.1%}",f"{s['finishSpread']:.2f}",f"{sp[len(sp)//2]} / {sp[int(.9*(len(sp)-1))]}",f"{s['hhi']:.3f}",sum(r['endReason']=='roundLimit' for r in rs),f"{mean(v for r in rs for v in r['scores']):.1f}"])
b+='<h2>Finish frequency, tails and returns</h2>'+table(['Players','Arm','Companies at 24','Spread in finishes','Spread median/p90','Holding HHI','Round-cap games','Mean net score'],pace)+'<p>Companies at 24 counts final company positions, not games with at least one finish. A company may touch 24 and retreat during the final reveal, so that rate differs from the game-ending trigger. HHI is the sum of squared holding fractions; lower means more diversified. Net score deducts all called capital, including initial capital in the current arm.</p>'
b+='<h2 id="cards">Support actions per game</h2>'+table(['Players','Arm','Capital calls','Value actions','Founder changes','Passes','Spread in finishes'],actions)
names=json.loads(Path('docs/dice-payout-v149/run-01/card-names.json').read_text());counts={a:Counter(v for r in good if r['arm']==a for v in r['values']) for a in arms};exposures={a:Counter(v for r in good if r['arm']==a for v in r['valueExposures']) for a in arms}
b+='<h2>Value-card plays / hand appearances</h2>'+table(['Card',*arms],[[esc(names.get(k,k)),*[f'{counts[a][k]} / {exposures[a][k]}' for a in arms]] for k in sorted(set().union(*(set(v) for v in counts.values())))])+'<p>Hand appearances count each card present at a support-action opportunity, including repeated appearances of the same held card. This is an exposure measure, not a unique-card play probability or causal strength ranking.</p>'
policies=[]
for p in [2,3,4]:
 for arm in arms:
  for policy in ['concentration','diversification']:
   seats=[(r,i) for r in good if r['players']==p and r['arm']==arm and r['cohort']=='mixed' for i,x in enumerate(r['policies']) if x==policy]
   policies.append([p,arm,policy,len(seats),f"{mean((1/len(r['winners']) if i in r['winners'] else 0) for r,i in seats):.1%}"])
b+='<h2>Mixed-policy seat results</h2>'+table(['Players','Arm','Policy','Seat-games','Split win rate'],policies)+'<p>Policies share support/auction logic and differ chiefly in which companies they fund. Seats alternate by seed, and ties split win credit. These are bounded bot strategies, not expert human diversification/concentration.</p>'
b+='<h2>Bot budget and limits</h2><p>Each support choice uses the real engine, two identical sampled hidden states across candidates, and one round of continuation, capped at 240 commands. The planner then forecasts remaining portfolio value from public supply. It considers founder replacements, card/target combinations, capital calls and passing. Opponent hidden cash is estimated at $20, and their initial obligation uses the arm’s known setup; later hidden capital changes are not inferred. Continuations use cheaper heuristics. Some continuation card heuristics still use classic positional values. Price-setting cards use their minimum legal offer. Results are evidence about these bots under these rules, not optimal play or human enjoyment.</p>'
b+='<h2 id="reviews">Ten complete current-rules replays</h2>'
for r in json.loads((D/'reviews.json').read_text()):b+='<article><h3>'+r['game']+'</h3><p>'+esc(r['review'])+'</p><a href="samples/'+r['game']+'.json">Full commands, candidate scores and events</a> · <a href="samples/'+r['game']+'.compact.txt">Chronological transcript</a></article>'
plans=[p for f in (D/'samples').glob('*.json') for d in json.loads(f.read_text())['decisions'] for p in d.get('plans',[])];ev=[e for p in plans for e in p['evaluations']]
b+=f'<h2>Reliability and reproduction</h2><p>{len(good)}/{len(rows)} completed; {sum(r["status"]=="failed" for r in rows)} failed; {sum(r["status"]=="censored" for r in rows)} censored. Ten preselected current-rules games independently replayed commands, logs and scores. Their {len(plans)} planning calls evaluated {len(ev)} candidates, with {sum(e["censored"] for e in ev)} sampled continuations hitting the search cap. The seven-round ending is normal completion, not censoring. No numeric spread target was chosen; lower spread, meaningful diversification and finishes are desired directions.</p>'
b+='<p><a href="manifest.json">Protocol</a> · <a href="games.jsonl">All records</a> · <a href="summary.json">Summary</a> · <a href="runtime.json">Runtime</a> · <a href="source/src/live-dice-rules.js">Frozen rules</a> · <a href="source/src/dice-planner.js">Frozen planner</a></p><pre>node scripts/early-exit-study.js NEW_DIRECTORY\nnode scripts/payout-compact.mjs RUN_DIRECTORY\npython3 scripts/early-exit-report.py RUN_DIRECTORY</pre><p>The report requires reviews.json and optionally findings.html, written after reading the traces. Frozen source SHA-256: '+M['source']+'</p>'
(D/'report.html').write_text('<!doctype html><meta charset="utf-8"><title>Vests · earlier exits</title><style>body{font:17px/1.5 system-ui;margin:40px auto;padding:0 25px;max-width:1300px;background:#faf9f5;color:#232923}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}th,td{text-align:left;padding:9px;border-bottom:1px solid #d5dcd5}th,nav{background:#e2ece5}tr:nth-child(even),article{background:white}h2{margin-top:45px}a{color:#285845}article,nav{padding:20px;margin:15px 0}pre{white-space:pre-wrap}</style>'+b)
print(json.dumps(summary,indent=2))
