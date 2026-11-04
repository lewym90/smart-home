// Serwer powiadomień Smart Home. Trzyma listę telefonów i wysyła do nich Web Push.
// Sterowanie domem przez niego nie przechodzi: jego awaria zabiera tylko powiadomienia.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';

const { PORT = '18871', APP_KEY, NOTIFY_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT = 'mailto:admin@example.com',
  ALLOWED_ORIGIN = 'https://lewym90.github.io', DATA_FILE = './subs.json' } = process.env;
if (!APP_KEY || !NOTIFY_SECRET || !VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('Brak zmiennych APP_KEY, NOTIFY_SECRET, VAPID_PUBLIC lub VAPID_PRIVATE');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

let subs = existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, 'utf8')) : [];
const save = () => { writeFileSync(`${DATA_FILE}.tmp`, JSON.stringify(subs)); renameSync(`${DATA_FILE}.tmp`, DATA_FILE); };

const same = (a = '', b = '') => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

async function broadcast(payload) {
  const body = JSON.stringify(payload);
  let sent = 0;
  const gone = new Set();
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(s, body, { TTL: 3600, urgency: 'high' }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) gone.add(s.endpoint);
      else console.error('Błąd wysyłki', e.statusCode ?? e.message);
    }
  }));
  if (gone.size) { subs = subs.filter((s) => !gone.has(s.endpoint)); save(); }
  return sent;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 8192) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const send = (code, obj = {}) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(JSON.stringify(obj));
  };
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(204);
    if (req.method === 'GET' && pathname === '/health') return send(200, { ok: true });
    if (pathname === '/notify' && req.method === 'POST') {
      if (!same(req.headers.authorization, `Bearer ${NOTIFY_SECRET}`)) return send(401, { error: 'unauthorized' });
      const { title, body, url } = await readJson(req);
      if (!title) return send(400, { error: 'title required' });
      return send(200, { sent: await broadcast({ title: String(title), body: String(body ?? ''), url }) });
    }
    if (!same(req.headers['x-app-key'], APP_KEY)) return send(401, { error: 'unauthorized' });
    if (req.method === 'GET' && pathname === '/vapid') return send(200, { key: VAPID_PUBLIC });
    if (req.method === 'POST' && pathname === '/subscribe') {
      const sub = await readJson(req);
      if (!sub?.endpoint?.startsWith('https://') || !sub?.keys?.p256dh || !sub?.keys?.auth) return send(400, { error: 'bad subscription' });
      subs = [...subs.filter((s) => s.endpoint !== sub.endpoint), sub];
      save();
      return send(200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/unsubscribe') {
      const { endpoint } = await readJson(req);
      subs = subs.filter((s) => s.endpoint !== endpoint);
      save();
      return send(200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/test') {
      return send(200, { sent: await broadcast({ title: 'Smart Home', body: 'Powiadomienia działają.' }) });
    }
    send(404, { error: 'not found' });
  } catch (e) {
    send(400, { error: 'bad request' });
  }
}).listen(+PORT, '127.0.0.1', () => console.log(`Smart Home push: 127.0.0.1:${PORT}, telefony: ${subs.length}`));
