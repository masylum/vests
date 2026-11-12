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
  actions.append([p,arm,*[f"{mean(r['actions'][k] for r in rs):.2f}" for k in ['raiseMoney','valueAction','changeFounder','passAction']],f"{s['finishSpread']:.2f}" if s['finishSpread'] is not None else '—'])
 for a,b in [('previous','danilo-one'),('danilo-one','secret')]:
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
companies=['Gogol','Amazin','Weta','Novidia','Testra','Obenay']
def quant(v,p):return sorted(v)[int(p*(len(v)-1))]
pooled={}
for arm in arms:
 rs=[r for r in good if r['arm']==arm];pooled[arm]={'finish':mean(r['endReason']=='finish' for r in rs),'spread':mean(r['spread'] for r in rs),'price':mean(v for r in rs for v in r['prices']),'concentration':mean(r['concentration'] for r in rs),'diversity':mean(r['diversity'] for r in rs),'sharesPerPlayer':mean(sum(r['shares'])/r['players'] for r in rs),'boughtPerPlayer':mean(sum(r['boughtByPlayer'])/r['players'] for r in rs),'bonusPerPlayer':mean(mean(r['bonusPayouts']) for r in rs)}
summary['pooled']=pooled
companyRows=[];holdingRows=[];bonusRows=[]
for p in [2,3,4]:
 for arm in arms:
  rs=[r for r in good if r['players']==p and r['arm']==arm]
  for c in range(p+2):
   bought=[r['boughtByCompany'][c] for r in rs];held=[r['shares'][c] for r in rs];paid=[a['paid'] for r in rs for a in r['auctionDetails'] if a['winner'] is not None and a['company']==c]
   companyRows.append([p,arm,companies[c],f'{mean(bought):.2f}',f'{min(bought)}–{max(bought)}',f'{mean(held):.2f}',f'{mean(paid):.2f}' if paid else '—'])
  for seat in range(p):
   shares=[sum(r['portfolios'][seat]) for r in rs];buys=[r['boughtByPlayer'][seat] for r in rs]
   holdingRows.append([p,arm,seat+1,f'{mean(buys):.2f}',f'{mean(shares):.2f}',f'{quant(shares,.5)} / {quant(shares,.9)}',f'{min(shares)}–{max(shares)}',f'{mean(r["bonusPayouts"][seat] for r in rs):.2f}'])
  if arm=='secret':
   for band in ['plus5','plus3','other']:
    count=0;total=0;held=0
    for r in rs:
     for a in r['auctionDetails']:
      if a['winner'] is None:continue
      card=r['secretCards'][a['winner']];kind='plus5' if a['company']==card['plus5'] else 'plus3' if a['company']==card['plus3'] else 'other'
      count+=kind==band;total+=1
     for i,port in enumerate(r['portfolios']):
      card=r['secretCards'][i];held+=sum(n for c,n in enumerate(port) if ('plus5' if c==card['plus5'] else 'plus3' if c==card['plus3'] else 'other')==band)
    bonusRows.append([p,band,count,f'{count/total:.1%}',f'{held/(len(rs)*p):.2f}'])
