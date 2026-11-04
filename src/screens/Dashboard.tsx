import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Lightbulb, Settings as Gear, Snowflake, Thermometer, TriangleAlert, Zap } from 'lucide-react';
import { useApp, asset, type TileId } from '../store';
import { MODE_LABEL, activeScene, fmt, quickScenes } from '../ha/model';
import type { EnergySummary } from '../ha/types';
import { IconHome, Washer, Sheet, deviceIcon, go, sceneVisual, weatherIcon, Toggle } from '../components/Ui';

function Tile({ icon, title, sub, value, valueClass, onClick }: { icon: React.ReactNode; title: string; sub: string; value: string; valueClass?: string; onClick: () => void }) {
  return (
    <button className="tile card" onClick={onClick}>
      <span className="tile-icon">{icon}</span>
      <span className="tile-text">
        <b>{title}</b>
        <small>{sub}</small>
        <em className={valueClass}>{value}</em>
      </span>
      <ChevronRight size={16} className="tile-chev" />
    </button>
  );
}

function EnergyTile() {
  const { provider, home, status } = useApp();
  const [e, setE] = useState<EnergySummary | null>(null);
  const id = home.energyEntity;
  useEffect(() => {
    if (!id || status !== 'online') return;
    let live = true;
    provider.energy(id).then((r) => live && setE(r)).catch(() => {});
    return () => { live = false; };
  }, [id, provider, status]);
  if (!e) return null;
  const max = Math.max(...e.bars, 0.01);
  const down = (e.deltaPct ?? 0) <= 0;
  return (
    <button className="energy card" onClick={() => go('/wiecej/energia')}>
      <Zap size={32} className="tone-amber filled" />
      <span className="energy-main">
        <small>Zużycie energii (dziś)</small>
        <span><strong>{fmt(e.todayKwh)}</strong> <i>kWh</i>
          {e.deltaPct !== null && <b className={down ? 'good' : 'bad'}><span aria-hidden>{down ? '▼' : '▲'}</span> {e.deltaPct > 0 ? '+' : '−'}{Math.abs(e.deltaPct)}%</b>}
        </span>
      </span>
      <span className="bars" aria-hidden>{e.bars.map((b, i) => <i key={i} style={{ height: `${Math.max(10, (b / max) * 100)}%` }} />)}</span>
    </button>
  );
}

function HomeMenu({ onClose }: { onClose: () => void }) {
  const { conn, settings, status } = useApp();
  return (
    <Sheet title={settings.homeName} onClose={onClose}>
      <p className="muted">{conn ? `Połączono z ${new URL(conn.url).host}` : 'To dom demonstracyjny. Zmiany nie dotyczą prawdziwych urządzeń.'}</p>
      <button className="btn primary wide" onClick={() => { onClose(); setTimeout(() => go('/wiecej/polaczenie')); }}>
        {conn ? (status === 'online' ? 'Ustawienia połączenia' : 'Napraw połączenie') : 'Połącz z Home Assistant'}
      </button>
    </Sheet>
  );
}

