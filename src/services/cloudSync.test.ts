import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistedData } from '@/src/domain/types';
import { resetCloudSyncGuard, syncDataToCloud } from '@/src/services/cloudSync';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from },
}));

const localData: PersistedData = {
  routines: [],
  history: [],
  profile: { bodyWeight: '', height: '', goal: 'Fuerza', level: 'Inicial', defaultRestSeconds: 180, updatedAt: '2026-01-01T00:00:00.000Z' },
  tombstones: [],
};

describe('syncDataToCloud', () => {
  beforeEach(() => { resetCloudSyncGuard(); mocks.from.mockReset(); mocks.getSession.mockReset(); });

  it('bloquea toda escritura si antes no hubo una descarga exitosa', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    await expect(syncDataToCloud(localData)).resolves.toBe('pull-required');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('no intenta escribir si no existe una sesión', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(syncDataToCloud(localData)).resolves.toBe('no-session');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
