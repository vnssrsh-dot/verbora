// Shared helpers for the Azure TTS scripts.
import { readFileSync } from 'node:fs';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const VOICES = JSON.parse(readFileSync(new URL('./voices.json', import.meta.url), 'utf8'));
const KEY = process.env.AZURE_SPEECH_KEY || 'injected-by-proxy'; // the session proxy adds the real key
const ENDPOINT = () => `https://${VOICES.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
const MIN_GAP_MS = 60000 / 18; // free F0 tier allows 20 requests a minute; stay under it

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const part = (voice, text) => `<voice name="${voice}"><prosody rate="${VOICES.rate}">${esc(text)}</prosody></voice>`;

// parts: [{ voice, text }] — several voices in one file for dialogs
export function ssml(parts) {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">${parts.map((p) => part(p.voice, p.text)).join('')}</speak>`;
}

let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function synth(body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = last + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetch(ENDPOINT(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'verbora-tts',
      },
      body,
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 429 || r.status >= 500) { await sleep((Number(r.headers.get('retry-after')) || 15) * 1000); continue; }
    throw new Error(`Azure ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('Azure: too many retries');
}

export async function listVoices() {
  const r = await fetch(`https://${VOICES.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, { headers: { 'Ocp-Apim-Subscription-Key': KEY, 'User-Agent': 'verbora-tts' } });
  if (!r.ok) throw new Error(`voices ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
