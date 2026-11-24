// POST /reminders — called every hour by pg_cron (see supabase/sql/reminders_cron.sql).
// Sends one evening reminder (19:00 local time) to learners who have not studied today.
import { tg } from '../_shared/telegram.ts';
import { db } from '../_shared/db.ts';

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://vnssrsh-dot.github.io/verbora/';
const HOUR = 19;

const TEXT = {
  ua: { msg: (n: string) => `${n ? `${n}, ` : ''}пора повторити 5 слів 🔥 Verbi сумує без тебе!`, open: 'Відкрити VERBORA' },
  ru: { msg: (n: string) => `${n ? `${n}, ` : ''}пора повторить 5 слов 🔥 Verbi скучает без тебя!`, open: 'Открыть VERBORA' },
};

const localNow = (offsetMin: number) => new Date(Date.now() + offsetMin * 60000);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  const { data: rows, error } = await db
    .from('learners')
    .select('tg_id, first_name, lang, tz_offset_min, last_active_date, reminded_on, state')
    .eq('reminders', true)
    .eq('can_message', true);
  if (error) return new Response('db', { status: 500 });

  let sent = 0;
  for (const r of rows ?? []) {
    const local = localNow(r.tz_offset_min ?? 0);
    const today = isoDate(local);
    if (local.getUTCHours() !== HOUR) continue;
    if (r.last_active_date === today || r.reminded_on === today) continue;
    const L = TEXT[(r.lang as 'ua' | 'ru')] ?? TEXT.ua;
    const name = (r.state?.profile?.name as string) || r.first_name || '';
    const res = await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: r.tg_id,
      text: L.msg(name),
      reply_markup: { inline_keyboard: [[{ text: L.open, web_app: { url: APP_URL } }]] },
    });
    if (res?.ok) {
      sent++;
      await db.from('learners').update({ reminded_on: today }).eq('tg_id', r.tg_id);
    } else if (res?.error_code === 403) {
      // the learner blocked the bot
      await db.from('learners').update({ can_message: false }).eq('tg_id', r.tg_id);
    }
    await new Promise((ok) => setTimeout(ok, 40)); // stay well under Telegram's 30 msg/s
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'content-type': 'application/json' } });
});
