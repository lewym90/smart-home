import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useApp } from '../store';
import { isUnavailable, timeAgo, stateLabel } from '../ha/model';
import type { Entity } from '../ha/types';
import { PageHead, Sheet, Toggle, autoVisual, go, sceneVisual } from '../components/Ui';

export function Scenes() {
  const { home, act, toast } = useApp();
  const [done, setDone] = useState<string | null>(null);
  const run = async (s: Entity) => {
    const ok = await act('scene', 'turn_on', { entity_id: s.entity_id });
    if (ok) {
      setDone(s.entity_id);
      setTimeout(() => setDone((d) => (d === s.entity_id ? null : d)), 1600);
      toast(`Scena uruchomiona: ${s.attributes.friendly_name}`);
    }
  };
  return (
    <div className="page">
      <PageHead title="Sceny" action={<button className="icon-btn round-soft tone-cyan" aria-label="Nowa scena" onClick={() => go('/sceny/nowa')}><Plus size={22} /></button>} />
      <div className="scene-grid">
        {home.scenes.map((s) => {
          const name = s.attributes.friendly_name ?? s.entity_id;
          const { Icon, tone } = sceneVisual(name);
          return (
            <button key={s.entity_id} className={`scene card${done === s.entity_id ? ' done' : ''}`} onClick={() => run(s)}>
              <span className={`q-ball small tone-${tone}`}>{done === s.entity_id ? <Check size={22} /> : <Icon size={22} />}</span>
              <b>{name}</b>
              <small>{timeAgo(isUnavailable(s) ? null : s.state)}</small>
            </button>
          );
        })}
      </div>
      {!home.scenes.length && <p className="muted">Nie ma jeszcze scen. Utwórz pierwszą przyciskiem plus.</p>}
      <button className="cta" onClick={() => go('/sceny/nowa')}><Plus size={20} /> Nowa scena</button>
    </div>
  );
}

export function Automations() {
  const { home, snap, act, pending } = useApp();
  const [open, setOpen] = useState<Entity | null>(null);
  const current = open ? home.automations.find((a) => a.entity_id === open.entity_id) : null;
  return (
    <div className="page">
      <PageHead title="Automatyzacje" action={<button className="icon-btn round-soft tone-cyan" aria-label="Nowa automatyzacja" onClick={() => go('/automatyzacje/nowa')}><Plus size={22} /></button>} />
      <div className="list autos">
        {home.automations.map((a) => {
          const name = a.attributes.friendly_name ?? a.entity_id;
          const { Icon, tone } = autoVisual(name);
          const on = a.entity_id in pending ? pending[a.entity_id] === 'on' : a.state === 'on';
          return (
            <div key={a.entity_id} className="auto card">
              <button className="auto-main" onClick={() => setOpen(a)}>
                <Icon size={34} strokeWidth={1.7} className={`tone-${tone}`} />
                <span><b>{name}</b><small>{snap.descriptions[a.entity_id] || timeAgo(a.attributes.last_triggered)}</small></span>
              </button>
              <Toggle label={`${name}: ${on ? 'wyłącz' : 'włącz'}`} on={on} pending={a.entity_id in pending}
                onChange={(v) => act('automation', v ? 'turn_on' : 'turn_off', { entity_id: a.entity_id }, v ? 'on' : 'off')} />
            </div>
          );
        })}
        {!home.automations.length && <p className="muted">Nie ma jeszcze automatyzacji.</p>}
      </div>
      <button className="cta" onClick={() => go('/automatyzacje/nowa')}><Plus size={20} /> Nowa automatyzacja</button>
      {current && (
        <Sheet title={current.attributes.friendly_name} onClose={() => setOpen(null)}>
          <p className="muted">{snap.descriptions[current.entity_id]}</p>
          <p className="kv"><span>Ostatnie uruchomienie</span><b>{timeAgo(current.attributes.last_triggered)}</b></p>
          <button className="btn primary wide" onClick={async () => { if (await act('automation', 'trigger', { entity_id: current.entity_id })) setOpen(null); }}>Uruchom teraz</button>
        </Sheet>
      )}
    </div>
  );
}

