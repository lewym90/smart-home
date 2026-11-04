import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Bell, BellRing, Eye, EyeOff, Info, LayoutGrid, Link2, Palette, Shield, ShieldAlert, ShieldCheck, Users, Zap, Download, Upload } from 'lucide-react';
import { TILES, useApp, shrinkPhoto, type Settings, type TileId } from '../store';
import { binaryLabel, fmt, timeAgo } from '../ha/model';
import type { EnergySummary, Me } from '../ha/types';
import { isMixedContent, normalizeUrl } from '../ha/hass';
import { PageHead, Row, Toggle, go } from '../components/Ui';
import { disablePush, enablePush, isSubscribed, parsePairing, pushProblem, sendTest, type PushConfig } from '../push';
import { DeviceRow } from './Rooms';

export function More() {
  const { unread, conn, status, alerts } = useApp();
  const secure = alerts.filter((a) => a.level === 'danger').length;
  return (
    <div className="page">
      <PageHead title="Więcej" />
      <div className="list">
        <Row icon={<Bell size={24} />} tone="tone-cyan" title="Powiadomienia" sub={unread ? `Nowe: ${unread}` : 'Brak nowych'} onClick={() => go('/wiecej/powiadomienia')} />
        <Row icon={secure ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />} tone={secure ? 'tone-heat' : 'tone-green'} title="Bezpieczeństwo" sub={secure ? 'Wymaga uwagi' : 'Wszystko w porządku'} onClick={() => go('/wiecej/bezpieczenstwo')} />
        <Row icon={<Zap size={24} />} tone="tone-amber" title="Energia" sub="Zużycie i porównanie z wczoraj" onClick={() => go('/wiecej/energia')} />
        <Row icon={<Users size={24} />} tone="tone-teal" title="Domownicy" sub="Kto jest w domu" onClick={() => go('/wiecej/domownicy')} />
        <Row icon={<Palette size={24} />} tone="tone-white" title="Ustawienia" sub="Wygląd, pulpit, kopia ustawień" onClick={() => go('/wiecej/ustawienia')} />
        <Row icon={<Link2 size={24} />} tone="tone-white" title="Połączenie" sub={conn ? (status === 'online' ? 'Połączono z Home Assistant' : 'Brak połączenia') : 'Tryb demo'} onClick={() => go('/wiecej/polaczenie')} />
      </div>
    </div>
  );
}

const readPush = (): PushConfig | null => { try { return JSON.parse(localStorage.getItem('sh.push') ?? 'null'); } catch { return null; } };

function PushCard() {
  const { toast } = useApp();
  const [cfg, setCfg] = useState<PushConfig | null>(readPush);
  const [code, setCode] = useState('');
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const problem = pushProblem();
  useEffect(() => { isSubscribed().then(setOn).catch(() => {}); }, []);
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await f(); } catch (e: any) { setError(e?.message ?? 'Nie udało się.'); }
    setBusy(false);
  };
  const enable = () => run(async () => {
    const c = cfg ?? parsePairing(code);
    if (!c) throw new Error('To nie jest poprawny kod. Powinien zaczynać się od https:// i zawierać znak #.');
    await enablePush(c);
    try { localStorage.setItem('sh.push', JSON.stringify(c)); } catch { /* */ }
    setCfg(c); setOn(true); toast('Powiadomienia włączone.');
  });
  return (
    <section className="group">
      <h2>Na telefonie</h2>
      {problem ? <p className="notice warn">{problem}</p> : (
        <div className="card push-card">
          <div className="push-row">
            <span className="row-text"><b>Powiadomienia push</b><small>{on ? 'Włączone' : 'Wyłączone'}</small></span>
            <Toggle label="Powiadomienia push" on={on} pending={busy} disabled={busy || (!cfg && !code.trim())} onChange={(v) => v ? enable() : run(async () => { if (cfg) await disablePush(cfg); setOn(false); })} />
          </div>
          {!cfg && <label className="field"><span>Kod z serwera</span><input className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} /></label>}
          {on && cfg && <button className="btn wide" disabled={busy} onClick={() => run(async () => { const r = await sendTest(cfg); toast(r.sent ? 'Wysłano próbne powiadomienie.' : 'Serwer nie ma zapisanego telefonu.'); })}>Wyślij próbne powiadomienie</button>}
        </div>
      )}
      {error && <p className="notice warn" role="alert">{error}</p>}
    </section>
  );
}

