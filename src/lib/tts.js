// Pronunciation: pre-generated mp3 (tools/tts, files in public/audio named by audioKey) first,
// Web Speech API as fallback when a file is missing or audio cannot play.
import { audioKey, spokenText } from './audiokey.js';

// public/audio/index.json lists the keys that have a file (written by tools/tts/generate.mjs).
// Only those are requested, so the device voice still starts right inside the tap on iOS.
let available = new Set();
if (typeof window !== 'undefined') {
  fetch('./audio/index.json').then((r) => (r.ok ? r.json() : [])).then((keys) => { available = new Set(keys); }).catch(() => {});
}
let voice = null;
let current = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  return (
    en.find((v) => /en[-_]GB/i.test(v.lang) && /female|libby|sonia|serena|kate|google uk english female/i.test(v.name)) ||
    en.find((v) => /en[-_]GB/i.test(v.lang)) ||
    en.find((v) => /en[-_]US/i.test(v.lang)) ||
    en[0] ||
    null
  );
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voice = pickVoice();
  speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, { audio, slow = false, rate, enabled = true } = {}) {
  if (!enabled || !text) return;
  stop();
  const key = audioKey(text);
  const src = audio || (available.has(key) ? `./audio/${key}.mp3` : '');
  if (src) {
    const a = new Audio(src);
    a.playbackRate = rate || (slow ? 0.75 : 1);
    current = a;
    let failed = false;
    const fallback = () => { if (!failed && current === a) { failed = true; speakSynth(spokenText(text), slow, rate); } };
    a.addEventListener('error', fallback, { once: true });
    a.play().catch((e) => { if (e?.name !== 'NotAllowedError') fallback(); });
    return;
  }
  speakSynth(spokenText(text), slow, rate);
}

function speakSynth(text, slow, rate) {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang || 'en-GB';
  if (voice) u.voice = voice;
  u.rate = rate ? 0.9 * rate : slow ? 0.6 : 0.9;
  speechSynthesis.speak(u);
}

export function stop() {
  if (current) { try { current.pause(); } catch {} current = null; }
  if (canSpeak()) speechSynthesis.cancel();
}
