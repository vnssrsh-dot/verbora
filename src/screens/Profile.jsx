import { useState } from 'react';
import { useStore, streakAlive, freshState, today } from '../lib/store.jsx';
import { LEVELS, topicName, levelInfo } from '../lib/content.js';
import GrammarMap from './GrammarMap.jsx';
import { levelPercent, currentLevel } from '../lib/progress.js';
import { BADGES } from '../lib/badges.js';
import { loc } from '../lib/loc.js';
import { tgUser } from '../lib/telegram.js';
import { PRIVACY, PRIVACY_DATE } from '../lib/privacy.js';
import { TopBar, Icon, Mascot, Bar, Toggle, Sheet, Tile } from '../components.jsx';

function weekDates() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() - dow + i); return today(x); });
}

export default function Profile({ nav, t, lang }) {
  const { state } = useStore();
  const lvl = state.currentLevel || currentLevel(state);
  const streak = streakAlive(state);
  const name = state.profile.name || tgUser()?.first_name || t('learner');
  const lessons = Object.keys(state.lessonsDone).filter((id) => !id.startsWith('x-')).length;
  const got = Object.keys(state.badges).length;
  const rows = [
    { icon: 'award', label: t('myAchievements'), right: `${got}/${BADGES.length}`, go: () => nav.push({ name: 'achievements' }) },
    { icon: 'results', label: t('myResults'), go: () => nav.tab('progress') },
    { icon: 'dict', label: t('tileWords'), go: () => nav.push({ name: 'words' }) },
    { icon: 'gear', label: t('settings'), go: () => nav.push({ name: 'settings' }) },
    { icon: 'info', label: t('privacy'), go: () => nav.push({ name: 'privacy' }) },
  ];
  return (
    <div className="screen with-nav">
      <TopBar title={t('profile')} />
      <div className="col" style={{ alignItems: 'center', gap: 4 }}>
        <div className="avatar"><Mascot emotion="idle" size={96} /></div>
        <button className="row" style={{ gap: 8, marginTop: 6 }} onClick={() => nav.push({ name: 'settings' })} aria-label={t('yourName')}>
          <span className="h2">{name}</span><Icon name="pencil" size={18} style={{ color: 'var(--primary-2)' }} />
        </button>
        <div className="sub">{lvl} — {loc(levelInfo(lvl).title, lang)}</div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="card stat"><Icon name="flame" size={22} style={{ color: 'var(--warn)' }} /><b>{streak}</b><span>{t('streakDaysShort')}</span></div>
        <div className="card stat"><Icon name="star" size={22} style={{ color: 'var(--accent)' }} /><b>{state.xp}</b><span>XP</span></div>
        <div className="card stat"><Icon name="box" size={22} style={{ color: 'var(--primary)' }} /><b>{lessons}</b><span>{t('lessonsShort')}</span></div>
      </div>
      <div className="card menu">
        {rows.map((r) => (
          <button key={r.label} className="menu-row" onClick={r.go}>
            <Icon name={r.icon} size={20} />
            <span className="grow">{r.label}</span>
            {r.right && <span className="small">{r.right}</span>}
            <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// «Мої досягнення»
export function Achievements({ nav, t, lang }) {
  const { state } = useStore();
  return (
    <div className="screen">
      <TopBar onBack={() => nav.back()} title={t('myAchievements')} />
      <div className="grid3">
        {BADGES.map((b) => {
          const got = state.badges[b.id];
          if (b.hidden && !got) return <div key={b.id} className="card badge-tile off"><Tile icon="question" size={52} tone="plain" /><span className="tiny">???</span></div>;
          return (
            <div key={b.id} className={`card badge-tile ${got ? '' : 'off'}`}>
              <Tile icon={b.icon} size={52} tone={got ? 'primary' : 'plain'} />
              <b style={{ fontSize: 12 }}>{loc(b.title, lang)}</b>
              <span className="tiny">{loc(b.desc, lang)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// «Прогрес»: streak, levels, topics and the grammar map
export function ProgressScreen({ nav, t, lang }) {
  const { state } = useStore();
  const streak = streakAlive(state);
  const week = weekDates();
  const topics = Object.entries(state.topics).filter(([, r]) => r.ok + r.bad > 0).slice(-12);
  return (
    <div className="screen with-nav">
      <TopBar title={t('progress')} />
      <div className="card col" style={{ gap: 12 }}>
        <div className="row between"><b>{t('streak')}</b><span className="small">{t('streakDays', { n: streak })}</span></div>
        <div className="row between">
          {week.map((d, i) => {
            const on = state.week[d];
            const isToday = d === today();
            return (
              <div key={d} className="col" style={{ alignItems: 'center', gap: 6 }}>
                <span className="tiny">{t('weekDays')[i]}</span>
                <span className={`wk ${on ? 'on' : ''} ${isToday ? 'today' : ''}`}>{on ? <Icon name="check" size={14} stroke={3} /> : null}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card col" style={{ gap: 10 }}>
        <b>{t('overall')}</b>
        {LEVELS.map((l) => (
          <div key={l} className="row" style={{ gap: 10 }}>
            <span style={{ width: 28, fontWeight: 700 }}>{l}</span>
            <Bar value={levelPercent(state, l)} style={{ flex: 1 }} />
            <span className="tiny" style={{ width: 34, textAlign: 'right' }}>{levelPercent(state, l)}%</span>
          </div>
        ))}
      </div>
      {topics.length > 0 && (
        <div className="card col" style={{ gap: 10 }}>
          <b>{t('topicsStats')}</b>
          {topics.map(([tp, r]) => {
            const acc = Math.round((r.ok / (r.ok + r.bad)) * 100);
            return (
              <div key={tp} className="col" style={{ gap: 4 }}>
                <div className="row between"><span className="small" style={{ color: 'var(--text)' }}>{topicName(tp, lang)}</span><span className="tiny">{acc}%</span></div>
                <Bar value={acc} style={{ height: 6 }} />
              </div>
            );
          })}
        </div>
      )}
      <GrammarMap nav={nav} t={t} lang={lang} embedded />
    </div>
  );
}

export function Settings({ nav, t, lang }) {
  const { state, update, replace } = useStore();
  const [confirm, setConfirm] = useState(false);
  const row = (icon, title, right, onClick) => (
    <button className="row" style={{ padding: '14px 4px', width: '100%', textAlign: 'left' }} onClick={onClick}>
      <span style={{ color: 'var(--primary-2)' }}><Icon name={icon} /></span>
      <span className="grow" style={{ fontWeight: 700 }}>{title}</span>
      {right}
    </button>
  );
  return (
    <div className="screen">
      <TopBar title={t('settings')} onBack={() => nav.back()} />
      <div className="card col" style={{ gap: 10 }}>
        <b>{t('language')}</b>
        <div className="grid2">
          {[['ua', 'Українська'], ['ru', 'Русский']].map(([id, label]) => (
            <button key={id} className={`option ${lang === id ? 'sel' : ''}`} style={{ minHeight: 50, justifyContent: 'center' }} onClick={() => update((s) => { s.lang = id; })}>
              <span className="title">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card col" style={{ gap: 8 }}>
        <b>{t('yourName')}</b>
        <input className="input" value={state.profile.name} maxLength={40} placeholder={t('learner')} onChange={(e) => { const v = e.target.value; update((s) => { s.profile.name = v; }); }} />
      </div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {row('sound', t('sound'), <Toggle on={state.settings.sound} onChange={(v) => update((s) => { s.settings.sound = v; })} />)}
        <div className="sep" />
        {row('moon', t('theme'), <span className="small">{state.settings.theme === 'dark' ? t('themeDark') : t('themeLight')}</span>, () => update((s) => { s.settings.theme = s.settings.theme === 'dark' ? 'light' : 'dark'; }))}
        <div className="sep" />
        {row('info', t('privacy'), <Icon name="chevron" />, () => nav.push({ name: 'privacy' }))}
        <div className="sep" />
        {row('trash', t('reset'), <Icon name="chevron" />, () => setConfirm(true))}
      </div>
      <div className="card row">
        <Mascot emotion="thanks" size={80} />
        <div className="col" style={{ gap: 4 }}><b>{t('about')}</b><span className="small">{t('aboutText')}</span><span className="tiny">v0.1 · @verbora_englishbot</span></div>
      </div>
      {confirm && (
        <Sheet onClose={() => setConfirm(false)}>
          <div className="row"><Mascot emotion="surprised" size={80} /><span className="small" style={{ color: 'var(--text)' }}>{t('resetConfirm')}</span></div>
          <button className="btn bad" onClick={() => { const f = freshState(); f.lang = state.lang; replace(f); nav.tab('home'); }}>{t('reset')}</button>
          <button className="btn line" onClick={() => setConfirm(false)}>{t('close')}</button>
        </Sheet>
      )}
    </div>
  );
}

export function Privacy({ nav, t, lang }) {
  const doc = PRIVACY[lang] || PRIVACY.ua;
  return (
    <div className="screen">
      <TopBar title="" onBack={() => nav.back()} />
      <div className="h1" style={{ textWrap: 'balance' }}>{doc.title}</div>
      <p className="small">{doc.intro.replace('{date}', PRIVACY_DATE[lang] || PRIVACY_DATE.ua)}</p>
      {doc.sections.map((sec) => (
        <section key={sec.h} className="col" style={{ gap: 8 }}>
          <div className="h3">{sec.h}</div>
          {(sec.p || []).map((x, i) => <p key={i} style={{ lineHeight: 1.55, fontSize: 15 }}>{x}</p>)}
          {sec.l && (
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5, fontSize: 15 }}>
              {sec.l.map((x, i) => <li key={i} dangerouslySetInnerHTML={{ __html: x }} />)}
            </ul>
          )}
          {(sec.after || []).map((x, i) => <p key={i} style={{ lineHeight: 1.55, fontSize: 15 }}>{x}</p>)}
        </section>
      ))}
      <button className="btn ghost" onClick={() => nav.back()}>{t('back')}</button>
    </div>
  );
}
