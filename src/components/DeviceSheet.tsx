import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Minus, Plus, Square, Unlock } from 'lucide-react';
import { useApp } from '../store';
import { FAN_PL, HVAC_PL, fmt, isOn, isToggleable, num, stateLabel, type Device } from '../ha/model';
import type { Point } from '../ha/types';
import { Sheet, Toggle } from './Ui';

/** Linia z ostatnich 24 godzin. */
export function History({ entityId, unit }: { entityId: string; unit: string }) {
  const { provider } = useApp();
  const [pts, setPts] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    provider.history(entityId, 24).then((p) => live && setPts(p)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [entityId, provider]);
  if (failed) return <p className="muted small">Historia jest teraz niedostępna.</p>;
  if (!pts) return <div className="chart-skeleton" />;
  if (pts.length < 2) return <p className="muted small">Za mało danych, żeby narysować wykres.</p>;
  const W = 340, H = 110;
  const ts = pts.map((p) => p.t), vs = pts.map((p) => p.v);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), lo = Math.min(...vs), hi = Math.max(...vs);
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  return (
    <figure className="chart">
      <figcaption><span>Ostatnie 24 godziny</span><span>{fmt(lo)}–{fmt(hi)} {unit}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Wykres z 24 godzin, od ${fmt(lo)} do ${fmt(hi)} ${unit}`} preserveAspectRatio="none">
        <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="url(#fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}

function Slider({ value, min = 0, max = 100, label, onCommit }: { value: number; min?: number; max?: number; label: string; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value);
  const timer = useRef<number>(0);
  useEffect(() => setV(value), [value]);
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span><b>{label}</b><i>{Math.round(pct)}%</i></span>
      <input
        type="range" min={min} max={max} value={v} aria-label={label}
        style={{ '--p': `${pct}%` } as React.CSSProperties}
        onChange={(e) => {
          const n = +e.target.value; setV(n);
          clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onCommit(n), 250);
        }}
      />
    </label>
  );
}

function Chips({ options, value, labels, onPick, label }: { options: string[]; value: string; labels: Record<string, string>; onPick: (v: string) => void; label: string }) {
  return (
    <div className="chips-block">
      <p className="field-label">{label}</p>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} role="radio" aria-checked={o === value} className={o === value ? 'chip on' : 'chip'} onClick={() => onPick(o)}>{labels[o] ?? o}</button>
        ))}
      </div>
    </div>
  );
}

function Climate({ d }: { d: Device }) {
  const { act, home } = useApp();
  const e = d.entity, a = e.attributes, id = d.id;
  const roomTemp = home.devices.find((x) => x.kind === 'sensor' && x.roomId === d.roomId && d.roomId && x.entity.attributes.device_class === 'temperature');
  const step = a.target_temp_step ?? 0.5;
  const [target, setTarget] = useState<number>(a.temperature ?? 22);
  const timer = useRef<number>(0);
  useEffect(() => { if (a.temperature != null) setTarget(a.temperature); }, [a.temperature]);
  const change = (delta: number) => {
    const n = Math.min(a.max_temp ?? 30, Math.max(a.min_temp ?? 16, target + delta));
    setTarget(n);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => act('climate', 'set_temperature', { entity_id: id, temperature: n }), 350);
  };
  const off = e.state === 'off';
  return (
    <>
      <div className={`dial${off ? ' off' : ''}`}>
        <button className="round" aria-label="Obniż temperaturę" disabled={off} onClick={() => change(-step)}><Minus size={24} /></button>
        <div className="dial-value">
          <small>{HVAC_PL[e.state] ?? e.state}</small>
          <strong>{fmt(target)}°</strong>
          <small>{a.current_temperature != null ? `Teraz ${fmt(a.current_temperature)}°C` : ' '}</small>
        </div>
        <button className="round" aria-label="Podnieś temperaturę" disabled={off} onClick={() => change(step)}><Plus size={24} /></button>
      </div>
      {a.hvac_modes?.length > 0 && <Chips label="Tryb" options={a.hvac_modes} value={e.state} labels={{ ...HVAC_PL, off: 'Wył.' }} onPick={(m) => act('climate', 'set_hvac_mode', { entity_id: id, hvac_mode: m }, m)} />}
      {a.fan_modes?.length > 0 && <Chips label="Nawiew" options={a.fan_modes} value={a.fan_mode} labels={FAN_PL} onPick={(m) => act('climate', 'set_fan_mode', { entity_id: id, fan_mode: m })} />}
      {a.swing_modes?.length > 0 && <Chips label="Kierunek" options={a.swing_modes} value={a.swing_mode} labels={{ off: 'Stały', vertical: 'Góra-dół', horizontal: 'Lewo-prawo', both: 'Pełny', on: 'Ruchomy' }} onPick={(m) => act('climate', 'set_swing_mode', { entity_id: id, swing_mode: m })} />}
      {roomTemp && <History entityId={roomTemp.id} unit="°C" />}
    </>
  );
}

function Light({ d }: { d: Device }) {
  const { act } = useApp();
  const a = d.entity.attributes;
  const modes: string[] = a.supported_color_modes ?? [];
  const dimmable = modes.some((m) => m !== 'onoff');
  const on = d.entity.state === 'on';
  const lo = a.min_color_temp_kelvin ?? 2200, hi = a.max_color_temp_kelvin ?? 6500;
  return (
    <>
      {dimmable && on && <Slider label="Jasność" value={Math.round(((a.brightness ?? 255) / 255) * 100)} min={1} max={100} onCommit={(v) => act('light', 'turn_on', { entity_id: d.id, brightness_pct: v })} />}
      {modes.includes('color_temp') && on && <div className="slider-kelvin"><Slider label="Barwa światła" value={a.color_temp_kelvin ?? lo} min={lo} max={hi} onCommit={(v) => act('light', 'turn_on', { entity_id: d.id, color_temp_kelvin: v })} /></div>}
      {!on && <p className="muted small">Włącz światło, żeby ustawić jasność.</p>}
    </>
  );
}

function CoverCtl({ d }: { d: Device }) {
  const { act } = useApp();
  const a = d.entity.attributes, id = d.id, f = a.supported_features ?? 15;
  return (
    <>
      <div className="btn-row">
        {!!(f & 1) && <button className="btn" onClick={() => act('cover', 'open_cover', { entity_id: id })}><ArrowUp size={18} /> Otwórz</button>}
        {!!(f & 8) && <button className="btn" onClick={() => act('cover', 'stop_cover', { entity_id: id })}><Square size={16} /> Stop</button>}
        {!!(f & 2) && <button className="btn" onClick={() => act('cover', 'close_cover', { entity_id: id })}><ArrowDown size={18} /> Zamknij</button>}
      </div>
      {!!(f & 4) && a.current_position != null && <Slider label="Pozycja" value={a.current_position} onCommit={(v) => act('cover', 'set_cover_position', { entity_id: id, position: v })} />}
    </>
  );
}

/** Otwarcie zamka wymaga przytrzymania, żeby nie dało się go wykonać przypadkiem. */
function LockCtl({ d }: { d: Device }) {
  const { act } = useApp();
  const locked = d.entity.state === 'locked';
  const [holding, setHolding] = useState(false);
  const t = useRef<number>(0);
  // Puszczenie palca po otwarciu nie może trafić w przycisk Zamknij, który pojawia się w tym samym miejscu.
  const guard = useRef(false);
  const release = () => { if (guard.current) setTimeout(() => { guard.current = false; }, 450); };
  const start = () => {
    setHolding(true);
    t.current = window.setTimeout(() => { guard.current = true; setHolding(false); act('lock', 'unlock', { entity_id: d.id }, 'unlocked'); }, 1200);
  };
  const stop = () => { clearTimeout(t.current); setHolding(false); };
  return (
    <div onPointerUp={release} onPointerCancel={release} onKeyUp={release}>
    {!locked ? <button className="btn primary wide" onClick={() => { if (!guard.current) act('lock', 'lock', { entity_id: d.id }, 'locked'); }}><Lock size={18} /> Zamknij</button> : <button
      className={`hold wide${holding ? ' holding' : ''}`}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(); }} onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
    ><span className="hold-fill" /><Unlock size={18} /> Przytrzymaj, żeby otworzyć</button>}
    </div>
  );
}

function Washer({ d }: { d: Device }) {
  const w = d.washer!;
  return (
    <div className="washer">
      <strong>{w.running && w.remainingMin != null ? `${w.remainingMin} min` : w.statusLabel}</strong>
      <span>{w.running ? `${w.statusLabel}${w.program ? `, ${w.program}` : ''}` : w.program ?? 'Pralka nie pracuje'}</span>
    </div>
  );
}

function Camera({ d }: { d: Device }) {
  const { provider } = useApp();
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setTick(Date.now()), 10_000); return () => clearInterval(i); }, []);
  const pic = d.entity.attributes.entity_picture;
  if (!pic) return <p className="muted small">Kamera nie udostępnia podglądu.</p>;
  return <img className="camera" alt={`Podgląd: ${d.name}`} src={`${provider.mediaUrl(pic)}&t=${tick}`} />;
}

function Vacuum({ d }: { d: Device }) {
  const { act } = useApp();
  return (
    <div className="btn-row">
      <button className="btn" onClick={() => act('vacuum', 'start', { entity_id: d.id })}>Start</button>
      <button className="btn" onClick={() => act('vacuum', 'pause', { entity_id: d.id })}>Pauza</button>
      <button className="btn" onClick={() => act('vacuum', 'return_to_base', { entity_id: d.id })}>Do stacji</button>
    </div>
  );
}

export function DeviceSheet({ device, onClose }: { device: Device; onClose: () => void }) {
  const { act, pending, settings, setSettings } = useApp();
  const d = device;
  const domain = d.id.split('.')[0];
  const on = d.id in pending ? pending[d.id] === 'on' : isOn(d);
  const fav = settings.favorites.includes(d.id);
  const unit = d.entity.attributes.unit_of_measurement ?? '';
  return (
    <Sheet title={d.name} onClose={onClose}>
      <div className="sheet-state">
        <span>{stateLabel(d)}</span>
        {isToggleable(d.kind) && d.available && (
          <Toggle label={`${d.name}: ${on ? 'wyłącz' : 'włącz'}`} on={on} pending={d.id in pending}
            onChange={(v) => act(domain, v ? 'turn_on' : 'turn_off', { entity_id: d.id }, v ? 'on' : 'off')} />
        )}
      </div>
      {!d.available && <p className="notice warn">Urządzenie nie odpowiada. Sprawdź jego zasilanie i połączenie z Wi-Fi.</p>}
      {d.available && d.kind === 'climate' && <Climate d={d} />}
      {d.available && d.kind === 'light' && <Light d={d} />}
      {d.available && d.kind === 'cover' && <CoverCtl d={d} />}
      {d.available && d.kind === 'lock' && <LockCtl d={d} />}
      {d.available && d.kind === 'washer' && <Washer d={d} />}
      {d.available && d.kind === 'camera' && <Camera d={d} />}
      {d.available && d.kind === 'vacuum' && <Vacuum d={d} />}
      {d.kind === 'sensor' && num(d.entity.state) !== null && <History entityId={d.id} unit={unit} />}
      <button className="link-btn" onClick={() => setSettings({ favorites: fav ? settings.favorites.filter((f) => f !== d.id) : [...settings.favorites, d.id] })}>
        {fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
      </button>
    </Sheet>
  );
}
