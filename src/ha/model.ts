import type { Area, Entity, Snapshot } from './types';

export type Kind = 'climate' | 'light' | 'switch' | 'fan' | 'cover' | 'lock' | 'camera' | 'vacuum' | 'media' | 'humidifier' | 'sensor' | 'binary' | 'washer';

export interface Washer {
  statusLabel: string;
  running: boolean;
  finished: boolean;
  remainingMin: number | null;
  program: string | null;
}

export interface Device {
  id: string;
  kind: Kind;
  name: string;
  roomId: string | null;
  entity: Entity;
  /** wszystkie encje należące do tego urządzenia */
  deviceId: string | null;
  available: boolean;
  washer?: Washer;
}

export interface Room {
  id: string;
  name: string;
  picture?: string | null;
  devices: Device[];
  count: number;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  lightsOn: number;
}

export interface Home {
  rooms: Room[];
  devices: Device[];
  byEntity: Record<string, Device>;
  scenes: Entity[];
  automations: Entity[];
  persons: Entity[];
  weather: Entity | null;
  energyEntity: string | null;
  unavailable: Device[];
  lowBattery: Entity[];
}

const WASHER = /(pralk|washer|washing|wäsche)/i;
const SENSOR_CLASSES = new Set(['temperature', 'humidity', 'carbon_dioxide', 'pm25', 'pm10', 'aqi', 'volatile_organic_compounds', 'volatile_organic_compounds_parts', 'illuminance']);
const BINARY_CLASSES = new Set(['door', 'window', 'opening', 'garage_door', 'motion', 'occupancy', 'presence', 'smoke', 'gas', 'carbon_monoxide', 'moisture']);
const DOMAIN_KIND: Record<string, Kind> = {
  climate: 'climate', light: 'light', switch: 'switch', fan: 'fan', cover: 'cover', lock: 'lock', camera: 'camera',
  vacuum: 'vacuum', media_player: 'media', humidifier: 'humidifier', sensor: 'sensor', binary_sensor: 'binary',
};

export const domainOf = (id: string) => id.split('.')[0];
export const isUnavailable = (e: Entity) => e.state === 'unavailable' || e.state === 'unknown';
export const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export function plDevices(n: number): string {
  const last = n % 10, teen = n % 100;
  if (n === 1) return '1 urządzenie';
  if (last >= 2 && last <= 4 && !(teen >= 12 && teen <= 14)) return `${n} urządzenia`;
  return `${n} urządzeń`;
}

