import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { tgUser, haptic } from '../lib/telegram.js';
import { Mascot, Icon } from '../components.jsx';

// First contact with Verbi: an alien "transmission" chat in space.
// Verbi's next line depends on the reply buttons; she asks the learner's name and saves it.

const SCRIPT = {
  ua: {
    hello: 'Біп-біп! 📡 Привіт, я Verbi — дослідниця з планети Вербора. Як тебе звати?',
    namePh: 'Твоє імʼя', nameOk: 'Це я!',
    gotName: '{name}, полетіли вчити англійську разом! 🚀',
    noName: 'Полетіли вчити англійську разом! 🚀',
    rWho: 'Хто ти? 👽',
    who: 'Я прилетіла з планети, де розмовляють сигналами. Тепер вивчаю людські мови — і буду поруч на кожному уроці 💜',
    start: 'Почати', skip: 'Пропустити', typing: 'Verbi передає сигнал',
  },
  ru: {
    hello: 'Бип-бип! 📡 Привет, я Verbi — исследовательница с планеты Вербора. Как тебя зовут?',
    namePh: 'Твоё имя', nameOk: 'Это я!',
    gotName: '{name}, полетели учить английский вместе! 🚀',
    noName: 'Полетели учить английский вместе! 🚀',
    rWho: 'Кто ты? 👽',
    who: 'Я прилетела с планеты, где говорят сигналами. Теперь изучаю человеческие языки — и буду рядом на каждом уроке 💜',
    start: 'Начать', skip: 'Пропустить', typing: 'Verbi передаёт сигнал',
  },
};

// Short first contact: Verbi greets and asks the name, the learner confirms it, done (two taps).
// «Пропустити» is always there; the Telegram name is used then.
export default function VerbiChat({ lang, onDone }) {
  const { state, update } = useStore();
  const S = SCRIPT[lang] || SCRIPT.ua;
  const tgName = tgUser()?.first_name || '';
  const [msgs, setMsgs] = useState([]); // { from: 'verbi'|'me', text }
  const [emotion, setEmotion] = useState('greeting');
  const [typing, setTyping] = useState(false);
  const [stage, setStage] = useState(null); // 'name' | 'start'
  const [askedWho, setAskedWho] = useState(false);
  const [name, setName] = useState(state.profile.name || tgName);
  const list = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [msgs, typing, stage]);

  // Verbi "transmits" a line (short typing pause), then offers the next step
  const say = (text, emo, next, wait = 250) => {
    setStage(null);
    timers.current.push(setTimeout(() => setTyping(true), wait));
    timers.current.push(setTimeout(() => {
      setTyping(false);
      setEmotion(emo);
      setMsgs((m) => [...m, { from: 'verbi', text }]);
      haptic('light');
      setStage(next);
    }, wait + Math.min(900, 380 + text.length * 6)));
  };

  useEffect(() => { say(S.hello, 'greeting', 'name', 700); }, []);

  const saveName = (n) => {
    const clean = n.trim().slice(0, 40);
    if (clean) update((s) => { s.profile.name = clean; });
    haptic('select');
    setMsgs((m) => [...m, { from: 'me', text: clean }]);
    say(clean ? S.gotName.replace('{name}', clean) : S.noName, 'celebration', 'start');
  };

  const skip = () => {
    timers.current.forEach(clearTimeout);
    if (!state.profile.name && tgName) update((s) => { s.profile.name = tgName; });
    onDone();
  };

  return (
    <div className="space-screen">
      <SpaceBackdrop />
      {stage !== 'start' && <button className="chat-skip" onClick={skip}>{S.skip}</button>}
      <div className="chat-verbi">
        <div className="verbi-glow" />
        <div className="verbi-land"><div className="m-float"><Mascot emotion={emotion} size={150} anim="pop" /></div></div>
      </div>

      <div className="chat-list" ref={list} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>{m.text}</div>
        ))}
        {typing && (
          <div className="msg verbi typing" aria-label={S.typing}>
            <Icon name="sparkles" size={14} /><i /><i /><i />
          </div>
        )}
      </div>

      <div className="chat-actions">
        {stage === 'name' && (
          <form className="name-row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveName(name); }}>
            <input className="name-input" value={name} maxLength={40} placeholder={S.namePh} enterKeyHint="done" onChange={(e) => setName(e.target.value)} aria-label={S.namePh} />
            <button className="reply solid" type="submit" disabled={!name.trim()}>{S.nameOk}</button>
          </form>
        )}
        {stage === 'start' && (
          <>
            {!askedWho && (
              <button className="reply" onClick={() => { setAskedWho(true); haptic('select'); setMsgs((m) => [...m, { from: 'me', text: S.rWho }]); say(S.who, 'speaking', 'start'); }}>{S.rWho}</button>
            )}
            <button className="btn" onClick={() => { haptic('medium'); onDone(); }}>{S.start} <Icon name="arrow" size={18} /></button>
          </>
        )}
      </div>
    </div>
  );
}

// Twinkling stars, a drifting planet and a comet now and then.
export function SpaceBackdrop() {
  return (
    <div className="space" aria-hidden>
      <div className="stars s1" />
      <div className="stars s2" />
      <div className="stars s3" />
      <div className="planet"><i /></div>
      <div className="planet small" />
      <div className="comet" />
    </div>
  );
}
