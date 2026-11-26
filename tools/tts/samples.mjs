// Voice samples for choosing: every British neural voice reads the same lines.
// Usage: node tools/tts/samples.mjs <out-dir>  → mp3 files + voices.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ssml, synth, listVoices, VOICES } from './lib.mjs';

const out = process.argv[2];
if (!out) { console.log('usage: node tools/tts/samples.mjs <out-dir>'); process.exit(1); }
mkdirSync(out, { recursive: true });
const LINES = [
  ['verbi', "Hi! I'm Verbi. Let's learn English together! Teacher. Beautiful. Thirty-three."],
  ['lesson', 'My sister is a doctor, and her husband works at the bank. They usually have breakfast at seven.'],
];
const voices = (await listVoices()).filter((v) => v.Locale === 'en-GB' && v.VoiceType === 'Neural');
console.log(voices.length, 'British neural voices');
const rows = [];
for (const v of voices) {
  const files = [];
  for (const [id, text] of LINES) {
    const f = `${v.ShortName}-${id}.mp3`;
    writeFileSync(join(out, f), await synth(ssml([{ voice: v.ShortName, text }])));
    files.push(f);
  }
  rows.push({ name: v.ShortName, display: v.DisplayName, gender: v.Gender, files });
  console.log('✓', v.ShortName);
}
writeFileSync(join(out, 'voices.json'), JSON.stringify({ region: VOICES.region, rows }, null, 1));
