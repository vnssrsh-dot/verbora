"""Assemble a level (a2, b1, …) from tools/<level>/units_*.py into content/<level>/.

Usage: python3 tools/build_level.py a2
Reuses ids / recap / formula helpers from build_a1.py. The first lesson's recap
comes from the last unit of the previous level.
"""
import copy, glob, importlib.util, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_a1 import localize_formula, recap_from, last_taught, validate, ROOT

LEVELS = ["a1", "a2", "b1", "b2", "c1"]


def load(level):
    units = []
    for path in sorted(glob.glob(os.path.join(ROOT, "tools", level, "units_*.py"))):
        spec = importlib.util.spec_from_file_location(f"{level}_{os.path.basename(path)[:-3]}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        units.extend(mod.UNITS)
    return sorted(units, key=lambda u: u["order"])


def main(level):
    LV = level.upper()
    out_dir = os.path.join(ROOT, "content", level)
    os.makedirs(out_dir, exist_ok=True)
    prev_dir = os.path.join(ROOT, "content", LEVELS[LEVELS.index(level) - 1])
    prev_unit = json.load(open(sorted(glob.glob(os.path.join(prev_dir, "unit-*.json")))[-1], encoding="utf-8"))
    built = []
    for u in load(level):
        uid = f"{level}-u{u['order']:02d}"
        topic = u.pop("_topic")
        out = {"id": uid, "level": LV, **u}
        for i, l in enumerate(out["lessons"], 1):
            lid = f"{uid}-l{i:02d}"
            for j, e in enumerate(l["exercises"], 1):
                e["id"] = f"{lid}-e{j:02d}"
                e["topic"] = e["topic"] or topic
            src = last_taught(prev_unit) if i == 1 else out["lessons"][i - 2]
            ordered = {"id": lid, "title": l["title"], "recap": recap_from(src, lid)}
            ordered.update({k: v for k, v in l.items() if k != "title"})
            out["lessons"][i - 1] = ordered
        for j, e in enumerate(out["checkpoint"], 1):
            e["id"] = f"{uid}-cp{j:02d}"
            e["topic"] = e["topic"] or topic
        with open(os.path.join(out_dir, f"unit-{u['order']:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        built.append(out)
        prev_unit = out
    validate(built)
    # final test: one task per unit, then the last checkpoint task of grammar units until 30
    exs = [u["checkpoint"][(k * 5) % len(u["checkpoint"])] for k, u in enumerate(built)]
    back = 1
    while len(exs) < 30 and back <= 12:
        for u in built:
            if len(exs) >= 30:
                break
            if u["kind"] == "grammar":
                exs.append(u["checkpoint"][-back])
        back += 1
    tasks = []
    for j, e in enumerate(exs[:30], 1):
        e = copy.deepcopy(e)
        e["source"] = e["id"]
        e["id"] = f"{level}-final-{j:02d}"
        tasks.append(e)
    test = {"id": f"{level}-final", "level": LV, "kind": "final-test",
            "title": {"en": f"{LV} final test", "ua": f"Фінальний тест {LV}", "ru": f"Финальный тест {LV}"},
            "pass_score": 0.8, "exercises": tasks}
    with open(os.path.join(out_dir, "final-test.json"), "w", encoding="utf-8") as f:
        json.dump(test, f, ensure_ascii=False, indent=2)
    print("final-test:", len(tasks), "заданий")


if __name__ == "__main__":
    main(sys.argv[1])