type TriggerKind = 'above' | 'below' | 'time';

export function NewAutomation() {
  const { home, provider, toast } = useApp();
  const temps = useMemo(() => home.devices.filter((d) => d.kind === 'sensor' && d.entity.attributes.device_class === 'temperature'), [home]);
  const targets = useMemo(() => home.devices.filter((d) => ['light', 'switch', 'climate', 'fan', 'cover'].includes(d.kind)), [home]);
  const roomOf = (id: string | null) => home.rooms.find((r) => r.id === id)?.name;
  const label = (d: { name: string; roomId: string | null }) => [roomOf(d.roomId), d.name].filter(Boolean).join(': ');

  const [name, setName] = useState('');
  const [kind, setKind] = useState<TriggerKind>('above');
  const [sensor, setSensor] = useState(temps[0]?.id ?? '');
  const [value, setValue] = useState(26);
  const [time, setTime] = useState('21:00');
  const [action, setAction] = useState<'on' | 'off' | 'scene'>('on');
  const [target, setTarget] = useState(targets[0]?.id ?? '');
  const [scene, setScene] = useState(home.scenes[0]?.entity_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sensorDev = temps.find((t) => t.id === sensor);
  const targetDev = targets.find((t) => t.id === target);
  const sceneName = home.scenes.find((s) => s.entity_id === scene)?.attributes.friendly_name;
  const needsSensor = kind !== 'time';
  const whenText = kind === 'time' ? `O ${time}` : `Gdy ${sensorDev ? label(sensorDev) : 'temperatura'} ${kind === 'above' ? '>' : '<'} ${value}°C`;
  const doText = action === 'scene' ? `uruchom scenę ${sceneName ?? ''}` : `${action === 'on' ? 'włącz' : 'wyłącz'} ${targetDev ? label(targetDev) : ''}`;
  const valid = name.trim() && (needsSensor ? sensor : time) && (action === 'scene' ? scene : target);

  const save = async () => {
    setSaving(true); setError('');
    const trigger = kind === 'time'
      ? { trigger: 'time', at: `${time}:00` }
      : { trigger: 'numeric_state', entity_id: sensor, [kind]: value };
    const domain = target.split('.')[0];
    const service = domain === 'cover' ? (action === 'on' ? 'open_cover' : 'close_cover') : action === 'on' ? 'turn_on' : 'turn_off';
    const act = action === 'scene'
      ? { action: 'scene.turn_on', target: { entity_id: scene } }
      : { action: `${domain}.${service}`, target: { entity_id: target } };
    try {
      await provider.saveAutomation({ alias: name.trim(), description: `${whenText}: ${doText}`, triggers: [trigger], conditions: [], actions: [act], mode: 'single' });
      toast('Automatyzacja zapisana.');
      history.back();
    } catch (e: any) {
      setError(e?.message === 'Failed to fetch' ? 'Home Assistant zablokował zapis. Dodaj adres aplikacji do cors_allowed_origins w configuration.yaml.' : e?.message ?? 'Zapis nie powiódł się.');
      setSaving(false);
    }
  };

  return (
    <div className="page form">
      <PageHead title="Nowa automatyzacja" back />
      <label className="field"><span>Nazwa</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Np. Chłodzenie salonu" /></label>
      <section className="group">
        <h2>Kiedy</h2>
        <div className="chips">
          {([['above', 'Temperatura powyżej'], ['below', 'Temperatura poniżej'], ['time', 'O godzinie']] as const).map(([k, l]) => (
            <button key={k} className={kind === k ? 'chip on' : 'chip'} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
        {needsSensor ? (
          temps.length ? <>
            <label className="field"><span>Czujnik</span><select className="input" value={sensor} onChange={(e) => setSensor(e.target.value)}>{temps.map((t) => <option key={t.id} value={t.id}>{label(t)}</option>)}</select></label>
            <label className="field"><span>Temperatura (°C)</span><input className="input" type="number" inputMode="decimal" value={value} onChange={(e) => setValue(+e.target.value)} /></label>
          </> : <p className="muted">Dom nie ma jeszcze czujnika temperatury.</p>
        ) : <label className="field"><span>Godzina</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>}
      </section>
      <section className="group">
        <h2>Wykonaj</h2>
        <div className="chips">
          {([['on', 'Włącz'], ['off', 'Wyłącz'], ['scene', 'Uruchom scenę']] as const).map(([k, l]) => (
            <button key={k} className={action === k ? 'chip on' : 'chip'} onClick={() => setAction(k)}>{l}</button>
          ))}
        </div>
        {action === 'scene'
          ? <label className="field"><span>Scena</span><select className="input" value={scene} onChange={(e) => setScene(e.target.value)}>{home.scenes.map((s) => <option key={s.entity_id} value={s.entity_id}>{s.attributes.friendly_name}</option>)}</select></label>
          : <label className="field"><span>Urządzenie</span><select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>{targets.map((t) => <option key={t.id} value={t.id}>{label(t)}</option>)}</select></label>}
      </section>
      <p className="preview card">{whenText}: {doText}.</p>
      {error && <p className="notice warn" role="alert">{error}</p>}
      <button className="cta" disabled={!valid || saving} onClick={save}>{saving ? 'Zapisuję…' : 'Zapisz automatyzację'}</button>
    </div>
  );
}

export function NewScene() {
  const { home, provider, toast } = useApp();
  const devs = useMemo(() => home.devices.filter((d) => ['light', 'switch', 'climate', 'fan', 'cover'].includes(d.kind) && d.available), [home]);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const roomOf = (id: string | null) => home.rooms.find((r) => r.id === id)?.name;
  const ids = Object.keys(picked).filter((k) => picked[k]);

  const save = async () => {
    setSaving(true); setError('');
    const entities: Record<string, Record<string, any>> = {};
    for (const id of ids) {
      const e = home.byEntity[id].entity, a = e.attributes;
      const s: Record<string, any> = { state: e.state };
      for (const k of ['brightness', 'color_temp_kelvin', 'temperature', 'hvac_mode', 'fan_mode', 'current_position']) if (a[k] != null) s[k === 'current_position' ? 'position' : k] = a[k];
      entities[id] = s;
    }
    try {
      await provider.saveScene({ name: name.trim(), entities });
      toast('Scena zapisana.');
      history.back();
    } catch (e: any) {
      setError(e?.message === 'Failed to fetch' ? 'Home Assistant zablokował zapis. Dodaj adres aplikacji do cors_allowed_origins w configuration.yaml.' : e?.message ?? 'Zapis nie powiódł się.');
      setSaving(false);
    }
  };

  return (
    <div className="page form">
      <PageHead title="Nowa scena" back />
      <label className="field"><span>Nazwa</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Np. Wieczór filmowy" /></label>
      <section className="group">
        <h2>Urządzenia</h2>
        <p className="muted small">Ustaw urządzenia tak, jak mają działać w scenie, i zaznacz je tutaj. Scena zapamięta ich obecny stan.</p>
        <div className="list">
          {devs.map((d) => (
            <div key={d.id} className="row card">
              <span className="row-text"><b>{d.name}</b><small>{[roomOf(d.roomId), stateLabel(d)].filter(Boolean).join(', ')}</small></span>
              <Toggle label={d.name} on={!!picked[d.id]} onChange={(v) => setPicked({ ...picked, [d.id]: v })} />
            </div>
          ))}
        </div>
      </section>
      {error && <p className="notice warn" role="alert">{error}</p>}
      <button className="cta" disabled={!name.trim() || !ids.length || saving} onClick={save}>{saving ? 'Zapisuję…' : 'Zapisz scenę'}</button>
    </div>
  );
}
