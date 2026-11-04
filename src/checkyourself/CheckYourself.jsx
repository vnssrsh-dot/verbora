import { useEffect, useMemo, useRef, useState } from 'react';
import pool from '../../content/check-yourself/pool.json';
import translations from '../../content/check-yourself/translations.json';
import icons from 'virtual:cy-icons';
import { buildPack, normalize, compareWords } from './pack.js';
import { useStore, addXp, bumpStreak, awardBadges } from '../lib/store.jsx';
import { tgUser, haptic } from '../lib/telegram.js';
import { speak, stop } from '../lib/tts.js';
import { loc } from '../lib/loc.js';
import { Mascot, Icon, Bar, Sheet, Confetti, Tile } from '../components.jsx';
import { badgeById } from '../lib/badges.js';

// «Перевір себе» — picture dictation (SPEC §15). Word step: icon + letter cells, no sound.
// Sentence step: dictation by ear with word cells. Pack logic comes from pack.js unchanged.

const ICON_PROPS = { size: 96, strokeWidth: 1.5, color: 'var(--primary-2)' };
const wordsById = {};
const sentencesById = {};
for (const t of pool.themes) for (const w of t.words) {
  wordsById[w.id] = { ...w, themeId: t.id };
  for (const s of w.sentences) sentencesById[s.id] = s;
}
const themeById = Object.fromEntries(pool.themes.map((t) => [t.id, t]));

export function WordIcon({ name, size = 96, strokeWidth = 1.5, color = 'var(--primary-2)' }) {
  const C = icons[name];
  return C ? <C size={size} strokeWidth={strokeWidth} color={color} aria-hidden /> : null;
}

