import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistedData } from '@/src/domain/types';
import { pullDataFromCloud, resetCloudSyncGuard, syncDataToCloud } from '@/src/services/cloudSync';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), writes: [] as { table: string; value: unknown }[] }));

vi.mock('@/src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from },
}));

const localData: PersistedData = {
  routines: [],
  history: [],
  profile: { displayName: '', bodyWeight: '', height: '', goal: 'Fuerza', level: 'Inicial', defaultRestSeconds: 180, updatedAt: '2026-01-01T00:00:00.000Z' },
  tombstones: [],
};

describe('syncDataToCloud', () => {
  beforeEach(() => { resetCloudSyncGuard(); mocks.from.mockReset(); mocks.getSession.mockReset(); mocks.writes.length = 0; });

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

  it('sincroniza modo de esfuerzo, rangos, RIR y notas', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => {
          const response = { data: table === 'profiles' ? null : [], error: null };
          const terminal = Promise.resolve(response);
          return Object.assign(terminal, { maybeSingle: () => terminal, order: () => terminal });
        },
      }),
      upsert: (value: unknown) => {
        mocks.writes.push({ table, value });
        return Promise.resolve({ error: null });
      },
    }));

    const richData: PersistedData = {
      ...localData,
      routines: [{
        id: 'routine-1', name: 'Rango', day: 1, effortMode: 'both', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        exercises: [{ id: 'routine-exercise-1', exerciseId: 'squat', name: 'Squat', muscle: 'Piernas', sets: [{ id: 'routine-set-1', type: 'working', weight: 100, repsMin: 5, repsMax: 7, rpe: 8, rir: 2 }] }],
      }],
      history: [{
        id: 'workout-1', routineName: 'Rango', effortMode: 'both', date: '2026-01-02T00:00:00.000Z', durationSeconds: 600, totalVolume: 600, setsCompleted: 1, notes: 'Buena sesión',
        exercises: [{ id: 'workout-exercise-1', exerciseId: 'squat', name: 'Squat', muscle: 'Piernas', notes: 'Profundidad sólida', sets: [{ id: 'workout-set-1', type: 'working', weight: '100', reps: '6', targetRepsMin: 5, targetRepsMax: 7, rpe: '8', rir: '2', completed: true }] }],
      }],
    };

    await expect(pullDataFromCloud(richData, { includeLocalData: true })).resolves.toMatchObject({ status: 'pulled' });
    await expect(syncDataToCloud(richData)).resolves.toBe('synced');

    const routine = (mocks.writes.find(write => write.table === 'routines')?.value as Record<string, unknown>[])[0];
    const routineSet = (mocks.writes.find(write => write.table === 'routine_sets')?.value as Record<string, unknown>[])[0];
    const workout = (mocks.writes.find(write => write.table === 'workouts')?.value as Record<string, unknown>[])[0];
    const workoutExercise = (mocks.writes.find(write => write.table === 'workout_exercises')?.value as Record<string, unknown>[])[0];
    const workoutSet = (mocks.writes.find(write => write.table === 'workout_sets')?.value as Record<string, unknown>[])[0];
    expect(routine.effort_mode).toBe('both');
    expect(routineSet).toMatchObject({ reps: 5, reps_min: 5, reps_max: 7, rpe: 8, rir: 2 });
    expect(workout).toMatchObject({ effort_mode: 'both', notes: 'Buena sesión' });
    expect(workoutExercise.notes).toBe('Profundidad sólida');
    expect(workoutSet).toMatchObject({ target_reps_min: 5, target_reps_max: 7, rpe: 8, rir: 2 });
  });
});
