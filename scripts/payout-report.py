import json,sys,statistics,random,html,math
from pathlib import Path
from collections import Counter,defaultdict
D=Path(sys.argv[1]); rows=[json.loads(l) for l in (D/'games.jsonl').read_text().splitlines()]; good=[r for r in rows if r['status']=='complete']; M=json.loads((D/'manifest.json').read_text())
mean=lambda a:statistics.mean(a) if a else 0
q=lambda a,p:sorted(a)[min(len(a)-1,math.ceil(p*len(a))-1)] if a else 0
esc=html.escape
def table(headers,rows):return '<table><tr>'+''.join('<th>'+str(x)+'</th>' for x in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+str(x)+'</td>' for x in r)+'</tr>' for r in rows)+'</table>'
def bootstrap(a):
 rng=random.Random(149);v=[mean(rng.choices(a,k=len(a))) for _ in range(2000)];return [q(v,.025),q(v,.975)]
names=json.loads((D/'card-names.json').read_text()) if (D/'card-names.json').exists() else {}
summary={};primary=[];deltas=[];details=[];policy=[]
for p in [2,3,4]:
 for mode in M['modes']:
  a=[r for r in good if r['players']==p and r['payoutMode']==mode];prices=[v for r in a for v in r['prices']];fin=[r for r in a if r['endReason']=='finish']
  z={'games':len(a),'finish':mean([r['endReason']=='finish' for r in a]),'spread':mean([r['spread'] for r in a]),'finishSpread':mean([r['spread'] for r in fin]),'price':mean(prices),'medianPrice':q(prices,.5),'p90Price':q(prices,.9),'concentration':mean([r['concentration'] for r in a]),'hhi':mean([r['hhi'] for r in a]),'diversity':mean([r['diversity'] for r in a]),'rounds':mean([r['rounds'] for r in a]),'values':dict(Counter(v for r in a for v in r['values']))};summary[f'{p}-{mode}']=z
  primary.append([p,mode,len(a),f"{100*z['finish']:.1f}%",f"{z['spread']:.2f}",f"${z['price']:.2f}",f"{100*z['concentration']:.1f}%",f"{z['hhi']:.3f}",f"{z['diversity']:.2f}"])
  details.append([p,mode,f"{z['rounds']:.2f}",len(fin),f"{z['finishSpread']:.2f}",f"${z['medianPrice']} / ${z['p90Price']}",f"{100*sum(r['noSales'] for r in a)/sum(r['auctions'] for r in a):.1f}%",f"{mean([r['actions']['changeFounder'] for r in a]):.2f}"])
  mixed=[r for r in a if r['cohort']=='mixed']
  for pol in ['concentration','diversification']:
   seats=[(r,i) for r in mixed for i,x in enumerate(r['policies']) if x==pol];policy.append([p,mode,pol,len(seats),f"{100*mean([(1/len(r['winners']) if i in r['winners'] else 0) for r,i in seats]):.1f}%"])
 for metric in ['finish','spread','meanPaid','concentration','hhi','diversity']:
  pairs=[]
  for seed in M['seeds']:
   ds=[]
   for cohort in M['cohorts']:
    arm={r['payoutMode']:r for r in good if r['players']==p and r['seed']==seed and r['cohort']==cohort}
    if len(arm)==2:
     val=lambda r:(r['endReason']=='finish') if metric=='finish' else r[metric]
     ds.append(val(arm['perShare'])-val(arm['dilution']))
   if len(ds)==2:pairs.append(mean(ds))
  ci=bootstrap(pairs);factor=100 if metric in ['finish','concentration'] else 1
  deltas.append([p,metric,len(pairs),f'{factor*mean(pairs):+.2f}',f'{factor*ci[0]:+.2f} to {factor*ci[1]:+.2f}'])
