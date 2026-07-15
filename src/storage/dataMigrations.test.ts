import { describe, expect, it } from 'vitest';
import { normalizeActiveSession, normalizePersistedData } from '@/src/storage/dataMigrations';

const legacySet = { id: 'set-1', type: 'working', weight: 100, reps: 5, rpe: 8 };
const legacyExercise = { id: 'exercise-1', exerciseId: 'squat', name: 'Squat', muscle: 'Piernas', sets: [legacySet] };

describe('data migrations', () => {
  it('convierte una rutina antigua de repeticiones fijas al formato nuevo', () => {
    const data = normalizePersistedData({
      routines: [{ id: 'routine-1', name: 'Rutina antigua', day: 1, exercises: [legacyExercise], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      history: [],
      profile: { bodyWeight: '80', height: '175', goal: 'Fuerza', level: 'Intermedio', defaultRestSeconds: 180 },
    });

    expect(data?.routines[0].effortMode).toBe('rpe');
    expect(data?.routines[0].exercises[0].sets[0]).toMatchObject({ repsMin: 5, repsMax: 5, rpe: 8 });
    expect(data?.tombstones).toEqual([]);
  });

  it('agrega rangos, RIR y notas vacías a una sesión activa antigua', () => {
    const session = normalizeActiveSession({
      id: 'session-1', routineName: 'Rutina antigua', startedAt: 123, exercises: [{ ...legacyExercise, sets: [{ ...legacySet, weight: '100', reps: '5', rpe: '8', completed: false }] }],
    });

    expect(session?.effortMode).toBe('rpe');
    expect(session?.notes).toBe('');
    expect(session?.exercises[0].notes).toBe('');
    expect(session?.exercises[0].sets[0]).toMatchObject({ targetRepsMin: 5, targetRepsMax: 5, rir: '' });
  });

  it('conserva notas y rangos que ya están en el formato nuevo', () => {
    const session = normalizeActiveSession({
      id: 'session-2', routineName: 'RIR', effortMode: 'rir', startedAt: 123, notes: 'Sesión sólida',
      exercises: [{ ...legacyExercise, notes: 'Buena técnica', sets: [{ ...legacySet, weight: '100', reps: '6', targetRepsMin: 5, targetRepsMax: 7, rpe: '', rir: '2', completed: true }] }],
    });

    expect(session?.effortMode).toBe('rir');
    expect(session?.notes).toBe('Sesión sólida');
    expect(session?.exercises[0].notes).toBe('Buena técnica');
    expect(session?.exercises[0].sets[0]).toMatchObject({ targetRepsMin: 5, targetRepsMax: 7, rir: '2' });
  });
});