export function Dashboard() {
  const { home, settings, openSheet, act, alerts, conn, pending } = useApp();
  const [menu, setMenu] = useState(false);
  const quick = useMemo(() => quickScenes(home.scenes), [home.scenes]);
  const active = activeScene(quick);
  const [running, setRunning] = useState<string | null>(null);
  const Weather = weatherIcon(home.weather?.state);
  const outside = home.weather?.attributes.temperature;

  const room = home.rooms.find((r) => r.id === settings.primaryRoom)
    ?? home.rooms.find((r) => /salon|living/i.test(r.name) && r.temperature !== null)
    ?? home.rooms.find((r) => r.temperature !== null) ?? home.rooms[0];
  const climate = home.devices.find((d) => d.kind === 'climate' && d.roomId === room?.id) ?? home.devices.find((d) => d.kind === 'climate');
  const washer = home.devices.find((d) => d.kind === 'washer');
  const lightRoom = room?.devices.some((d) => d.kind === 'light') ? room : home.rooms.find((r) => r.devices.some((d) => d.kind === 'light'));
  const favorites = settings.favorites.map((id) => home.byEntity[id]).filter(Boolean);

  const roomName = (id: string | null) => home.rooms.find((r) => r.id === id)?.name ?? 'Dom';

  const tile = (id: TileId) => {
    if (settings.hiddenTiles.includes(id)) return null;
    switch (id) {
      case 'temperature':
        return room?.temperature != null
          ? <Tile key={id} icon={<Thermometer size={36} className="tone-heat" />} title="Temperatura" sub={room.name} value={`${fmt(room.temperature)}°C`} onClick={() => go(`/pokoje/${room.id}`)} /> : null;
      case 'climate':
        return climate
          ? <Tile key={id} icon={<Snowflake size={36} className="tone-cyan glow" />} title="Klimatyzacja" sub={roomName(climate.roomId)} value={climate.entity.state === 'off' ? 'Wyłączona' : 'Włączona'} valueClass={climate.entity.state === 'off' ? 'plain' : 'good'} onClick={() => openSheet(climate.id)} /> : null;
      case 'washer':
        return washer
          ? <Tile key={id} icon={<Washer size={36} />} title="Pralka" sub={washer.washer!.statusLabel} value={washer.washer!.running && washer.washer!.remainingMin != null ? `Pozostało ${washer.washer!.remainingMin} min` : washer.washer!.finished ? 'Gotowe' : 'Bezczynna'} valueClass="long" onClick={() => openSheet(washer.id)} /> : null;
      case 'lights':
        return lightRoom
          ? <Tile key={id} icon={<Lightbulb size={36} className="tone-amber glow" />} title="Oświetlenie" sub={lightRoom.name} value={lightRoom.lightsOn ? `${lightRoom.lightsOn} włączone` : 'Wyłączone'} valueClass={lightRoom.lightsOn ? 'warm' : 'plain'} onClick={() => go(`/pokoje/${lightRoom.id}`)} /> : null;
      default: return null;
    }
  };

  const empty = home.devices.length === 0;

  return (
    <div className="dash">
      <div className="hero">
        <img src={settings.photos.hero ?? asset('img/hero.webp')} alt="" />
        <header className="dash-head">
          <button className="home-switch" onClick={() => setMenu(true)} aria-haspopup="dialog">
            <IconHome size={24} className="tone-cyan" />
            <span>{settings.homeName}</span>
            <ChevronDown size={16} />
            {!conn && <em className="demo-tag">demo</em>}
          </button>
          <button className="gear" aria-label="Ustawienia" onClick={() => go('/wiecej/ustawienia')}><Gear size={22} /></button>
        </header>
        <div className="hero-cards">
          {outside != null && (
            <div className="glass weather">
              <Weather size={38} className="tone-amber" />
              <span><strong>{fmt(outside, Number.isInteger(outside) ? 0 : 1)}°C</strong><small>Na zewnątrz</small></span>
            </div>
          )}
          <span className="spacer" />
          {active && (
            <div className="glass mode">
              <span className="mode-ico"><IconHome size={20} /></span>
              <span><small>Dom w trybie</small><strong>{MODE_LABEL[active.label]}</strong></span>
            </div>
          )}
        </div>
      </div>

      {quick.length > 0 && (
        <div className="quick" role="group" aria-label="Szybkie sceny">
          {quick.map((q) => {
            const { Icon, tone } = sceneVisual(q.label);
            const isActive = active?.scene.entity_id === q.scene.entity_id;
            return (
              <button key={q.scene.entity_id} className={`q${isActive ? ' active' : ''}${running === q.scene.entity_id ? ' running' : ''}`} aria-pressed={isActive}
                onClick={async () => {
                  setRunning(q.scene.entity_id);
                  await act('scene', 'turn_on', { entity_id: q.scene.entity_id });
                  setRunning(null);
                }}>
                <span className={`q-ball tone-${tone}`}><Icon size={26} /></span>
                <small>{q.label}</small>
              </button>
            );
          })}
        </div>
      )}

      {alerts.length > 0 && (
        <button className={`alert-strip ${alerts.some((a) => a.level === 'danger') ? 'danger' : ''}`} onClick={() => go('/wiecej/powiadomienia')}>
          <TriangleAlert size={18} />
          <span>{alerts[0].title}{alerts.length > 1 ? ` i ${alerts.length - 1} więcej` : ''}</span>
          <ChevronRight size={18} />
        </button>
      )}

      {empty ? (
        <div className="empty card">
          <AlertTriangle size={24} />
          <p>Home Assistant nie zgłosił jeszcze żadnych urządzeń. Dodaj je w HA, a pojawią się tutaj same.</p>
        </div>
      ) : (
        <div className="tiles">
          {settings.tiles.filter((t) => t !== 'energy').map(tile)}
        </div>
      )}

      {!settings.hiddenTiles.includes('energy') && <EnergyTile />}

      {favorites.length > 0 && (
        <section className="favs">
          <h2>Ulubione</h2>
          <div className="tiles">
            {favorites.map((d) => {
              const { Icon, tone } = deviceIcon(d);
              const toggle = d.kind === 'light' || d.kind === 'switch';
              const on = d.id in pending ? pending[d.id] === 'on' : d.entity.state === 'on';
              return (
                <button key={d.id} className="fav card" onClick={() => openSheet(d.id)}>
                  <Icon size={24} className={`tone-${tone}`} />
                  <b>{d.name}</b>
                  {toggle && <Toggle label={d.name} on={on} onChange={(v) => act(d.id.split('.')[0], v ? 'turn_on' : 'turn_off', { entity_id: d.id }, v ? 'on' : 'off')} />}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {menu && <HomeMenu onClose={() => setMenu(false)} />}
    </div>
  );
}
