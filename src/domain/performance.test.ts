import { describe, expect, it } from 'vitest';
import { aggregateMicrocycles, buildSessionExposures, classifyPerformanceTrend, normalizeFamilyPerformance, SessionExposure } from '@/src/domain/performance';
import { WorkoutHistory } from '@/src/domain/types';

function session(id: string, week: string, exerciseId: string, sets: { weight: string; reps: string; rpe: string; rir?: string; type?: 'working' | 'warmup'; completed?: boolean }[]): WorkoutHistory {
  return {
    id,
    blockId: 'meso-1',
    blockWeekId: week,
    routineName: 'Día 1',
    effortMode: 'both',
    date: `2026-07-${id.slice(-2)}T12:00:00.000Z`,
    durationSeconds: 3600,
    totalVolume: 0,
    setsCompleted: sets.length,
    notes: '',
    exercises: [{
      id: `we-${id}`,
      exerciseId,
      name: exerciseId,
      muscle: 'SBD',
      notes: '',
      sets: sets.map((set, index) => ({
        id: `${id}-${index}`,
        type: set.type ?? 'working',
        weight: set.weight,
        reps: set.reps,
        targetRepsMin: 1,
        targetRepsMax: 1,
        rpe: set.rpe,
        rir: set.rir ?? '',
        completed: set.completed ?? true,
      })),
    }],
  };
}

const weeks = [1, 2, 3].map(order => ({ id: `w${order}`, name: `Semana ${order}`, order, mesocycleId: 'meso-1', mesocycleName: 'Meso I' }));
const exercises = [
  { id: 'squat', name: 'Sentadilla', movementFamily: 'squat' as const },
  { id: 'pause-squat', name: 'Sentadilla pausa', movementFamily: 'squat' as const },
];

describe('performance analytics', () => {
  it('usa solo series efectivas completadas y conserva el mejor e1RM por exposición', () => {
    const exposures = buildSessionExposures([
      session('s01', 'w1', 'squat', [
        { weight: '40', reps: '5', rpe: '8', type: 'warmup' },
        { weight: '100', reps: '5', rpe: '8' },
        { weight: '999', reps: '1', rpe: '10', completed: false },
        { weight: '105', reps: '5', rpe: '8' },
      ]),
    ], exercises, weeks);
    expect(exposures).toHaveLength(1);
    expect(exposures[0].bestE1rm).toBeCloseTo(105 * (1 + 7 / 30));
  });

  it('calcula mejor y mediana de los mejores por sesión, luego compara microciclos', () => {
    const exposures = buildSessionExposures([
      session('s01', 'w1', 'squat', [{ weight: '100', reps: '5', rpe: '8' }]),
      session('s02', 'w1', 'squat', [{ weight: '110', reps: '5', rpe: '8' }]),
      session('s03', 'w2', 'squat', [{ weight: '115', reps: '5', rpe: '8' }]),
    ], exercises, weeks);
    const rows = aggregateMicrocycles(exposures);
    expect(rows[0].bestE1rm).toBeCloseTo(110 * (1 + 7 / 30));
    expect(rows[0].medianSessionBestE1rm).toBeCloseTo(105 * (1 + 7 / 30));
    expect(rows[1].percentChange).toBeCloseTo((115 / 105 - 1) * 100);
  });

  it('exige tres microciclos y aplica los umbrales de tendencia', () => {
    const base = (values: number[]): SessionExposure[] => values.map((bestE1rm, index) => ({
      sessionId: `s${index}`, date: '', exerciseId: 'squat', exerciseName: 'Squat', family: 'squat',
      mesocycleId: 'm1', mesocycleName: 'Meso', microcycleId: `w${index}`, microcycleName: `W${index}`,
      microcycleOrder: index, bestE1rm, confidence: 'high',
    }));
    expect(classifyPerformanceTrend(aggregateMicrocycles(base([100, 102])))).toBe('insufficient');
    expect(classifyPerformanceTrend(aggregateMicrocycles(base([100, 101, 104])))).toBe('ascending');
    expect(classifyPerformanceTrend(aggregateMicrocycles(base([100, 101, 98])))).toBe('descending');
    expect(classifyPerformanceTrend(aggregateMicrocycles(base([100, 101, 102])))).toBe('stable');
  });

  it('normaliza cada variante a base 100 antes de combinar la familia', () => {
    const rows = aggregateMicrocycles([
      { sessionId: '1', date: '', exerciseId: 'squat', exerciseName: 'Squat', family: 'squat', mesocycleId: 'm', mesocycleName: 'M', microcycleId: 'w1', microcycleName: 'W1', microcycleOrder: 1, bestE1rm: 200, confidence: 'high' },
      { sessionId: '2', date: '', exerciseId: 'pause-squat', exerciseName: 'Pause', family: 'squat', mesocycleId: 'm', mesocycleName: 'M', microcycleId: 'w1', microcycleName: 'W1', microcycleOrder: 1, bestE1rm: 100, confidence: 'high' },
      { sessionId: '3', date: '', exerciseId: 'squat', exerciseName: 'Squat', family: 'squat', mesocycleId: 'm', mesocycleName: 'M', microcycleId: 'w2', microcycleName: 'W2', microcycleOrder: 2, bestE1rm: 220, confidence: 'high' },
      { sessionId: '4', date: '', exerciseId: 'pause-squat', exerciseName: 'Pause', family: 'squat', mesocycleId: 'm', mesocycleName: 'M', microcycleId: 'w2', microcycleName: 'W2', microcycleOrder: 2, bestE1rm: 105, confidence: 'high' },
    ]);
    const family = normalizeFamilyPerformance(rows, 'squat');
    expect(family[0].normalizedIndex).toBe(100);
    expect(family[1].normalizedIndex).toBeCloseTo(107.5);
  });
});
