// node --experimental-strip-types supabase/tests/telegram.test.ts
import { createHmac } from 'node:crypto';
import { verifyInitData } from '../functions/_shared/telegram.ts';

const TOKEN = '123456:TEST';
function sign(fields: Record<string, string>, token = TOKEN) {
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const now = Date.now();
const user = JSON.stringify({ id: 42, first_name: 'Валерія', language_code: 'uk' });
const fields = { auth_date: String(Math.floor(now / 1000) - 60), query_id: 'AAE', user };
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('✖', m); } };
ok((await verifyInitData(sign(fields), TOKEN, 86400, now))?.id === 42, 'valid initData accepted');
ok((await verifyInitData(sign(fields, '999:OTHER'), TOKEN, 86400, now)) === null, 'other bot token rejected');
const tampered = new URLSearchParams(sign(fields)); tampered.set('user', JSON.stringify({ id: 7, first_name: 'Mallory' }));
ok((await verifyInitData(tampered.toString(), TOKEN, 86400, now)) === null, 'tampered user rejected');
ok((await verifyInitData(sign({ ...fields, auth_date: String(Math.floor(now / 1000) - 90000) }), TOKEN, 86400, now)) === null, 'stale auth_date rejected');
ok((await verifyInitData('', TOKEN)) === null, 'empty rejected');
console.log(fails ? `${fails} failed` : '✓ initData checks passed');
process.exit(fails ? 1 : 0);
