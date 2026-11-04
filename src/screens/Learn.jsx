import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { buildPath, levelUnlocked, levelPercent } from '../lib/progress.js';
import { LEVELS, levelInfo, finalTestMeta } from '../lib/content.js';
import { loc } from '../lib/loc.js';
import { haptic } from '../lib/telegram.js';
import { Mascot, Icon, Bar, Sheet, TopBar } from '../components.jsx';

// unit state on the path: done · current · open · locked
export function unitState(u) {
  if (u.complete) return 'done';
  if (u.lessons.some((l) => l.status === 'current') || u.checkpoint === 'current') return 'current';
  if (u.unlocked) return 'open';
  return 'locked';
}

function StatusMark({ st, size = 30 }) {
  if (st === 'done') return <span className="u-mark ok" style={{ width: size, height: size }}><Icon name="check" size={size * 0.55} stroke={3} /></span>;
  if (st === 'current') return <span className="u-mark cur" style={{ width: size, height: size }}><Icon name="play" size={size * 0.45} fill="currentColor" stroke={0} /></span>;
  if (st === 'locked') return <span className="u-mark lock" style={{ width: size, height: size }}><Icon name="lock" size={size * 0.5} /></span>;
  return <span className="u-mark open" style={{ width: size, height: size }} />;
}

function LevelChips({ level, setLevel, state }) {
  return (
    <div className="chips">
      {LEVELS.map((l) => {
        const open = levelUnlocked(state, l);
        return (
          <button key={l} className={`chip ${l === level ? 'on' : ''}`} disabled={!open} onClick={() => { haptic('select'); setLevel(l); }}>
            {!open && <span className="ic" style={{ marginRight: 4 }}><Icon name="lock" size={13} /></span>}{l}
          </button>
        );
      })}
    </div>
  );
}

// «Твій шлях» — units as pills on a winding line (Valeria's mockup)
export default function Learn({ nav, t, lang }) {
  const { state } = useStore();
  const [level, setLevel] = useState(state.currentLevel);
  const path = buildPath(state, level);
  const pct = levelPercent(state, level);
  const final = finalTestMeta(level);

  const ROW = 72;
  const X = [6, 22, 36, 22]; // percent offsets for the zigzag
  const units = path.units;
  const pts = units.map((_, i) => ({ x: X[i % X.length], y: i * ROW + 30 }));
  const height = units.length * ROW + 10;
  const d = pts.map((p, i) => (i === 0 ? `M${p.x + 8},${p.y}` : `C${pts[i - 1].x + 8},${pts[i - 1].y + ROW / 2} ${p.x + 8},${p.y - ROW / 2} ${p.x + 8},${p.y}`)).join(' ');

  return (
    <div className="screen with-nav">
      <div className="h1">{t('yourPath')}</div>
      <LevelChips level={level} setLevel={setLevel} state={state} />
      <div className="card row" style={{ padding: '14px 16px' }}>
        <div className="col grow" style={{ gap: 6 }}>
          <span className="small">{level} — {loc(levelInfo(level).title, lang)}</span>
          <Bar value={pct} />
        </div>
        <b style={{ fontSize: 20 }}>{pct}%</b>
      </div>

      <div style={{ position: 'relative', height, marginTop: 4 }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          <path d={d} fill="none" stroke="var(--primary-soft)" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="color-mix(in srgb, var(--primary) 30%, transparent)" strokeWidth="3" strokeDasharray="1 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {units.map((u, i) => {
          const st = unitState(u);
          return (
            <button
              key={u.id}
              className={`u-pill ${st}`}
              style={{ position: 'absolute', top: pts[i].y - 26, left: `${pts[i].x}%` }}
              onClick={() => { haptic('light'); nav.push({ name: 'unit', unitId: u.id, level }); }}
            >
              <StatusMark st={st} />
              <span className="col" style={{ gap: 0, minWidth: 0, alignItems: 'flex-start' }}>
                <b className="u-pill-t">{t('unit')} {i + 1}</b>
                <span className="u-pill-s">{loc(u.title, lang)}</span>
              </span>
              {st === 'current' && <span className={`u-verbi ${pts[i].x > 25 ? 'left' : ''}`}><Mascot emotion="greeting" size={54} /></span>}
            </button>
          );
        })}
      </div>

      {final && (
        <button className={`card row ${path.finalTest === 'locked' ? 'dim-card' : ''}`} onClick={() => path.finalTest !== 'locked' && nav.push({ name: 'lesson', mode: 'level', level })}>
          <StatusMark st={path.finalTest === 'done' ? 'done' : path.finalTest === 'current' ? 'current' : 'locked'} size={36} />
          <span className="col grow" style={{ gap: 0, textAlign: 'left' }}>
            <b>{t('levelTest')} {level}</b>
            <span className="small">{final.count} · {t('levelTestSub')}</span>
          </span>
          <Icon name="chevron" />
        </button>
      )}
    </div>
  );
}

