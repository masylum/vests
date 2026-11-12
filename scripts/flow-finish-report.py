import json,sys,statistics as st,html,random
from pathlib import Path
from collections import Counter
D=Path(sys.argv[1]);M=json.loads((D/'manifest.json').read_text());rows=[json.loads(l) for l in (D/'games.jsonl').read_text().splitlines()];arms=['capped','uncapped','five'];mean=lambda v:st.mean(list(v));esc=html.escape

def table(head,rows):return '<table><tr>'+''.join('<th>'+str(x)+'</th>' for x in head)+'</tr>'+''.join('<tr>'+''.join('<td>'+str(x)+'</td>' for x in row)+'</tr>' for row in rows)+'</table>'
def q(v,p):return sorted(v)[min(len(v)-1,int(p*(len(v)-1)))]
def ci(v):
 rng=random.Random(154);b=sorted(mean(rng.choices(v,k=len(v))) for _ in range(4000));return [b[100],b[3899]]
summary={};duration=[];economy=[];paired=[];components=[];matchups=[]
for p in [2,3,4]:
 for arm in arms:
  rs=[r for r in rows if r['players']==p and r['arm']==arm];ok=[r for r in rs if r['status']=='complete'];fin=[r for r in ok if r['endReason']=='finish'];v=[r['rounds'] for r in fin];paid=[x for r in ok for x in r['prices']]
  s={'attempts':len(rs),'completed':len(ok),'finish':len(fin)/len(rs),'finishRounds':mean(v) if v else None,'median':st.median(v) if v else None,'p90':q(v,.9) if v else None,'max':max(v) if v else None,'rounds':mean(r['rounds'] for r in ok),'spread':mean(r['spread'] for r in ok),'price':mean(paid),'boughtPerPlayer':mean(sum(r['boughtByPlayer'])/p for r in ok),'finalSharesPerPlayer':mean(sum(r['shares'])/p for r in ok),'diversity':mean(r['diversity'] for r in ok),'concentration':mean(r['concentration'] for r in ok),'shortRowGames':sum(r.get('shortRows',0)>0 for r in ok) if arm!='capped' else None,'emptyRowGames':sum(r.get('emptyRows',0)>0 for r in ok) if arm!='capped' else None,'bankCards':mean(r['bankCards'] for r in ok),'rolls':mean(r['rolls'] for r in ok),'scorespread':mean(max(r['scores'])-min(r['scores']) for r in ok)}
  summary[f'{p}-{arm}']=s
  duration.append([p,arm,f'{len(fin)}/{len(rs)}',f"{s['rounds']+1e-9:.2f}",f"{s['finishRounds']+1e-9:.2f}" if v else '—',f"{s['median']} / {s['p90']} / {s['max']}",f"{s['spread']+1e-9:.2f}",f"{s['shortRowGames']} / {s['emptyRowGames']}" if arm!='capped' else 'not recorded'])
  economy.append([p,arm,f"${s['price']+1e-9:.2f}",f"{s['boughtPerPlayer']+1e-9:.2f}",f"{s['finalSharesPerPlayer']+1e-9:.2f}",f"{s['diversity']+1e-9:.2f}",f"{s['concentration']:.1%}",f"{s['bankCards']+1e-9:.2f}",f"{s['rolls']+1e-9:.2f}"])
  components.append([p,arm,*[f"{mean(r['actions'][k] for r in ok):.2f}" for k in ['raiseMoney','valueAction','changeFounder','passAction']],f"{mean(r['recoveryDiscards'] for r in ok):.2f}"])
  mixed=[r for r in ok if r['cohort']=='mixed'];credits=Counter();seats=Counter()
  for r in mixed:
   for i,policy in enumerate(r['policies']):
    seats[policy]+=1
    if i in r['winners']:credits[policy]+=1/len(r['winners'])
  matchups.append([p,arm,*[f'{credits[k]:.2f} / {seats[k]}' for k in ['concentration','diversification']]])
 for metric in ['rounds','spread','meanPaid','diversity']:
  ds=[]
  for seed in M['seeds']:
   vv=[]
   for cohort in M['cohorts']:
    g={r['arm']:r for r in rows if r['players']==p and r['seed']==seed and r['cohort']==cohort and r['status']=='complete'}
    if 'five' in g and 'uncapped' in g:vv.append(g['five'][metric]-g['uncapped'][metric])
   if len(vv)==2:ds.append(mean(vv))
  if ds:lo,hi=ci(ds);paired.append([p,metric,f'{mean(ds):+.2f}',f'{lo:+.2f} to {hi:+.2f}',len(ds)])
