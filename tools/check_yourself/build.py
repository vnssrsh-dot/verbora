"""Build content/check-yourself/pool.json from tools/check_yourself/pool.py and validate it.

Usage: python3 tools/check_yourself/build.py [path/to/lucide_names.txt]
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from pool import THEMES  # noqa: E402

LEVELS = ["A1", "A2", "B1", "B2", "C1"]


def main(icon_list=None):
    icons = set(open(icon_list).read().split()) if icon_list else None
    errors, seen, out = [], set(), []
    for t in THEMES:
        words = []
        for i, w in enumerate(t["words"], 1):
            wid = f"{t['id']}-{i:02d}"
            if w["word"].lower() in seen:
                errors.append(f"duplicate word {w['word']}")
            seen.add(w["word"].lower())
            if w["level"] not in LEVELS:
                errors.append(f"{wid} bad level")
            if icons is not None and w["icon"] not in icons:
                errors.append(f"{wid} icon not in Lucide: {w['icon']}")
            if not w["sentences"]:
                errors.append(f"{wid} no sentences")
            if min(LEVELS.index(s["level"]) for s in w["sentences"]) > LEVELS.index(w["level"]):
                errors.append(f"{wid} no sentence at word level {w['level']}")
            stem = w["word"].lower().rstrip("s") if w["word"] not in ("glasses", "scissors") else w["word"].lower()
            for j, s in enumerate(w["sentences"], 1):
                if LEVELS.index(s["level"]) < LEVELS.index(w["level"]):
                    errors.append(f"{wid} sentence below word level")
                if stem[:4] not in s["text"].lower():
                    errors.append(f"{wid} sentence without the word: {s['text']}")
                s["id"] = f"{wid}-s{j}"
                s["audio"] = ""
            words.append({"id": wid, **w, "audio": ""})
        out.append({**t, "words": words})
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    data = {"id": "check-yourself", "pack_size": 10, "refresh_days": 2, "levels": LEVELS, "themes": out}
    os.makedirs(os.path.join(ROOT, "content", "check-yourself"), exist_ok=True)
    with open(os.path.join(ROOT, "content", "check-yourself", "pool.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # stats: words available per level per theme (cumulative)
    print("theme".ljust(12), *[l.rjust(4) for l in LEVELS])
    for t in out:
        print(t["id"].ljust(12), *[str(sum(LEVELS.index(w["level"]) <= k for w in t["words"])).rjust(4) for k in range(5)])
    nw = sum(len(t["words"]) for t in out)
    ns = sum(len(w["sentences"]) for t in out for w in t["words"])
    print(f"words {nw} | sentences {ns}")
    print("words by level:", {l: sum(w["level"] == l for t in out for w in t["words"]) for l in LEVELS})


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
