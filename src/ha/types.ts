/** Wspólny model danych. Tryb demo i Home Assistant mówią tym samym językiem. */
export interface Entity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface Area { id: string; name: string; picture?: string | null }

export interface RegistryEntry {
  areaId?: string | null;
  deviceId?: string | null;
  hidden?: boolean;
  /** diagnostic / config — nie pokazujemy jako urządzenia */
  category?: string | null;
  name?: string | null;
}

export interface Snapshot {
  entities: Record<string, Entity>;
  areas: Area[];
  registry: Record<string, RegistryEntry>;
  devices: Record<string, { name: string; areaId?: string | null }>;
  /** opisy automatyzacji, jeśli są dostępne */
  descriptions: Record<string, string>;
  at: number;
}

export type ConnStatus = 'connecting' | 'online' | 'offline' | 'error';

export interface Point { t: number; v: number }

export interface EnergySummary {
  todayKwh: number;
  /** różnica procentowa względem wczoraj o tej samej porze */
  deltaPct: number | null;
  bars: number[];
}

export interface AutomationConfig {
  alias: string;
  description: string;
  triggers: Record<string, any>[];
  conditions: Record<string, any>[];
  actions: Record<string, any>[];
  mode: 'single';
}

export interface SceneConfig { name: string; entities: Record<string, Record<string, any>> }

export interface Me { name: string; isAdmin: boolean }

export interface Provider {
  kind: 'demo' | 'hass';
  start(onSnapshot: (s: Snapshot) => void, onStatus: (s: ConnStatus, msg?: string) => void): Promise<void>;
  stop(): void;
  call(domain: string, service: string, data?: Record<string, any>): Promise<void>;
  history(entityId: string, hours: number): Promise<Point[]>;
  energy(entityId: string): Promise<EnergySummary | null>;
  saveAutomation(cfg: AutomationConfig): Promise<void>;
  saveScene(cfg: SceneConfig): Promise<void>;
  me(): Promise<Me | null>;
  /** adres obrazu z kamery albo zdjęcia */
  mediaUrl(path: string): string;
}
