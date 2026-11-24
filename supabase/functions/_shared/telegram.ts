// Telegram helpers shared by the Edge Functions (Deno; also runs under Node for tests).

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export type TgUser = { id: number; first_name?: string; language_code?: string };

// Checks Mini App initData as documented by Telegram:
// secret = HMAC_SHA256(key "WebAppData", bot token); hash = HMAC_SHA256(secret, data_check_string).
// Returns the user when the signature is valid and not older than maxAgeSec, otherwise null.
export async function verifyInitData(initData: string, botToken: string, maxAgeSec = 7 * 86400, now = Date.now()): Promise<TgUser | null> {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const expected = hex(await hmac(secret, check));
  if (expected.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') || 'null');
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

export async function tg(botToken: string, method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export const langOf = (code?: string) => (code && code.toLowerCase().startsWith('ru') ? 'ru' : 'ua');
