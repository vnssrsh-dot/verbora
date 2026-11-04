import { useMemo, useState } from 'react';
import { useStore, reviewWord, isDue, awardBadges } from '../lib/store.jsx';
import { allVocab } from '../lib/content.js';
import { buildPath } from '../lib/progress.js';
import { loc } from '../lib/loc.js';
import { haptic } from '../lib/telegram.js';
import { speak } from '../lib/tts.js';
import { Mascot, Icon, TopBar, Speak, Sheet, Bar, Confetti, Tile } from '../components.jsx';
import { LEVELS } from '../lib/content.js';

// Words from units the learner has opened.
export function useMyWords() {
  const { state } = useStore();
  return useMemo(() => {
    const open = new Set();
    for (const l of LEVELS) for (const u of buildPath(state, l).units) if (u.unlocked) open.add(u.id);
    return allVocab().filter((w) => open.has(w.unitId));
  }, [state.unitsPassed, state.lessonsDone, state.levelsPassed]);
}

export default function Words({ nav, t, lang }) {
  const { state, update } = useStore();
  const words = useMyWords();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const due = words.filter((w) => isDue(state.vocab[w.word]));
  const list = words.filter((w) => {
    const c = state.vocab[w.word];
    if (filter === 'new' && c) return false;
    if (filter === 'learned' && !c?.learned) return false;
    if (filter === 'due' && !isDue(c)) return false;
    if (filter === 'fav' && !state.favorites?.[w.word]) return false;
    const n = q.trim().toLowerCase();
    return !n || w.word.toLowerCase().includes(n) || loc(w, lang).toLowerCase().includes(n);
  });
  const sound = state.settings.sound;

  return (
    <div className="screen with-nav">
      <TopBar title={t('wordsTitle')} onBack={() => nav.back()} />
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: 15, color: 'var(--muted)' }}><Icon name="search" size={19} /></span>
        <input className="input" style={{ paddingLeft: 42, minHeight: 48 }} placeholder={t('searchWord')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <button className="continue" style={{ padding: '12px 16px' }} onClick={() => nav.push({ name: 'cards' })} disabled={!words.length}>
        <span className="continue-play" style={{ width: 38, height: 38, padding: 0 }}><Icon name="cards" size={19} /></span>
        <span className="col grow" style={{ gap: 0, alignItems: 'flex-start' }}>
          <b style={{ fontSize: 15, fontWeight: 600 }}>{t('cardsReview')}</b>
          <span style={{ fontSize: 12.5, opacity: 0.9 }}>{due.length ? t('cardsDue', { n: due.length }) : t('cardsNone')}</span>
        </span>
        <Icon name="chevron" />
      </button>
      <div className="chips">
        {[['all', t('all')], ['learned', t('learned')], ['fav', t('favorites')], ['due', t('due')], ['new', t('newW')]].map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {!words.length && <div className="empty"><Mascot emotion="searching" size={110} /><p>{t('wordsEmpty')}</p></div>}
      <div className="list">
        {list.map((w) => {
          const c = state.vocab[w.word];
          return (
            <div key={w.word} className="option" style={{ padding: '9px 10px 9px 12px', minHeight: 0, cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => setOpen(w)}>
              <Speak text={w.word} audio={w.audio} enabled={sound} />
              <span className="col grow" style={{ gap: 0, minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}><b className="en">{w.word}</b>{c?.learned && <span style={{ color: 'var(--ok)' }}><Icon name="check" size={15} stroke={2.6} /></span>}</span>
                <span className="small">{loc(w, lang)}</span>
              </span>
              <button className="icon-btn" aria-label={t('favorites')} aria-pressed={Boolean(state.favorites?.[w.word])}
                onClick={(e) => { e.stopPropagation(); haptic('select'); update((s) => { s.favorites = s.favorites || {}; if (s.favorites[w.word]) delete s.favorites[w.word]; else s.favorites[w.word] = 1; }); }}
                style={{ color: state.favorites?.[w.word] ? 'var(--primary)' : 'var(--muted)' }}>
                <Icon name="heart" size={20} fill={state.favorites?.[w.word] ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}
      </div>
      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <div className="row between">
            <div className="col" style={{ gap: 2 }}>
              <div className="h1 en">{open.word}</div>
              <div className="sub">{open.ipa}</div>
            </div>
            <Speak lg text={open.word} audio={open.audio} enabled={sound} />
          </div>
          <div className="h3">{loc(open, lang)}</div>
          <div className="card soft row">
            <div className="col grow" style={{ gap: 2 }}><span className="tiny">{t('example')}</span><span className="en">{open.example}</span></div>
            <Speak text={open.example} enabled={sound} />
          </div>
          <button className="btn line" onClick={() => setOpen(null)}>{t('close')}</button>
        </Sheet>
      )}
    </div>
  );
}

// Flash cards with spaced repetition (Leitner boxes, Anki-like).
export function Cards({ nav, t, lang }) {
  const { state, update } = useStore();
  const words = useMyWords();
  const deck = useMemo(() => {
    const due = words.filter((w) => state.vocab[w.word] && isDue(state.vocab[w.word]));
    const fresh = words.filter((w) => !state.vocab[w.word]).slice(0, 10);
    return [...due, ...fresh];
  }, []);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState(0);
  const sound = state.settings.sound;
  const w = deck[i];

  const answer = (k) => {
    haptic(k ? 'success' : 'light');
    update((s) => { reviewWord(s, w.word, k); awardBadges(s); });
    if (k) setKnown(known + 1);
    setFlip(false);
    setI(i + 1);
  };

  if (!w) {
    return (
      <div className="screen center" style={{ gap: 14 }}>
        {deck.length > 0 && <Confetti />}
        <Mascot emotion={deck.length ? 'celebration' : 'sleeping'} size={180} anim="bounce" />
        <div className="h2">{deck.length ? t('cardsDone') : t('cardsNone')}</div>
        {deck.length > 0 && <p className="sub">{known} / {deck.length} ✓</p>}
        <button className="btn" onClick={() => nav.back()}>{t('continue')}</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row" style={{ gap: 10 }}>
        <button className="icon-btn" onClick={() => nav.back()}><Icon name="close" /></button>
        <Bar value={(i / deck.length) * 100} style={{ flex: 1 }} />
        <span className="tiny">{i + 1}/{deck.length}</span>
      </div>
      <button key={i} className="card col" onClick={() => { setFlip(true); speak(w.word, { audio: w.audio, enabled: sound }); }}
        style={{ minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', animation: 'mPop .3s ease' }}>
        <div className="h1 en" style={{ fontSize: 38 }}>{w.word}</div>
        <div className="sub">{w.ipa}</div>
        <Speak text={w.word} audio={w.audio} enabled={sound} />
        {flip ? (
          <>
            <div className="sep" style={{ width: '60%' }} />
            <div className="h2" style={{ color: 'var(--primary-2)' }}>{loc(w, lang)}</div>
            <div className="small en">{w.example}</div>
          </>
        ) : (
          <div className="tiny row" style={{ marginTop: 20, gap: 6 }}><Icon name="hand" size={16} />{t('showAnswer')}</div>
        )}
      </button>
      <div className="grow" />
      {flip ? (
        <div className="row">
          <button className="btn ghost" onClick={() => answer(false)}>{t('dontKnow')}</button>
          <button className="btn ok" onClick={() => answer(true)}>{t('know')}</button>
        </div>
      ) : (
        <button className="btn" onClick={() => { setFlip(true); speak(w.word, { audio: w.audio, enabled: sound }); }}>{t('showAnswer')}</button>
      )}
    </div>
  );
}