export function Notifications() {
  const { alerts, log, markRead, clearLog, openSheet } = useApp();
  useEffect(() => { markRead(); }, [markRead, log.length]);
  return (
    <div className="page">
      <PageHead title="Powiadomienia" back />
      <PushCard />
      {alerts.length > 0 && (
        <section className="group"><h2>Teraz</h2><div className="list">
          {alerts.map((a) => <Row key={a.id} icon={<BellRing size={22} />} tone={a.level === 'danger' ? 'tone-heat' : 'tone-amber'} title={a.title} onClick={a.deviceId ? () => openSheet(a.deviceId!) : undefined} />)}
        </div></section>
      )}
      <section className="group">
        <h2>Historia</h2>
        <div className="list">
          {log.map((l) => <Row key={l.id} icon={<Bell size={22} />} tone={l.level === 'danger' ? 'tone-heat' : l.level === 'warn' ? 'tone-amber' : 'tone-cyan'} title={l.title} sub={timeAgo(new Date(l.at).toISOString())} />)}
          {!log.length && <p className="muted">Nowe zdarzenia pojawią się tutaj, np. koniec prania czy wykryte zalanie.</p>}
        </div>
        {log.length > 0 && <button className="link-btn" onClick={clearLog}>Wyczyść historię</button>}
      </section>
    </div>
  );
}

