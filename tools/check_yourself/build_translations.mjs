// Merges tools/check_yourself/translations/*.tsv (id \t ua \t ru) into
// content/check-yourself/translations.json and checks that every sentence of pool.json is covered.
// Usage: node tools/check_yourself/build_translations.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const root = join(here, '../..');
const pool = JSON.parse(readFileSync(join(root, 'content/check-yourself/pool.json'), 'utf8'));
const out = {};
const errors = [];
for (const f of readdirSync(join(here, 'translations')).filter((x) => x.endsWith('.tsv')).sort()) {
  readFileSync(join(here, 'translations', f), 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const [id, ua, ru, ...rest] = line.split('\t');
    if (!ua || !ru || rest.length) errors.push(`${f}:${i + 1}: expected id<TAB>ua<TAB>ru`);
    if (out[id]) errors.push(`${f}:${i + 1}: duplicate ${id}`);
    out[id] = { ua: ua?.trim(), ru: ru?.trim() };
  });
}
const ids = pool.themes.flatMap((t) => t.words.flatMap((w) => w.sentences.map((s) => s.id)));
for (const id of ids) if (!out[id]) errors.push(`missing translation: ${id}`);
for (const id of Object.keys(out)) if (!ids.includes(id)) errors.push(`unknown sentence id: ${id}`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
const sorted = Object.fromEntries(ids.map((id) => [id, out[id]]));
writeFileSync(join(root, 'content/check-yourself/translations.json'), JSON.stringify(sorted, null, 1) + '\n');
console.log(`✓ ${ids.length} sentences translated`);
