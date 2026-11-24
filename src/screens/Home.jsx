import { useEffect, useRef, useState } from 'react';
import { useStore, streakAlive, streakLost } from '../lib/store.jsx';
import { levelPercent, nextStep } from '../lib/progress.js';
import { levelInfo } from '../lib/content.js';
import { loc } from '../lib/loc.js';
import { haptic } from '../lib/telegram.js';
import { Mascot, Icon, Bar, ToneIcon } from '../components.jsx';

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

  const vocabCount = Object.keys(state.vocab).length;
  const missionsDone = 3 - missionsLeft;
  const tiles = [
    { id: 'units', icon: 'grad', tone: 0, label: t('tileLessons'), sub: t('tileLessonsSub', { level }) },
    { id: 'practice', icon: 'practice', tone: 1, label: t('tilePractice'), sub: state.mistakes.length ? t('tilePracticeSubN', { n: Math.min(state.mistakes.length, 10) }) : t('tilePracticeSub') },
    { id: 'words', icon: 'dict', tone: 2, label: t('tileWords'), sub: t('tileWordsSub', { n: vocabCount }) },
    { id: 'missions', icon: 'missions', tone: 3, label: t('tileMissions'), sub: `${missionsDone}/3`, dot: missionsLeft > 0 },
  ];

  return (
    <div className="screen with-nav" style={{ gap: 16 }}>
      <div className="row between">
        <div className="logo" style={{ fontSize: 32 }}>verbora</div>
        <div className="row" style={{ gap: 6 }}>
          <span className="pill" title={t('streak')} style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><span className="ic"><Icon name="flame" size={15} /></span>{streak}</span>
          <span className="pill"><span className="ic"><Icon name="star" size={15} /></span>{state.xp}</span>
          <button className="icon-btn bell" onClick={() => nav.push({ name: 'missions' })} aria-label={t('tileMissions')}>
            <Icon name="bell" />{missionsLeft > 0 && <i className="bell-dot" />}
          </button>
        </div>
      </div>

      {/* hero: greeting, level and Verbi holding the percentage (SPEC §4.6) */}
      <div className="hero-card home-hero">
        <div className="col" style={{ gap: 2, zIndex: 1, maxWidth: '64%' }}>
          <b style={{ fontSize: 19, lineHeight: 1.25 }}>{name ? t('hiName', { name }) : t('hiAnon')}&nbsp;👋</b>
          <span style={{ fontSize: 13.5, opacity: 0.88 }}>{lost ? t('streakLostHint') : t('readyToday')}</span>
          <span style={{ fontSize: 13, opacity: 0.88, marginTop: 14 }}>{t('yourLevel')}</span>
          <b style={{ fontSize: 16 }}>{level} — {loc(levelInfo(level).title, lang)}</b>
          <div className="hero-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className={`hero-verbi ${cheer ? '' : 'm-float'}`} style={{ right: 0, bottom: -4 }}>
          <span className="pct-bubble" style={{ transform: cheer ? 'scale(1.15)' : 'none' }}>{pct}%</span>
          <Mascot emotion={lost ? 'sad' : cheer ? 'celebration' : 'greeting'} size={132} anim={cheer ? 'bounce' : 'pop'} sparkles={cheer} />
        </div>
      </div>

      <button className="card row continue-card" onClick={cont}>
        <span className="continue-play2"><Icon name="play" size={22} fill="currentColor" stroke={0} /></span>
        <span className="col grow" style={{ gap: 1, minWidth: 0, alignItems: 'flex-start', textAlign: 'left' }}>
          <b style={{ fontSize: 16.5 }}>
            {!step ? t('openPath') : step.kind === 'lesson' ? (step.index === 0 && !state.lessonsDone[step.lesson.id] ? t('startLesson') : t('continueLesson')) : step.kind === 'checkpoint' ? t('checkpoint') : t('levelTest')}
          </b>
          {step && (
            <span className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {step.kind === 'lesson' ? `${loc(step.unit.title, lang)} · ${loc(step.lesson.title, lang)}` : step.kind === 'checkpoint' ? loc(step.unit.title, lang) : level}
            </span>
          )}
        </span>
        <Icon name="chevron" style={{ color: 'var(--muted)' }} />
      </button>

      <div className="tiles">
        {tiles.map((x) => (
          <button key={x.id} className="tile-opt small-tile" onClick={() => { haptic('light'); nav.push({ name: x.id }); }}>
            <ToneIcon icon={x.icon} tone={x.tone} size={46} />
            <span className="col" style={{ gap: 1, alignItems: 'flex-start' }}>
              <span className="tile-t">{x.label}</span>
              <span className="tile-s">{x.sub}</span>
            </span>
            {x.dot && <i className="bell-dot" style={{ top: 14, right: 14 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