export function Security() {
  const { home, alerts } = useApp();
  const dc = (...c: string[]) => home.devices.filter((d) => d.kind === 'binary' && c.includes(d.entity.attributes.device_class));
  const openings = dc('door', 'window', 'opening', 'garage_door');
  const open = openings.filter((d) => d.entity.state === 'on');
  const unlocked = home.devices.filter((d) => d.kind === 'lock' && d.entity.state !== 'locked');
  const danger = alerts.filter((a) => a.level === 'danger');
  const ok = !danger.length && !open.length && !unlocked.length;
  const summary = danger[0]?.title ?? (ok ? 'Drzwi i okna zamknięte, brak alarmów' : [open.length ? `Otwarte: ${open.map((o) => o.name).join(', ')}` : '', unlocked.length ? 'Zamek otwarty' : ''].filter(Boolean).join('. '));
  const groups: [string, typeof openings][] = [
    ['Zamki', home.devices.filter((d) => d.kind === 'lock')], ['Drzwi i okna', openings], ['Ruch', dc('motion', 'occupancy', 'presence')],
    ['Dym i gaz', dc('smoke', 'gas', 'carbon_monoxide')], ['Zalanie', dc('moisture')], ['Kamery', home.devices.filter((d) => d.kind === 'camera')],
  ];
  return (
    <div className="page">
      <PageHead title="Bezpieczeństwo" back />
      <div className={`status-hero card ${ok ? 'ok' : 'bad'}`}>
        {ok ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
        <span><b>{ok ? 'Dom bezpieczny' : 'Sprawdź dom'}</b><small>{summary}</small></span>
      </div>
      {groups.filter(([, l]) => l.length).map(([t, l]) => (
        <section className="group" key={t}><h2>{t}</h2><div className="list">{l.map((d) => <DeviceRow key={d.id} d={d} sub={d.kind === 'binary' ? binaryLabel(d.entity) : undefined} />)}</div></section>
      ))}
    </div>
  );
}

export function Energy() {
  const { provider, home, status } = useApp();
  const [e, setE] = useState<EnergySummary | null | undefined>(undefined);
  useEffect(() => {
    if (!home.energyEntity || status !== 'online') { setE(null); return; }
    provider.energy(home.energyEntity).then(setE).catch(() => setE(null));
  }, [provider, home.energyEntity, status]);
  const max = e ? Math.max(...e.bars, 0.01) : 1;
  return (
    <div className="page">
      <PageHead title="Energia" back />
      {e === null && <p className="muted">Brak danych o energii. Dodaj licznik energii do Home Assistanta, a zużycie pojawi się tutaj.</p>}
      {e && (
        <>
          <div className="card energy-big">
            <small>Dziś</small>
            <strong>{fmt(e.todayKwh)} <i>kWh</i></strong>
            {e.deltaPct !== null && <span className={e.deltaPct <= 0 ? 'good' : 'bad'}>{e.deltaPct <= 0 ? 'Mniej' : 'Więcej'} niż wczoraj o tej porze o {Math.abs(e.deltaPct)}%</span>}
          </div>
          <div className="card">
            <p className="field-label">Ostatnie godziny</p>
            <div className="bars big" role="img" aria-label="Zużycie energii w ostatnich godzinach">{e.bars.map((b, i) => <i key={i} style={{ height: `${Math.max(6, (b / max) * 100)}%` }} />)}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function People() {
  const { home, provider, status } = useApp();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { if (status === 'online') provider.me().then(setMe).catch(() => {}); }, [provider, status]);
  return (
    <div className="page">
      <PageHead title="Domownicy" back />
      {me && <Row icon={<Shield size={22} />} tone="tone-cyan" title={me.name} sub={me.isAdmin ? 'Administrator' : 'Domownik'} />}
      <section className="group"><h2>Kto jest w domu</h2><div className="list">
        {home.persons.map((p) => <Row key={p.entity_id} icon={<span className="avatar">{(p.attributes.friendly_name ?? '?').charAt(0)}</span>} title={p.attributes.friendly_name} sub={p.state === 'home' ? 'W domu' : p.state === 'not_home' ? 'Poza domem' : p.state === 'unknown' ? 'Nieznane' : p.state} />)}
        {!home.persons.length && <p className="muted">Dodaj osoby w Home Assistant, a zobaczysz tutaj, kto jest w domu.</p>}
      </div></section>
      <p className="muted small">Konta, hasła i uwierzytelnianie dwuskładnikowe ustawiasz w Home Assistant. Każdy domownik łączy się własnym tokenem.</p>
    </div>
  );
}

const TILE_NAMES: Record<TileId, string> = { temperature: 'Temperatura', climate: 'Klimatyzacja', washer: 'Pralka', lights: 'Oświetlenie', energy: 'Zużycie energii' };

export function SettingsScreen() {
  const { settings, setSettings, toast, home } = useApp();
  const importRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const move = (i: number, d: number) => {
    const t = [...settings.tiles];
    [t[i], t[i + d]] = [t[i + d], t[i]];
    setSettings({ tiles: t });
  };
  const hide = (t: TileId) => setSettings({ hiddenTiles: settings.hiddenTiles.includes(t) ? settings.hiddenTiles.filter((x) => x !== t) : [...settings.hiddenTiles, t] });
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'smart-home-ustawienia.json'; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="page">
      <PageHead title="Ustawienia" back />
      <section className="group">
        <h2>Wygląd</h2>
        <div className="chips" role="radiogroup" aria-label="Motyw">
          {([['dark', 'Ciemny'], ['light', 'Jasny'], ['system', 'Jak w telefonie']] as const).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={settings.theme === k} className={settings.theme === k ? 'chip on' : 'chip'} onClick={() => setSettings({ theme: k })}>{l}</button>
          ))}
        </div>
      </section>
      <section className="group">
        <h2>Dom</h2>
        <label className="field"><span>Nazwa domu</span><input className="input" value={settings.homeName} onChange={(e) => setSettings({ homeName: e.target.value })} onBlur={(e) => !e.target.value.trim() && setSettings({ homeName: 'Mój Dom' })} /></label>
        <label className="field"><span>Główny pokój na pulpicie</span>
          <select className="input" value={settings.primaryRoom ?? ''} onChange={(e) => setSettings({ primaryRoom: e.target.value || null })}>
            <option value="">Wybierz automatycznie</option>
            {home.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <button className="btn wide" onClick={() => heroRef.current?.click()}>Zmień zdjęcie domu</button>
        <input ref={heroRef} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) try { setSettings({ photos: { ...settings.photos, hero: await shrinkPhoto(f, 1170) } }); toast('Zdjęcie domu zmienione.'); } catch (err: any) { toast(err.message); }
        }} />
      </section>
      <section className="group">
        <h2><LayoutGrid size={16} /> Kafelki na pulpicie</h2>
        <div className="list">
          {settings.tiles.map((t, i) => {
            const hidden = settings.hiddenTiles.includes(t);
            return (
              <div key={t} className={`row card${hidden ? ' faded' : ''}`}>
                <span className="row-text"><b>{TILE_NAMES[t]}</b></span>
                <button className="icon-btn" aria-label={`${TILE_NAMES[t]}: wyżej`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={18} /></button>
                <button className="icon-btn" aria-label={`${TILE_NAMES[t]}: niżej`} disabled={i === TILES.length - 1} onClick={() => move(i, 1)}><ArrowDown size={18} /></button>
                <button className="icon-btn" aria-label={`${TILE_NAMES[t]}: ${hidden ? 'pokaż' : 'ukryj'}`} onClick={() => hide(t)}>{hidden ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="group">
        <h2>Kopia ustawień</h2>
        <div className="btn-row">
          <button className="btn" onClick={exportFile}><Download size={18} /> Zapisz</button>
          <button className="btn" onClick={() => importRef.current?.click()}><Upload size={18} /> Wczytaj</button>
        </div>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const data = JSON.parse(await f.text()) as Partial<Settings>;
            if (!Array.isArray(data.tiles)) throw new Error();
            setSettings(data);
            toast('Ustawienia wczytane.');
          } catch { toast('Ten plik nie jest kopią ustawień Smart Home.'); }
        }} />
      </section>
      <p className="muted small about"><Info size={14} /> Smart Home {__VERSION__}. Bez reklam i abonamentu. Twoje dane zostają w domu.</p>
    </div>
  );
}

export function Connection() {
  const { conn, connect, status, statusMsg, provider } = useApp();
  const [url, setUrl] = useState(conn?.url ?? '');
  const [token, setToken] = useState(conn?.token ?? '');
  const clean = normalizeUrl(url);
  const mixed = !!clean && isMixedContent(clean);
  return (
    <div className="page form">
      <PageHead title="Połączenie" back />
      <div className={`status-hero card ${provider.kind === 'hass' && status === 'online' ? 'ok' : ''}`}>
        <Link2 size={32} />
        <span>
          <b>{provider.kind === 'demo' ? 'Tryb demo' : status === 'online' ? 'Połączono' : status === 'connecting' ? 'Łączę się…' : 'Brak połączenia'}</b>
          <small>{provider.kind === 'demo' ? 'Aplikacja pokazuje przykładowy dom.' : statusMsg ?? conn?.url}</small>
        </span>
      </div>
      <label className="field"><span>Adres Home Assistanta</span>
        <input className="input" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://dom.example.ts.net" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="field"><span>Token dostępu</span>
        <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></label>
      <p className="muted small">Token utworzysz w Home Assistant: Profil, Bezpieczeństwo, Tokeny długoterminowe. Zostaje tylko na tym urządzeniu.</p>
      {mixed && <p className="notice warn" role="alert">Ta aplikacja działa przez https, więc adres domu też musi zaczynać się od https. Przeglądarka zablokuje połączenie po http.</p>}
      <button className="cta" disabled={!clean || !token.trim() || mixed} onClick={() => connect({ url: clean, token: token.trim() })}>Połącz</button>
      {conn && <button className="link-btn" onClick={() => { setToken(''); setUrl(''); connect(null); }}>Odłącz i wróć do trybu demo</button>}
    </div>
  );
}