summary['companyShares']=companyRows;summary['investorShares']=holdingRows;summary['bonusAllocation']=bonusRows
(D/'summary.json').write_text(json.dumps(summary,indent=2))
b='<h1>Secret investments and Danilo’s one-space reaction</h1><p>Vests v153 · 11 November 2026 · '+str(len(rows))+' attempted games · 12 seeds × 2 cohorts × 3 player counts × 3 arms.</p>'
if (D/'findings.html').exists():b+=(D/'findings.html').read_text()
if M.get('reusedControls'):b+='<p>Controls were reused from the frozen run-01 pilot; only the secret-card seed shuffle changed before run-02. All 72 secret-card games were rerun. The pilot secret games are excluded. <a href="../run-01/manifest.json">Control provenance</a>.</p>'
b+='<nav><a href="#results">Race and auctions</a> · <a href="#companies">Company shares</a> · <a href="#investors">Investor holdings</a> · <a href="#reviews">Ten replays</a></nav><h2>Rules and comparison</h2><p><b>previous</b> uses v152 rules: early payouts ($1 at space 5 through $20 at 24), $20 repayable initial capital, no secret cards and Danilo following a companion’s full move. <b>danilo-one</b> changes only Danilo to advance one space when a companion moves, even backward. <b>secret</b> adds the private exit bonuses and is the current game.</p><p>One bonus card per active company (4, 5 or 6). Each grants +$5/share to its company and +$3/share to the next company, wrapping around. Cards are shuffled without replacement on a separate deterministic seed stream and one is dealt to each investor. Undealt cards remain hidden. Bonuses pay only at settlement, including on a $0 printed exit, and apply only to their holder’s shares. Bots know their own card; support forecasts sample compatible opponent cards without reading the actual assignments.</p><h2 id="results">Results by player count</h2>'+table(['Players','Arm','Games','Games reaching 24','Mean spread','Paid/auction','Largest holding','Companies owned','Rounds','No sales'],main)
b+='<p>Each row is 12 self-play plus 12 mixed-policy games. Spread is max minus min final space. Largest holding is each investor’s largest company holding divided by all their shares, averaged per game; lower means less concentration. Companies owned counts distinct holdings. Auction prices pool successful auctions only.</p><h2>Paired differences</h2>'+table(['Players','Comparison','Metric','Change','95% interval'],pairs)+'<p>Bootstrap over 12 matched seed clusters, averaging self/mixed cohorts per seed. Finish/concentration differences are percentage points; price deltas use per-game mean prices. Small exploratory sample, no multiple-comparison correction. Matching setup seeds do not preserve subsequent rolls after choices diverge.</p>'
b+='<h2 id="companies">Shares bought and outstanding, by company</h2>'+table(['Players','Arm','Company','Auction purchases/game','Purchase range','Final shares/game','Paid/share'],companyRows)+'<p>Purchases count successful auctions, including value-card auctions. They exclude free setup shares, bank growth and non-auction ownership grants. Final shares count all outstanding investor shares after transfers, grants and retirements. Therefore final shares are not simply auction purchases plus one. Bank funding never creates a share.</p>'
b+='<h2 id="investors">Final holdings, by investor seat</h2>'+table(['Players','Arm','Seat','Bought/game','Final shares/game','Final median/p90','Final range','Secret payout/game'],holdingRows)+'<p>Seat 1 is Saul, 2 Marek, 3 Pieter and 4 Reed. Initial first player varies by seed. Final holdings include all companies and all acquisition methods. Secret payout is the extra settlement amount only, not total portfolio payout. Final per-company portfolios for every investor are retained in games.jsonl.</p><h2>Where secret-card holders invest</h2>'+table(['Players','Bonus category','Auction purchases','Share of purchases','Final shares/investor'],bonusRows)+'<p>Categories are relative to the winning investor’s secret card. “Other” contains players-count companies, while each bonus category contains one; do not compare raw shares as equal-sized opportunity sets. Assignment, ownership and prices jointly affect choices, so these are descriptive preferences, not causal card-strength estimates.</p>'
b+='<h2>Support actions per game</h2>'+table(['Players','Arm','Capital calls','Value actions','Founder changes','Passes','Spread in finishes'],actions)
names=json.loads(Path('docs/dice-payout-v149/run-01/card-names.json').read_text());counts={a:Counter(v for r in good if r['arm']==a for v in r['values']) for a in arms};exposures={a:Counter(v for r in good if r['arm']==a for v in r['valueExposures']) for a in arms}
b+='<h2>Value-card plays / hand appearances</h2>'+table(['Card',*arms],[[esc(names.get(k,k)),*[f'{counts[a][k]} / {exposures[a][k]}' for a in arms]] for k in sorted(set().union(*(set(v) for v in counts.values())))])+'<p>Hand appearances count repeated support opportunities with the card held, not unique dealt cards. No causal strength ranking is implied.</p>'
b+='<h2>Budget and limits</h2><p>All arms use the same bot code: two sampled hidden states per support candidate, one-round lookahead, 240-command continuation cap, and a public-supply portfolio forecast. All legal card targets and founder replacements compete with capital calls and passing. Bids and holding values add the known secret bonus; support forecasts sample the remaining cards without replacement. Opponent hidden cash uses a neutral $20 estimate and later capital changes are not inferred. Continuations use cheap heuristics, some based on classic positional values; price-setting cards use their minimum offer. This is not expert human play or a proof of enjoyment.</p>'
b+='<h2 id="reviews">Ten full current-rules replay reviews</h2>'
for r in json.loads((D/'reviews.json').read_text()):b+='<article><h3>'+r['game']+'</h3><p>'+esc(r['review'])+'</p><a href="samples/'+r['game']+'.json">Full commands, candidate scores, secrets and events</a> · <a href="samples/'+r['game']+'.compact.txt">Chronological transcript</a></article>'
plans=[p for f in (D/'samples').glob('*.json') for d in json.loads(f.read_text())['decisions'] for p in d.get('plans',[])];ev=[e for p in plans for e in p['evaluations']]
b+=f'<h2>Reliability</h2><p>{len(good)}/{len(rows)} completed; {sum(r["status"]=="failed" for r in rows)} failed; {sum(r["status"]=="censored" for r in rows)} censored. Ten preselected current-rules games independently replayed commands, full logs and scores. Their {len(plans)} planning calls evaluated {len(ev)} candidates; {sum(e["censored"] for e in ev)} sampled continuations hit the search cap. Seven-round endings are normal completions. No numeric balance target was chosen; tighter races and meaningful investment choice are desired directions.</p>'
b+='<p><a href="manifest.json">Protocol</a> · <a href="games.jsonl">All records</a> · <a href="summary.json">Summary</a> · <a href="runtime.json">Runtime</a> · <a href="source/src/live-dice-rules.js">Frozen rules</a></p><pre>node scripts/secret-investment-study.js NEW_DIRECTORY\nnode scripts/payout-compact.mjs RUN_DIRECTORY\npython3 scripts/secret-investment-report.py RUN_DIRECTORY</pre><p>The report also requires reviews.json and optionally findings.html, written after reading the full traces. Source SHA-256: '+M['source']+'</p>'
(D/'report.html').write_text('<!doctype html><meta charset="utf-8"><title>Vests · secret investments</title><style>body{font:17px/1.5 system-ui;margin:40px auto;padding:0 25px;max-width:1300px;background:#faf9f5;color:#232923}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}th,td{text-align:left;padding:9px;border-bottom:1px solid #d5dcd5}th,nav{background:#e2ece5}tr:nth-child(even),article{background:white}h2{margin-top:45px}a{color:#285845}article,nav{padding:20px;margin:15px 0}pre{white-space:pre-wrap}</style>'+b)
print(json.dumps(summary,indent=2))
