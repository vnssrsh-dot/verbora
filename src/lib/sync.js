// Progress sync with the VERBORA server (Supabase Edge Function «api»).
// Off unless VITE_API_URL is set at build time and the app runs inside Telegram.
// Rule: the newest progress wins (savedAt); the device pulls once at start, then pushes changes.
import { initData } from './telegram.js';
import { today } from './store.jsx';

const API = import.meta.env.VITE_API_URL || '';
let ready = false; // no pushes until the first pull has finished
let timer = null;
let lastPushed = 0;

const enabled = () => Boolean(API && initData());

async function call(body) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData: initData(), ...body }),
  });
  if (!r.ok && r.status !== 409) throw new Error(`sync ${r.status}`);
  return r.json();
}

export function startSync({ get, adopt }) {
  if (!enabled()) return undefined;
  let alive = true;
  call({ action: 'pull' })
    .then((res) => {
      if (!alive) return;
      const local = get();
      if (res?.state && (res.savedAt || 0) > (local.savedAt || 0)) adopt({ ...res.state, savedAt: res.savedAt });
    })
    .catch(() => {})
    .finally(() => { ready = true; pushSoon(get()); });
  return () => { alive = false; };
}

export function pushSoon(state) {
  if (!enabled() || !ready || !state?.savedAt || state.savedAt === lastPushed) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const savedAt = state.savedAt;
    call({ action: 'push', state, savedAt, today: today(), tzOffsetMin: -new Date().getTimezoneOffset() })
      .then(() => { lastPushed = savedAt; })
      .catch(() => {});
  }, 2500);
}
