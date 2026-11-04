import json,glob,re
cyr=re.compile('[А-Яа-яІіЇїЄєҐґ]')
bad=0
for p in sorted(glob.glob('content/a1/unit-*.json')):
    u=json.load(open(p))
    exs=list(u['checkpoint'])
    for l in u['lessons']: exs+=l['exercises']
    for e in exs:
        for k in ('question','options','sentence','definition','cue','answer','words','statement','text','sentences','bank','answers','audio_text'):
            v=e.get(k)
            if isinstance(v,dict): continue
            if v is not None and cyr.search(json.dumps(v,ensure_ascii=False)):
                print(e['id'],k,json.dumps(v,ensure_ascii=False)[:90]); bad+=1
print('untranslated:',bad)
