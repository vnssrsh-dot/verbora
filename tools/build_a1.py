"""Assemble A1 units from tools/units_*.py into content/a1/unit-XX.json.

Fills ids, default topics and the "Згадаймо" recap (2 exercises from the previous
lesson; for a unit's first lesson — from the last taught lesson of the previous unit).
unit-01.json is hand-made and kept as is.
"""
import copy, glob, importlib.util, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content", "a1")


def load_batches():
    units = []
    for path in sorted(glob.glob(os.path.join(ROOT, "tools", "units_*.py"))):
        spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
        mod = importlib.util.module_from_spec(spec)
        sys.path.insert(0, os.path.join(ROOT, "tools"))
        spec.loader.exec_module(mod)
        units.extend(mod.UNITS)
    return sorted(units, key=lambda u: u["order"])


UA_RU = [("Питальне слово", "Вопросительное слово"), ("множина взагалі", "множественное вообще"), ("незлічувані", "неисчисляемые"),
         ("приголосний", "согласный"), ("голосний", "гласный"), ("будь-який", "любой"), ("конкретний", "конкретный"),
         ("відомий", "известный"), ("той самий", "тот самый"), ("дієслово", "глагол"), ("прохання", "просьба"),
         ("дозвіл", "разрешение"), ("зазвичай", "обычно"), ("зараз", "сейчас"), ("багато", "много"), ("поруч", "рядом"),
         ("після", "после"), ("імена", "имена"), ("тут", "здесь"), ("хто", "кто"), ("під", "под"), ("між", "между")]


def localize_formula(r):
    """Rule formulas with Ukrainian words get a Russian twin: formula → {ua, ru}."""
    if not r or not isinstance(r.get("formula"), str):
        return
    f = r["formula"]
    if not any("\u0400" <= ch <= "\u04ff" for ch in f):
        return
    ru = f
    for a, b in UA_RU:
        ru = ru.replace(a, b)
    r["formula"] = {"ua": f, "ru": ru}


def recap_from(src_lesson, new_lesson_id):
    pool = [e for e in src_lesson["exercises"] if e["type"] in ("choose", "fill", "fix", "translate", "define")]
    if len(pool) < 2:
        pool = src_lesson["exercises"]
    picks = [pool[0], pool[len(pool) // 2]] if len(pool) > 1 else pool[:1]
    exs = []
    for j, e in enumerate(picks, 1):
        e = copy.deepcopy(e)
        e["id"] = f"{new_lesson_id}-r{j:02d}"
        exs.append(e)
    rl = src_lesson.get("rule")
    if rl:
        f = rl["formula"]
        t_ua, t_ru = (f["ua"], f["ru"]) if isinstance(f, dict) else (f, f)
    else:
        t_ua, t_ru = src_lesson["title"]["ua"], src_lesson["title"]["ru"]
    return {"from": src_lesson["id"],
            "note": {"ua": f"Згадаймо: {t_ua}", "ru": f"Вспомним: {t_ru}"},
            "exercises": exs}


def last_taught(u):
    taught = [l for l in u["lessons"] if l.get("rule") or l.get("words")]
    return taught[-1] if taught else u["lessons"][-1]


def main():
    prev_unit = json.load(open(os.path.join(OUT, "unit-01.json"), encoding="utf-8"))
    built = [prev_unit]
    for u in load_batches():
        uid = f"a1-u{u['order']:02d}"
        topic = u.pop("_topic")
        out = {"id": uid, "level": "A1", **u}
        localize_formula(out.get("rule"))
        for l in out["lessons"]:
            localize_formula(l.get("rule"))
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
        with open(os.path.join(OUT, f"unit-{u['order']:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        built.append(out)
        prev_unit = out
    validate(built)
    final_test(built)


def final_test(units):
    """30 tasks: one from every unit's checkpoint + one more from 5 key grammar units."""
    exs = []
    for k, u in enumerate(units):
        cp = u["checkpoint"]
        exs.append(cp[(k * 5) % len(cp)])
    key = {"a1-u02", "a1-u15", "a1-u16", "a1-u22", "a1-u25"}
    for u in units:
        if u["id"] in key and len(exs) < 30:
            exs.append(u["checkpoint"][-1])
    out = []
    for j, e in enumerate(exs[:30], 1):
        e = copy.deepcopy(e)
        e["source"] = e["id"]
        e["id"] = f"a1-final-{j:02d}"
        out.append(e)
    test = {"id": "a1-final", "level": "A1", "kind": "final-test",
            "title": {"en": "A1 final test", "ua": "Фінальний тест A1", "ru": "Финальный тест A1"},
            "pass_score": 0.8, "exercises": out}
    with open(os.path.join(OUT, "final-test.json"), "w", encoding="utf-8") as f:
        json.dump(test, f, ensure_ascii=False, indent=2)
    print("final-test:", len(out), "заданий")


def validate(units):
    ids = set()
    total = 0
    for u in units:
        exs = list(u["checkpoint"])
        for l in u["lessons"]:
            exs += l["exercises"] + (l["recap"]["exercises"] if l.get("recap") else [])
        for e in exs:
            assert e["id"] not in ids, e["id"]
            ids.add(e["id"])
            assert e["topic"], e["id"]
            assert e["explain"]["ua"] and e["explain"]["ru"], e["id"]
            if "options" in e:
                assert e["answer"] in e["options"], e["id"]
        n = sum(len(l["exercises"]) for l in u["lessons"])
        total += n
        print(f"{u['id']}  {u.get('kind','grammar'):7}  {u['title']['en'][:38]:38}  уроков {len(u['lessons'])}  заданий {n:3}  чекпоинт {len(u['checkpoint'])}")
    print("всего заданий в уроках:", total, "| юнитов:", len(units))


if __name__ == "__main__":
    main()
