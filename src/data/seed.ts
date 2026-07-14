import { Exercise, PersistedData, Routine, WorkoutHistory, makeId } from '@/src/domain/types';

export const EXERCISES: Exercise[] = [
  { id: 'squat', name: 'Squat', muscle: 'Piernas' }, { id: 'bench', name: 'Bench Press', muscle: 'Pecho' },
  { id: 'deadlift', name: 'Deadlift', muscle: 'Espalda' }, { id: 'row', name: 'Remo con barra', muscle: 'Espalda' },
  { id: 'ohp', name: 'Overhead Press', muscle: 'Hombros' }, { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Piernas' },
  { id: 'pulldown', name: 'Lat Pulldown', muscle: 'Espalda' }, { id: 'leg-curl', name: 'Leg Curl', muscle: 'Piernas' },
  { id: 'curl', name: 'Curl con barra', muscle: 'Bíceps' }, { id: 'pushdown', name: 'Tricep Pushdown', muscle: 'Tríceps' },
];

const sets = (weights: number[], reps: number[]) => weights.map((weight, index) => ({ id: makeId('rs'), type: index === 0 ? 'warmup' as const : 'working' as const, weight, reps: reps[index], rpe: index ? Math.min(9, 7 + index * .5) : undefined }));
const routineExercise = (exerciseId: string, weights: number[], reps: number[]) => { const exercise = EXERCISES.find(item => item.id === exerciseId)!; return { id: makeId('re'), exerciseId, name: exercise.name, muscle: exercise.muscle, sets: sets(weights, reps) }; };
const now = new Date().toISOString();

export const SEED_ROUTINES: Routine[] = [
  { id: 'routine-a', name: 'Día A · Sentadilla', day: 1, createdAt: now, updatedAt: now, exercises: [routineExercise('squat', [60,120,120,120], [5,5,5,3]), routineExercise('bench', [40,85,85,85], [8,5,5,5]), routineExercise('row', [40,75,75], [8,6,6])] },
  { id: 'routine-b', name: 'Día B · Press', day: 3, createdAt: now, updatedAt: now, exercises: [routineExercise('ohp', [30,60,60,60], [8,5,5,4]), routineExercise('bench', [40,90,90], [8,3,3]), routineExercise('pulldown', [40,70,70], [10,8,8])] },
  { id: 'routine-c', name: 'Día C · Peso muerto', day: 5, createdAt: now, updatedAt: now, exercises: [routineExercise('deadlift', [80,160,160,155], [5,3,3,3]), routineExercise('rdl', [50,90,90], [8,6,6]), routineExercise('leg-curl', [25,45,45], [12,10,10])] },
];

const historicalExercises = SEED_ROUTINES[2].exercises.map(exercise => ({ ...exercise, sets: exercise.sets.map(set => ({ ...set, weight: String(set.weight), reps: String(set.reps), rpe: set.rpe ? String(set.rpe) : '', completed: true, completedAt: now })) }));
export const SEED_HISTORY: WorkoutHistory[] = [{ id: 'history-demo', routineName: 'Día C · Peso muerto', date: new Date(Date.now() - 3 * 86400000).toISOString(), durationSeconds: 3840, totalVolume: 8540, setsCompleted: 10, exercises: historicalExercises }];
export const DEFAULT_DATA: PersistedData = { routines: SEED_ROUTINES, history: SEED_HISTORY, profile: { bodyWeight: '85', height: '178', goal: 'Fuerza máxima', level: 'Intermedio', defaultRestSeconds: 180, updatedAt: now }, tombstones: [] };
