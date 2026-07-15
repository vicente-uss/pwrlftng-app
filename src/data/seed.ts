import { Exercise, PersistedData, Routine, WorkoutHistory, makeId } from '@/src/domain/types';

export const EXERCISE_CATALOG: Exercise[] = [
  { id: 'squat', name: 'Squat', muscle: 'Piernas' },
  { id: 'bench', name: 'Bench Press', muscle: 'Pecho' },
  { id: 'deadlift', name: 'Deadlift', muscle: 'Espalda' },
  { id: 'ohp', name: 'Overhead Press', muscle: 'Hombros' },
  { id: 'curl', name: 'Curl con barra', muscle: 'Bíceps' },
  { id: 'pushdown', name: 'Tricep Pushdown', muscle: 'Tríceps' },
  // Se conservan para poder mostrar rutinas e historiales creados antes de Prioridad 2.
  { id: 'row', name: 'Remo con barra', muscle: 'Espalda' },
  { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Piernas' },
  { id: 'pulldown', name: 'Lat Pulldown', muscle: 'Espalda' },
  { id: 'leg-curl', name: 'Leg Curl', muscle: 'Piernas' },
];

const ACTIVE_EXERCISE_IDS = new Set(['squat', 'bench', 'deadlift', 'ohp', 'curl', 'pushdown']);
export const EXERCISES = EXERCISE_CATALOG.filter(exercise => ACTIVE_EXERCISE_IDS.has(exercise.id));

type RepPrescription = number | [number, number];

const sets = (weights: number[], reps: RepPrescription[]) => weights.map((weight, index) => {
  const prescription = reps[index];
  const [repsMin, repsMax] = Array.isArray(prescription) ? prescription : [prescription, prescription];
  return {
    id: makeId('rs'),
    type: index === 0 ? 'warmup' as const : 'working' as const,
    weight,
    repsMin,
    repsMax,
    rpe: index ? Math.min(9, 7 + index * 0.5) : undefined,
  };
});

const routineExercise = (exerciseId: string, weights: number[], reps: RepPrescription[]) => {
  const exercise = EXERCISE_CATALOG.find(item => item.id === exerciseId)!;
  return { id: makeId('re'), exerciseId, name: exercise.name, muscle: exercise.muscle, sets: sets(weights, reps) };
};

const now = new Date().toISOString();

export const SEED_ROUTINES: Routine[] = [
  {
    id: 'routine-a', name: 'Día A · Sentadilla', day: 1, effortMode: 'rpe', createdAt: now, updatedAt: now,
    exercises: [
      routineExercise('squat', [60, 120, 120, 120], [5, [5, 7], [5, 7], 3]),
      routineExercise('bench', [40, 85, 85, 85], [8, 5, 5, 5]),
      routineExercise('curl', [20, 35, 35], [10, [8, 10], [8, 10]]),
    ],
  },
  {
    id: 'routine-b', name: 'Día B · Press', day: 3, effortMode: 'rpe', createdAt: now, updatedAt: now,
    exercises: [
      routineExercise('ohp', [30, 60, 60, 60], [8, [4, 6], [4, 6], 4]),
      routineExercise('bench', [40, 90, 90], [8, 3, 3]),
      routineExercise('pushdown', [20, 35, 35], [12, [10, 12], [10, 12]]),
    ],
  },
  {
    id: 'routine-c', name: 'Día C · Peso muerto', day: 5, effortMode: 'rpe', createdAt: now, updatedAt: now,
    exercises: [
      routineExercise('deadlift', [80, 160, 160, 155], [5, 3, 3, 3]),
      routineExercise('squat', [60, 100, 100], [5, [5, 7], [5, 7]]),
    ],
  },
];

const historicalExercises = SEED_ROUTINES[2].exercises.map(exercise => ({
  ...exercise,
  notes: '',
  sets: exercise.sets.map(set => ({
    id: set.id,
    type: set.type,
    weight: String(set.weight),
    reps: String(set.repsMin),
    targetRepsMin: set.repsMin,
    targetRepsMax: set.repsMax,
    rpe: set.rpe ? String(set.rpe) : '',
    rir: '',
    completed: true,
    completedAt: now,
  })),
}));

const historicalVolume = historicalExercises.flatMap(exercise => exercise.sets)
  .reduce((total, set) => set.type === 'working' ? total + Number(set.weight) * Number(set.reps) : total, 0);

export const SEED_HISTORY: WorkoutHistory[] = [{
  id: 'history-demo',
  routineName: 'Día C · Peso muerto',
  effortMode: 'rpe',
  date: new Date(Date.now() - 3 * 86400000).toISOString(),
  durationSeconds: 3840,
  totalVolume: historicalVolume,
  setsCompleted: historicalExercises.flatMap(exercise => exercise.sets).length,
  notes: '',
  exercises: historicalExercises,
}];

export const DEFAULT_DATA: PersistedData = {
  routines: SEED_ROUTINES,
  history: SEED_HISTORY,
  profile: { bodyWeight: '85', height: '178', goal: 'Fuerza máxima', level: 'Intermedio', defaultRestSeconds: 180, updatedAt: now },
  tombstones: [],
};
