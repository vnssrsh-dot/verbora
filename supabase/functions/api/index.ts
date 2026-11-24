// POST /api — progress sync for the Mini App.
// Body: { initData, action: 'pull' } or { initData, action: 'push', state, savedAt, today, tzOffsetMin }
// The Telegram signature in initData identifies the learner; nothing else is trusted.
import { verifyInitData, langOf } from '../_shared/telegram.ts';
import { db } from '../_shared/db.ts';

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? '';
const APP_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? 'https://vnssrsh-dot.github.io').split(',');
const MAX_STATE_BYTES = 512 * 1024;

function cors(origin: string | null) {
  const allow = origin && APP_ORIGINS.includes(origin) ? origin : APP_ORIGINS[0];
  return { 'access-control-allow-origin': allow, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
}
const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, h);

  const raw = await req.text();
  if (raw.length > MAX_STATE_BYTES) return json({ error: 'too large' }, 413, h);
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400, h); }

  const user = await verifyInitData(body.initData, BOT_TOKEN);
  if (!user) return json({ error: 'unauthorized' }, 401, h);

  if (body.action === 'pull') {
    const { data, error } = await db.from('learners').select('state, state_saved_at').eq('tg_id', user.id).maybeSingle();
    if (error) return json({ error: 'db' }, 500, h);
    return json({ state: data?.state ?? null, savedAt: data?.state_saved_at ?? 0 }, 200, h);
  }

  if (body.action === 'push') {
    const savedAt = Number(body.savedAt) || 0;
    if (!body.state || typeof body.state !== 'object') return json({ error: 'no state' }, 400, h);
    const { data: cur } = await db.from('learners').select('state_saved_at').eq('tg_id', user.id).maybeSingle();
    if (cur && cur.state_saved_at > savedAt) return json({ ok: false, reason: 'older' }, 409, h);
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
    const tz = Number.isFinite(body.tzOffsetMin) ? Math.max(-840, Math.min(840, Math.round(body.tzOffsetMin))) : 0;
    const { error } = await db.from('learners').upsert({
      tg_id: user.id,
      first_name: user.first_name ?? null,
      lang: body.state.lang === 'ru' ? 'ru' : body.state.lang === 'ua' ? 'ua' : langOf(user.language_code),
      state: body.state,
      state_saved_at: savedAt,
      last_active_date: body.state?.streak?.last ?? today,
      tz_offset_min: tz,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: 'db' }, 500, h);
    return json({ ok: true }, 200, h);
  }

  return json({ error: 'action' }, 400, h);
});
