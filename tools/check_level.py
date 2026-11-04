"""Quality checks for a built level: python3 tools/check_level.py a2"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CYR = re.compile('[А-Яа-яІіЇїЄєҐґ]')
UKR = re.compile('[іїєґІЇЄҐ]')
RUS = re.compile('[ыэъёЫЭЪЁ]')
SHOWN = ('question', 'options', 'sentence', 'definition', 'cue', 'answer', 'words', 'statement',
         'text', 'sentences', 'bank', 'answers', 'audio_text')


def exercises(u):
    exs = list(u.get('exercises', [])) + list(u.get('checkpoint', []))
    for l in u.get('lessons', []):
        exs += l['exercises'] + (l['recap']['exercises'] if l.get('recap') else [])
    return exs


def walk(o, path, bad):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == 'ru' and isinstance(v, str) and UKR.search(v):
                bad.append(f'RU has UA: {path} {v[:70]}')
            if k == 'ua' and isinstance(v, str) and RUS.search(v):
                bad.append(f'UA has RU: {path} {v[:70]}')
            walk(v, path + '/' + k, bad)
    elif isinstance(o, list):
        for v in o:
            walk(v, path, bad)


def main(level):
    bad, n = [], 0
    for p in sorted(glob.glob(os.path.join(ROOT, 'content', level, '*.json'))):
        u = json.load(open(p, encoding='utf-8'))
        walk(u, os.path.basename(p), bad)
        for r in [u.get('rule')] + [l.get('rule') for l in u.get('lessons', [])]:
            if r and isinstance(r.get('formula'), str) and CYR.search(r['formula']):
                bad.append(f"formula needs ua/ru: {os.path.basename(p)} {r['formula'][:60]}")
        for e in exercises(u):
            n += 1
            for k in SHOWN:
                v = e.get(k)
                if v is not None and not isinstance(v, dict) and CYR.search(json.dumps(v, ensure_ascii=False)):
                    bad.append(f"untranslated {e['id']} {k}: {json.dumps(v, ensure_ascii=False)[:70]}")
            if e['type'] == 'build':
                if sorted(w.lower() for w in e['words']) != sorted(w.lower() for w in e['answer'].split()):
                    bad.append(f"build mismatch {e['id']}")
            if e['type'] == 'fix' and e['sentence'] == e['answer']:
                bad.append(f"fix unchanged {e['id']}")
    print('\n'.join(bad) if bad else 'all checks ok', f'| заданий всего: {n}')


if __name__ == '__main__':
    main(sys.argv[1])
