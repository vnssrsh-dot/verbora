// Ported as-is from tools/check_yourself/pack.js (reference logic, SPEC §15.2). Do not change the rules here
// without updating the reference file.
// «Перевір себе» — reference pack builder (no dependencies).
// buildPack(pool, { userId, level, now, history }) → { period, theme, items[] }
//   level    — user's current CEFR level ("A1"…"C1"); words and sentences up to this level are used
//   now      — Date (defaults to new Date()); a new pack every pool.refresh_days days
//   history  — { recentWordIds: [], missedWordIds: [], lastThemeId } kept per user
// The same user gets the same pack for the whole period (deterministic seed).

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const MIN_THEME_WORDS = 6;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function pickSentence(word, lvl, rand) {
  const ok = word.sentences.filter(s => LEVELS.indexOf(s.level) <= lvl)
    .sort((x, y) => LEVELS.indexOf(y.level) - LEVELS.indexOf(x.level));
  // usually the hardest allowed sentence; from B1 up, sometimes one step easier for variety
  if (ok.length > 1 && lvl >= 2 && rand() < 0.3) return ok[1];
  return ok[0];
}

function buildPack(pool, { userId, level, now = new Date(), history = {} }) {
  const lvl = LEVELS.indexOf(level);
  const period = Math.floor(now.getTime() / 86400000 / pool.refresh_days);
  const rand = rng(hash(`${userId}:${period}`));
  const recent = new Set(history.recentWordIds || []);
  const avail = t => t.words.filter(w => LEVELS.indexOf(w.level) <= lvl);

  // 1. theme: enough words at this level, not the same as last time
  let themes = pool.themes.filter(t => avail(t).length >= MIN_THEME_WORDS && t.id !== history.lastThemeId);
  if (!themes.length) themes = pool.themes.filter(t => avail(t).length >= MIN_THEME_WORDS);
  const theme = themes[Math.floor(rand() * themes.length)];

  // 2. words: up to 3 missed words from earlier packs, then fresh words from the theme, then top up from other themes
  const all = pool.themes.flatMap(avail);
  const byId = Object.fromEntries(all.map(w => [w.id, w]));
  const chosen = [];
  const add = w => { if (w && !chosen.includes(w) && chosen.length < pool.pack_size) chosen.push(w); };
  (history.missedWordIds || []).slice(0, 3).forEach(id => add(byId[id]));
  const fresh = list => shuffle(list, rand).sort((a, b) => recent.has(a.id) - recent.has(b.id));
  fresh(avail(theme)).forEach(add);
  fresh(all.filter(w => !theme.words.includes(w))).forEach(add);

  return {
    period,
    theme: { id: theme.id, title: theme.title, icon: theme.icon },
    items: shuffle(chosen, rand).map(w => ({ word: w, sentence: pickSentence(w, lvl, rand) })),
  };
}

// Answer check: case, curly apostrophes, double spaces and final punctuation are ignored.
function normalize(s) {
  return s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"«»—–-]/g, " ").replace(/\s+/g, " ").trim();
}
// Per-word comparison for the sentence step → [{ expected, typed, ok }]
function compareWords(expected, typed) {
  const e = normalize(expected).split(" "), t = normalize(typed).split(" ");
  return e.map((w, i) => ({ expected: w, typed: t[i] || "", ok: w === (t[i] || "") }));
}

export { buildPack, normalize, compareWords, LEVELS };
