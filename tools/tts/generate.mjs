// Voices the whole course into public/audio/<audioKey>.mp3 (Azure TTS, free F0 tier, ~18 files a minute).
// Skips files that already exist, so it can be stopped and run again. Writes public/audio/index.json.
// Usage: node tools/tts/generate.mjs [--dry] [--limit N]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VOICES, ssml, synth } from './lib.mjs';
import { audioKey, spokenText } from '../../src/lib/audiokey.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const OUT = join(ROOT, 'public/audio');
mkdirSync(OUT, { recursive: true });

const FEMALE = /\b(she|her|hers|herself|anna|kate|mia|emma|olena|sofia|lisa|maria|woman|women|girl|girls|wife|sister|mum|mom|mother|aunt|grandma|daughter|queen|lady|actress|waitress|princess)\b/i;
const MALE = /\b(he|him|his|himself|max|tom|ben|ivan|andrii|oleh|sam|john|mark|man|men|boy|boys|husband|brother|dad|father|uncle|grandpa|son|king|gentleman|waiter|prince)\b/i;
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function lessonVoice(text) {
  const f = FEMALE.test(text), m = MALE.test(text);
  const pool = f && !m ? ['f1', 'f2'] : m && !f ? ['m1', 'm2'] : ['f1', 'm1', 'f2', 'm2'];
  return VOICES[pool[hash(text) % pool.length]];
}
const SPEAKER_F = /^(anna|kate|mia|emma|olena|sofia|lisa|maria|mum|mom|grandma|waitress|receptionist|assistant|nurse|teacher)$/i;
const SPEAKER_M = /^(max|tom|ben|ivan|andrii|oleh|sam|john|mark|dad|grandpa|waiter|doctor|driver|officer|guide)$/i;

const items = new Map(); // key -> { text, parts }
function add(raw, voiceFor) {
  const text = spokenText(raw);
  const key = audioKey(raw);
  if (!key || items.has(key)) return;
  items.set(key, { text, parts: [voiceFor === 'verbi' ? { voice: VOICES.verbi, pitch: VOICES.verbiPitch, text } : { voice: lessonVoice(text), text }] });
}
function addDialog(dialog) {
  const joined = dialog.map((d) => d.line).join(' ');
  const key = audioKey(joined);
  if (!key || items.has(key)) return;
  const order = [];
  const parts = dialog.map((d) => {
    const sp = String(d.speaker || '').trim();
    if (!order.includes(sp)) order.push(sp);
    const voice = SPEAKER_F.test(sp) ? VOICES.f1 : SPEAKER_M.test(sp) ? VOICES.m1 : [VOICES.f1, VOICES.m1, VOICES.f2, VOICES.m2][order.indexOf(sp) % 4];
    return { voice, text: spokenText(d.line) };
  });
  items.set(key, { text: spokenText(joined), parts });
}

function walkExercise(e, course) {
  if (e.type === 'listen') add(e.audio_text, course ? 'verbi' : 'auto');
  if (e.type === 'ipa') add(e.answer, 'verbi');
  if (e.type === 'reading') { if (e.text) add(e.text, 'auto'); else if (e.dialog) addDialog(e.dialog); }
}
function walkUnit(u, course = false) {
  for (const v of u.vocab || []) { add(v.word, 'verbi'); if (v.example) add(v.example, 'auto'); }
  for (const x of u.rule?.examples || []) add(x.en, 'verbi');
  for (const l of u.lessons) {
    for (const x of l.rule?.examples || []) add(x.en, 'verbi');
    for (const e of [...l.exercises, ...(l.recap?.exercises || [])]) walkExercise(e, course);
  }
  for (const e of u.checkpoint || []) walkExercise(e, course);
}

// the order matters: A1 first, so the most used audio is ready soonest
for (const lvl of ['a1', 'a2', 'b1', 'b2', 'c1']) {
  const dir = join(ROOT, 'content', lvl);
  for (const f of readdirSync(dir).sort()) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (/^unit-\d+\.json$/.test(f)) walkUnit(d);
    else if (f === 'final-test.json') d.exercises.forEach((e) => walkExercise(e, false));
  }
  if (lvl === 'a1') {
    walkUnit(JSON.parse(readFileSync(join(ROOT, 'content/extra/transcription.json'), 'utf8')), true);
    const sounds = JSON.parse(readFileSync(join(ROOT, 'content/extra/ipa-sounds.json'), 'utf8'));
    for (const g of sounds.groups) for (const s of g.sounds) add(s.words.join(', '), 'verbi');
    const pool = JSON.parse(readFileSync(join(ROOT, 'content/check-yourself/pool.json'), 'utf8'));
    for (const t of pool.themes) for (const w of t.words) { add(w.word, 'verbi'); for (const s of w.sentences) add(s.text, 'auto'); }
  }
}

const todo = [...items.entries()].filter(([k]) => !existsSync(join(OUT, `${k}.mp3`)));
const chars = todo.reduce((n, [, it]) => n + it.text.length, 0);
console.log(`${items.size} clips in the course, ${todo.length} to voice (${chars} characters, about ${Math.ceil(todo.length / 18)} min)`);
const writeIndex = () => {
  const keys = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(keys));
  return keys.length;
};
if (DRY) process.exit(0);

let done = 0;
for (const [key, it] of todo.slice(0, LIMIT)) {
  try {
    writeFileSync(join(OUT, `${key}.mp3`), await synth(ssml(it.parts)));
    done++;
    if (done % 25 === 0) console.log(`${done}/${Math.min(todo.length, LIMIT)} · index ${writeIndex()}`);
  } catch (e) {
    console.log(`✖ ${key} «${it.text.slice(0, 60)}»: ${e.message}`);
    if (/Azure 40[13]/.test(e.message)) break; // wrong key or region: stop
  }
}
console.log(`done ${done}, files ${writeIndex()}`);
