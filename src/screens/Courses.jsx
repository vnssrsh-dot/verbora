import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { transcription, ipaSounds, CHECK_YOURSELF, cyPeriod, cyMsToNext } from '../lib/content.js';
import { loc } from '../lib/loc.js';
import { speak } from '../lib/tts.js';
import { haptic } from '../lib/telegram.js';
import { TopBar, Icon, Mascot, Bar, Tile, ToneIcon } from '../components.jsx';

export default function Courses({ nav, t, lang }) {
  const { state } = useStore();
  const u = transcription;
  const done = u.lessons.filter((l) => state.lessonsDone[l.id]).length;
  const passed = Boolean(state.unitsPassed[u.id]);
  const pct = Math.round(((done + (passed ? 1 : 0)) / (u.lessons.length + 1)) * 100);
  return (
    <div className="screen with-nav">
      <TopBar title={t('coursesTitle')} />
      <div className="hero-card" style={{ minHeight: 160, alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 4, zIndex: 1, maxWidth: '60%' }}>
          <span className="hero-chip">{t('ipaPill')}</span>
          <b style={{ fontSize: 19, lineHeight: 1.25, marginTop: 4 }}>{t('ipaCourse')}</b>
          <span style={{ fontSize: 13, opacity: 0.88 }}>{t('ipaCourseSub')}</span>
          <div className="hero-bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="hero-verbi" style={{ right: 2, bottom: -6 }}><Mascot emotion={passed ? 'badge' : 'listening'} size={128} /></div>
      </div>
      <div className="list">
        {u.lessons.map((l, i) => {
          const isDone = Boolean(state.lessonsDone[l.id]);
          const open = i === 0 || state.lessonsDone[u.lessons[i - 1].id] || passed;
          return (
            <button key={l.id} className={`option ${open ? '' : 'dim'}`} disabled={!open} onClick={() => nav.push({ name: 'lesson', mode: 'lesson', lessonId: l.id })}>
              <ToneIcon tone={isDone ? 2 : i % 5} size={38}>{isDone ? <Icon name="check" size={18} stroke={2.6} /> : open ? <b>{i + 1}</b> : <Icon name="lock" size={16} />}</ToneIcon>
              <span className="title grow">{loc(l.title, lang)}</span>
              <Icon name="chevron" style={{ color: 'var(--muted)' }} />
            </button>
          );
        })}
        <button className={`option ${done === u.lessons.length || passed ? '' : 'dim'}`} disabled={!(done === u.lessons.length || passed)} onClick={() => nav.push({ name: 'lesson', mode: 'checkpoint', unitId: u.id })}>
          <ToneIcon icon={passed ? 'medal' : 'flag'} tone={1} size={38} />
          <span className="title grow">{t('finalChallenge')}</span>
          <Icon name="chevron" style={{ color: 'var(--muted)' }} />
        </button>
      </div>
      <div className="h3" style={{ marginTop: 6 }}>{t('moreSkills')}</div>
      <div className="tiles">
        {CHECK_YOURSELF && <CheckTile state={state} nav={nav} t={t} />}
        <button className="tile-opt small-tile" onClick={() => nav.push({ name: 'sounds' })}>
          <ToneIcon tone={3} size={46}><b style={{ fontSize: 22 }}>ʃ</b></ToneIcon>
          <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}><span className="tile-t">{t('soundTable')}</span><span className="tile-s">{t('soundTableSub')}</span></span>
        </button>
        {[[t('ieltsSoon'), 'cap', 1], [t('nicheSoon'), 'briefcase', 4]].map(([title, ic, tone]) => (
          <div key={title} className="tile-opt small-tile dim-card">
            <ToneIcon icon={ic} tone={tone} size={46} />
            <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}><span className="tile-t">{title}</span><span className="tile-s">{t('comingSoon')}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SoundTable({ nav, t, lang }) {
  const { state } = useStore();
  const [active, setActive] = useState(null);
  const play = (s) => {
    haptic('light');
    setActive(s.ipa);
    speak(s.words.join(', '), { enabled: state.settings.sound, slow: true });
  };
  return (
    <div className="screen">
      <TopBar title={t('soundTable')} onBack={() => nav.back()} />
      <p className="small">{t('soundTableSub')}</p>
      {ipaSounds.groups.map((g) => (
        <section key={g.id} className="col" style={{ gap: 8 }}>
          <div className="h3">{loc(g.title, lang)}</div>
          <div className="grid3">
            {g.sounds.map((s) => (
              <button key={s.ipa} className="card col" onClick={() => play(s)}
                style={{ alignItems: 'center', gap: 2, padding: '12px 6px', outline: active === s.ipa ? '2px solid var(--primary)' : 'none', background: active === s.ipa ? 'var(--primary-soft)' : 'var(--surface)' }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary-2)' }}>/{s.ipa}/</span>
                <span className="tiny en" style={{ color: 'var(--text)' }}>{s.words.join(' · ')}</span>
                {active === s.ipa && <span className="tiny">{loc(s.hint, lang)}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CheckTile({ state, nav, t }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  const done = state.cy?.done?.[cyPeriod(now)];
  let status = t('cyNew');
  if (done) {
    const ms = cyMsToNext(now);
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    status = d > 0 ? t('cyNext', { d, h }) : t('cyNextH', { h, m });
  }
  return (
    <button className="tile-opt small-tile" onClick={() => nav.push({ name: 'check' })}>
      <ToneIcon icon="headphones" tone={0} size={46} />
      <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}>
        <span className="tile-t">{t('cyTitle')}</span>
        <span className="tile-s">{t('cySub')}</span>
        <span className="tiny" style={{ color: done ? 'var(--text-2)' : 'var(--primary-2)', fontWeight: 700, marginTop: 2 }}>{done ? `${done.clean}/${done.total} · ${status}` : status}</span>
      </span>
    </button>
  );
}
