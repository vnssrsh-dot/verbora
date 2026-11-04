// Content engine. A light index (titles, lessons, topics, vocab) ships with the app;
// each unit's full JSON is a separate chunk loaded when the unit is opened.
// Adding a unit = dropping content/<level>/unit-XX.json, no code changes (SPEC §12).
import index from 'virtual:content-index';
import levelsData from '../../content/levels.json';
import diagnostic from '../../content/diagnostic.json';
import ipaSounds from '../../content/extra/ipa-sounds.json';
import transcription from '../../content/extra/transcription.json';
import topicNames from '../../content/topics.json';
import { loc } from './loc.js';

const loaders = import.meta.glob('../../content/*/*.json', { import: 'default' });

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
export { diagnostic, ipaSounds, transcription };

// Course metadata for the transcription mini-course is built from its (small) eager file.
function metaOf(u) {
  return {
    id: u.id, level: u.level, order: u.order, kind: u.kind, title: u.title, rule: u.rule, vocab: u.vocab || [],
    lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, topics: [...new Set(l.exercises.map((e) => e.topic))] })),
    cpTopics: [...new Set((u.checkpoint || []).map((e) => e.topic))],
  };
}

const metaById = {};
for (const u of index.units) metaById[u.id] = u;
metaById[transcription.id] = metaOf(transcription);

const cache = { [transcription.id]: transcription };

export function getUnitMeta(id) {
  return metaById[id] || null;
}

export async function loadUnit(id) {
  if (cache[id]) return cache[id];
  const m = metaById[id];
  if (!m) return null;
  const data = await loaders[`../../content/${m.file}`]();
  cache[id] = data;
  return data;
}

export function finalTestMeta(level) {
  return index.finals[level] || null;
}

export async function loadFinalTest(level) {
  const f = index.finals[level];
  return f ? loaders[`../../content/${f.file}`]() : null;
}

// The serpentine for a level: unit files ordered by their number.
export function levelPath(levelId) {
  return index.units
    .filter((u) => u.level === levelId)
    .sort((a, b) => a.order - b.order)
    .map((u) => ({ id: u.id, kind: u.kind, title: u.title, planned: u.lessons.length, data: u }));
}

export function levelInfo(levelId) {
  return levelsData.levels.find((l) => l.id === levelId) || { id: levelId, title: { ua: levelId, ru: levelId } };
}

export function findLessonMeta(lessonId) {
  for (const u of Object.values(metaById)) {
    const i = u.lessons.findIndex((l) => l.id === lessonId);
    if (i >= 0) return { unit: u, lesson: u.lessons[i], index: i };
  }
  return null;
}

// Unit that holds an exercise: "a1-u01-l02-e05", "a1-u01-cp03", "x-ipa-l01-e02" → unit id.
export function unitIdOfExercise(exId) {
  const m = /^([a-z]\d-u\d+|x-[a-z]+)-/.exec(exId || '');
  return m ? m[1] : null;
}

export function allExercises(unit) {
  const list = [];
  for (const l of unit.lessons) {
    for (const e of l.exercises) list.push(e);
    for (const e of l.recap?.exercises || []) list.push(e);
  }
  for (const e of unit.checkpoint || []) list.push(e);
  return list;
}

export async function loadExercises(ids) {
  const units = [...new Set(ids.map(unitIdOfExercise).filter(Boolean))];
  const loaded = await Promise.all(units.map(loadUnit));
  const pool = new Map();
  for (const u of loaded) if (u) for (const e of allExercises(u)) pool.set(e.id, e);
  return ids.map((id) => pool.get(id)).filter(Boolean);
}

// Topics of a unit, in order of appearance — used by the grammar map.
export function unitTopics(meta) {
  const seen = [];
  for (const l of meta.lessons) for (const t of l.topics) if (t && !seen.includes(t)) seen.push(t);
  for (const t of meta.cpTopics || []) if (t && !seen.includes(t)) seen.push(t);
  return seen;
}

// Readable topic name: content/topics.json first, otherwise the title of the lesson that introduces it.
export function topicName(topic, lang) {
  return loc(topicNames[topic] || index.topicTitles[topic], lang) || topic;
}

export function allVocab() {
  const out = [];
  for (const lvl of LEVELS) for (const u of levelPath(lvl)) for (const w of u.data.vocab) out.push({ ...w, unitId: u.id, level: lvl });
  return out;
}
