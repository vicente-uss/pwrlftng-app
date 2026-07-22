import { freshDefaultData, LEGACY_SEED_ROUTINE_IDS } from '@/src/data/seed';
import { DEFAULT_BLOCK, MAX_REST_SECONDS, normalizeGoal } from '@/src/domain/profileOptions';
import { ActiveExercise, ActiveSession, ActiveSet, DeletionTombstone, PersistedData, Profile, Routine, RoutineSet, SetType, WorkoutHistory } from '@/src/domain/types';
import { isEffortMode, normalizeRepRange } from '@/src/domain/training';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function setType(value: unknown): SetType {
  return value === 'warmup' ? 'warmup' : 'working';
}

function normalizeRoutineSet(value: unknown): RoutineSet {
  const source = record(value);
  const legacyReps = number(source.reps, 5);
  const range = normalizeRepRange(number(source.repsMin, legacyReps), number(source.repsMax, legacyReps));
  return {
    id: text(source.id),
    type: setType(source.type),
    weight: Math.max(0, number(source.weight)),
    repsMin: range.min,
    repsMax: range.max,
    rpe: optionalNumber(source.rpe),
    rir: optionalNumber(source.rir),
  };
}

function normalizeRoutine(value: unknown): Routine {
  const source = record(value);
  return {
    id: text(source.id),
    name: text(source.name, 'Rutina'),
    day: Math.min(7, Math.max(1, Math.round(number(source.day, 1)))),
    effortMode: isEffortMode(source.effortMode) ? source.effortMode : 'rpe',
    exercises: Array.isArray(source.exercises) ? source.exercises.map(value => {
      const exercise = record(value);
      return {
        id: text(exercise.id),
        exerciseId: text(exercise.exerciseId),
        name: text(exercise.name),
        muscle: text(exercise.muscle),
        sets: Array.isArray(exercise.sets) ? exercise.sets.map(normalizeRoutineSet) : [],
      };
    }) : [],
    createdAt: text(source.createdAt, new Date().toISOString()),
    updatedAt: text(source.updatedAt, text(source.createdAt, new Date().toISOString())),
  };
}

function normalizeActiveSet(value: unknown): ActiveSet {
  const source = record(value);
  const actualReps = Math.max(0, Math.round(number(source.reps, 0)));
  const range = normalizeRepRange(number(source.targetRepsMin, actualReps), number(source.targetRepsMax, actualReps));
  return {
    id: text(source.id),
    type: setType(source.type),
    weight: text(source.weight, String(number(source.weight))),
    reps: text(source.reps, String(actualReps)),
    targetRepsMin: range.min,
    targetRepsMax: range.max,
    rpe: text(source.rpe, source.rpe == null ? '' : String(source.rpe)),
    rir: text(source.rir, source.rir == null ? '' : String(source.rir)),
    completed: source.completed === true,
    completedAt: typeof source.completedAt === 'string' ? source.completedAt : undefined,
  };
}

function normalizeActiveExercise(value: unknown): ActiveExercise {
  const source = record(value);
  return {
    id: text(source.id),
    exerciseId: text(source.exerciseId),
    name: text(source.name),
    muscle: text(source.muscle),
    notes: text(source.notes),
    sets: Array.isArray(source.sets) ? source.sets.map(normalizeActiveSet) : [],
  };
}

function normalizeWorkout(value: unknown): WorkoutHistory {
  const source = record(value);
  return {
    id: text(source.id),
    routineName: text(source.routineName, 'Entrenamiento'),
    effortMode: isEffortMode(source.effortMode) ? source.effortMode : 'rpe',
    date: text(source.date, new Date().toISOString()),
    durationSeconds: Math.max(0, Math.round(number(source.durationSeconds))),
    totalVolume: Math.max(0, number(source.totalVolume)),
    setsCompleted: Math.max(0, Math.round(number(source.setsCompleted))),
    notes: text(source.notes),
    exercises: Array.isArray(source.exercises) ? source.exercises.map(normalizeActiveExercise) : [],
  };
}

function normalizeProfile(value: unknown, migratedAt: string): Profile {
  const source = record(value);
  return {
    displayName: text(source.displayName),
    bodyWeight: text(source.bodyWeight),
    height: text(source.height),
    goal: normalizeGoal(text(source.goal, 'Ganar fuerza máxima')),
    level: DEFAULT_BLOCK,
    defaultRestSeconds: Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(number(source.defaultRestSeconds, 180)))),
    updatedAt: text(source.updatedAt, migratedAt),
  };
}

function normalizeTombstones(value: unknown): DeletionTombstone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const source = record(item);
    return source.entityType === 'routine' && typeof source.recordId === 'string' && typeof source.deletedAt === 'string'
      ? [{ entityType: 'routine' as const, recordId: source.recordId, deletedAt: source.deletedAt }]
      : [];
  });
}

export function migratePrototypeData(data: PersistedData): PersistedData {
  const routineIds = new Set(data.routines.map(routine => routine.id));
  const hasCompleteLegacySeed = LEGACY_SEED_ROUTINE_IDS.every(id => routineIds.has(id));
  const history = data.history.filter(workout => workout.id !== 'history-demo');
  const profile = { ...data.profile, goal: normalizeGoal(data.profile.goal), level: DEFAULT_BLOCK };

  if (!hasCompleteLegacySeed) return { ...data, history, profile };

  const routines = new Map(
    data.routines
      .filter(routine => !LEGACY_SEED_ROUTINE_IDS.includes(routine.id as (typeof LEGACY_SEED_ROUTINE_IDS)[number]))
      .map(routine => [routine.id, routine]),
  );
  freshDefaultData().routines.forEach(routine => {
    if (!routines.has(routine.id)) routines.set(routine.id, routine);
  });

  const tombstones = new Map(data.tombstones.map(item => [`${item.entityType}:${item.recordId}`, item]));
  LEGACY_SEED_ROUTINE_IDS.forEach(recordId => {
    const key = `routine:${recordId}`;
    if (!tombstones.has(key)) {
      tombstones.set(key, { entityType: 'routine', recordId, deletedAt: '2026-07-14T00:00:00.000Z' });
    }
  });

  return { routines: [...routines.values()], history, profile, tombstones: [...tombstones.values()] };
}

export function normalizePersistedData(value: unknown): PersistedData | null {
  const source = record(value);
  if (!Array.isArray(source.routines) || !Array.isArray(source.history) || !source.profile) return null;
  const migratedAt = new Date().toISOString();
  return migratePrototypeData({
    routines: source.routines.map(normalizeRoutine),
    history: source.history.map(normalizeWorkout),
    profile: normalizeProfile(source.profile, migratedAt),
    tombstones: normalizeTombstones(source.tombstones),
  });
}

export function normalizeActiveSession(value: unknown): ActiveSession | null {
  const source = record(value);
  if (typeof source.id !== 'string' || typeof source.routineName !== 'string' || !Array.isArray(source.exercises)) return null;
  return {
    id: source.id,
    routineId: typeof source.routineId === 'string' ? source.routineId : undefined,
    routineName: source.routineName,
    effortMode: isEffortMode(source.effortMode) ? source.effortMode : 'rpe',
    restSeconds: Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(number(source.restSeconds, 180)))),
    startedAt: number(source.startedAt, Date.now()),
    notes: text(source.notes),
    exercises: source.exercises.map(normalizeActiveExercise),
  };
}
