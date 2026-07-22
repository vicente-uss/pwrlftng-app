import { describe, expect, it } from 'vitest';
import { bestByRepCount, bestEstimated1RM, bestRpeAtOrAbove, bestSessionVolume, bestSet, heaviestWeight, previousSetPerformance } from '@/src/domain/records';
import { ActiveExercise, WorkoutHistory } from '@/src/domain/types';

function makeExercise(exerciseId: string, sets: Partial<ActiveExercise['sets'][number]>[]): ActiveExercise {
  return {
    id: `ae-${exerciseId}`,
    exerciseId,
    name: exerciseId,
    muscle: 'Piernas',
    notes: '',
    sets: sets.map((set, index) => ({
      id: `set-${index}`,
      type: 'working',
      weight: '0',
      reps: '0',
      targetRepsMin: 0,
      targetRepsMax: 0,
      rpe: '',
      rir: '',
      completed: true,
      ...set,
    })),
  };
}

function makeSession(overrides: Partial<WorkoutHistory>): WorkoutHistory {
  return {
    id: 'session-1',
    routineName: 'Día 1',
    effortMode: 'rpe',
    date: '2026-07-01T00:00:00.000Z',
    durationSeconds: 3600,
    totalVolume: 0,
    setsCompleted: 0,
    notes: '',
    exercises: [],
    ...overrides,
  };
}

const history: WorkoutHistory[] = [
  makeSession({
    id: 'session-1',
    date: '2026-07-01T00:00:00.000Z',
    exercises: [makeExercise('squat', [
      { weight: '100', reps: '5' },
      { weight: '110', reps: '3' },
      { weight: '90', reps: '8', completed: false },
      { weight: '999', reps: '1', type: 'warmup' },
    ])],
  }),
  makeSession({
    id: 'session-2',
    date: '2026-07-08T00:00:00.000Z',
    exercises: [makeExercise('squat', [
      { weight: '105', reps: '5' },
      { weight: '120', reps: '1' },
    ])],
  }),
];

describe('records', () => {
  it('encuentra el peso más pesado entre series de trabajo completadas', () => {
    expect(heaviestWeight(history, 'squat')).toEqual({ weight: 120, reps: 1, date: '2026-07-08T00:00:00.000Z', rpe: null, rir: null });
  });

  it('ignora series de calentamiento y series no completadas', () => {
    expect(heaviestWeight(history, 'squat')?.weight).not.toBe(999);
    expect(heaviestWeight(history, 'squat')?.weight).not.toBe(90);
  });

  it('encuentra la mejor serie por peso x reps', () => {
    expect(bestSet(history, 'squat')).toEqual({ weight: 105, reps: 5, date: '2026-07-08T00:00:00.000Z', rpe: null, rir: null });
  });

  it('encuentra el mejor volumen total en una sola sesión', () => {
    expect(bestSessionVolume(history, 'squat')).toEqual({ volume: 100 * 5 + 110 * 3, date: '2026-07-01T00:00:00.000Z' });
  });

  it('devuelve la mejor marca por cantidad de repeticiones, ordenada', () => {
    expect(bestByRepCount(history, 'squat')).toEqual([
      { reps: 1, weight: 120, date: '2026-07-08T00:00:00.000Z' },
      { reps: 3, weight: 110, date: '2026-07-01T00:00:00.000Z' },
      { reps: 5, weight: 105, date: '2026-07-08T00:00:00.000Z' },
    ]);
  });

  it('permite intercambiar la fórmula de e1RM', () => {
    const doubleFormula = (weight: number) => weight * 2;
    const record = bestEstimated1RM(history, 'squat', doubleFormula);
    expect(record?.estimated1RM).toBe(240);
  });

  it('devuelve null cuando no hay series registradas para el ejercicio', () => {
    expect(heaviestWeight(history, 'bench')).toBeNull();
    expect(bestSet(history, 'bench')).toBeNull();
    expect(bestSessionVolume(history, 'bench')).toBeNull();
    expect(bestByRepCount(history, 'bench')).toEqual([]);
    expect(bestEstimated1RM(history, 'bench')).toBeNull();
  });
});

describe('bestRpeAtOrAbove', () => {
  const historyWithRpe: WorkoutHistory[] = [
    makeSession({
      id: 'session-1',
      date: '2026-07-01T00:00:00.000Z',
      exercises: [makeExercise('squat', [
        { weight: '100', reps: '5', rpe: '8' },
        { weight: '100', reps: '6', rpe: '9' },
        { weight: '90', reps: '5', rpe: '7' },
      ])],
    }),
  ];

  it('devuelve el RPE más bajo entre series que igualan o superan peso y reps', () => {
    expect(bestRpeAtOrAbove(historyWithRpe, 'squat', 100, 5)).toBe(8);
  });

  it('devuelve null si ninguna serie anterior iguala o supera ese peso/reps', () => {
    expect(bestRpeAtOrAbove(historyWithRpe, 'squat', 110, 5)).toBeNull();
  });

  it('devuelve null si el ejercicio nunca se registró', () => {
    expect(bestRpeAtOrAbove(historyWithRpe, 'bench', 50, 5)).toBeNull();
  });
});

describe('previousSetPerformance', () => {
  const recentFirst: WorkoutHistory[] = [
    makeSession({
      id: 'session-2',
      date: '2026-07-08T00:00:00.000Z',
      exercises: [makeExercise('squat', [
        { weight: '105', reps: '5' },
        { weight: '120', reps: '1' },
      ])],
    }),
    makeSession({
      id: 'session-1',
      date: '2026-07-01T00:00:00.000Z',
      exercises: [makeExercise('squat', [
        { weight: '100', reps: '5' },
        { weight: '110', reps: '3' },
      ])],
    }),
  ];

  it('devuelve el set en la misma posición de la sesión más reciente con ese ejercicio', () => {
    expect(previousSetPerformance(recentFirst, 'squat', 0)).toEqual({ weight: '105', reps: '5', rpe: '', rir: '' });
    expect(previousSetPerformance(recentFirst, 'squat', 1)).toEqual({ weight: '120', reps: '1', rpe: '', rir: '' });
  });

  it('devuelve null si el índice no existe en esa sesión o el ejercicio nunca se registró', () => {
    expect(previousSetPerformance(recentFirst, 'squat', 5)).toBeNull();
    expect(previousSetPerformance(recentFirst, 'bench', 0)).toBeNull();
  });
});