export const fmt = (n: number, digits = 1) => n.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function displayName(e: Entity, snap: Snapshot, room?: Area): string {
  const raw = e.attributes.friendly_name || snap.registry[e.entity_id]?.name || e.entity_id.split('.')[1];
  if (room && raw.toLowerCase().startsWith(room.name.toLowerCase() + ' ')) {
    const rest = raw.slice(room.name.length + 1);
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return raw;
}

const RUN = /(^|[_ -])(run|running|wash|washing|rinse|rinsing|spin|spinning|pran|płuk|wiro|in_progress|active|on)/i;
const END = /(end|finish|complete|done|koniec|zako)/i;
const STATUS_PL: [RegExp, string][] = [
  [/rinse|płuk/i, 'Płukanie'], [/spin|wiro/i, 'Wirowanie'], [END, 'Zakończono'], [RUN, 'Pranie'],
  [/pause|wstrzym/i, 'Wstrzymano'], [/idle|off|stop|ready|bezczyn|gotow/i, 'Gotowa'],
];

export function washerFrom(entities: Entity[]): Washer {
  const name = (e: Entity) => `${e.entity_id} ${e.attributes.friendly_name ?? ''}`;
  const status = entities.find((e) => /(status|state|stan|machine_state|operation)/i.test(name(e)) && !/(remain|pozosta)/i.test(name(e)));
  const remaining = entities.find((e) => /(remain|pozosta|time_left|czas)/i.test(name(e)) && num(e.state) !== null);
  const finish = entities.find((e) => e.attributes.device_class === 'timestamp' && /(finish|end|complet|koni)/i.test(name(e)));
  const program = entities.find((e) => /(program|cycle|cykl)/i.test(name(e)) && num(e.state) === null);
  const raw = status?.state ?? '';
  const statusLabel = STATUS_PL.find(([r]) => r.test(raw))?.[1] ?? (isUnavailable(status ?? ({ state: 'unknown' } as Entity)) ? 'Brak danych' : raw);
  const finished = END.test(raw);
  const running = !finished && RUN.test(raw);
  let remainingMin: number | null = null;
  if (remaining) {
    const v = num(remaining.state)!;
    const unit = remaining.attributes.unit_of_measurement;
    remainingMin = unit === 'h' ? Math.round(v * 60) : unit === 's' ? Math.round(v / 60) : Math.round(v);
  } else if (finish) {
    const t = Date.parse(finish.state);
    if (Number.isFinite(t)) remainingMin = Math.max(0, Math.round((t - Date.now()) / 6e4));
  }
  return { statusLabel, running, finished, remainingMin, program: program && !isUnavailable(program) ? program.state : null };
}

export function buildHome(snap: Snapshot): Home {
  const areaById = new Map(snap.areas.map((a) => [a.id, a]));
  const all = Object.values(snap.entities);
  const devices: Device[] = [];
  const washerGroups = new Map<string, Entity[]>();

  const washerKey = (e: Entity): string | null => {
    const reg = snap.registry[e.entity_id];
    const dev = reg?.deviceId ? snap.devices[reg.deviceId] : undefined;
    if (dev?.name && WASHER.test(dev.name)) return reg!.deviceId!;
    if (!reg?.deviceId && domainOf(e.entity_id) === 'sensor' && WASHER.test(e.entity_id)) return 'washer';
    return null;
  };

  for (const e of all) {
    const key = washerKey(e);
    if (key) { (washerGroups.get(key) ?? washerGroups.set(key, []).get(key)!).push(e); continue; }
    const reg = snap.registry[e.entity_id] ?? {};
    const domain = domainOf(e.entity_id);
    const kind = DOMAIN_KIND[domain];
    if (!kind || reg.hidden || reg.category) continue;
    const dc = e.attributes.device_class;
    if (kind === 'sensor' && !SENSOR_CLASSES.has(dc)) continue;
    if (kind === 'binary' && !BINARY_CLASSES.has(dc)) continue;
    const roomId = reg.areaId ?? null;
    devices.push({
      id: e.entity_id, kind, entity: e, roomId, deviceId: reg.deviceId ?? null,
      name: displayName(e, snap, roomId ? areaById.get(roomId) : undefined),
      available: !isUnavailable(e) || kind === 'sensor',
    });
  }

  for (const [key, ents] of washerGroups) {
    const reg = snap.registry[ents[0].entity_id] ?? {};
    const washer = washerFrom(ents);
    const primary = ents.find((e) => /(status|state|stan)/i.test(e.entity_id)) ?? ents[0];
    devices.push({
      id: `washer:${key}`, kind: 'washer', entity: primary, roomId: reg.areaId ?? null, deviceId: reg.deviceId ?? null,
      name: snap.devices[key]?.name || 'Pralka', available: !ents.every(isUnavailable), washer,
    });
  }

  devices.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const rooms: Room[] = snap.areas.map((a) => {
    const ds = devices.filter((d) => d.roomId === a.id);
    const metric = (cls: string) => {
      const vals = ds.filter((d) => d.kind === 'sensor' && d.entity.attributes.device_class === cls).map((d) => num(d.entity.state)).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
    };
    const climate = ds.find((d) => d.kind === 'climate');
    return {
      id: a.id, name: a.name, picture: a.picture, devices: ds,
      count: new Set(ds.map((d) => d.deviceId ?? d.id)).size,
      temperature: metric('temperature') ?? num(climate?.entity.attributes.current_temperature),
      humidity: metric('humidity'),
      co2: metric('carbon_dioxide'),
      lightsOn: ds.filter((d) => d.kind === 'light' && d.entity.state === 'on').length,
    };
  });

  const byEntity: Home['byEntity'] = {};
  for (const d of devices) byEntity[d.id] = d;

  return {
    rooms, devices, byEntity,
    scenes: all.filter((e) => domainOf(e.entity_id) === 'scene' && !snap.registry[e.entity_id]?.hidden),
    automations: all.filter((e) => domainOf(e.entity_id) === 'automation' && !snap.registry[e.entity_id]?.hidden),
    persons: all.filter((e) => domainOf(e.entity_id) === 'person'),
    weather: all.find((e) => domainOf(e.entity_id) === 'weather') ?? null,
    energyEntity: all.find((e) => e.attributes.device_class === 'energy' && /total/.test(e.attributes.state_class ?? ''))?.entity_id ?? null,
    unavailable: devices.filter((d) => !d.available || isUnavailable(d.entity)),
    lowBattery: all.filter((e) => e.attributes.device_class === 'battery' && (num(e.state) ?? 100) < 15),
  };
}

const QUICK: [string, RegExp][] = [['W domu', /w domu|dom\b|home/i], ['Wychodzę', /wychodz|poza|away|leave/i], ['Noc', /noc|night/i], ['Urlop', /urlop|wakacj|vacation/i]];
export const MODE_LABEL: Record<string, string> = { 'W domu': 'Dom', 'Wychodzę': 'Poza domem', Noc: 'Noc', Urlop: 'Urlop' };

/** Cztery okrągłe przyciski z pulpitu. Scena z najnowszym uruchomieniem jest aktywnym trybem. */
export function quickScenes(scenes: Entity[]): { label: string; scene: Entity }[] {
  const used = new Set<string>();
  const out: { label: string; scene: Entity }[] = [];
  for (const [label, re] of QUICK) {
    const s = scenes.find((x) => re.test(x.attributes.friendly_name ?? '') && !used.has(x.entity_id));
    if (s) { used.add(s.entity_id); out.push({ label, scene: s }); }
  }
  return out;
}

export function activeScene(list: { label: string; scene: Entity }[]) {
  let best: { label: string; scene: Entity } | null = null;
  let bestT = 0;
  for (const q of list) {
    const t = Date.parse(q.scene.state);
    if (Number.isFinite(t) && t > bestT) { bestT = t; best = q; }
  }
  return best;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return 'Jeszcze nie uruchomiono';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Jeszcze nie uruchomiono';
  const min = Math.round((Date.now() - t) / 6e4);
  if (min < 1) return 'Przed chwilą';
  if (min < 60) return `${min} min temu`;
  const d = new Date(t);
  const hm = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (new Date().toDateString() === d.toDateString()) return `Dziś, ${hm}`;
  if (new Date(Date.now() - 864e5).toDateString() === d.toDateString()) return `Wczoraj, ${hm}`;
  return `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}, ${hm}`;
}

export function stateLabel(d: Device): string {
  const e = d.entity;
  if (!d.available) return 'Brak połączenia';
  switch (d.kind) {
    case 'light': case 'switch': case 'fan': case 'humidifier': return e.state === 'on' ? 'Włączone' : 'Wyłączone';
    case 'climate': return e.state === 'off' ? 'Wyłączona' : 'Włączona';
    case 'cover': return e.state === 'open' ? (e.attributes.current_position < 100 ? `Otwarta ${e.attributes.current_position}%` : 'Otwarta') : e.state === 'closed' ? 'Zamknięta' : 'W ruchu';
    case 'lock': return e.state === 'locked' ? 'Zamknięty' : e.state === 'unlocked' ? 'Otwarty' : 'W ruchu';
    case 'washer': return d.washer!.remainingMin && d.washer!.running ? `Pozostało ${d.washer!.remainingMin} min` : d.washer!.statusLabel;
    case 'sensor': { const n = num(e.state); return n === null ? 'Brak danych' : `${fmt(n, Number.isInteger(n) ? 0 : 1)} ${e.attributes.unit_of_measurement ?? ''}`.trim(); }
    case 'binary': return binaryLabel(e);
    case 'vacuum': return e.state === 'cleaning' ? 'Sprząta' : e.state === 'docked' ? 'W stacji' : 'Gotowy';
    default: return e.state;
  }
}

export function binaryLabel(e: Entity): string {
  const on = e.state === 'on';
  switch (e.attributes.device_class) {
    case 'door': case 'window': case 'opening': case 'garage_door': return on ? 'Otwarte' : 'Zamknięte';
    case 'motion': case 'occupancy': case 'presence': return on ? 'Wykryto ruch' : 'Brak ruchu';
    case 'smoke': case 'gas': case 'carbon_monoxide': return on ? 'Alarm' : 'W normie';
    case 'moisture': return on ? 'Wykryto zalanie' : 'Sucho';
    default: return on ? 'Aktywny' : 'Spokój';
  }
}

export const isToggleable = (k: Kind) => k === 'light' || k === 'switch' || k === 'fan' || k === 'humidifier';
export const isOn = (d: Device) => d.kind === 'climate' ? d.entity.state !== 'off' : d.entity.state === 'on';

export const HVAC_PL: Record<string, string> = { off: 'Wyłączona', cool: 'Chłodzenie', heat: 'Grzanie', dry: 'Osuszanie', fan_only: 'Wentylator', auto: 'Auto', heat_cool: 'Grzanie i chłodzenie' };
export const FAN_PL: Record<string, string> = { auto: 'Auto', low: 'Niski', medium: 'Średni', high: 'Wysoki', quiet: 'Cichy', turbo: 'Turbo', middle: 'Średni', off: 'Wył.', on: 'Wł.' };
export const WEATHER_PL: Record<string, string> = { sunny: 'Słonecznie', 'clear-night': 'Pogodnie', partlycloudy: 'Częściowe zachmurzenie', cloudy: 'Pochmurno', rainy: 'Deszcz', pouring: 'Ulewa', snowy: 'Śnieg', fog: 'Mgła', windy: 'Wietrznie', lightning: 'Burza' };

export interface Alert { id: string; level: 'danger' | 'warn'; title: string; deviceId?: string }

/** Stany wymagające uwagi teraz. Lista zdarzeń powstaje z ich zmian. */
export function activeAlerts(home: Home): Alert[] {
  const out: Alert[] = [];
  for (const d of home.devices) {
    if (d.kind !== 'binary' || d.entity.state !== 'on') continue;
    const dc = d.entity.attributes.device_class;
    if (dc === 'moisture') out.push({ id: `leak:${d.id}`, level: 'danger', title: `Wykryto zalanie: ${d.name}`, deviceId: d.id });
    if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide') out.push({ id: `smoke:${d.id}`, level: 'danger', title: `Alarm: ${d.name}`, deviceId: d.id });
  }
  for (const d of home.unavailable) if (d.kind !== 'sensor') out.push({ id: `off:${d.id}`, level: 'warn', title: `Nie odpowiada: ${d.name}`, deviceId: d.id });
  for (const e of home.lowBattery) out.push({ id: `bat:${e.entity_id}`, level: 'warn', title: `Niski poziom baterii: ${e.attributes.friendly_name ?? e.entity_id}` });
  return out;
}
