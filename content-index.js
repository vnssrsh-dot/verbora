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
  return { units, finals, topicTitles };
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
