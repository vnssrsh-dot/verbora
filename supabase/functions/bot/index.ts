// POST /bot — Telegram webhook for @verbora_englishbot.
// /start — greeting with the button that opens the Mini App; /stop — no more reminders; /reminders — on again.
import { tg, langOf } from '../_shared/telegram.ts';
import { db } from '../_shared/db.ts';

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://vnssrsh-dot.github.io/verbora/';

const T = {
  ua: {
    start: (n: string) => `Привіт${n ? `, ${n}` : ''}! 👋 Я Verbi — маленька дослідниця з планети Вербора.\n\nРазом вивчатимемо англійську: правила, слова й вимову. Натискай кнопку — і полетіли! 🚀`,
    open: 'Відкрити VERBORA',
    stop: 'Добре, більше не нагадуватиму. Повернути нагадування: /reminders',
    on: 'Нагадування увімкнено ✨ Писатиму ввечері, якщо ти ще не займався(лася).',
    other: 'Я поки розумію тільки кнопки 🙂 Натисни «Відкрити VERBORA».',
  },
  ru: {
    start: (n: string) => `Привет${n ? `, ${n}` : ''}! 👋 Я Verbi — маленькая исследовательница с планеты Вербора.\n\nВместе будем учить английский: правила, слова и произношение. Жми кнопку — и полетели! 🚀`,
    open: 'Открыть VERBORA',
    stop: 'Хорошо, больше не буду напоминать. Вернуть напоминания: /reminders',
    on: 'Напоминания включены ✨ Напишу вечером, если ты ещё не занимался(лась).',
    other: 'Я пока понимаю только кнопки 🙂 Нажми «Открыть VERBORA».',
  },
};

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  if (!msg || msg.chat?.type !== 'private' || !msg.from) return new Response('ok');

  const from = msg.from;
  const { data: row } = await db.from('learners').select('lang').eq('tg_id', from.id).maybeSingle();
  const lang = (row?.lang as 'ua' | 'ru') ?? langOf(from.language_code);
  const L = T[lang] ?? T.ua;
  const text = String(msg.text ?? '').trim();
  const button = { reply_markup: { inline_keyboard: [[{ text: L.open, web_app: { url: APP_URL } }]] } };

  if (text.startsWith('/start')) {
    await db.from('learners').upsert({ tg_id: from.id, first_name: from.first_name ?? null, lang, can_message: true, updated_at: new Date().toISOString() });
    await tg(BOT_TOKEN, 'sendMessage', { chat_id: from.id, text: L.start(from.first_name ?? ''), ...button });
  } else if (text.startsWith('/stop')) {
    await db.from('learners').update({ reminders: false }).eq('tg_id', from.id);
    await tg(BOT_TOKEN, 'sendMessage', { chat_id: from.id, text: L.stop });
  } else if (text.startsWith('/reminders')) {
    await db.from('learners').upsert({ tg_id: from.id, reminders: true, can_message: true, updated_at: new Date().toISOString() });
    await tg(BOT_TOKEN, 'sendMessage', { chat_id: from.id, text: L.on });
  } else {
    await tg(BOT_TOKEN, 'sendMessage', { chat_id: from.id, text: L.other, ...button });
  }
  return new Response('ok');
});
