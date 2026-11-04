import { useEffect, useState, type ReactNode } from 'react';
import {
  Armchair, Bath, BedDouble, ChevronLeft, ChevronRight, Clapperboard, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Coffee, DoorOpen, Droplets,
  Fan, Flame, Home as HomeIcon, Leaf, Lightbulb, Lock, LogOut, Monitor, Moon, Plane, Plug, Blinds, Play, Search, Shield, Snowflake, Sofa, Sparkles, Sun, Sunrise,
  Thermometer, Users, Utensils, Video, Wind, createLucideIcon, X, Zap, Activity, AppWindow, Cpu,
  type LucideIcon,
} from 'lucide-react';
import type { Device } from '../ha/model';

export const IconHome = HomeIcon;
export const Washer = createLucideIcon('Washer', [
  ['rect', { x: '3', y: '2.5', width: '18', height: '19', rx: '2.5', key: 'a' }],
  ['circle', { cx: '12', cy: '13.5', r: '4.5', key: 'b' }],
  ['path', { d: 'M3 7h18', key: 'c' }],
  ['path', { d: 'M6.5 4.8h1M17 4.8h.5', key: 'd' }],
]);
const Heat = createLucideIcon('Heat', [
  ['path', { d: 'M6 3c-2 3 2 6 0 9s2 6 0 9', key: 'a' }],
  ['path', { d: 'M12 3c-2 3 2 6 0 9s2 6 0 9', key: 'b' }],
  ['path', { d: 'M18 3c-2 3 2 6 0 9s2 6 0 9', key: 'c' }],
]);

export function go(path: string) { location.hash = path; }
export function useRoute() {
  const [r, set] = useState(() => location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const f = () => { set(location.hash.replace(/^#/, '') || '/'); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function Toggle({ on, onChange, label, pending, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; pending?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`toggle${on ? ' on' : ''}${pending ? ' pending' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    ><span /></button>
  );
}

export function PageHead({ title, back, action }: { title: string; back?: boolean; action?: ReactNode }) {
  return (
    <header className="page-head">
      {back && <button className="icon-btn" aria-label="Wróć" onClick={() => history.back()}><ChevronLeft size={22} /></button>}
      <h1>{title}</h1>
      {action}
    </header>
  );
}

export function Row({ icon, title, sub, onClick, right, tone }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; onClick?: () => void; right?: ReactNode; tone?: string }) {
  const body = (
    <>
      {icon && <span className={`row-icon ${tone ?? ''}`}>{icon}</span>}
      <span className="row-text"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right ?? (onClick && <ChevronRight size={18} className="chev" />)}
    </>
  );
  return onClick
    ? <button className="row card" onClick={onClick}>{body}</button>
    : <div className="row card">{body}</div>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', f);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', f); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Zamknij" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}

export const roomIcon = (name: string): LucideIcon => {
  const n = name.toLowerCase();
  if (/salon|living/.test(n)) return Sofa;
  if (/sypial|bed/.test(n)) return BedDouble;
  if (/kuch|kitchen/.test(n)) return Utensils;
  if (/łazien|lazien|bath/.test(n)) return Bath;
  if (/pral|laundry/.test(n)) return Washer;
  if (/biur|office/.test(n)) return Monitor;
  return HomeIcon;
};

export const sceneVisual = (name: string): { Icon: LucideIcon; tone: string } => {
  const n = name.toLowerCase();
  if (/w domu|^dom/.test(n)) return { Icon: HomeIcon, tone: 'blue' };
  if (/wychodz|poza/.test(n)) return { Icon: LogOut, tone: 'teal' };
  if (/noc/.test(n)) return { Icon: Moon, tone: 'moon' };
  if (/urlop|wakacj/.test(n)) return { Icon: Plane, tone: 'white' };
  if (/relaks/.test(n)) return { Icon: Armchair, tone: 'amber' };
  if (/kino|film/.test(n)) return { Icon: Clapperboard, tone: 'white' };
  if (/sprzątan/.test(n)) return { Icon: Sparkles, tone: 'cyan' };
  if (/gości|goście/.test(n)) return { Icon: Users, tone: 'teal' };
  if (/pobudka|rano/.test(n)) return { Icon: Sunrise, tone: 'amber' };
  if (/oszczęd|energi/.test(n)) return { Icon: Leaf, tone: 'green' };
  return { Icon: Play, tone: 'blue' };
};

export const autoVisual = (name: string): { Icon: LucideIcon; tone: string } => {
  const n = name.toLowerCase();
  if (/klima|upał|chłod/.test(n)) return { Icon: Snowflake, tone: 'cyan' };
  if (/ogrzew|grzan|ciepł/.test(n)) return { Icon: Heat, tone: 'heat' };
  if (/świat|lamp/.test(n)) return { Icon: Lightbulb, tone: 'amber' };
  if (/noc/.test(n)) return { Icon: Moon, tone: 'moon' };
  if (/pran|pralk/.test(n)) return { Icon: Washer, tone: 'white' };
  return { Icon: Zap, tone: 'cyan' };
};

export function deviceIcon(d: Device): { Icon: LucideIcon; tone: string } {
  const dc = d.entity.attributes.device_class;
  switch (d.kind) {
    case 'climate': return { Icon: Snowflake, tone: 'cyan' };
    case 'light': return { Icon: Lightbulb, tone: 'amber' };
    case 'switch': return { Icon: /kaw|ekspres|coffee/i.test(d.name) ? Coffee : dc === 'outlet' ? Plug : Fan, tone: 'white' };
    case 'fan': return { Icon: Fan, tone: 'cyan' };
    case 'cover': return { Icon: Blinds, tone: 'white' };
    case 'lock': return { Icon: Lock, tone: 'teal' };
    case 'camera': return { Icon: Video, tone: 'white' };
    case 'vacuum': return { Icon: Cpu, tone: 'white' };
    case 'media': return { Icon: AppWindow, tone: 'white' };
    case 'humidifier': return { Icon: Droplets, tone: 'cyan' };
    case 'washer': return { Icon: Washer, tone: 'white' };
    case 'sensor':
      if (dc === 'humidity') return { Icon: Droplets, tone: 'cyan' };
      if (dc === 'temperature') return { Icon: Thermometer, tone: 'heat' };
      if (dc === 'illuminance') return { Icon: Sun, tone: 'amber' };
      return { Icon: Wind, tone: 'teal' };
    case 'binary':
      if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide') return { Icon: Flame, tone: 'heat' };
      if (dc === 'moisture') return { Icon: Droplets, tone: 'cyan' };
      if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') return { Icon: Activity, tone: 'teal' };
      return { Icon: DoorOpen, tone: 'white' };
    default: return { Icon: Shield, tone: 'white' };
  }
}

export function weatherIcon(state?: string): LucideIcon {
  switch (state) {
    case 'sunny': return Sun;
    case 'clear-night': return Moon;
    case 'cloudy': return Cloud;
    case 'rainy': case 'pouring': return CloudRain;
    case 'snowy': case 'snowy-rainy': return CloudSnow;
    case 'fog': return CloudFog;
    case 'lightning': case 'lightning-rainy': return CloudLightning;
    default: return CloudSun;
  }
}

export { Search };
