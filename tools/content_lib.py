"""Compact helpers for writing VERBORA lesson content.

Each helper returns an exercise dict. `ru=None` means the explanation is the same
in both languages (formulas like "She → is.").
Topic `None` is filled with the unit default at assembly time.
"""
import random


def _t(ua, ru=None):
    return {"ua": ua, "ru": ua if ru is None else ru}


def _ex(type_, tp, ua, ru, **kw):
    d = {"type": type_, "topic": tp}
    d.update(kw)
    d["explain"] = _t(ua, ru)
    return d


def C(q, opts, ans, ua, ru=None, tp=None):
    """choose"""
    assert ans in opts, (q, ans)
    if isinstance(q, tuple):
        q = _t(*q)
    return _ex("choose", tp, ua, ru, question=q, options=list(opts), answer=ans)


def F(q, ans, ua, ru=None, acc=(), hint=None, tp=None):
    """fill"""
    kw = {"question": q, "answer": ans, "accept": list(acc)}
    if hint:
        kw["hint"] = hint
    return _ex("fill", tp, ua, ru, **kw)


def B(ans, ua, ru=None, extra=(), tp=None):
    """build: words are the answer's words shuffled (plus optional distractors)"""
    words = ans.split() + list(extra)
    rnd = random.Random(ans)
    shuffled = words[:]
    for _ in range(10):
        rnd.shuffle(shuffled)
        if shuffled != words:
            break
    return _ex("build", tp or "word-order", ua, ru, words=shuffled, answer=ans)


def X(sentence, ans, ua, ru=None, acc=(), tp=None):
    """fix"""
    return _ex("fix", tp, ua, ru, sentence=sentence, answer=ans, accept=list(acc))


def L(text, opts, ua, ru=None, tp=None):
    """listen: first option must be the spoken text"""
    assert text in opts
    return _ex("listen", tp, ua, ru, audio_text=text, options=list(opts), answer=text, audio="")


def T(pua, pru, ans, ua, ru=None, acc=(), tp=None):
    """translate from native"""
    return _ex("translate", tp, ua, ru, prompt=_t(pua, pru), answer=ans, accept=list(acc))


def I(ipa, opts, ans, ua, ru=None):
    """read transcription"""
    assert ans in opts
    return _ex("ipa", "vocab", ua, ru, ipa=ipa, options=list(opts), answer=ans)


def M(pairs, ua, ru=None, tp="vocab"):
    """match: pairs of (left, right); right is str or (ua, ru)"""
    out = []
    for left, right in pairs:
        r = _t(*right) if isinstance(right, tuple) else right
        out.append({"left": left, "right": r})
    return _ex("match", tp, ua, ru, pairs=out)


def W(bank, sents, answers, ua, ru=None, reuse=True, tp=None):
    """wordbank"""
    assert len(sents) == len(answers)
    low = [b.lower() for b in bank]
    for a in answers:
        assert a.lower() in low, a
    return _ex("wordbank", tp, ua, ru, bank=list(bank), reuse=reuse, sentences=list(sents), answers=list(answers))


def D(definition, ans, ua, ru=None, acc=()):
    """define: name the word by its description"""
    return _ex("define", "vocab", ua, ru, definition=definition, answer=ans, accept=list(acc))


def A(cue, ans, ua, ru=None, acc=()):
    """associate"""
    return _ex("associate", "vocab", ua, ru, cue=cue, answer=ans, accept=list(acc))


def R(questions, ua, ru=None, text=None, dialog=None, tp="reading"):
    """reading. questions: ("c", question, options, answer) or ("tf", statement, bool)"""
    qs = []
    for q in questions:
        if q[0] == "c":
            assert q[3] in q[2]
            qs.append({"type": "choose", "question": q[1], "options": list(q[2]), "answer": q[3]})
        else:
            qs.append({"type": "truefalse", "statement": q[1], "answer": q[2]})
    kw = {"audio": "", "questions": qs}
    if text:
        kw["text"] = text
    if dialog:
        kw["dialog"] = [{"speaker": s, "line": l} for s, l in dialog]
    return _ex("reading", tp, ua, ru, **kw)


def rule(formula, ua, ru, examples, compare=None):
    """formula: str (same for both languages) or (ua, ru) tuple"""
    if isinstance(formula, tuple):
        formula = _t(*formula)
    d = {"formula": formula, "explain": _t(ua, ru),
         "examples": [{"en": e, "ua": u, "ru": r} for e, u, r in examples]}
    if compare:
        d["compare"] = _t(*compare)
    return d


def lesson(en, ua, ru, rl, exercises, words=None):
    d = {"title": {"en": en, "ua": ua, "ru": ru}, "rule": rl, "exercises": exercises}
    if words:
        d["words"] = list(words)
    return d


def V(word, ipa, ua, ru, example):
    return {"word": word, "ipa": ipa, "ua": ua, "ru": ru, "example": example, "audio": ""}


def unit(order, kind, en, ua, ru, rl, vocab, lessons, checkpoint, topic):
    return {"order": order, "kind": kind, "title": {"en": en, "ua": ua, "ru": ru},
            "rule": rl, "vocab": vocab, "lessons": lessons, "checkpoint": checkpoint,
            "_topic": topic}
