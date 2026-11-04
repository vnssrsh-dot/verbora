import { useEffect, useRef, useState } from 'react';
import { useStore, streakAlive, streakLost } from '../lib/store.jsx';
import { levelPercent, nextStep } from '../lib/progress.js';
import { levelInfo } from '../lib/content.js';
import { loc } from '../lib/loc.js';
import { haptic } from '../lib/telegram.js';
import { Mascot, Icon, Bar } from '../components.jsx';

// Home (Valeria's mockup): greeting with Verbi, level card, «continue» card, quick tiles.
export default function Home({ nav, t, lang }) {
  const { state } = useStore();
  const level = state.currentLevel;
  const pct = levelPercent(state, level);
  const prevPct = useRef(pct);
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (pct > prevPct.current) { setCheer(true); const id = setTimeout(() => setCheer(false), 1600); prevPct.current = pct; return () => clearTimeout(id); }
  }, [pct]);

  const step = nextStep(state, level);
  const streak = streakAlive(state);
  const lost = streakLost(state);
  const name = state.profile.name;
  const missionsLeft = [state.daily.lessons >= 1, state.daily.words >= 5, state.daily.correct >= 15].filter((x) => !x).length;

  const cont = () => {
    if (!step) return nav.tab('learn');
    haptic('medium');
    if (step.kind === 'lesson') nav.push({ name: 'lesson', mode: 'lesson', lessonId: step.lesson.id });
    else if (step.kind === 'checkpoint') nav.push({ name: 'lesson', mode: 'checkpoint', unitId: step.unit.id });
    else nav.push({ name: 'lesson', mode: 'level', level });
  };

  const tiles = [
    { id: 'units', icon: 'grad', label: t('tileLessons') },
    { id: 'practice', icon: 'practice', label: t('tilePractice') },
    { id: 'words', icon: 'dict', label: t('tileWords') },
    { id: 'missions', icon: 'missions', label: t('tileMissions'), dot: missionsLeft > 0 },
  ];

  return (
    <div className="screen with-nav" style={{ gap: 18 }}>
      <div className="row between">
        <div className="logo" style={{ fontSize: 32 }}>verbora</div>
        <div className="row" style={{ gap: 6 }}>
          <span className="pill" title={t('streak')} style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><span className="ic"><Icon name="flame" size={15} /></span>{streak}</span>
          <button className="icon-btn bell" onClick={() => nav.push({ name: 'missions' })} aria-label={t('tileMissions')}>
            <Icon name="bell" />{missionsLeft > 0 && <i className="bell-dot" />}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div className="col" style={{ gap: 2, paddingRight: 110 }}>
          <div className="h2">{name ? t('hiName', { name }) : t('hiAnon')} 👋</div>
          <div className="small">{lost ? t('streakLostHint') : t('readyToday')}</div>
        </div>
        <div style={{ position: 'absolute', right: -6, top: -10, zIndex: 1 }} className={cheer ? '' : 'm-float'}>
          <Mascot emotion={lost ? 'sad' : cheer ? 'celebration' : 'greeting'} size={96} anim={cheer ? 'bounce' : 'pop'} sparkles={cheer} />
        </div>
      </div>

      <div className="card" style={{ padding: '16px 16px 18px' }}>
        <div className="small">{t('yourLevel')}</div>
        <div className="row between" style={{ marginTop: 2 }}>
          <b style={{ fontSize: 16 }}>{level} — {loc(levelInfo(level).title, lang)}</b>
          <b style={{ fontSize: 22, letterSpacing: '-0.02em', transform: cheer ? 'scale(1.12)' : 'none', transition: 'transform .3s' }}>{pct}%</b>
        </div>
        <Bar value={pct} style={{ marginTop: 10 }} />
      </div>

      <button className="continue" onClick={cont}>
        <span className="continue-play"><Icon name="play" size={20} fill="currentColor" stroke={0} /></span>
        <span className="col" style={{ gap: 1, minWidth: 0, alignItems: 'flex-start', textAlign: 'left' }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>
            {!step ? t('openPath') : step.kind === 'lesson' ? (step.index === 0 && !state.lessonsDone[step.lesson.id] ? t('startLesson') : t('continueLesson')) : step.kind === 'checkpoint' ? t('checkpoint') : t('levelTest')}
          </span>
          {step && (
            <span style={{ fontSize: 13, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {step.kind === 'lesson' ? `${loc(step.unit.title, lang)} · ${loc(step.lesson.title, lang)}` : step.kind === 'checkpoint' ? loc(step.unit.title, lang) : level}
            </span>
          )}
        </span>
      </button>

      <div className="quick">
        {tiles.map((x) => (
          <button key={x.id} onClick={() => { haptic('light'); nav.push({ name: x.id }); }} style={{ position: 'relative' }}>
            <Icon name={x.icon} size={26} stroke={1.6} />
            {x.label}
            {x.dot && <i className="bell-dot" style={{ top: 10, right: 14 }} />}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="card stat"><Icon name="flame" size={22} style={{ color: 'var(--warn)' }} /><b>{streak}</b><span>{t('streakDaysShort')}</span></div>
        <div className="card stat"><Icon name="star" size={22} style={{ color: 'var(--accent)' }} /><b>{state.xp}</b><span>XP</span></div>
        <div className="card stat"><Icon name="target" size={22} style={{ color: 'var(--ok)' }} /><b>{state.daily.correct}</b><span>{t('correctToday')}</span></div>
      </div>
    </div>
  );
}
