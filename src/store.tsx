import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DemoProvider } from './ha/demo';
import { HassProvider } from './ha/hass';
import { activeAlerts, buildHome, type Alert, type Home } from './ha/model';
import type { ConnStatus, Provider, Snapshot } from './ha/types';

export const TILES = ['temperature', 'climate', 'washer', 'lights', 'energy'] as const;
export type TileId = (typeof TILES)[number];

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  tiles: TileId[];
  hiddenTiles: TileId[];
  favorites: string[];
  primaryRoom: string | null;
  homeName: string;
  photos: Record<string, string>;
}

const DEFAULTS: Settings = { theme: 'dark', tiles: [...TILES], hiddenTiles: [], favorites: [], primaryRoom: null, homeName: 'Mój Dom', photos: {} };

export interface LogEntry { id: string; at: number; title: string; level: 'danger' | 'warn' | 'info' }
export interface Conn { url: string; token: string }

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };
const readRaw = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* pełna pamięć nie może zatrzymać aplikacji */ } };

const EMPTY: Snapshot = { entities: {}, areas: [], registry: {}, devices: {}, descriptions: {}, at: 0 };

interface Ctx {
  home: Home;
  snap: Snapshot;
  provider: Provider;
  status: ConnStatus;
  statusMsg?: string;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  conn: Conn | null;
  connect: (c: Conn | null) => void;
  alerts: Alert[];
  log: LogEntry[];
  unread: number;
  markRead: () => void;
  clearLog: () => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  /** polecenie do domu z pamięcią stanu oczekującego */
  act: (domain: string, service: string, data: Record<string, any>, expected?: string) => Promise<boolean>;
  pending: Record<string, string>;
  sheet: string | null;
  openSheet: (id: string | null) => void;
  stale: boolean;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setS] = useState<Settings>(() => read('sh.settings', DEFAULTS));
  const [conn, setConn] = useState<Conn | null>(() => readRaw('sh.conn', null));
  const [snap, setSnap] = useState<Snapshot>(() => (conn ? readRaw('sh.cache', EMPTY) : EMPTY));
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [statusMsg, setMsg] = useState<string>();
  const [log, setLog] = useState<LogEntry[]>(() => readRaw('sh.log', []));
  const [lastRead, setLastRead] = useState<number>(() => readRaw('sh.read', 0));
  const [toastMsg, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [sheet, openSheet] = useState<string | null>(null);

  const provider = useMemo<Provider>(() => (conn ? new HassProvider(conn.url, conn.token) : new DemoProvider()), [conn]);
  const providerRef = useRef(provider); providerRef.current = provider;
  const statusRef = useRef(status); statusRef.current = status;

  const toast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 3500);
  }, []);

  useEffect(() => {
    let live = true;
    let saved = 0;
    provider.start(
      (s) => {
        if (!live) return;
        setSnap(s);
        if (provider.kind === 'hass' && Date.now() - saved > 30_000) { saved = Date.now(); write('sh.cache', s); }
      },
      (st, m) => { if (live) { setStatus(st); setMsg(m); } },
    ).catch(() => { /* stan błędu ustawia dostawca */ });
    return () => { live = false; provider.stop(); };
  }, [provider]);

  const home = useMemo(() => buildHome(snap), [snap]);
  const alerts = useMemo(() => activeAlerts(home), [home]);

  // Zdarzenia: każda nowa sytuacja i koniec prania trafia do listy powiadomień.
  const seen = useRef<Set<string> | null>(null);
  const washing = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!snap.at) return;
    const add: LogEntry[] = [];
    if (seen.current) {
      for (const a of alerts) if (!seen.current.has(a.id)) add.push({ id: `${a.id}:${Date.now()}`, at: Date.now(), title: a.title, level: a.level });
    }
    seen.current = new Set(alerts.map((a) => a.id));
    for (const d of home.devices) {
      if (d.kind !== 'washer') continue;
      if (washing.current[d.id] && d.washer!.finished) add.push({ id: `wash:${Date.now()}`, at: Date.now(), title: `${d.name}: pranie zakończone`, level: 'info' });
      washing.current[d.id] = d.washer!.running;
    }
    if (add.length) setLog((l) => { const n = [...add, ...l].slice(0, 100); write('sh.log', n); return n; });
  }, [home, alerts, snap.at]);

  // Oczekujące polecenie kończy się, gdy dom potwierdzi nowy stan.
  useEffect(() => {
    setPending((p) => {
      const next = { ...p };
      let changed = false;
      for (const id of Object.keys(p)) if (snap.entities[id]?.state === p[id]) { delete next[id]; changed = true; }
      return changed ? next : p;
    });
  }, [snap]);

  const act = useCallback(async (domain: string, service: string, data: Record<string, any>, expected?: string) => {
    if (statusRef.current !== 'online') {
      toast('Brak połączenia z domem. Polecenie nie zostało wysłane.');
      return false;
    }
    const id: string | undefined = data.entity_id;
    if (id && expected) {
      setPending((p) => ({ ...p, [id]: expected }));
      window.setTimeout(() => setPending((p) => {
        if (!(id in p)) return p;
        const { [id]: _, ...rest } = p;
        return rest;
      }), 6000);
    }
    try {
      await providerRef.current.call(domain, service, data);
      return true;
    } catch (e: any) {
      if (id) setPending(({ [id]: _, ...rest }) => rest);
      toast(`Polecenie nie zostało wykonane${e?.message ? `: ${e.message}` : '.'}`);
      return false;
    }
  }, [toast]);

  const setSettings = useCallback((p: Partial<Settings>) => {
    setS((s) => { const n = { ...s, ...p }; write('sh.settings', n); return n; });
  }, []);

  const connect = useCallback((c: Conn | null) => {
    try { c ? localStorage.setItem('sh.conn', JSON.stringify(c)) : localStorage.removeItem('sh.conn'); localStorage.removeItem('sh.cache'); } catch { /* */ }
    setSnap(EMPTY);
    setStatus('connecting');
    setConn(c);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : settings.theme === 'dark';
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#040d18' : '#eaf1f9');
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  const unread = log.filter((l) => l.at > lastRead).length + alerts.filter((a) => a.level === 'danger').length;
  const markRead = useCallback(() => { const t = Date.now(); setLastRead(t); write('sh.read', t); }, []);
  const clearLog = useCallback(() => { setLog([]); write('sh.log', []); }, []);

  const value: Ctx = {
    home, snap, provider, status, statusMsg, settings, setSettings, conn, connect, alerts, log, unread, markRead, clearLog,
    toast, toastMsg, act, pending, sheet, openSheet, stale: status !== 'online' && snap.at > 0,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

const ROOM_IMAGES: [RegExp, string][] = [[/salon|living/i, 'salon'], [/sypial|bed/i, 'sypialnia'], [/kuch|kitchen/i, 'kuchnia'], [/łazien|lazien|bath/i, 'lazienka'], [/pral|laundry/i, 'pralnia'], [/biur|office/i, 'biuro'], [/koryt|przedpok|hol\b|wiatro|hall/i, 'korytarz'], [/jadal|dining/i, 'jadalnia'], [/dzieci|dziecka|kid|child/i, 'dzieciecy'], [/gara[zż]|garage/i, 'garaz'], [/taras|ogr[oó]d|balkon|garden|terrace/i, 'taras']];

export function roomImage(name: string, id: string, picture: string | null | undefined, photos: Record<string, string>, media: (p: string) => string): string | null {
  if (photos[id]) return photos[id];
  if (picture) return media(picture);
  const m = ROOM_IMAGES.find(([r]) => r.test(name));
  return asset(`img/room-${m ? m[1] : 'domyslny'}.webp`);
}

/** Zmniejsza zdjęcie z telefonu, żeby mieściło się w pamięci urządzenia. */
export function shrinkPhoto(file: File, maxWidth = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => reject(new Error('Nie można odczytać tego zdjęcia.'));
    img.src = URL.createObjectURL(file);
  });
}
