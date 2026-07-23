import { estimatePerformedSet, EstimateConfidence } from '@/src/domain/prFormulas';
import { MovementFamily, WorkoutHistory } from '@/src/domain/types';

export type PerformanceExercise = {
  id: string;
  name: string;
  movementFamily?: MovementFamily | null;
};

export type PerformanceMicrocycle = {
  id: string;
  name: string;
  order: number;
  mesocycleId?: string | null;
  mesocycleName?: string | null;
};

export type SessionExposure = {
  sessionId: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  family: MovementFamily | null;
  mesocycleId: string | null;
  mesocycleName: string;
  microcycleId: string;
  microcycleName: string;
  microcycleOrder: number;
  bestE1rm: number;
  confidence: EstimateConfidence;
};

export type MicrocyclePerformance = {
  exerciseId: string;
  exerciseName: string;
  family: MovementFamily | null;
  mesocycleId: string | null;
  mesocycleName: string;
  microcycleId: string;
  microcycleName: string;
  microcycleOrder: number;
  sessionCount: number;
  bestE1rm: number;
  medianSessionBestE1rm: number;
  percentChange: number | null;
  confidence: EstimateConfidence;
};

export type PerformanceTrend = 'ascending' | 'stable' | 'descending' | 'insufficient';

export type FamilyPerformancePoint = {
  mesocycleId: string | null;
  microcycleId: string;
  microcycleName: string;
  microcycleOrder: number;
  normalizedIndex: number;
  variantCount: number;
};

const confidenceRank: Record<EstimateConfidence, number> = { high: 0, medium: 1, low: 2 };

function parseEffort(value: string, minimum: number) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed >= minimum && parsed <= 10 ? parsed : null;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weakestConfidence(values: EstimateConfidence[]) {
  return values.reduce((weakest, value) => confidenceRank[value] > confidenceRank[weakest] ? value : weakest, 'high');
}

export function buildSessionExposures(
  history: WorkoutHistory[],
  exercises: PerformanceExercise[],
  microcycles: PerformanceMicrocycle[],
): SessionExposure[] {
  const exerciseMap = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const microcycleMap = new Map(microcycles.map(microcycle => [microcycle.id, microcycle]));
  const exposures: SessionExposure[] = [];

  history.forEach(session => {
    const microcycle = session.blockWeekId ? microcycleMap.get(session.blockWeekId) : undefined;
    session.exercises.forEach(performedExercise => {
      const catalogExercise = exerciseMap.get(performedExercise.exerciseId);
      const valid = performedExercise.sets.flatMap(set => {
        if (!set.completed || set.type !== 'working') return [];
        const estimate = estimatePerformedSet(
          Number(set.weight),
          Number(set.reps),
          parseEffort(set.rpe, 1),
          parseEffort(set.rir, 0),
        );
        return estimate ? [estimate] : [];
      });
      if (!valid.length) return;
      const best = valid.reduce((winner, candidate) => candidate.value > winner.value ? candidate : winner);
      exposures.push({
        sessionId: session.id,
        date: session.date,
        exerciseId: performedExercise.exerciseId,
        exerciseName: catalogExercise?.name ?? performedExercise.name,
        family: catalogExercise?.movementFamily ?? null,
        mesocycleId: microcycle?.mesocycleId ?? session.blockId ?? null,
        mesocycleName: microcycle?.mesocycleName ?? 'Historial',
        microcycleId: microcycle?.id ?? session.blockWeekId ?? session.id,
        microcycleName: microcycle?.name ?? new Date(session.date).toLocaleDateString('es-CL'),
        microcycleOrder: microcycle?.order ?? new Date(session.date).getTime(),
        bestE1rm: best.value,
        confidence: best.confidence,
      });
    });
  });
  return exposures.sort((a, b) => a.microcycleOrder - b.microcycleOrder || a.date.localeCompare(b.date));
}

export function aggregateMicrocycles(exposures: SessionExposure[]): MicrocyclePerformance[] {
  const groups = new Map<string, SessionExposure[]>();
  exposures.forEach(exposure => {
    const key = `${exposure.exerciseId}::${exposure.microcycleId}`;
    groups.set(key, [...(groups.get(key) ?? []), exposure]);
  });

  const rows = [...groups.values()].map(group => {
    const first = group[0];
    const values = group.map(item => item.bestE1rm);
    return {
      exerciseId: first.exerciseId,
      exerciseName: first.exerciseName,
      family: first.family,
      mesocycleId: first.mesocycleId,
      mesocycleName: first.mesocycleName,
      microcycleId: first.microcycleId,
      microcycleName: first.microcycleName,
      microcycleOrder: first.microcycleOrder,
      sessionCount: group.length,
      bestE1rm: Math.max(...values),
      medianSessionBestE1rm: median(values),
      percentChange: null,
      confidence: weakestConfidence(group.map(item => item.confidence)),
    } satisfies MicrocyclePerformance;
  }).sort((a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.microcycleOrder - b.microcycleOrder);

  const previousByExercise = new Map<string, MicrocyclePerformance>();
  return rows.map(row => {
    const previous = previousByExercise.get(row.exerciseId);
    previousByExercise.set(row.exerciseId, row);
    return {
      ...row,
      percentChange: previous && previous.medianSessionBestE1rm > 0
        ? ((row.medianSessionBestE1rm / previous.medianSessionBestE1rm) - 1) * 100
        : null,
    };
  });
}

export function classifyPerformanceTrend(rows: MicrocyclePerformance[]): PerformanceTrend {
  const ordered = [...rows].sort((a, b) => a.microcycleOrder - b.microcycleOrder);
  if (ordered.length < 3) return 'insufficient';
  const change = ordered.at(-1)?.percentChange;
  if (change == null) return 'insufficient';
  if (change > 2) return 'ascending';
  if (change < -2) return 'descending';
  return 'stable';
}

/**
 * Each variant is normalized against its own first valid microcycle (base 100)
 * before variants are combined. Kilograms from different variants are never averaged.
 */
export function normalizeFamilyPerformance(
  rows: MicrocyclePerformance[],
  family: Exclude<MovementFamily, 'other'>,
): FamilyPerformancePoint[] {
  const familyRows = rows.filter(row => row.family === family);
  const baseByExercise = new Map<string, number>();
  familyRows.forEach(row => {
    if (!baseByExercise.has(row.exerciseId) && row.medianSessionBestE1rm > 0) {
      baseByExercise.set(row.exerciseId, row.medianSessionBestE1rm);
    }
  });
  const groups = new Map<string, { row: MicrocyclePerformance; indexes: number[] }>();
  familyRows.forEach(row => {
    const base = baseByExercise.get(row.exerciseId);
    if (!base) return;
    const current = groups.get(row.microcycleId) ?? { row, indexes: [] };
    current.indexes.push((row.medianSessionBestE1rm / base) * 100);
    groups.set(row.microcycleId, current);
  });
  return [...groups.values()]
    .sort((a, b) => a.row.microcycleOrder - b.row.microcycleOrder)
    .map(({ row, indexes }) => ({
      mesocycleId: row.mesocycleId,
      microcycleId: row.microcycleId,
      microcycleName: row.microcycleName,
      microcycleOrder: row.microcycleOrder,
      normalizedIndex: median(indexes),
      variantCount: indexes.length,
    }));
}
