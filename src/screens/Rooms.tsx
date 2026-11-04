import { useMemo, useRef, useState } from 'react';
import { Camera, Search, X } from 'lucide-react';
import { useApp, roomImage, shrinkPhoto } from '../store';
import { fmt, isOn, isToggleable, plDevices, stateLabel, type Device } from '../ha/model';
import { PageHead, Row, Toggle, deviceIcon, go, roomIcon } from '../components/Ui';

export function DeviceRow({ d, sub }: { d: Device; sub?: string }) {
  const { act, pending, openSheet } = useApp();
  const { Icon, tone } = deviceIcon(d);
  const domain = d.id.split('.')[0];
  const on = d.id in pending ? pending[d.id] === 'on' : isOn(d);
  return (
    <Row
      icon={<Icon size={24} className={`tone-${on || !isToggleable(d.kind) ? tone : 'dim'}`} />}
      title={d.name} sub={sub ?? stateLabel(d)} onClick={() => openSheet(d.id)}
      right={isToggleable(d.kind) && d.available
        ? <Toggle label={`${d.name}: ${on ? 'wyłącz' : 'włącz'}`} on={on} pending={d.id in pending} onChange={(v) => act(domain, v ? 'turn_on' : 'turn_off', { entity_id: d.id }, v ? 'on' : 'off')} />
        : undefined}
    />
  );
}

export function Rooms() {
  const { home, settings, provider } = useApp();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? home.devices.filter((d) => d.name.toLowerCase().includes(t)) : [];
  }, [q, home.devices]);
  const roomName = (id: string | null) => home.rooms.find((r) => r.id === id)?.name;
  const stray = home.devices.filter((d) => !d.roomId && d.kind !== 'binary' && d.kind !== 'sensor');

  return (
    <div className="page">
      <PageHead title="Pokoje" action={
        <button className="icon-btn round-soft" aria-label={searching ? 'Zamknij wyszukiwanie' : 'Szukaj urządzenia'} onClick={() => { setSearching(!searching); setQ(''); }}>
          {searching ? <X size={20} /> : <Search size={20} />}
        </button>} />
      {searching ? (
        <>
          <input className="input" type="search" autoFocus placeholder="Szukaj urządzenia" aria-label="Szukaj urządzenia" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="list">
            {results.map((d) => <DeviceRow key={d.id} d={d} sub={[roomName(d.roomId), stateLabel(d)].filter(Boolean).join(', ')} />)}
            {q && !results.length && <p className="muted">Nie ma urządzenia o takiej nazwie.</p>}
          </div>
        </>
      ) : home.rooms.length === 0 ? (
        <p className="muted">Nie ma jeszcze pomieszczeń. Utwórz je w Home Assistant (obszary), a pojawią się tutaj.</p>
      ) : (
        <>
          <div className="rooms">
            {home.rooms.map((r) => {
              const Icon = roomIcon(r.name);
              const img = roomImage(r.name, r.id, r.picture, settings.photos, provider.mediaUrl.bind(provider));
              return (
                <button key={r.id} className="room" onClick={() => go(`/pokoje/${r.id}`)}>
                  {img && <img src={img} alt="" loading="lazy" />}
                  <span className="room-shade" />
                  <span className="room-text">
                    <Icon size={30} strokeWidth={1.6} />
                    <b>{r.name}</b>
                    <small>{plDevices(r.count)}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {stray.length > 0 && (
            <section className="group"><h2>Bez przypisanego pokoju</h2><div className="list">{stray.map((d) => <DeviceRow key={d.id} d={d} />)}</div></section>
          )}
        </>
      )}
    </div>
  );
}

export function RoomDetail({ id }: { id: string }) {
  const { home, settings, setSettings, provider, toast } = useApp();
  const room = home.rooms.find((r) => r.id === id);
  const file = useRef<HTMLInputElement>(null);
  if (!room) return <div className="page"><PageHead title="Pokój" back /><p className="muted">Tego pokoju już nie ma.</p></div>;
  const img = roomImage(room.name, room.id, room.picture, settings.photos, provider.mediaUrl.bind(provider));
  const control = room.devices.filter((d) => d.kind !== 'sensor' && d.kind !== 'binary');
  const sensors = room.devices.filter((d) => d.kind === 'sensor' || d.kind === 'binary');
  const stats: [string, string][] = [];
  if (room.temperature != null) stats.push(['Temperatura', `${fmt(room.temperature)}°C`]);
  if (room.humidity != null) stats.push(['Wilgotność', `${fmt(room.humidity, 0)}%`]);
  if (room.co2 != null) stats.push(['CO₂', `${fmt(room.co2, 0)} ppm`]);
  return (
    <div className="page">
      <PageHead title={room.name} back action={
        <button className="icon-btn round-soft" aria-label="Zmień zdjęcie pokoju" onClick={() => file.current?.click()}><Camera size={20} /></button>} />
      <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try { setSettings({ photos: { ...settings.photos, [room.id]: await shrinkPhoto(f) } }); toast('Zdjęcie pokoju zmienione.'); }
        catch (err: any) { toast(err.message); }
      }} />
      <div className="room-banner">
        {img && <img src={img} alt="" />}
        <div className="room-stats">
          {stats.map(([k, v]) => <div key={k}><strong>{v}</strong><small>{k}</small></div>)}
        </div>
      </div>
      {control.length > 0 && <section className="group"><h2>Urządzenia</h2><div className="list">{control.map((d) => <DeviceRow key={d.id} d={d} />)}</div></section>}
      {sensors.length > 0 && <section className="group"><h2>Czujniki</h2><div className="list">{sensors.map((d) => <DeviceRow key={d.id} d={d} />)}</div></section>}
      {room.devices.length === 0 && <p className="muted">W tym pokoju nie ma jeszcze urządzeń.</p>}
    </div>
  );
}
