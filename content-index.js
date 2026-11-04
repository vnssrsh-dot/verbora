// Vite plugin: builds a light index of all content (titles, lesson ids, topics, vocab) at build time.
// The app loads this index up front and each full unit JSON only when it is opened,
// so ~4 MB of exercises never sit in the main bundle.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ID = 'virtual:content-index';
const RID = '\0' + ID;
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];

export function buildIndex(root) {
  const units = [];
  const finals = {};
  const topicTitles = {};
  for (const lvl of LEVELS) {
    const dir = join(root, lvl);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (f === 'final-test.json') {
        finals[data.level] = { id: data.id, title: data.title, pass: data.pass_score ?? 0.8, count: data.exercises.length, file: `${lvl}/${f}` };
        continue;
      }
      if (!/^unit-\d+\.json$/.test(f)) continue;
      const lessons = data.lessons.map((l) => {
        const topics = [...new Set(l.exercises.map((e) => e.topic).filter(Boolean))];
        for (const t of topics) if (!topicTitles[t]) topicTitles[t] = l.title;
        return { id: l.id, title: l.title, topics };
      });
      const cpTopics = [...new Set((data.checkpoint || []).map((e) => e.topic).filter(Boolean))];
      for (const t of cpTopics) if (!topicTitles[t]) topicTitles[t] = data.title;
      units.push({
        id: data.id, level: data.level, order: data.order, kind: data.kind, title: data.title,
        vocab: (data.vocab || []).map(({ audio, ...w }) => (audio ? { ...w, audio } : w)), lessons, cpTopics, file: `${lvl}/${f}`,
      });
    }
  }
  let checkYourself = null;
  const cyFile = join(root, 'check-yourself', 'pool.json');
  if (existsSync(cyFile)) {
    const pool = JSON.parse(readFileSync(cyFile, 'utf8'));
    checkYourself = { packSize: pool.pack_size, refreshDays: pool.refresh_days };
  }
  return { units, finals, topicTitles, checkYourself };
}

export default function contentIndex() {
  let root;
  return {
    name: 'content-index',
    configResolved(c) { root = join(c.root, 'content'); },
    resolveId(id) { return id === ID ? RID : null; },
    load(id) {
      if (id !== RID) return null;
      for (const lvl of LEVELS) {
        const dir = join(root, lvl);
        if (existsSync(dir)) for (const f of readdirSync(dir)) this.addWatchFile(join(dir, f));
      }
      return `export default ${JSON.stringify(buildIndex(root))};`;
    },
  };
}

// Lucide icons used by «Перевір себе»: only the icons named in pool.json are bundled.
// Icons missing from the installed lucide-react version fall back to a close one.
const CY_ID = 'virtual:cy-icons';
const CY_RID = '\0' + CY_ID;
const CY_FALLBACK = { earbuds: 'headphones' };
export function cyIcons() {
  let root;
  return {
    name: 'cy-icons',
    configResolved(c) { root = c.root; },
    resolveId(id) { return id === CY_ID ? CY_RID : null; },
    async load(id) {
      if (id !== CY_RID) return null;
      const file = join(root, 'content/check-yourself/pool.json');
      this.addWatchFile(file);
      const pool = JSON.parse(readFileSync(file, 'utf8'));
      const lucide = await import('lucide-react');
      const pascal = (n) => n.split('-').map((x) => x[0].toUpperCase() + x.slice(1)).join('');
      const names = new Set();
      for (const t of pool.themes) { names.add(t.icon); for (const w of t.words) names.add(w.icon); }
      const map = {};
      for (const n of names) {
        let use = lucide[pascal(n)] ? n : CY_FALLBACK[n];
        if (!use || !lucide[pascal(use)]) { this.warn(`lucide icon "${n}" not found, using circle-help`); use = 'circle-help'; }
        map[n] = pascal(use);
      }
      const comps = [...new Set(Object.values(map))];
      return `import { ${comps.join(', ')} } from 'lucide-react';\nexport default { ${Object.entries(map).map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(', ')} };`;
    },
  };
}