// Words of a sentence exactly as normalize() splits them, with the punctuation in between kept for display.
function tokenize(text) {
  const out = [];
  const re = /[^\s.,!?;:"«»—–-]+/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ sep: text.slice(last, m.index) });
    out.push({ word: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ sep: text.slice(last) });
  return out;
}

export default function CheckYourself({ nav, t, lang }) {
  const { state, update } = useStore();
  const sound = state.settings.sound;
  const level = state.currentLevel || 'A1';

  // The pack for this period: built once with the history at the start of the period, then kept.
  const pack = useMemo(() => {
    const now = new Date();
    const period = Math.floor(now.getTime() / 86400000 / pool.refresh_days);
    const saved = state.cy?.pack;
    if (saved && saved.period === period && saved.level === level && saved.items.every((x) => wordsById[x.w] && sentencesById[x.s])) {
      return { ...saved, items: saved.items.map((x) => ({ word: wordsById[x.w], sentence: sentencesById[x.s] })) };
    }
    const userId = String(tgUser()?.id || state.uid || 'local');
    const history = state.cy?.history || {};
    const p = buildPack(pool, { userId, level, now, history });
    const stored = { period: p.period, level, themeId: p.theme.id, items: p.items.map((x) => ({ w: x.word.id, s: x.sentence.id })) };
    update((s) => {
      if (!s.uid) s.uid = Math.random().toString(36).slice(2, 12);
      s.cy = { ...(s.cy || {}), pack: stored };
    });
    return { ...stored, items: p.items };
  }, []);

  const [items, setItems] = useState(pack.items);
  const [round, setRound] = useState(0); // remounts the run for «Ще раз»
  const [mode, setMode] = useState('all');
  const [results, setResults] = useState(null);

  const finish = (res) => {
    const clean = res.filter((r) => r.clean).length;
    let earned = [];
    update((s) => {
      const cy = s.cy || { history: {}, done: {}, goodPacks: 0 };
      const h = cy.history || {};
      const ids = res.map((r) => r.word.id);
      const missed = res.filter((r) => !r.clean).map((r) => r.word.id);
      h.lastThemeId = pack.themeId;
      h.recentWordIds = [...ids, ...(h.recentWordIds || []).filter((x) => !ids.includes(x))].slice(0, 30);
      h.missedWordIds = [...missed, ...(h.missedWordIds || []).filter((x) => !ids.includes(x))].slice(0, 30);
      cy.history = h;
      cy.done = cy.done || {};
      if (mode === 'all' && !cy.done[pack.period]) {
        cy.done[pack.period] = { clean, total: res.length };
        if (clean >= 8) cy.goodPacks = (cy.goodPacks || 0) + 1;
      }
      s.cy = cy;
      addXp(s, clean * 5 + 10);
      bumpStreak(s);
      earned = awardBadges(s);
    });
    setResults({ res, clean, xp: clean * 5 + 10, badges: earned });
    haptic('success');
  };

  if (results) {
    return (
      <Result
        {...results}
        t={t}
        lang={lang}
        onAgain={() => { setItems(pack.items); setMode('all'); setResults(null); setRound(round + 1); }}
        onMissed={() => { setItems(results.res.filter((r) => !r.clean).map((r) => ({ word: r.word, sentence: r.sentence }))); setMode('missed'); setResults(null); setRound(round + 1); }}
        onHome={() => nav.tab('home')}
      />
    );
  }
  return <Run key={round} items={items} theme={themeById[pack.themeId]} t={t} lang={lang} sound={sound} onExit={() => nav.back()} onFinish={finish} />;
}

function Run({ items, theme, t, lang, sound, onExit, onFinish }) {
  const [i, setI] = useState(0);
  const [stepNo, setStepNo] = useState(1);
  const [res, setRes] = useState([]);
  const [askExit, setAskExit] = useState(false);
  const cur = useRef({ clean: true });
  useEffect(() => () => stop(), []);
  const item = items[i];

  const done = (clean) => {
    cur.current.clean = cur.current.clean && clean;
    if (stepNo === 1) { setStepNo(2); return; }
    const next = [...res, { word: item.word, sentence: item.sentence, clean: cur.current.clean }];
    cur.current = { clean: true };
    setRes(next);
    if (i + 1 < items.length) { setI(i + 1); setStepNo(1); } else onFinish(next);
  };

  return (
    <div className="screen" style={{ gap: 14, paddingBottom: 40 }}>
      <div className="row" style={{ gap: 10 }}>
        <button className="icon-btn" onClick={() => setAskExit(true)} aria-label={t('close')}><Icon name="close" /></button>
        <Bar value={((i + (stepNo === 2 ? 0.5 : 0)) / items.length) * 100} style={{ flex: 1, height: 10 }} />
        <span className="tiny" style={{ minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}/{items.length}</span>
      </div>
      <div className="row between">
        <span className="small" style={{ fontWeight: 700 }}>{t('cyTitle')}{theme ? ` · ${loc(theme.title, lang)}` : ''}</span>
        <span className="pill">{stepNo === 1 ? t('cyStep1') : t('cyStep2')}</span>
      </div>
      <WordStep key={`w-${i}`} word={item.word} active={stepNo === 1} t={t} lang={lang} sound={sound} onDone={done} />
      {stepNo === 2 && <SentenceStep key={`s-${i}`} sentence={item.sentence} word={item.word} t={t} lang={lang} sound={sound} onDone={done} />}
      {askExit && (
        <Sheet onClose={() => setAskExit(false)}>
          <div className="row"><Mascot emotion="sad" size={80} /><div className="col" style={{ gap: 4 }}><div className="h3">{t('exit')}</div><div className="small">{t('exitSub')}</div></div></div>
          <button className="btn" onClick={() => setAskExit(false)}>{t('stay')}</button>
          <button className="btn line" onClick={() => { stop(); onExit(); }}>{t('leave')}</button>
        </Sheet>
      )}
    </div>
  );
}

// ---------- step 1: write the word from the picture ----------
function WordStep({ word, active, t, lang, sound, onDone }) {
  const answer = word.word.toLowerCase();
  const letters = answer.replace(/ /g, '');
  const groups = answer.split(' ').map((g) => g.length);
  const [value, setValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState('typing'); // typing | wrong | ok | revealed
  const [hint, setHint] = useState(false);
  const [showTr, setShowTr] = useState(false);
  const input = useRef(null);
  const finished = status === 'ok' || status === 'revealed';

  useEffect(() => { if (active) setTimeout(() => input.current?.focus({ preventScroll: true }), 200); }, [active]);

  const check = (v) => {
    if (v.length < letters.length) return;
    if (v === letters) {
      setStatus('ok');
      haptic('success');
      speak(word.word, { audio: word.audio, enabled: sound });
      return;
    }
    haptic('error');
    const a = attempts + 1;
    setAttempts(a);
    setStatus(a >= 2 ? 'revealed' : 'wrong');
  };
  const onType = (e) => {
    if (finished) return;
    const v = normalize(e.target.value).replace(/[^a-z']/g, '').slice(0, letters.length);
    setValue(v);
    setStatus('typing');
    check(v);
  };
  const openLetter = () => {
    let k = 0;
    while (k < value.length && value[k] === letters[k]) k++;
    const v = letters.slice(0, k + 1);
    setHint(true);
    setValue(v);
    setStatus('typing');
    check(v);
    input.current?.focus({ preventScroll: true });
  };

  // cells, grouped by the words of a compound («ice cream»)
  let idx = 0;
  const shown = status === 'revealed' ? letters : value;
  return (
    <div className="card col" style={{ alignItems: 'center', gap: 14, padding: '20px 14px', opacity: active || finished ? 1 : 0.6 }}>
      <WordIcon name={word.icon} {...ICON_PROPS} />
      <div style={{ position: 'relative', maxWidth: '100%', '--n': Math.max(...groups, 6) }} onClick={() => input.current?.focus()}>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {groups.map((n, g) => (
            <div key={g} className="row" style={{ gap: 5 }}>
              {Array.from({ length: n }, () => {
                const k = idx++;
                const ch = shown[k] || '';
                let st = '';
                if (status === 'wrong' || status === 'revealed') st = value[k] === letters[k] ? 'ok' : 'bad';
                if (status === 'ok') st = 'ok';
                if (status === 'revealed') st = value[k] === letters[k] ? 'ok' : 'shown';
                return <span key={k} className={`cy-cell ${st} ${!finished && k === value.length ? 'cur' : ''}`}>{ch}</span>;
              })}
            </div>
          ))}
        </div>
      </div>
      {!finished && (
        // a plain visible field: hidden overlay inputs do not get focus in some webviews
        <input
          ref={input}
          className={`input ${status === 'wrong' ? 'bad' : ''}`}
          value={value}
          onChange={onType}
          placeholder={t('cyTypeWord')}
          aria-label={t('cyStep1')}
          autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done"
          style={{ textAlign: 'center', letterSpacing: '0.12em' }}
        />
      )}
      {!finished && status === 'wrong' && <div className="tiny">{t('cyTry')}</div>}
      {finished && (
        <div className="col" style={{ alignItems: 'center', gap: 2 }}>
          {status === 'revealed' && <span className="tiny">{t('cyAnswer')}</span>}
          <span className="row" style={{ gap: 8 }}>
            <b className="en" style={{ fontSize: 20 }}>{word.word}</b>
            <span className="sub">{word.ipa}</span>
          </span>
        </div>
      )}
      {showTr && <div className="pill">{loc(word, lang)}</div>}
      {active && !finished && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => { setShowTr(true); setHint(true); }}><Icon name="bulb" size={16} />{t('cyTranslation')}</button>
          <button className="btn sm ghost" onClick={openLetter}><span style={{ fontWeight: 700 }}>A</span>{t('cyLetter')}</button>
        </div>
      )}
      {active && finished && <button className="btn" onClick={() => onDone(status === 'ok' && !hint)}>{t('next')} <Icon name="arrow" size={18} /></button>}
    </div>
  );
}

// ---------- step 2: dictation by ear ----------
function SentenceStep({ sentence, t, lang, sound, onDone }) {
  const tokens = useMemo(() => tokenize(sentence.text), [sentence.id]);
  const expected = tokens.filter((x) => x.word).map((x) => x.word);
  const [value, setValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState(null); // compareWords output after a check
  const [status, setStatus] = useState('typing'); // typing | wrong | ok | revealed
  const [hint, setHint] = useState(false);
  const input = useRef(null);
  const finished = status === 'ok' || status === 'revealed';
  const play = (rate) => speak(sentence.text, { audio: sentence.audio, rate, enabled: sound });

  useEffect(() => {
    const id = setTimeout(() => { play(); input.current?.focus({ preventScroll: true }); }, 300);
    return () => clearTimeout(id);
  }, []);

  const typed = normalize(value).split(' ').filter(Boolean);
  const check = () => {
    const r = compareWords(sentence.text, value);
    setResult(r);
    if (r.every((x) => x.ok) && typed.length === expected.length) {
      setStatus('ok');
      haptic('success');
      return;
    }
    haptic('error');
    const a = attempts + 1;
    setAttempts(a);
    setStatus(a >= 2 ? 'revealed' : 'wrong');
  };
  const openWord = () => {
    const r = compareWords(sentence.text, value);
    let k = 0;
    while (k < r.length && r[k].ok) k++;
    setValue(expected.slice(0, k + 1).join(' ') + (k + 1 < expected.length ? ' ' : ''));
    setHint(true);
    setStatus('typing');
    setResult(null);
    input.current?.focus({ preventScroll: true });
  };

  // group each word with the punctuation around it
  const units = [];
  let pending = '';
  for (const tok of tokens) {
    if (tok.word) { units.push({ word: tok.word, before: pending.trim(), after: '' }); pending = ''; }
    else if (units.length) units[units.length - 1].after += tok.sep.trim();
    else pending += tok.sep;
  }
  let w = -1;
  return (
    <div className="card col" style={{ gap: 14, padding: '18px 14px', animation: 'screenIn .25s ease both' }}>
      <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
        <button className="speak lg" onClick={() => play()} aria-label={t('listen')}><Icon name="sound" size={30} /></button>
        <button className="speak" style={{ width: 52, height: 52 }} onClick={() => play(0.7)} aria-label={t('slow')}><span style={{ fontWeight: 700, fontSize: 13 }}>0.7×</span></button>
      </div>
      <div className="cy-sentence en" aria-hidden>
        {units.map((u, k) => {
          w++;
          const r = result?.[w];
          const shownWord = status === 'revealed' || status === 'ok' ? u.word : typed[w] || '';
          const st = status === 'ok' ? 'ok' : r ? (r.ok ? 'ok' : 'bad') : '';
          // punctuation stays glued to its word so a final «.» never wraps alone
          return (
            <span key={k} className="cy-unit">
              {u.before && <span className="cy-sep">{u.before}</span>}
              <span className={`cy-word ${st}`} style={{ minWidth: `${Math.max(u.word.length, 2) * 0.62}em` }}>
                {shownWord || '\u00a0'}
                {status === 'wrong' && r && !r.ok && <span className="cy-fix">{u.word}</span>}
              </span>
              {u.after && <span className="cy-sep">{u.after}</span>}
            </span>
          );
        })}
      </div>
      {!finished && (
        <>
          <input
            ref={input}
            className={`input ${status === 'wrong' ? 'bad' : ''}`}
            value={value}
            placeholder="English…"
            onChange={(e) => { setValue(e.target.value); if (status === 'wrong') { setStatus('typing'); setResult(null); } }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (normalize(value)) check(); } }}
            autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done"
          />
          {status === 'wrong' && <div className="tiny">{t('cyTry')}</div>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm ghost" onClick={openWord}><Icon name="bulb" size={16} />{t('cyWord')}</button>
            <button className="btn" style={{ flex: 1 }} disabled={!normalize(value)} onClick={check}>{t('check')}</button>
          </div>
        </>
      )}
      {finished && <div style={{ height: 210 }} aria-hidden />}
      {finished && (
        // result sheet, same look as the lesson feedback: verdict + the sentence and its translation
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, display: 'flex', justifyContent: 'center' }}>
          <div className={`fb ${status === 'ok' ? 'fb-ok' : 'fb-bad'}`} style={{ width: '100%', maxWidth: 480 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <span className="fb-icon"><Icon name={status === 'ok' ? 'check' : 'close'} size={22} stroke={3} /></span>
              <div className="col grow" style={{ gap: 6, minWidth: 0 }}>
                <div className="fb-title">{status === 'ok' ? t('correct') : t('wrong')}</div>
                <div className="fb-answer">
                  <span className="en">{sentence.text}</span>
                  {translations[sentence.id] && <span className="small" style={{ color: 'var(--text-2)' }}>{loc(translations[sentence.id], lang)}</span>}
                </div>
              </div>
              <Mascot emotion={status === 'ok' ? 'correct' : 'mistake'} size={60} anim={status === 'ok' ? 'bounce' : 'shake'} />
            </div>
            <button className="btn" onClick={() => onDone(status === 'ok' && !hint)}>{t('next')} <Icon name="arrow" size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- result ----------
function Result({ res, clean, xp, badges, t, lang, onAgain, onMissed, onHome }) {
  const total = res.length;
  const emotion = clean === total ? 'celebration' : clean < 5 ? 'encouragement' : 'correct';
  const missed = res.filter((r) => !r.clean).length;
  return (
    <div className="screen" style={{ gap: 16 }}>
      {clean === total && <Confetti />}
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 8, paddingTop: 8 }}>
        <Mascot emotion={emotion} size={160} anim="bounce" sparkles={clean >= 8} />
        <div className="h1">{t('cyDone')}</div>
        <div className="h3" style={{ color: 'var(--primary-2)' }}>{t('cyClean', { n: clean, total })}</div>
      </div>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {res.map((r) => (
          <div key={r.word.id} className={`card cy-tile ${r.clean ? '' : 'miss'}`} title={r.word.word}>
            <WordIcon name={r.word.icon} size={30} strokeWidth={1.5} color={r.clean ? 'var(--primary-2)' : 'var(--bad)'} />
            <span className="tiny en" style={{ color: 'var(--text)', fontWeight: 700 }}>{r.word.word}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="card stat"><Tile icon="star" size={36} /><b>+{xp}</b><span>XP</span></div>
        <div className="card stat"><Tile icon="target" size={36} tone="ok" /><b>{clean}/{total}</b><span>{t('cyCleanShort')}</span></div>
      </div>
      {badges.map((id) => { const b = badgeById(id); return b && (
        <div key={id} className="card row"><Tile icon={b.icon} size={44} /><div className="col" style={{ gap: 2 }}><b>{t('newBadge')} {loc(b.title, lang)}</b><span className="small">{loc(b.desc, lang)}</span></div></div>
      ); })}
      <div className="grow" />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost" onClick={onAgain}>{t('cyAgain')}</button>
        {missed > 0 && <button className="btn ghost" onClick={onMissed}>{t('cyRepeatMissed')}</button>}
      </div>
      <button className="btn" onClick={onHome}>{t('cyHome')} <Icon name="arrow" size={18} /></button>
    </div>
  );
}
