import { describe, expect, it } from 'vitest';
import { DemoProvider } from './demo';
import { summarizeEnergy, isMixedContent, normalizeUrl } from './hass';
import { activeAlerts, activeScene, buildHome, plDevices, quickScenes, washerFrom } from './model';
import type { Entity, Snapshot } from './types';

const e = (entity_id: string, state: string, attributes: Record<string, any> = {}): Entity => ({ entity_id, state, attributes, last_changed: '', last_updated: '' });
const snap = (ents: Entity[], extra: Partial<Snapshot> = {}): Snapshot => ({ entities: Object.fromEntries(ents.map((x) => [x.entity_id, x])), areas: [], registry: {}, devices: {}, descriptions: {}, at: 1, ...extra });

describe('plDevices', () => {
  it.each([[1, '1 urządzenie'], [2, '2 urządzenia'], [4, '4 urządzenia'], [5, '5 urządzeń'], [12, '12 urządzeń'], [22, '22 urządzenia'], [0, '0 urządzeń']])('%i', (n, s) => expect(plDevices(n)).toBe(s));
});

describe('washerFrom', () => {
  it('rozpoznaje pracę i czas', () => {
    const w = washerFrom([e('sensor.pralka_status', 'run'), e('sensor.pralka_pozostaly_czas', '32', { unit_of_measurement: 'min' })]);
    expect(w).toMatchObject({ running: true, finished: false, remainingMin: 32, statusLabel: 'Pranie' });
  });
  it('liczy godziny na minuty i rozpoznaje koniec', () => {
    const w = washerFrom([e('sensor.washer_state', 'end'), e('sensor.washer_remaining_time', '1.5', { unit_of_measurement: 'h' })]);
    expect(w).toMatchObject({ running: false, finished: true, remainingMin: 90, statusLabel: 'Zakończono' });
  });
  it('nie uznaje stanu off ani unavailable za pracę', () => {
    expect(washerFrom([e('sensor.washer_state', 'off')]).running).toBe(false);
    expect(washerFrom([e('sensor.washer_state', 'unavailable')]).running).toBe(false);
  });
});

describe('buildHome', () => {
  it('grupuje encje pralki w jedno urządzenie i liczy urządzenia, nie encje', () => {
    const h = buildHome(snap(
      [e('sensor.p_status', 'run'), e('sensor.p_time', '10', { unit_of_measurement: 'min' }), e('sensor.t', '20', { device_class: 'temperature' }), e('sensor.h', '50', { device_class: 'humidity' })],
      { areas: [{ id: 'a', name: 'Pralnia' }], devices: { d1: { name: 'Pralka Bosch' }, d2: { name: 'Termometr' } },
        registry: { 'sensor.p_status': { deviceId: 'd1', areaId: 'a' }, 'sensor.p_time': { deviceId: 'd1', areaId: 'a' }, 'sensor.t': { deviceId: 'd2', areaId: 'a' }, 'sensor.h': { deviceId: 'd2', areaId: 'a' } } },
    ));
    expect(h.devices.filter((d) => d.kind === 'washer')).toHaveLength(1);
    expect(h.rooms[0].count).toBe(2);
    expect(h.rooms[0].temperature).toBe(20);
  });
  it('pomija encje diagnostyczne i ukryte', () => {
    const h = buildHome(snap([e('switch.a', 'on'), e('switch.b', 'on'), e('switch.c', 'on')], { registry: { 'switch.a': { category: 'diagnostic' }, 'switch.b': { hidden: true } } }));
    expect(h.devices.map((d) => d.id)).toEqual(['switch.c']);
  });
  it('alarmuje o zalaniu i niedostępnym urządzeniu', () => {
    const a = activeAlerts(buildHome(snap([e('binary_sensor.l', 'on', { device_class: 'moisture', friendly_name: 'Pod zlewem' }), e('switch.x', 'unavailable', { friendly_name: 'Gniazdko' })])));
    expect(a.map((x) => x.title)).toEqual(['Wykryto zalanie: Pod zlewem', 'Nie odpowiada: Gniazdko']);
  });
});

describe('sceny', () => {
  it('aktywny tryb to ostatnio uruchomiona scena', () => {
    const q = quickScenes([e('scene.a', '2026-01-01T10:00:00Z', { friendly_name: 'W domu' }), e('scene.b', '2026-01-02T10:00:00Z', { friendly_name: 'Noc' }), e('scene.c', 'unknown', { friendly_name: 'Urlop' })]);
    expect(activeScene(q)?.label).toBe('Noc');
  });
});

describe('połączenie', () => {
  it('dopisuje https i usuwa ukośnik', () => expect(normalizeUrl(' dom.example.net/ ')).toBe('https://dom.example.net'));
  it('wykrywa blokadę http przy stronie https', () => {
    expect(isMixedContent('http://192.168.1.5:8123', 'https:')).toBe(true);
    expect(isMixedContent('https://dom.net', 'https:')).toBe(false);
    expect(isMixedContent('http://192.168.1.5:8123', 'http:')).toBe(false);
  });
});

describe('energia', () => {
  it('porównuje z wczoraj o tej samej porze', () => {
    const now = new Date(2026, 10, 4, 2, 30);
    const mid = new Date(2026, 10, 4).getTime();
    const h = 36e5;
    const stats = [
      { start: mid - 24 * h, change: 2 }, { start: mid - 23 * h, change: 2 }, { start: mid - 22 * h, change: 1 },
      { start: mid - 10 * h, change: 50 },
      { start: mid, change: 1 }, { start: mid + h, change: 3 }, { start: mid + 2 * h, change: 0.5 },
    ];
    const r = summarizeEnergy(stats, now)!;
    expect(r.todayKwh).toBe(4.5);
    expect(r.deltaPct).toBe(-10);
    expect(r.bars).toEqual([1, 3, 0.5]);
  });
  it('bez danych zwraca null', () => expect(summarizeEnergy([], new Date())).toBeNull());
});

describe('tryb demo', () => {
  it('liczby pokoi zgadzają się z grafiką', () => {
    const p = new DemoProvider();
    let s: Snapshot | undefined;
    (globalThis as any).window = { setInterval: () => 0 };
    p.start((x) => { s = x; }, () => {});
    p.stop();
    expect(buildHome(s!).rooms.map((r) => r.count)).toEqual([6, 4, 5, 3, 2, 3]);
  });
  it('scena zmienia stan urządzeń', async () => {
    const p = new DemoProvider();
    let s: Snapshot | undefined;
    p.start((x) => { s = x; }, () => {});
    await p.call('scene', 'turn_on', { entity_id: 'scene.noc' });
    p.stop();
    expect(s!.entities['light.salon_sufit'].state).toBe('off');
    expect(s!.entities['cover.salon_roleta'].state).toBe('closed');
  });
});
