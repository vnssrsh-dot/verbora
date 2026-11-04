import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useStore } from './lib/store.jsx';
import { makeT } from './lib/i18n.js';
import { loadUnit, findLessonMeta, levelPath, loadExercises, loadFinalTest } from './lib/content.js';
import { buildRecap } from './lib/progress.js';
import { loc } from './lib/loc.js';
import { Icon, Mascot } from './components.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Lesson from './screens/Lesson.jsx';
import Words, { Cards } from './screens/Words.jsx';
import GrammarMap from './screens/GrammarMap.jsx';
import Courses, { SoundTable } from './screens/Courses.jsx';
import Profile, { Settings, Privacy } from './screens/Profile.jsx';

const CheckYourself = lazy(() => import('./checkyourself/CheckYourself.jsx'));

const TABS = [
  { id: 'home', icon: 'home', label: 'tabHome' },
  { id: 'words', icon: 'book', label: 'tabWords' },
  { id: 'map', icon: 'map', label: 'tabMap' },
  { id: 'courses', icon: 'grad', label: 'tabCourses' },
  { id: 'profile', icon: 'user', label: 'tabProfile' },
];

let keySeq = 0;
const mk = (r) => ({ ...r, key: ++keySeq });

export default function App() {
  const { state } = useStore();
  const lang = state.lang || 'ua';
  const t = useMemo(() => makeT(lang), [lang]);
  const [stack, setStack] = useState(() => [mk({ name: 'home' })]);
  const current = stack[stack.length - 1];

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uk';
  }, [state.settings.theme, lang]);

  const nav = useMemo(() => ({
    current,
    push: (r) => setStack((s) => [...s, mk(r)]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : [mk({ name: 'home' })])),
    replace: (r) => setStack((s) => [...s.slice(0, -1), mk(r)]),
    tab: (name) => setStack([mk({ name })]),
  }), [current]);

  // Telegram native back button
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb || !window.Telegram.WebApp.initData) return;
    const handler = () => nav.back();
    if (stack.length > 1 && current.name !== 'lesson') { bb.show(); bb.onClick(handler); } else bb.hide();
    return () => bb.offClick(handler);
  }, [stack, nav]);

  useEffect(() => { window.scrollTo(0, 0); }, [current.key]);

  if (!state.onboarded) return <div className="app"><Onboarding t={t} lang={lang} /></div>;

  const props = { nav, t, lang };
  let body = null;
  switch (current.name) {
    case 'home': body = <Home {...props} />; break;
    case 'words': body = <Words {...props} />; break;
    case 'cards': body = <Cards {...props} />; break;
    case 'map': body = <GrammarMap {...props} />; break;
    case 'courses': body = <Courses {...props} />; break;
    case 'sounds': body = <SoundTable {...props} />; break;
    case 'profile': body = <Profile {...props} />; break;
    case 'settings': body = <Settings {...props} />; break;
    case 'privacy': body = <Privacy {...props} />; break;
    case 'check': body = (
      <Suspense fallback={<div className="screen center"><Mascot emotion="searching" size={150} /><div className="small">{t('loading')}</div></div>}>
        <CheckYourself {...props} />
      </Suspense>
    ); break;
    case 'lesson': body = <LessonRoute key={current.key} route={current} state={state} {...props} />; break;
    default: body = <Home {...props} />;
  }
  const showNav = TABS.some((x) => x.id === current.name);
  return (
    <div className="app">
      {body}
      {showNav && (
        <nav className="nav">
          {TABS.map((x) => (
            <button key={x.id} className={current.name === x.id ? 'on' : ''} onClick={() => nav.tab(x.id)}>
              <Icon name={x.icon} />
              {t(x.label)}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// Resolves a lesson route into the data the player needs (units are loaded on demand).
async function resolveRoute(route, state, t, lang) {
  if (route.mode === 'lesson') {
    const f = findLessonMeta(route.lessonId);
    if (!f) return null;
    const unit = await loadUnit(f.unit.id);
    let prevUnit = null;
    if (f.index === 0 && f.unit.level !== 'extra') {
      const path = levelPath(f.unit.level);
      const pos = path.findIndex((u) => u.id === f.unit.id);
      if (pos > 0) prevUnit = await loadUnit(path[pos - 1].id);
    }
    const lesson = unit.lessons[f.index];
    return {
      unit,
      lesson,
      recap: buildRecap(state, unit, f.index, prevUnit),
      title: `${t('lesson')} ${f.index + 1} · ${loc(lesson.title, lang)}`,
    };
  }
  if (route.mode === 'checkpoint') {
    const u = await loadUnit(route.unitId);
    return u && { unit: u, exercises: u.checkpoint, title: `${u.kind === 'course' ? t('finalChallenge') : t('checkpoint')} · ${loc(u.title, lang)}` };
  }
  if (route.mode === 'level') {
    const f = await loadFinalTest(route.level);
    return f && { exercises: f.exercises, pass: f.pass_score ?? 0.8, level: route.level, title: loc(f.title, lang) || `${t('levelTest')} ${route.level}` };
  }
  if (route.mode === 'mistakes') {
    return { exercises: (await loadExercises(state.mistakes.slice(0, 10))), title: t('workOnMistakes') };
  }
  return null;
}

function LessonRoute({ route, state, nav, t, lang }) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let alive = true;
    resolveRoute(route, state, t, lang).then((d) => alive && setData(d || null)).catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [route.key]);
  const empty = data === null || (data && data.exercises && !data.exercises.length);
  useEffect(() => { if (empty) nav.back(); }, [empty]);
  if (data === undefined) {
    return (
      <div className="screen center">
        <Mascot emotion="searching" size={150} />
        <div className="small">{t('loading')}</div>
      </div>
    );
  }
  if (empty) return null;
  return <Lesson mode={route.mode} {...data} nav={nav} t={t} lang={lang} />;
}
