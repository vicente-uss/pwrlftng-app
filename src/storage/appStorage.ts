import Storage from 'expo-sqlite/kv-store';
import { ActiveSession, DeletionTombstone, PersistedData, Profile, Routine, WorkoutHistory } from '@/src/domain/types';

const DATA_KEY = 'pwrlftng.data.v1';
const ACTIVE_KEY = 'pwrlftng.active-session.v1';

type LegacyData = { routines?: Routine[]; history?: WorkoutHistory[]; profile?: Partial<Profile>; tombstones?: DeletionTombstone[] };

export function normalizePersistedData(value: unknown): PersistedData | null {
  if (!value || typeof value !== 'object') return null;
  const legacy = value as LegacyData;
  if (!Array.isArray(legacy.routines) || !Array.isArray(legacy.history) || !legacy.profile) return null;
  const migratedAt = new Date().toISOString();
  return {
    routines: legacy.routines,
    history: legacy.history,
    profile: {
      bodyWeight: typeof legacy.profile.bodyWeight === 'string' ? legacy.profile.bodyWeight : '',
      height: typeof legacy.profile.height === 'string' ? legacy.profile.height : '',
      goal: typeof legacy.profile.goal === 'string' ? legacy.profile.goal : 'Fuerza máxima',
      level: typeof legacy.profile.level === 'string' ? legacy.profile.level : 'Intermedio',
      defaultRestSeconds: typeof legacy.profile.defaultRestSeconds === 'number' ? legacy.profile.defaultRestSeconds : 180,
      updatedAt: typeof legacy.profile.updatedAt === 'string' ? legacy.profile.updatedAt : migratedAt,
    },
    tombstones: Array.isArray(legacy.tombstones) ? legacy.tombstones : [],
  };
}

export async function loadData(): Promise<PersistedData | null> {
  const raw = await Storage.getItem(DATA_KEY);
  if (!raw) return null;
  try { return normalizePersistedData(JSON.parse(raw)); } catch { return null; }
}
export async function saveData(data: PersistedData) { await Storage.setItem(DATA_KEY, JSON.stringify(data)); }
export async function loadActiveSession(): Promise<ActiveSession | null> { const raw = await Storage.getItem(ACTIVE_KEY); return raw ? JSON.parse(raw) : null; }
export async function saveActiveSession(session: ActiveSession | null) { if (session) await Storage.setItem(ACTIVE_KEY, JSON.stringify(session)); else await Storage.removeItem(ACTIVE_KEY); }
