import { useStore, isDue, MISSIONS } from '../lib/store.jsx';
import { Mascot, Icon, Bar, TopBar } from '../components.jsx';
import { useMyWords } from './Words.jsx';

// «Практика»: everything that trains what was already learned.
export function Practice({ nav, t }) {
  const { state } = useStore();
  const words = useMyWords();
  const due = words.filter((w) => isDue(state.vocab[w.word])).length;
  const mistakes = Math.min(state.mistakes.length, 10);
  const rows = [
    { icon: 'refresh', title: t('workOnMistakes'), sub: mistakes ? t('workOnMistakesSub', { n: mistakes }) : t('noMistakes'), go: mistakes ? () => nav.push({ name: 'lesson', mode: 'mistakes' }) : null },
    { icon: 'cards', title: t('cardsReview'), sub: due ? t('cardsDue', { n: due }) : t('cardsNone'), go: words.length ? () => nav.push({ name: 'cards' }) : null },
    { icon: 'headphones', title: t('cyTitle'), sub: t('cySub'), go: () => nav.push({ name: 'check' }) },
    { icon: 'sound', title: t('soundTable'), sub: t('soundTableSub'), go: () => nav.push({ name: 'sounds' }) },
  ];
  return (
    <div className="screen">
      <TopBar onBack={() => nav.back()} title={t('tilePractice')} />
      <div className="row">
        <p className="sub grow">{t('practiceSub')}</p>
        <Mascot emotion="explaining" size={86} />
      </div>
      <div className="list">
        {rows.map((r) => (
          <button key={r.title} className={`option ${r.go ? '' : 'dim'}`} disabled={!r.go} onClick={r.go || undefined}>
            <span className="ico"><Icon name={r.icon} /></span>
            <span className="col grow" style={{ gap: 0 }}><span className="title">{r.title}</span><span className="small">{r.sub}</span></span>
            <Icon name="chevron" />
          </button>
        ))}
      </div>
    </div>
  );
}

// «Місії»: daily tasks with XP rewards (mockup)
export function Missions({ nav, t }) {
  const { state } = useStore();
  const d = state.daily;
  const label = { lesson: t('mLesson'), words: t('mWords'), correct: t('mCorrect') };
  const done = MISSIONS.filter((m) => m.value(d) >= m.max).length;
  return (
    <div className="screen">
      <TopBar onBack={() => nav.back()} title={t('tileMissions')} right={<span className="icon-btn"><Icon name="calendar" /></span>} />
      <div className="missions-hero">
        <Mascot emotion={done === MISSIONS.length ? 'celebration' : 'gift'} size={150} anim="bounce" sparkles />
      </div>
      <div className="h2" style={{ textAlign: 'center' }}>{t('dailyTasks')}</div>
      <div className="list">
        {MISSIONS.map((m) => {
          const cur = Math.min(m.value(d), m.max);
          const ok = cur >= m.max;
          return (
            <div key={m.id} className="option" style={{ cursor: 'default' }}>
              <span className={`m-check ${ok ? 'on' : ''}`}>{ok && <Icon name="check" size={15} stroke={3} />}</span>
              <span className="col grow" style={{ gap: 2 }}>
                <span className="title">{label[m.id]}</span>
                <span className="small" style={{ color: 'var(--primary-2)', fontWeight: 600 }}>+{m.xp} XP{!ok && m.max > 1 ? ` · ${cur}/${m.max}` : ''}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="row"><Bar value={(done / MISSIONS.length) * 100} style={{ flex: 1 }} /><span className="small">{done}/{MISSIONS.length}</span></div>
      <div className="grow" />
      <button className="btn" onClick={() => nav.tab('home')}>{t('toHome')}</button>
    </div>
  );
}
