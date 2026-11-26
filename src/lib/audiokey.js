// Shared by the app and tools/tts: the canonical spoken text and its audio file name.
// The same sentence always maps to the same mp3, whichever screen plays it.
export function spokenText(raw) {
  return String(raw ?? '')
    .replace(/\s*\/[^/]*\//g, ' ') // drop IPA like /ˈtiːtʃə/
    .replace(/\s*—\s*/g, ', ')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export function audioKey(raw) {
  const t = spokenText(raw);
  return t ? fnv(t, 2166136261) + fnv(t, 0x9e3779b9) : '';
}
