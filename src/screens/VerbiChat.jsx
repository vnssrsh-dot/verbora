import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { tgUser, haptic } from '../lib/telegram.js';
import { Mascot, Icon } from '../components.jsx';

// First contact with Verbi: an alien "transmission" chat in space.
// Verbi's next line depends on the reply buttons; she asks the learner's name and saves it.

const SCRIPT = {
  ua: {
    hello: 'Біп-біп! 📡 Сигнал прийнято… Привіт із космосу!',
    rHello: 'Привіт! 👋', rWho: 'Хто ти? 👽',
    afterHello: 'Ура, ти мене чуєш! Я Verbi — маленька дослідниця з планети Вербора.',
    afterWho: 'Я Verbi! Прилетіла з далекої планети Вербора, де всі розмовляють сигналами.',
    askName: 'А як тебе звати? Хочу правильно до тебе звертатися.',
    namePh: 'Твоє імʼя', nameOk: 'Це я!', nameSkip: 'Пропустити',
    gotName: '{name}! Гарне імʼя ✨ Записую в бортовий журнал.',
    noName: 'Добре, буду кликати тебе «друже» 💜',
    rWhere: 'Звідки ти? 🪐', rWhat: 'Що ми будемо робити? 🚀',
    where: 'На моїй планеті немає слів — лише сигнали. Коли я вперше почула людські мови, то закохалася в них.',
    rWhatNext: 'А що ми будемо робити? 🚀',
    what: 'Разом досліджуватимемо англійську: правила, слова, вимову. Я буду поруч, підказуватиму й святкуватиму твої успіхи!',
    rGo: 'Полетіли! 🚀',
    final: 'Тоді пристебнися! Спершу кілька питань, щоб прокласти наш маршрут.',
    start: 'Прокласти маршрут', typing: 'Verbi передає сигнал',
  },
  ru: {
    hello: 'Бип-бип! 📡 Сигнал принят… Привет из космоса!',
    rHello: 'Привет! 👋', rWho: 'Кто ты? 👽',
    afterHello: 'Ура, ты меня слышишь! Я Verbi — маленькая исследовательница с планеты Вербора.',
    afterWho: 'Я Verbi! Прилетела с далёкой планеты Вербора, где все разговаривают сигналами.',
    askName: 'А как тебя зовут? Хочу правильно к тебе обращаться.',
    namePh: 'Твоё имя', nameOk: 'Это я!', nameSkip: 'Пропустить',
    gotName: '{name}! Красивое имя ✨ Записываю в бортовой журнал.',
    noName: 'Хорошо, буду звать тебя «друг» 💜',
    rWhere: 'Откуда ты? 🪐', rWhat: 'Что мы будем делать? 🚀',
    where: 'На моей планете нет слов — только сигналы. Когда я впервые услышала человеческие языки, то влюбилась в них.',
    rWhatNext: 'А что мы будем делать? 🚀',
    what: 'Вместе будем исследовать английский: правила, слова, произношение. Я буду рядом, подскажу и отпраздную твои успехи!',
    rGo: 'Полетели! 🚀',
    final: 'Тогда пристегнись! Сначала несколько вопросов, чтобы проложить наш маршрут.',
    start: 'Проложить маршрут', typing: 'Verbi передаёт сигнал',
  },
};

export default function VerbiChat({ lang, onDone }) {
  const { state, update } = useStore();
  const S = SCRIPT[lang] || SCRIPT.ua;
  const [msgs, setMsgs] = useState([]); // { from: 'verbi'|'me', text }
  const [emotion, setEmotion] = useState('greeting');
  const [typing, setTyping] = useState(false);
  const [stage, setStage] = useState('hello'); // which replies are offered
  const [name, setName] = useState(state.profile.name || tgUser()?.first_name || '');
  const list = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [msgs, typing, stage]);

  // Verbi "transmits" her lines one after another, then offers the next replies
  const say = (lines, next) => {
    setStage(null);
    let delay = 350;
    lines.forEach(([text, emo]) => {
      timers.current.push(setTimeout(() => { setTyping(true); }, delay));
      delay += Math.min(1500, 650 + text.length * 12);
      timers.current.push(setTimeout(() => {
        setTyping(false);
        setEmotion(emo);
        setMsgs((m) => [...m, { from: 'verbi', text }]);
        haptic('light');
      }, delay));
      delay += 250;
    });
    timers.current.push(setTimeout(() => setStage(next), delay + 100));
  };

  useEffect(() => { say([[S.hello, 'greeting']], 'hello'); }, []);

  const reply = (text, then) => {
    haptic('select');
    setMsgs((m) => [...m, { from: 'me', text }]);
    then();
  };

  const saveName = (n) => {
    const clean = n.trim().slice(0, 40);
    if (clean) update((s) => { s.profile.name = clean; });
    reply(clean || S.nameSkip, () => say([[clean ? S.gotName.replace('{name}', clean) : S.noName, 'celebration']], 'about'));
  };

  return (
    <div className="space-screen">
      <SpaceBackdrop />
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
        {stage === 'hello' && (
          <>
            <button className="reply" onClick={() => reply(S.rHello, () => say([[S.afterHello, 'speaking'], [S.askName, 'thinking']], 'name'))}>{S.rHello}</button>
            <button className="reply" onClick={() => reply(S.rWho, () => say([[S.afterWho, 'surprised'], [S.askName, 'thinking']], 'name'))}>{S.rWho}</button>
          </>
        )}
        {stage === 'name' && (
          <form className="name-row" onSubmit={(e) => { e.preventDefault(); saveName(name); }}>
            <input className="name-input" value={name} maxLength={40} placeholder={S.namePh} autoFocus enterKeyHint="done" onChange={(e) => setName(e.target.value)} aria-label={S.namePh} />
            <button className="reply solid" type="submit" disabled={!name.trim()}>{S.nameOk}</button>
            <button className="reply ghost" type="button" onClick={() => saveName('')}>{S.nameSkip}</button>
          </form>
        )}
        {stage === 'about' && (
          <>
            <button className="reply" onClick={() => reply(S.rWhere, () => say([[S.where, 'explaining']], 'what'))}>{S.rWhere}</button>
            <button className="reply" onClick={() => reply(S.rWhat, () => say([[S.what, 'thanks']], 'go'))}>{S.rWhat}</button>
          </>
        )}
        {stage === 'what' && <button className="reply" onClick={() => reply(S.rWhatNext, () => say([[S.what, 'thanks']], 'go'))}>{S.rWhatNext}</button>}
        {stage === 'go' && <button className="reply" onClick={() => reply(S.rGo, () => say([[S.final, 'levelup']], 'start'))}>{S.rGo}</button>}
        {stage === 'start' && <button className="btn" onClick={() => { haptic('medium'); onDone(); }}>{S.start} <Icon name="arrow" size={18} /></button>}
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