(D/'summary.json').write_text(json.dumps({'groups':summary,'pairedDeltas':deltas},indent=2))
b='<h1>$24 per share versus dilution</h1><p>v149 · 10 November 2026 · paired study · '+str(len(rows))+' attempted games · 2–4 players</p><p>Both arms use players + 2 companies, eight cards/company, companies − 1 public row, sequential dice, all founders/value cards and seven rounds. Only the payout system changes. The same updated valuation code runs in both arms. This is a comparison of the complete $24-per-share curve against the $100-total dilution curve, not an isolated test of division.</p>'
b+=('<section>'+ (D/'findings.html').read_text() +'</section>') if (D/'findings.html').exists() else ''
b+='<nav><a href="#results">Results</a> · <a href="#deltas">Paired changes</a> · <a href="#cards">Cards</a> · <a href="#reviews">Ten replays</a></nav><h2 id="results">Results</h2>'+table(['Players','Payout','Games','Reached 24','Mean spread','Mean paid','Largest holding','HHI','Companies owned'],primary)
b+='<p>Spread = first minus last at settlement. Largest holding = fraction of each investor’s shares in their most-held company, averaged per game. HHI = sum of squared company share fractions. Both count shares, not payout-weighted exposure; empty portfolios count zero. Lower concentration/HHI means more diversified. Companies owned is the mean number of distinct holdings per investor. These measures should be compared within player count.</p>'
b+='<h2 id="deltas">Per-share minus dilution · paired changes</h2>'+table(['Players','Metric','Seed pairs','Change','95% interval'],deltas)+'<p>Finish and concentration changes are percentage points; meanPaid is dollars. Price deltas compare mean paid per game, while the main table pools sold auctions. Intervals bootstrap 60 matched seed clusters, averaging self and mixed cohorts within each seed. No per-auction independence assumption. Same setup seeds do not guarantee the same later dice after actions diverge. These are exploratory intervals, without multiple-comparison correction.</p>'
b+='<h2>Pacing and price distribution</h2>'+table(['Players','Payout','Rounds','Finishes','Spread in finishes','Paid median / p90','No sales','Founder changes/game'],details)
b+='<h2>Mixed policy results</h2>'+table(['Players','Payout','Policy','Seat-games','Split win rate'],policy)+'<p>Both policies share bid and support heuristics, differing mainly in funding selection. Seats alternate by seed. Ties split win credit. These are bounded policies, not expert human concentration/diversification strategies.</p>'
b+='<h2 id="cards">Value card usage</h2><p>Total plays across 360 games per arm; repeated plays are possible as cards cycle. No causal strength ranking is implied.</p>'
counts={mode:Counter(v for r in good if r['payoutMode']==mode for v in r['values']) for mode in M['modes']};b+=table(['Card','Dilution plays','Per-share plays'],[[esc(names.get(k,k)),counts['dilution'][k],counts['perShare'][k]] for k in sorted(set(counts['dilution'])|set(counts['perShare']))])
actions=[]
for p in [2,3,4]:
 for mode in M['modes']:
  a=[r for r in good if r['players']==p and r['payoutMode']==mode]
  actions.append([p,mode,*[f"{mean([r['actions'][k] for r in a]):.2f}" for k in ['raiseMoney','valueAction','changeFounder','passAction']],f"{mean([sum(r['shares']) for r in a]):.1f}"])
b+='<h2>Action and ownership effects</h2>'+table(['Players','Payout','Calls/game','Values/game','Founder changes/game','Passes/game','Shares/game'],actions)
b+='<h2>Valuation changes and limits</h2><p>Auction forecasts estimate remaining matching-card supply and future movement. Dilution bids include expected future issued shares; per-share bids do not divide by share count. Existing portfolio values no longer assume an extra purchase. Terminal scoring, die choice and founder movement valuation use the selected payout curve. Jenkins retains the $75 total alternative in both arms. Its divided special payout can still beat the ordinary per-share payout.</p><p>Founder switching still follows capital calls and positive value-card plays, and founder ratings remain static. Rights Issue uses the minimum offer. Card evaluations and opponent balances are approximate. The study therefore tests these rules with these bots, not optimal play or enjoyment. No numerical balance target was chosen; finish rate and tighter races are desired directions.</p>'
b+='<h2 id="reviews">Ten complete replay reviews</h2>'
reviews=json.loads((D/'reviews.json').read_text()) if (D/'reviews.json').exists() else []
for r in reviews:b+='<article><h3>'+esc(r['game'])+'</h3><p>'+esc(r['review'])+'</p><a href="samples/'+esc(r['game'])+'.json">Full commands and events</a> · <a href="samples/'+esc(r['game'])+'.compact.txt">Chronological transcript</a></article>'
b+='<h2>Reliability and reproduction</h2><p>'+str(len(good))+' complete; '+str(sum(r['status']=='failed' for r in rows))+' failed; '+str(sum(r['status']=='censored' for r in rows))+' censored. Every command checks invariants; ten samples independently replay full logs and scores. Source frozen before run. Runtime and failures retained. Reports do not silently exclude unsuccessful attempts.</p><p><a href="manifest.json">Protocol and metric definitions</a> · <a href="games.jsonl">All games</a> · <a href="summary.json">Summary</a> · <a href="runtime.json">Runtime</a> · <a href="source/src/live-dice-rules.js">Frozen rules</a></p><pre>node scripts/payout-study.js NEW_DIRECTORY\nnode scripts/payout-compact.mjs RUN_DIRECTORY\npython3 scripts/payout-report.py RUN_DIRECTORY</pre><p>Source SHA-256: '+M['source']+'</p>'
(D/'report.html').write_text('<!doctype html><meta charset="utf-8"><title>Vests · payout comparison</title><style>body{font:17px/1.5 system-ui;margin:40px auto;padding:0 25px;max-width:1180px;background:#faf9f5;color:#232923}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:15px}th,td{text-align:left;padding:10px;border-bottom:1px solid #d5dcd5}th{background:#e2ece5}tr:nth-child(even){background:white}h2{margin-top:45px}a{color:#285845}article{background:white;padding:20px;margin:15px 0}nav{padding:15px;background:#e2ece5}pre{white-space:pre-wrap}</style>'+b)
print(json.dumps(summary,indent=2))
