import Storage from 'expo-sqlite/kv-store';
import { ActiveSession, PersistedData } from '@/src/domain/types';

const DATA_KEY = 'pwrlftng.data.v1';
const ACTIVE_KEY = 'pwrlftng.active-session.v1';

export async function loadData(): Promise<PersistedData | null> { const raw = await Storage.getItem(DATA_KEY); return raw ? JSON.parse(raw) : null; }
export async function saveData(data: PersistedData) { await Storage.setItem(DATA_KEY, JSON.stringify(data)); }
export async function loadActiveSession(): Promise<ActiveSession | null> { const raw = await Storage.getItem(ACTIVE_KEY); return raw ? JSON.parse(raw) : null; }
export async function saveActiveSession(session: ActiveSession | null) { if (session) await Storage.setItem(ACTIVE_KEY, JSON.stringify(session)); else await Storage.removeItem(ACTIVE_KEY); }
