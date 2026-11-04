import type { AutomationConfig, ConnStatus, Entity, EnergySummary, Me, Point, Provider, SceneConfig, Snapshot } from './types';

const now = () => new Date().toISOString();
const ent = (entity_id: string, state: string, attributes: Record<string, any> = {}): Entity => ({
  entity_id, state, attributes, last_changed: now(), last_updated: now(),
});

const AREAS = [
  { id: 'salon', name: 'Salon' }, { id: 'sypialnia', name: 'Sypialnia' }, { id: 'kuchnia', name: 'Kuchnia' },
  { id: 'lazienka', name: 'Łazienka' }, { id: 'pralnia', name: 'Pralnia' }, { id: 'biuro', name: 'Biuro' },
];

const LIGHT = { supported_color_modes: ['color_temp', 'hs'], color_mode: 'color_temp', min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 };
const SIMPLE_LIGHT = { supported_color_modes: ['brightness'], color_mode: 'brightness' };

type Def = [area: string, entity: Entity, device?: string];

const ago = (min: number) => new Date(Date.now() - min * 6e4).toISOString();
const auto = (id: string, name: string, description: string, lastMin: number): Def => ['', ent(`automation.${id}`, 'on', { friendly_name: name, last_triggered: ago(lastMin), description })];
const scene = (id: string, name: string, lastMin?: number): Def => ['', ent(`scene.${id}`, lastMin === undefined ? 'unknown' : ago(lastMin), { friendly_name: name })];

