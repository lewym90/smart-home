import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  type Connection,
  type HassEntities,
} from 'home-assistant-js-websocket';
import type { AutomationConfig, ConnStatus, EnergySummary, Me, Point, Provider, RegistryEntry, SceneConfig, Snapshot } from './types';

export function normalizeUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

/** Strona z https nie może łączyć się z domem po http: blokuje to przeglądarka, nie Home Assistant. */
export function isMixedContent(url: string, pageProtocol = location.protocol): boolean {
  if (pageProtocol !== 'https:') return false;
  if (!url.startsWith('http://')) return false;
  const host = new URL(url).hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

export function connectionError(err: unknown): string {
  if (err === ERR_INVALID_AUTH) return 'Home Assistant odrzucił token. Utwórz nowy w swoim profilu HA i wklej go tutaj.';
  if (err === ERR_CANNOT_CONNECT) return 'Nie można połączyć się z tym adresem. Sprawdź adres i czy telefon ma dostęp do sieci domowej lub VPN.';
  return 'Połączenie nie powiodło się. Sprawdź adres i token.';
}

export class HassProvider implements Provider {
  kind = 'hass' as const;
  private conn?: Connection;
  private unsub?: () => void;
  private snap: Snapshot = { entities: {}, areas: [], registry: {}, devices: {}, descriptions: {}, at: 0 };
  private onSnap?: (s: Snapshot) => void;

  constructor(private url: string, private token: string) {}

  async start(onSnapshot: (s: Snapshot) => void, onStatus: (s: ConnStatus, msg?: string) => void) {
    this.onSnap = onSnapshot;
    onStatus('connecting');
    let conn: Connection;
    try {
      conn = await createConnection({ auth: createLongLivedTokenAuth(this.url, this.token) });
    } catch (e) {
      onStatus('error', connectionError(e));
      throw e;
    }
    this.conn = conn;
    conn.addEventListener('ready', () => { onStatus('online'); void this.loadRegistries(); });
    conn.addEventListener('disconnected', () => onStatus('offline'));
    conn.addEventListener('reconnect-error', (_c, e) => onStatus('error', connectionError(e)));
    await this.loadRegistries();
    this.unsub = subscribeEntities(conn, (ents: HassEntities) => {
      this.snap = { ...this.snap, entities: ents as any, at: Date.now() };
      void this.loadDescriptions();
      this.emit();
    });
    onStatus('online');
  }

  stop() { this.unsub?.(); this.conn?.close(); }

  private emit() { this.onSnap?.(this.snap); }

  private async loadRegistries() {
    const c = this.conn!;
    const send = (type: string) => c.sendMessagePromise<any[]>({ type }).catch(() => [] as any[]);
    const [areas, devices, entities] = await Promise.all([
      send('config/area_registry/list'),
      send('config/device_registry/list'),
      send('config/entity_registry/list'),
    ]);
    const devMap: Snapshot['devices'] = {};
    for (const d of devices) devMap[d.id] = { name: d.name_by_user || d.name || '', areaId: d.area_id };
    const registry: Record<string, RegistryEntry> = {};
    for (const e of entities) {
      registry[e.entity_id] = {
        areaId: e.area_id || devMap[e.device_id]?.areaId || null,
        deviceId: e.device_id,
        hidden: !!e.hidden_by || !!e.disabled_by,
        category: e.entity_category,
        name: e.name || e.original_name,
      };
    }
    this.snap = {
      ...this.snap,
      areas: areas.map((a) => ({ id: a.area_id, name: a.name, picture: a.picture })),
      devices: devMap,
      registry,
      at: Date.now(),
    };
    this.emit();
  }

  private loadingDesc = false;
  private async loadDescriptions() {
    if (this.loadingDesc) return;
    const missing = Object.keys(this.snap.entities).filter((id) => id.startsWith('automation.') && !(id in this.snap.descriptions));
    if (!missing.length) return;
    this.loadingDesc = true;
    const next = { ...this.snap.descriptions };
    await Promise.all(missing.map(async (id) => {
      try {
        const r = await this.conn!.sendMessagePromise<any>({ type: 'automation/config', entity_id: id });
        next[id] = r?.config?.description ?? '';
      } catch { next[id] = ''; }
    }));
    this.snap = { ...this.snap, descriptions: next };
    this.loadingDesc = false;
    this.emit();
  }

  async call(domain: string, service: string, data: Record<string, any> = {}) {
    if (!this.conn) throw new Error('Brak połączenia');
    const { entity_id, ...rest } = data;
    await callService(this.conn, domain, service, rest, entity_id ? { entity_id } : undefined);
  }

  async history(entityId: string, hours: number): Promise<Point[]> {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600_000);
    const r = await this.conn!.sendMessagePromise<Record<string, { s: string; lu: number }[]>>({
      type: 'history/history_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: [entityId],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
    return (r[entityId] ?? [])
      .map((p) => ({ t: p.lu * 1000, v: parseFloat(p.s) }))
      .filter((p) => Number.isFinite(p.v) && p.t > 0);
  }

  async energy(entityId: string): Promise<EnergySummary | null> {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 864e5);
    const r = await this.conn!.sendMessagePromise<Record<string, { start: number; change?: number }[]>>({
      type: 'recorder/statistics_during_period',
      start_time: yesterday.toISOString(),
      end_time: now.toISOString(),
      statistic_ids: [entityId],
      period: 'hour',
      types: ['change'],
    });
    return summarizeEnergy(r[entityId] ?? [], now);
  }

  /** Zapis konfiguracji idzie przez REST, więc HA musi znać adres aplikacji (cors_allowed_origins). */
  private async post(path: string, body: unknown) {
    const res = await fetch(`${this.url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) throw new Error('Do tej zmiany potrzebne jest konto administratora Home Assistanta.');
    if (!res.ok) throw new Error(`Home Assistant odrzucił zapis (kod ${res.status}).`);
  }

  saveAutomation(cfg: AutomationConfig) { return this.post(`/api/config/automation/config/${Date.now()}`, cfg); }
  saveScene(cfg: SceneConfig) { return this.post(`/api/config/scene/config/${Date.now()}`, cfg); }

  async me(): Promise<Me | null> {
    const u = await this.conn!.sendMessagePromise<any>({ type: 'auth/current_user' }).catch(() => null);
    return u ? { name: u.name, isAdmin: !!u.is_admin } : null;
  }

  mediaUrl(path: string) { return path.startsWith('http') ? path : this.url + path; }
}

export function summarizeEnergy(stats: { start: number; change?: number }[], now: Date): EnergySummary | null {
  if (!stats.length) return null;
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime();
  const elapsed = now.getTime() - t0;
  const todayRows = stats.filter((s) => s.start >= t0);
  const yRows = stats.filter((s) => s.start < t0 && s.start < t0 - 864e5 + elapsed);
  const sum = (rows: typeof stats) => rows.reduce((a, r) => a + Math.max(r.change ?? 0, 0), 0);
  const todayKwh = sum(todayRows);
  const y = sum(yRows);
  return {
    todayKwh,
    deltaPct: y > 0 ? Math.round(((todayKwh - y) / y) * 100) : null,
    bars: todayRows.slice(-10).map((r) => Math.max(r.change ?? 0, 0)),
  };
}
