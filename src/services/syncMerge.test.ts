import { describe, expect, it } from 'vitest';
import { PersistedData, Routine } from '@/src/domain/types';
import { mergePersistedData, withoutDeletedRoutines } from '@/src/services/syncMerge';

const older = '2026-01-01T00:00:00.000Z';
const newer = '2026-02-01T00:00:00.000Z';

function routine(id: string, updatedAt: string, name = id): Routine {
  return { id, name, day: 1, effortMode: 'rpe', exercises: [], createdAt: older, updatedAt };
}

function data(overrides: Partial<PersistedData> = {}): PersistedData {
  return {
    routines: [],
    history: [],
    profile: { bodyWeight: '80', height: '175', goal: 'Fuerza', level: 'Intermedio', defaultRestSeconds: 180, updatedAt: older },
    tombstones: [],
    ...overrides,
  };
}

describe('mergePersistedData', () => {
  it('trata Supabase como fuente de verdad en un dispositivo nuevo', () => {
    const local = data({ routines: [routine('demo', newer)], profile: { ...data().profile, bodyWeight: '99', updatedAt: newer } });
    const remote = data({ routines: [routine('cloud', older)], profile: { ...data().profile, bodyWeight: '82', updatedAt: older } });
    const result = mergePersistedData(local, remote, false);
    expect(result.routines.map(item => item.id)).toEqual(['cloud']);
    expect(result.profile.bodyWeight).toBe('82');
  });

  it('combina cambios locales reales y remotos sin perder registros', () => {
    const local = data({ routines: [routine('shared', newer, 'Local más reciente'), routine('local-only', newer)] });
    const remote = data({ routines: [routine('shared', older, 'Remoto antiguo'), routine('remote-only', newer)] });
    const result = mergePersistedData(local, remote, true);
    expect(result.routines.map(item => item.id).sort()).toEqual(['local-only', 'remote-only', 'shared']);
    expect(result.routines.find(item => item.id === 'shared')?.name).toBe('Local más reciente');
  });

  it('una eliminación explícita prevalece sobre copias antiguas', () => {
    const tombstone = { entityType: 'routine' as const, recordId: 'deleted', deletedAt: newer };
    const local = data({ tombstones: [tombstone] });
    const remote = data({ routines: [routine('deleted', newer)] });
    const result = mergePersistedData(local, remote, true);
    expect(result.routines).toEqual([]);
    expect(result.tombstones).toEqual([tombstone]);
  });

  it('la lista que se sube excluye rutinas con tombstone', () => {
    const routines = [routine('keep', newer), routine('deleted', newer)];
    const result = withoutDeletedRoutines(routines, [{ entityType: 'routine', recordId: 'deleted', deletedAt: newer }]);
    expect(result.map(item => item.id)).toEqual(['keep']);
  });
});
