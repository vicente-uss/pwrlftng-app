import { WorkoutHistory } from '@/src/domain/types';

export type ExerciseSetEntry = { weight: number; reps: number; date: string };
export type WeightRecord = ExerciseSetEntry;
export type VolumeRecord = { volume: number; date: string };
export type RepCountRecord = { reps: number; weight: number; date: string };
export type OneRmFormula = (weight: number, reps: number) => number;
export type OneRmRecord = ExerciseSetEntry & { estimated1RM: number };

// Formula pendiente de decisión final (ver 07_avance_desarrollo_beta1). Intercambiable vía el parámetro `formula`.
export const epley1RM: OneRmFormula = (weight, reps) => (reps <= 1 ? weight : weight * (1 + reps / 30));

function completedWorkingSets(history: WorkoutHistory[], exerciseId: string): ExerciseSetEntry[] {
  const entries: ExerciseSetEntry[] = [];
  history.forEach(session => {
    session.exercises.forEach(exercise => {
      if (exercise.exerciseId !== exerciseId) return;
      exercise.sets.forEach(set => {
        if (set.type !== 'working' || !set.completed) return;
        entries.push({ weight: Number(set.weight) || 0, reps: Number(set.reps) || 0, date: set.completedAt ?? session.date });
      });
    });
  });
  return entries;
}

export function heaviestWeight(history: WorkoutHistory[], exerciseId: string): WeightRecord | null {
  const entries = completedWorkingSets(history, exerciseId);
  if (!entries.length) return null;
  return entries.reduce((best, entry) => (entry.weight > best.weight ? entry : best));
}

export function bestSet(history: WorkoutHistory[], exerciseId: string): WeightRecord | null {
  const entries = completedWorkingSets(history, exerciseId);
  if (!entries.length) return null;
  return entries.reduce((best, entry) => (entry.weight * entry.reps > best.weight * best.reps ? entry : best));
}

export function bestSessionVolume(history: WorkoutHistory[], exerciseId: string): VolumeRecord | null {
  let best: VolumeRecord | null = null;
  history.forEach(session => {
    const volume = session.exercises
      .filter(exercise => exercise.exerciseId === exerciseId)
      .flatMap(exercise => exercise.sets)
      .filter(set => set.type === 'working' && set.completed)
      .reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
    if (volume <= 0) return;
    if (!best || volume > best.volume) best = { volume, date: session.date };
  });
  return best;
}

export function bestByRepCount(history: WorkoutHistory[], exerciseId: string): RepCountRecord[] {
  const byReps = new Map<number, RepCountRecord>();
  completedWorkingSets(history, exerciseId).forEach(entry => {
    if (entry.reps <= 0) return;
    const current = byReps.get(entry.reps);
    if (!current || entry.weight > current.weight) byReps.set(entry.reps, { reps: entry.reps, weight: entry.weight, date: entry.date });
  });
  return [...byReps.values()].sort((a, b) => a.reps - b.reps);
}

export function bestEstimated1RM(history: WorkoutHistory[], exerciseId: string, formula: OneRmFormula = epley1RM): OneRmRecord | null {
  return completedWorkingSets(history, exerciseId).reduce<OneRmRecord | null>((best, entry) => {
    const estimated1RM = formula(entry.weight, entry.reps);
    return !best || estimated1RM > best.estimated1RM ? { ...entry, estimated1RM } : best;
  }, null);
}

export type PreviousSetPerformance = { weight: string; reps: string; rpe: string; rir: string };

export function previousSetPerformance(history: WorkoutHistory[], exerciseId: string, setIndex: number): PreviousSetPerformance | null {
  const session = history.find(item => item.exercises.some(exercise => exercise.exerciseId === exerciseId));
  const set = session?.exercises.find(exercise => exercise.exerciseId === exerciseId)?.sets[setIndex];
  return set ? { weight: set.weight, reps: set.reps, rpe: set.rpe, rir: set.rir } : null;
}