(D/'summary.json').write_text(json.dumps({'groups':summary,'paired':paired},indent=2))
b='<h1>Five public cards and a finish-only race</h1><p>Vests v153 · experiment154 · 11 November 2026 · 216 matched game records, 144 new simulations plus 72 frozen capped controls.</p>'
if (D/'findings.html').exists():b+=(D/'findings.html').read_text()
b+='<nav><a href="#duration">Duration</a> · <a href="#economy">Auctions and holdings</a> · <a href="#reviews">Ten full replays</a></nav><h2>What was tested</h2><p><b>capped:</b> current game, players+1 cards, seven-round limit and deck-exhaustion exit. <b>uncapped:</b> players+1 cards, reaching24 is the only settlement condition. <b>five:</b> five cards regardless of player count, reaching24 only. Four-player uncapped/five are identical rules and should give identical results.</p><p>All other rules stay fixed: players+2 companies; eight deal-flow cards per company; setup spends cards; one support action then one fundraising pick per player; remaining cards receive two bland bank dice without shares. Private secret bonuses and Danilo+1 remain active. No discarded deal-flow is reshuffled automatically. If fewer cards remain, the row is short; once empty, support actions, founders and catch-up continue. Company cards can still be returned through existing effects.</p><p>Bots use the actual row size and stop condition in investment forecasts. Uncapped forecasts no longer assume settlement at round seven. Support search remains two hidden-state samples, one-round lookahead and 240 continuation commands; future actions use cheaper heuristics. Unknown opponent cash remains estimated at $20. No bot-strength change was made between the two uncapped arms.</p>'
b+='<h2 id="duration">Duration and race</h2>'+table(['Players','Arm','Reached24 / attempts','Mean all completed rounds','Mean rounds to24','Finish median / p90 / max','Mean spread','Short / empty row games'],duration)+'<p>Round zero is setup. One round includes every player’s support/fundraising turn and the reveal. Averages to24 are conditional on reaching24; capped non-finishes are excluded from that column, so it is not a fair duration comparison against uncapped games. Short/empty rows are recorded only for new simulations. The 40-round / 10,000-command safety budget is study censorship, not a game rule; unfinished attempts must not be counted as finishes. Rounds are not human minutes.</p>'
b+='<h2>Fixed five minus variable row, both uncapped</h2>'+table(['Players','Metric','Mean difference','95% paired interval','Seed clusters'],paired)+'<p>Bootstrap over12 matched seeds, with self/mixed averaged within seed. Exploratory intervals, no multiple-comparison correction. Subsequent rolls diverge after actions diverge. The identical four-player arms are a consistency check, not two independent cohorts.</p>'
b+='<h2 id="economy">Auctions, ownership and movement supply</h2>'+table(['Players','Arm','Paid/sold auction','Bought/investor','Final shares/investor','Companies owned','Largest holding','Bank cards/game','Dice/game'],economy)
b+='<h2>Support actions per game</h2>'+table(['Players','Arm','Capital calls','Value plays','Founder changes','Passes','Recovery discards'],components)+'<p>Final holdings include setup shares, ownership grants/transfers and retirements. Bank growth creates no shares. Largest holding is averaged over investors within games.</p>'
b+='<h2>Mixed-policy win credit</h2>'+table(['Players','Arm','Concentration credit / seat appearances','Diversification credit / seat appearances'],matchups)+'<p>Tied wins split credit. Mixed lineups alternate policies by seed and seat; first player rotates under the normal rules. Both policies use the same support planner; they differ in portfolio preference. This is not a test against expert human play.</p>'
names=json.loads(Path('docs/dice-payout-v149/run-01/card-names.json').read_text());counts={a:Counter(k for r in rows if r['arm']==a and r['status']=='complete' for k in r['values']) for a in arms}
b+='<h2>Value-card usage</h2>'+table(['Card',*arms],[[esc(names.get(k,k)),*[counts[a][k] for a in arms]] for k in sorted(set().union(*(set(x) for x in counts.values())))])+'<p>Total plays per arm; longer games expose more action opportunities. Counts are not causal power rankings.</p>'
b+='<h2 id="reviews">Ten complete five-card replay reviews</h2>'
for r in json.loads((D/'reviews.json').read_text()):b+='<article><h3>'+r['game']+'</h3><p>'+esc(r['review'])+'</p><a href="samples/'+r['game']+'.json">Full trace and candidate valuations</a> · <a href="samples/'+r['game']+'.compact.txt">Chronological transcript</a></article>'
b+='<h2>Reliability and reproducibility</h2><p>'+str(Counter(r['status'] for r in rows))+'; every traced game independently replayed commands, full logs and settlement. Complete default-rule controls come from <a href="../../dice-secret-v153/run-02/manifest.json">the previous frozen study</a>; the unchanged default was checked against a saved game’s scores, positions and prices. Current interactive defaults remain unchanged pending this experiment.</p><p>Desired direction: reliably reach24, shorten two/three-player games without wider races. No numerical duration/spread target was chosen.</p><p><a href="manifest.json">Protocol and source hash</a> · <a href="games.jsonl">All records</a> · <a href="summary.json">Summary data</a> · <a href="runtime.json">Runtime</a></p><pre>node scripts/flow-finish-study.js NEW_DIRECTORY\nnode scripts/payout-compact.mjs RUN_DIRECTORY\npython3 scripts/flow-finish-report.py RUN_DIRECTORY</pre><p>Report generation also reads reviews.json and optional findings.html. Source: '+M['source']+'</p>'
(D/'report.html').write_text('<!doctype html><meta charset="utf-8"><title>Vests · five cards and no round cap</title><style>body{font:17px/1.5 system-ui;max-width:1300px;margin:35px auto;padding:0 24px;background:#faf9f5;color:#232923}table{width:100%;border-collapse:collapse;font-size:14px;margin:20px 0}th,td{padding:9px;text-align:left;border-bottom:1px solid #d5dcd5}th,nav{background:#e2ece5}tr:nth-child(even),article{background:white}article,nav{padding:18px;margin:15px 0}h2{margin-top:40px}a{color:#285845}pre{white-space:pre-wrap}</style>'+b)
import re
out=D/'report.html'
pieces=re.split(r'(<style>.*?</style>|<pre>.*?</pre>|<[^>]+>)',out.read_text(),flags=re.S)
for i in range(0,len(pieces),2):
 pieces[i]=re.sub(r'(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])',' ',pieces[i])
 pieces[i]=re.sub(r'(?<=[A-Za-z])(?=[$−+])',' ',pieces[i])
out.write_text(''.join(pieces).replace('python 3 ', 'python3 ').replace('v 153', 'v153').replace('p 90', 'p90').replace(re.sub(r'(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])', ' ', M['source']), M['source']))
print(json.dumps(summary,indent=2))
