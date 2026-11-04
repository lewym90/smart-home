/** Powiadomienia na telefon przez serwer użytkownika. */
export interface PushConfig { url: string; key: string }

export function parsePairing(code: string): PushConfig | null {
  const [url, key] = code.trim().split('#');
  return /^https:\/\/\S+$/.test(url ?? '') && key ? { url: url.replace(/\/+$/, ''), key } : null;
}

export function pushProblem(): string | null {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) return 'Dodaj aplikację do ekranu początkowego: w Safari wybierz Udostępnij, a potem Do ekranu początkowego. Otwórz ją z ikony i wróć tutaj.';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'To urządzenie nie obsługuje powiadomień push.';
  return null;
}

const toBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function api(c: PushConfig, path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(c.url + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-App-Key': c.key, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('Serwer powiadomień nie odpowiada. Sprawdź kod i połączenie.'); }
  if (res.status === 401) throw new Error('Serwer odrzucił kod. Skopiuj go ponownie.');
  if (!res.ok) throw new Error(`Serwer zwrócił błąd ${res.status}.`);
  return res.json();
}

export async function enablePush(c: PushConfig) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Powiadomienia są zablokowane. Włącz je w Ustawieniach iPhone\'a: Powiadomienia, Smart Home.');
  const { key } = await api(c, '/vapid');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
  await api(c, '/subscribe', sub.toJSON());
}

export async function disablePush(c: PushConfig) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await api(c, '/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}

export const sendTest = (c: PushConfig): Promise<{ sent: number }> => api(c, '/test', {});

export async function isSubscribed() {
  if (pushProblem()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}