const defs = (): Def[] => [
  ['salon', ent('sensor.salon_temperatura', '24.5', { friendly_name: 'Temperatura', device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' }), 'th-salon'],
  ['salon', ent('sensor.salon_wilgotnosc', '46', { friendly_name: 'Wilgotność', device_class: 'humidity', unit_of_measurement: '%', state_class: 'measurement' }), 'th-salon'],
  ['salon', ent('sensor.salon_co2', '640', { friendly_name: 'CO2', device_class: 'carbon_dioxide', unit_of_measurement: 'ppm', state_class: 'measurement' }), 'th-salon'],
  ['salon', ent('climate.salon_klimatyzacja', 'cool', {
    friendly_name: 'Klimatyzacja', hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto'], fan_modes: ['auto', 'low', 'medium', 'high'],
    swing_modes: ['off', 'vertical'], fan_mode: 'auto', swing_mode: 'off', temperature: 23, current_temperature: 24.5, min_temp: 16, max_temp: 30, target_temp_step: 0.5, supported_features: 41,
  })],
  ['salon', ent('light.salon_sufit', 'on', { ...LIGHT, friendly_name: 'Sufit', brightness: 200, color_temp_kelvin: 3000 })],
  ['salon', ent('light.salon_lampa', 'on', { ...LIGHT, friendly_name: 'Lampa stojąca', brightness: 140, color_temp_kelvin: 2700 })],
  ['salon', ent('light.salon_listwa', 'on', { ...SIMPLE_LIGHT, friendly_name: 'Listwa LED', brightness: 90 })],
  ['salon', ent('cover.salon_roleta', 'open', { friendly_name: 'Roleta', current_position: 100, supported_features: 15, device_class: 'blind' })],
  ['sypialnia', ent('sensor.sypialnia_temperatura', '21.2', { friendly_name: 'Temperatura', device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' }), 'th-syp'],
  ['sypialnia', ent('sensor.sypialnia_wilgotnosc', '51', { friendly_name: 'Wilgotność', device_class: 'humidity', unit_of_measurement: '%', state_class: 'measurement' }), 'th-syp'],
  ['sypialnia', ent('light.sypialnia_sufit', 'off', { ...LIGHT, friendly_name: 'Sufit' })],
  ['sypialnia', ent('cover.sypialnia_roleta', 'open', { friendly_name: 'Roleta', current_position: 100, supported_features: 15, device_class: 'blind' })],
  ['sypialnia', ent('binary_sensor.sypialnia_okno', 'off', { friendly_name: 'Okno', device_class: 'window' })],
  ['kuchnia', ent('sensor.kuchnia_temperatura', '22.8', { friendly_name: 'Temperatura', device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' })],
  ['kuchnia', ent('light.kuchnia_sufit', 'off', { ...SIMPLE_LIGHT, friendly_name: 'Sufit' })],
  ['kuchnia', ent('light.kuchnia_blat', 'off', { ...SIMPLE_LIGHT, friendly_name: 'Blat' })],
  ['kuchnia', ent('switch.kuchnia_ekspres', 'off', { friendly_name: 'Ekspres', device_class: 'outlet' })],
  ['kuchnia', ent('binary_sensor.kuchnia_zalanie', 'off', { friendly_name: 'Czujnik zalania', device_class: 'moisture' })],
  ['lazienka', ent('sensor.lazienka_temperatura', '23.6', { friendly_name: 'Temperatura', device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' }), 'th-laz'],
  ['lazienka', ent('sensor.lazienka_wilgotnosc', '62', { friendly_name: 'Wilgotność', device_class: 'humidity', unit_of_measurement: '%', state_class: 'measurement' }), 'th-laz'],
  ['lazienka', ent('light.lazienka_lustro', 'off', { ...SIMPLE_LIGHT, friendly_name: 'Lustro' })],
  ['lazienka', ent('switch.lazienka_wentylator', 'off', { friendly_name: 'Wentylator' })],
  ['pralnia', ent('sensor.pralka_status', 'run', { friendly_name: 'Pralka Status' }), 'pralka'],
  ['pralnia', ent('sensor.pralka_pozostaly_czas', '32', { friendly_name: 'Pralka Pozostały czas', unit_of_measurement: 'min', device_class: 'duration' }), 'pralka'],
  ['pralnia', ent('sensor.pralka_program', 'Bawełna 40°', { friendly_name: 'Pralka Program' }), 'pralka'],
  ['pralnia', ent('binary_sensor.pralnia_zalanie', 'off', { friendly_name: 'Czujnik zalania', device_class: 'moisture' })],
  ['biuro', ent('sensor.biuro_temperatura', '22.1', { friendly_name: 'Temperatura', device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' })],
  ['biuro', ent('light.biuro_biurko', 'off', { ...SIMPLE_LIGHT, friendly_name: 'Lampka' })],
  ['biuro', ent('switch.biuro_gniazdko', 'on', { friendly_name: 'Gniazdko', device_class: 'outlet' })],
  ['', ent('lock.drzwi_wejsciowe', 'locked', { friendly_name: 'Drzwi wejściowe', supported_features: 0 })],
  ['', ent('binary_sensor.drzwi_wejsciowe', 'off', { friendly_name: 'Drzwi wejściowe', device_class: 'door' })],
  ['', ent('binary_sensor.ruch_korytarz', 'off', { friendly_name: 'Ruch w korytarzu', device_class: 'motion' })],
  ['', ent('binary_sensor.czujnik_dymu', 'off', { friendly_name: 'Czujnik dymu', device_class: 'smoke' })],
  ['', ent('sensor.dom_energia', '4182.6', { friendly_name: 'Energia', device_class: 'energy', state_class: 'total_increasing', unit_of_measurement: 'kWh' })],
  ['', ent('weather.dom', 'partlycloudy', { friendly_name: 'Dom', temperature: 14, temperature_unit: '°C', humidity: 71 })],
  ['', ent('person.ty', 'home', { friendly_name: 'Ty' })],
  ['', ent('person.domownik', 'not_home', { friendly_name: 'Domownik' })],
  scene('w_domu', 'W domu', 95), scene('wychodze', 'Wychodzę'), scene('noc', 'Noc'), scene('urlop', 'Urlop'),
  scene('relaks', 'Relaks'), scene('kino', 'Kino'), scene('sprzatanie', 'Sprzątanie'), scene('goscie', 'Goście'),
  scene('pobudka', 'Pobudka'), scene('oszczedzanie', 'Oszczędzanie energii'),
  auto('klima_upal', 'Klimatyzacja przy upale', 'Włącz, gdy w salonie > 26°C', 240),
  auto('ogrzewanie', 'Ogrzewanie wieczorem', 'Włącz o 21:00, jeśli < 20°C', 1600),
  auto('swiatla_powrot', 'Światła – powrót do domu', 'Włącz, gdy jestem w pobliżu', 95),
  auto('tryb_nocny', 'Tryb nocny', 'O 23:00 wyłącz światła i zasuń rolety', 900),
  auto('pranie', 'Przypomnienie o praniu', 'Powiadom, gdy cykl się zakończy', 2900),
];

/** Co robi każda scena demo: encja → stan docelowy. */
const SCENES: Record<string, Record<string, string>> = {
  'scene.w_domu': { 'light.salon_sufit': 'on', 'light.salon_lampa': 'on', 'light.salon_listwa': 'on', 'cover.salon_roleta': 'open' },
  'scene.wychodze': { 'light.salon_sufit': 'off', 'light.salon_lampa': 'off', 'light.salon_listwa': 'off', 'climate.salon_klimatyzacja': 'off', 'lock.drzwi_wejsciowe': 'locked' },
  'scene.noc': { 'light.salon_sufit': 'off', 'light.salon_lampa': 'off', 'light.salon_listwa': 'off', 'cover.salon_roleta': 'closed', 'cover.sypialnia_roleta': 'closed' },
  'scene.urlop': { 'light.salon_sufit': 'off', 'light.salon_lampa': 'off', 'light.salon_listwa': 'off', 'climate.salon_klimatyzacja': 'off' },
  'scene.relaks': { 'light.salon_sufit': 'off', 'light.salon_lampa': 'on', 'light.salon_listwa': 'on' },
  'scene.kino': { 'light.salon_sufit': 'off', 'light.salon_lampa': 'off', 'light.salon_listwa': 'on', 'cover.salon_roleta': 'closed' },
  'scene.sprzatanie': { 'light.salon_sufit': 'on', 'cover.salon_roleta': 'open' },
  'scene.goscie': { 'light.salon_sufit': 'on', 'light.salon_lampa': 'on', 'light.salon_listwa': 'on' },
  'scene.pobudka': { 'cover.sypialnia_roleta': 'open', 'light.sypialnia_sufit': 'on' },
  'scene.oszczedzanie': { 'light.salon_sufit': 'off', 'light.salon_lampa': 'off', 'climate.salon_klimatyzacja': 'off' },
};

export class DemoProvider implements Provider {
  kind = 'demo' as const;
  private snap: Snapshot;
  private cb?: (s: Snapshot) => void;
  private timer?: number;
  private scenes: Record<string, Record<string, string>> = { ...SCENES };

  constructor() {
    const entities: Snapshot['entities'] = {};
    const registry: Snapshot['registry'] = {};
    const descriptions: Snapshot['descriptions'] = {};
    for (const [area, e, device] of defs()) {
      entities[e.entity_id] = e;
      registry[e.entity_id] = { areaId: area || null, deviceId: device ?? null };
      if (e.attributes.description) descriptions[e.entity_id] = e.attributes.description;
    }
    this.snap = {
      entities, registry, descriptions, areas: AREAS, at: Date.now(),
      devices: {
        'th-salon': { name: 'Termometr', areaId: 'salon' }, 'th-syp': { name: 'Termometr', areaId: 'sypialnia' },
        'th-laz': { name: 'Termometr', areaId: 'lazienka' }, pralka: { name: 'Pralka', areaId: 'pralnia' },
      },
    };
  }

  async start(onSnapshot: (s: Snapshot) => void, onStatus: (s: ConnStatus) => void) {
    this.cb = onSnapshot;
    onStatus('online');
    this.emit();
    this.timer = window.setInterval(() => this.tick(), 60_000);
  }

  stop() { clearInterval(this.timer); }

  private emit() { this.snap = { ...this.snap, at: Date.now() }; this.cb?.(this.snap); }

  private set(id: string, state: string, attrs: Record<string, any> = {}) {
    const e = this.snap.entities[id];
    if (!e) return;
    const t = now();
    this.snap.entities = {
      ...this.snap.entities,
      [id]: { ...e, state, attributes: { ...e.attributes, ...attrs }, last_updated: t, last_changed: state !== e.state ? t : e.last_changed },
    };
  }

  private tick() {
    const left = parseFloat(this.snap.entities['sensor.pralka_pozostaly_czas'].state);
    if (this.snap.entities['sensor.pralka_status'].state === 'run') {
      const n = Math.max(0, left - 1);
      this.set('sensor.pralka_pozostaly_czas', String(n));
      if (n === 0) this.set('sensor.pralka_status', 'end');
    }
    this.emit();
  }

  private apply(id: string, target: string) {
    const domain = id.split('.')[0];
    const e = this.snap.entities[id];
    if (!e) return;
    if (domain === 'cover') this.set(id, target, { current_position: target === 'open' ? 100 : 0 });
    else if (domain === 'light' && target === 'on') this.set(id, 'on', { brightness: e.attributes.brightness ?? 180 });
    else this.set(id, target);
  }

  async call(domain: string, service: string, data: Record<string, any> = {}) {
    await new Promise((r) => setTimeout(r, 120));
    const ids: string[] = [data.entity_id].flat().filter(Boolean);
    for (const id of ids) {
      const e = this.snap.entities[id];
      if (!e) continue;
      if (domain === 'scene' && service === 'turn_on') {
        for (const [k, v] of Object.entries(this.scenes[id] ?? {})) this.apply(k, v);
        this.set(id, now());
      } else if (domain === 'automation' && service === 'trigger') {
        this.set(id, e.state, { last_triggered: now() });
      } else if (service === 'turn_on' || service === 'turn_off' || service === 'toggle') {
        const on = service === 'toggle' ? e.state === 'off' : service === 'turn_on';
        const { entity_id: _, ...attrs } = data;
        if (domain === 'climate') this.set(id, on ? 'cool' : 'off');
        else this.set(id, on ? 'on' : 'off', on ? { brightness: e.attributes.brightness ?? 180, ...attrs } : {});
      } else if (service === 'set_temperature') this.set(id, e.state, { temperature: data.temperature });
      else if (service === 'set_hvac_mode') this.set(id, data.hvac_mode);
      else if (service === 'set_fan_mode') this.set(id, e.state, { fan_mode: data.fan_mode });
      else if (service === 'set_swing_mode') this.set(id, e.state, { swing_mode: data.swing_mode });
      else if (service === 'open_cover') this.set(id, 'open', { current_position: 100 });
      else if (service === 'close_cover') this.set(id, 'closed', { current_position: 0 });
      else if (service === 'stop_cover') this.set(id, e.state);
      else if (service === 'set_cover_position') this.set(id, data.position > 0 ? 'open' : 'closed', { current_position: data.position });
      else if (service === 'lock') this.set(id, 'locked');
      else if (service === 'unlock') this.set(id, 'unlocked');
    }
    this.emit();
  }

  async history(entityId: string, hours: number): Promise<Point[]> {
    const e = this.snap.entities[entityId];
    const base = parseFloat(e?.state ?? e?.attributes.current_temperature ?? '0') || e?.attributes.current_temperature || 21;
    const t = Date.now();
    const n = hours * 4;
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = i / n;
      return { t: t - (1 - x) * hours * 36e5, v: +(base + Math.sin(x * 9) * 0.9 * (1 - x) + Math.sin(x * 23) * 0.2 * (1 - x)).toFixed(1) };
    });
  }

  async energy(): Promise<EnergySummary> {
    return { todayKwh: 12.8, deltaPct: -18, bars: [0.5, 0.35, 0.7, 1.15, 0.85, 0.65, 0.95, 1.3, 1.6, 1.35] };
  }

  async saveAutomation(cfg: AutomationConfig) {
    const id = `automation.nowa_${Date.now()}`;
    this.snap.entities = { ...this.snap.entities, [id]: ent(id, 'on', { friendly_name: cfg.alias, last_triggered: null }) };
    this.snap.registry = { ...this.snap.registry, [id]: {} };
    this.snap.descriptions = { ...this.snap.descriptions, [id]: cfg.description };
    this.emit();
  }

  async saveScene(cfg: SceneConfig) {
    const id = `scene.nowa_${Date.now()}`;
    this.snap.entities = { ...this.snap.entities, [id]: ent(id, 'unknown', { friendly_name: cfg.name }) };
    this.snap.registry = { ...this.snap.registry, [id]: {} };
    this.scenes[id] = Object.fromEntries(Object.entries(cfg.entities).map(([k, v]) => [k, v.state]));
    this.emit();
  }

  async me(): Promise<Me> { return { name: 'Konto demo', isAdmin: true }; }
  mediaUrl(path: string) { return path; }
}
