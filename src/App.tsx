import { Grid2x2, Home, MoreHorizontal, Play, WifiOff, Zap } from 'lucide-react';
import { useApp } from './store';
import { go, useRoute } from './components/Ui';
import { DeviceSheet } from './components/DeviceSheet';
import { Dashboard } from './screens/Dashboard';
import { RoomDetail, Rooms } from './screens/Rooms';
import { Automations, NewAutomation, NewScene, Scenes } from './screens/Automations';
import { Connection, Energy, More, Notifications, People, Security, SettingsScreen } from './screens/More';

const TABS = [
  { path: '/', match: /^\/$/, label: 'Pulpit', Icon: Home },
  { path: '/pokoje', match: /^\/pokoje/, label: 'Pokoje', Icon: Grid2x2 },
  { path: '/sceny', match: /^\/sceny/, label: 'Sceny', Icon: Play },
  { path: '/automatyzacje', match: /^\/automatyzacje/, label: 'Automatyzacje', Icon: Zap },
  { path: '/wiecej', match: /^\/wiecej/, label: 'Więcej', Icon: MoreHorizontal },
];

function Screen({ route }: { route: string }) {
  const [, a, b] = route.split('/');
  if (a === 'pokoje') return b ? <RoomDetail id={decodeURIComponent(b)} /> : <Rooms />;
  if (a === 'sceny') return b === 'nowa' ? <NewScene /> : <Scenes />;
  if (a === 'automatyzacje') return b === 'nowa' ? <NewAutomation /> : <Automations />;
  if (a === 'wiecej') {
    switch (b) {
      case 'powiadomienia': return <Notifications />;
      case 'bezpieczenstwo': return <Security />;
      case 'energia': return <Energy />;
      case 'domownicy': return <People />;
      case 'ustawienia': return <SettingsScreen />;
      case 'polaczenie': return <Connection />;
      default: return <More />;
    }
  }
  return <Dashboard />;
}

function StatusBanner() {
  const { status, conn, snap, stale, statusMsg } = useApp();
  if (!conn || status === 'online') return null;
  const time = snap.at ? new Date(snap.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <button className="conn-banner" onClick={() => go('/wiecej/polaczenie')}>
      <WifiOff size={16} />
      <span>{status === 'error' && statusMsg ? statusMsg : `${status === 'connecting' ? 'Łączę się z domem.' : 'Brak połączenia z domem.'}${stale && time ? ` Dane z ${time}.` : ''}`}</span>
    </button>
  );
}

export function App() {
  const route = useRoute();
  const { home, sheet, openSheet, toastMsg, unread } = useApp();
  const device = sheet ? home.byEntity[sheet] : null;
  return (
    <div className="app">
      <StatusBanner />
      <nav className="tabbar" aria-label="Główna nawigacja">
        <img className="rail-logo" src="icons/icon-192.png" alt="Smart Home" />
        {TABS.map(({ path, match, label, Icon }) => {
          const active = match.test(route);
          return (
            <a key={path} href={`#${path}`} className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined}>
              <span className="tab-ico">
                <Icon size={24} fill={active && path !== '/wiecej' && path !== '/pokoje' ? 'currentColor' : 'none'} strokeWidth={path === '/wiecej' ? 3 : 1.8} />
                {path === '/wiecej' && unread > 0 && <i className="badge">{unread}</i>}
              </span>
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
      <main><Screen route={route} /></main>
      {device && <DeviceSheet device={device} onClose={() => openSheet(null)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
