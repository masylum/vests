import json,sys
s=json.load(open(sys.argv[1]));print('META',json.dumps(s['meta']))
for i,e in enumerate(s['events']):
 t=e['type']
 if t=='roundStart':print(f"E{i} ROUND {e['round']} pos {e['positions']}")
 elif t=='action':print(f"E{i} P{e['player']} {e['command']}")
 elif t=='intelPlay':print(f"E{i} VALUE P{e['player']} {e['kind']} C{e['company']} target{e.get('target')}")
 elif t=='auction':print(f"E{i} AUCTION C{e['company']} {e.get('mode')} winner{e.get('winner')} ${e.get('paid')}")
 elif t=='diceReveal':print(f"E{i} DICE C{e['company']} {e['before']} +{e['printed']} x{e['fumbles']}")
 elif t=='founderPhase':
  rs=[r.get('text','') for r in e.get('reactions',[]) if not r.get('text','').startswith(('Passed','Used power'))]
  if rs:print(f"E{i} {e.get('stage')} {'; '.join(rs)} ->{e.get('finalPositions')}")
 elif t in ['roundEnd','legEnd','settlement']:print(f'E{i} {t}',e.get('positions',e.get('scores')))
print('DECISION AUDIT')
for d in s['decisions']:
 if not d.get('plans') or d['phase']!='flowAction':continue
 p=d['plans'][0];es=p['evaluations'];best=es[0];nextbest=es[1] if len(es)>1 else best
 print('D',d['step'],'R',d['round'],'P',d['id'],d['policy'],'chosen',d['cmd'],'top',round(best['mean'],2),'runner',nextbest['commands'],round(nextbest['mean'],2),'cap',sum(e['censored'] for e in es))
