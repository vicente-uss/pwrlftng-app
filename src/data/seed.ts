import { Exercise, PersistedData, Routine, RoutineExercise, RoutineSet } from '@/src/domain/types';

export const EXERCISE_CATALOG: Exercise[] = [
  { id: 'squat', name: 'Squat', muscle: 'Piernas' },
  { id: 'bench', name: 'Bench Press', muscle: 'Pecho' },
  { id: 'deadlift', name: 'Deadlift', muscle: 'Espalda' },
  { id: 'ohp', name: 'Overhead Press', muscle: 'Hombros' },
  { id: 'curl', name: 'Curl con barra', muscle: 'Bíceps' },
  { id: 'pushdown', name: 'Tricep Pushdown', muscle: 'Tríceps' },
  // Se conservan para mostrar rutinas e historiales creados antes de Prioridad 2.
  { id: 'row', name: 'Remo con barra', muscle: 'Espalda' },
  { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Piernas' },
  { id: 'pulldown', name: 'Lat Pulldown', muscle: 'Espalda' },
  { id: 'leg-curl', name: 'Leg Curl', muscle: 'Piernas' },
];

const ACTIVE_EXERCISE_IDS = new Set(['squat', 'bench', 'deadlift', 'ohp', 'curl', 'pushdown']);
export const EXERCISES = EXERCISE_CATALOG.filter(exercise => ACTIVE_EXERCISE_IDS.has(exercise.id));

export const LEGACY_SEED_ROUTINE_IDS = ['routine-a', 'routine-b', 'routine-c'] as const;
export const SEED_ROUTINE_IDS = ['routine-day-1', 'routine-day-2', 'routine-day-3', 'routine-day-4'] as const;

const SEED_TIMESTAMP = '2026-07-14T00:00:00.000Z';

function routineSets(prefix: string): RoutineSet[] {
  return [1, 2, 3, 4].map(position => ({
    id: `${prefix}-set-${position}`,
    type: 'working',
    weight: 0,
    repsMin: 5,
    repsMax: 5,
    rpe: 8,
  }));
}

function routineExercise(routineId: string, exerciseId: string): RoutineExercise {
  const exercise = EXERCISE_CATALOG.find(item => item.id === exerciseId)!;
  return {
    id: `${routineId}-${exerciseId}`,
    exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    sets: routineSets(`${routineId}-${exerciseId}`),
  };
}

export const SEED_ROUTINES: Routine[] = [
  {
    id: 'routine-day-1',
    name: 'Día 1',
    day: 1,
    effortMode: 'rpe',
    exercises: [routineExercise('routine-day-1', 'squat')],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'routine-day-2',
    name: 'Día 2',
    day: 2,
    effortMode: 'rpe',
    exercises: [routineExercise('routine-day-2', 'bench')],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'routine-day-3',
    name: 'Día 3',
    day: 3,
    effortMode: 'rpe',
    exercises: [routineExercise('routine-day-3', 'deadlift')],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'routine-day-4',
    name: 'Día 4',
    day: 4,
    effortMode: 'rpe',
    exercises: [
      routineExercise('routine-day-4', 'squat'),
      routineExercise('routine-day-4', 'bench'),
      routineExercise('routine-day-4', 'deadlift'),
    ],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

function cloneRoutines() {
  return SEED_ROUTINES.map(routine => ({
    ...routine,
    exercises: routine.exercises.map(exercise => ({
      ...exercise,
      sets: exercise.sets.map(set => ({ ...set })),
    })),
  }));
}

export function freshDefaultData(): PersistedData {
  return {
    routines: cloneRoutines(),
    history: [],
    profile: {
      bodyWeight: '85',
      height: '178',
      goal: 'Ganar fuerza máxima',
      level: 'Bloque base',
      defaultRestSeconds: 180,
      updatedAt: SEED_TIMESTAMP,
    },
    tombstones: [],
  };
}

export const DEFAULT_DATA: PersistedData = freshDefaultData();