// Unit page: its lessons and the checkpoint
export function UnitScreen({ nav, t, lang, route }) {
  const { state } = useStore();
  const level = route.level;
  const path = buildPath(state, level);
  const idx = path.units.findIndex((x) => x.id === route.unitId);
  const u = path.units[idx];
  const [info, setInfo] = useState(null);
  if (!u) return null;
  const done = u.lessons.filter((l) => l.status === 'done' || l.status === 'refresh').length;
  const open = (l) => {
    if (l.status === 'locked') return setInfo({ title: t('locked'), text: t('lockedLesson') });
    nav.push({ name: 'lesson', mode: 'lesson', lessonId: l.id });
  };
  return (
    <div className="screen">
      <TopBar onBack={() => nav.back()} title="" />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="col grow" style={{ gap: 4 }}>
          <span className="small">{t('unit')} {idx + 1} · {u.kind === 'vocab' ? t('kindVocab') : t('kindGrammar')}</span>
          <div className="h1">{loc(u.title, lang)}</div>
        </div>
        <Mascot emotion={u.complete ? 'badge' : 'explaining'} size={86} />
      </div>
      <div className="row"><Bar value={(done / u.lessons.length) * 100} style={{ flex: 1 }} /><span className="small">{done}/{u.lessons.length}</span></div>
      <div className="list">
        {u.lessons.map((l) => {
          const st = l.status === 'refresh' ? 'done' : l.status === 'available' ? 'open' : l.status;
          return (
            <button key={l.id} className={`option ${l.status === 'current' ? 'sel' : ''} ${l.status === 'locked' ? 'dim' : ''}`} onClick={() => open(l)}>
              <span className="ico"><Icon name={u.kind === 'vocab' ? 'book' : 'grammar'} /></span>
              <span className="col grow" style={{ gap: 0 }}>
                <span className="title">{t('lesson')} {l.index + 1}</span>
                <span className="small">{loc(l.title, lang)}</span>
              </span>
              {l.status === 'refresh' ? <span className="pill" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>{t('refresh')}</span> : <StatusMark st={st} size={26} />}
            </button>
          );
        })}
        <button className={`option ${u.checkpoint === 'current' ? 'sel' : ''} ${u.checkpoint === 'locked' && !u.canJump ? 'dim' : ''}`}
          onClick={() => {
            if (u.checkpoint !== 'locked') return nav.push({ name: 'lesson', mode: 'checkpoint', unitId: u.id });
            setInfo({ title: t('checkpoint'), text: u.unlocked ? t('checkpointSub') : t('jumpHint'), action: () => nav.push({ name: 'lesson', mode: 'checkpoint', unitId: u.id }), actionLabel: t('skipUnit') });
          }}>
          <span className="ico"><Icon name={u.complete ? 'trophy' : 'gift'} /></span>
          <span className="col grow" style={{ gap: 0 }}>
            <span className="title">{t('checkpoint')}</span>
            <span className="small">{t('checkpointSub')}</span>
          </span>
          <StatusMark st={u.checkpoint === 'done' ? 'done' : u.checkpoint === 'current' ? 'current' : u.checkpoint === 'available' ? 'open' : 'locked'} size={26} />
        </button>
      </div>
      {info && (
        <Sheet onClose={() => setInfo(null)}>
          <div className="row"><Mascot emotion="thinking" size={80} /><div className="col" style={{ gap: 4 }}><b>{info.title}</b><span className="small">{info.text}</span></div></div>
          {info.action && <button className="btn" onClick={() => { setInfo(null); info.action(); }}>{info.actionLabel}</button>}
          <button className="btn ghost" onClick={() => setInfo(null)}>{t('close')}</button>
        </Sheet>
      )}
    </div>
  );
}

// «Уроки»: all units of a level as a list (mockup «Курси» screen)
export function UnitsList({ nav, t, lang }) {
  const { state } = useStore();
  const [level, setLevel] = useState(state.currentLevel);
  const path = buildPath(state, level);
  return (
    <div className="screen">
      <TopBar onBack={() => nav.back()} title={t('lessonsTitle')} />
      <LevelChips level={level} setLevel={setLevel} state={state} />
      <div className="list">
        {path.units.map((u, i) => {
          const st = unitState(u);
          return (
            <button key={u.id} className={`option ${st === 'current' ? 'sel' : ''}`} onClick={() => nav.push({ name: 'unit', unitId: u.id, level })}>
              <span className="ico"><Icon name="folder" /></span>
              <span className="col grow" style={{ gap: 0, minWidth: 0 }}>
                <span className="title">{t('unit')} {i + 1}</span>
                <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc(u.title, lang)}</span>
              </span>
              <StatusMark st={st} size={26} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
