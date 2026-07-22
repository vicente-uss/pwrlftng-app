import { ActiveExercise, ActiveSet, EffortMode, PersistedData, Profile, Routine, RoutineExercise, RoutineSet, SetType, WorkoutHistory } from '@/src/domain/types';
import { isEffortMode } from '@/src/domain/training';
import { supabase } from '@/src/lib/supabase';
import { mergePersistedData, withoutDeletedRoutines } from '@/src/services/syncMerge';
import { migratePrototypeData } from '@/src/storage/dataMigrations';

type PullResult = { status: 'no-session' } | { status: 'pulled'; data: PersistedData };
export type PushResult = 'no-session' | 'pull-required' | 'synced';

type RemoteProfile = { display_name: string | null; body_weight: number | string | null; height_cm: number | null; goal: string; level: string; default_rest_seconds: number; updated_at: string };
type RemoteExercise = { id: string; name: string; muscle: string };
type RemoteRoutine = { id: string; name: string; training_day: number; effort_mode: string; created_at: string; updated_at: string };
type RemoteRoutineExercise = { id: string; routine_id: string; exercise_id: string; position: number };
type RemoteRoutineSet = { id: string; routine_exercise_id: string; position: number; set_type: string; weight: number | string; reps: number; reps_min: number | null; reps_max: number | null; rpe: number | string | null; rir: number | string | null };
type RemoteWorkout = { id: string; routine_name: string; effort_mode: string; notes: string | null; completed_at: string; duration_seconds: number; total_volume: number | string; sets_completed: number };
type RemoteWorkoutExercise = { id: string; workout_id: string; exercise_id: string; exercise_name: string; muscle: string; notes: string | null; position: number };
type RemoteWorkoutSet = { id: string; workout_exercise_id: string; position: number; set_type: string; weight: number | string; reps: number; target_reps_min: number | null; target_reps_max: number | null; rpe: number | string | null; rir: number | string | null; completed: boolean; completed_at: string | null };
type RemoteTombstone = { entity_type: string; record_id: string; deleted_at: string };

const pulledUsers = new Set<string>();

function ensure(error: { message: string } | null) { if (error) throw new Error(error.message); }
function setType(value: string): SetType { return value === 'warmup' ? 'warmup' : 'working'; }
function effortMode(value: string): EffortMode { return isEffortMode(value) ? value : 'rpe'; }
function rows<T>(value: unknown): T[] { return (value ?? []) as T[]; }
function optionalEffort(value: string, minimum: number) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= 10 ? parsed : null;
}

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  ensure(error);
  return data.session?.user.id ?? null;
}

export function resetCloudSyncGuard() { pulledUsers.clear(); }

export async function pullDataFromCloud(localData: PersistedData, options: { includeLocalData: boolean }): Promise<PullResult> {
  if (!supabase) return { status: 'no-session' };
  const userId = await getUserId();
  if (!userId) return { status: 'no-session' };

  const [profileResult, exercisesResult, routinesResult, routineExercisesResult, routineSetsResult, workoutsResult, workoutExercisesResult, workoutSetsResult, tombstonesResult] = await Promise.all([
    supabase.from('profiles').select('display_name,body_weight,height_cm,goal,level,default_rest_seconds,updated_at').eq('id', userId).maybeSingle(),
    supabase.from('exercises').select('id,name,muscle'),
    supabase.from('routines').select('id,name,training_day,effort_mode,created_at,updated_at').eq('user_id', userId).order('training_day'),
    supabase.from('routine_exercises').select('id,routine_id,exercise_id,position').eq('user_id', userId).order('position'),
    supabase.from('routine_sets').select('id,routine_exercise_id,position,set_type,weight,reps,reps_min,reps_max,rpe,rir').eq('user_id', userId).order('position'),
    supabase.from('workouts').select('id,routine_name,effort_mode,notes,completed_at,duration_seconds,total_volume,sets_completed').eq('user_id', userId).order('completed_at', { ascending: false }),
    supabase.from('workout_exercises').select('id,workout_id,exercise_id,exercise_name,muscle,notes,position').eq('user_id', userId).order('position'),
    supabase.from('workout_sets').select('id,workout_exercise_id,position,set_type,weight,reps,target_reps_min,target_reps_max,rpe,rir,completed,completed_at').eq('user_id', userId).order('position'),
    supabase.from('deletion_tombstones').select('entity_type,record_id,deleted_at').eq('user_id', userId),
  ]);

  [profileResult, exercisesResult, routinesResult, routineExercisesResult, routineSetsResult, workoutsResult, workoutExercisesResult, workoutSetsResult, tombstonesResult].forEach(result => ensure(result.error));

  const exerciseMap = new Map(rows<RemoteExercise>(exercisesResult.data).map(exercise => [exercise.id, exercise]));
  const routineExerciseRows = rows<RemoteRoutineExercise>(routineExercisesResult.data);
  const routineSetRows = rows<RemoteRoutineSet>(routineSetsResult.data);
  const remoteRoutines: Routine[] = rows<RemoteRoutine>(routinesResult.data).map(routine => ({
    id: routine.id,
    name: routine.name,
    day: routine.training_day,
    effortMode: effortMode(routine.effort_mode),
    createdAt: routine.created_at,
    updatedAt: routine.updated_at,
    exercises: routineExerciseRows.filter(item => item.routine_id === routine.id).sort((a, b) => a.position - b.position).map((item): RoutineExercise => {
      const exercise = exerciseMap.get(item.exercise_id);
      return {
        id: item.id,
        exerciseId: item.exercise_id,
        name: exercise?.name ?? item.exercise_id,
        muscle: exercise?.muscle ?? '',
        sets: routineSetRows.filter(set => set.routine_exercise_id === item.id).sort((a, b) => a.position - b.position).map((set): RoutineSet => ({
          id: set.id,
          type: setType(set.set_type),
          weight: Number(set.weight) || 0,
          repsMin: set.reps_min ?? set.reps,
          repsMax: set.reps_max ?? set.reps,
          rpe: set.rpe == null ? undefined : Number(set.rpe),
          rir: set.rir == null ? undefined : Number(set.rir),
        })),
      };
    }),
  }));

  const workoutExerciseRows = rows<RemoteWorkoutExercise>(workoutExercisesResult.data);
  const workoutSetRows = rows<RemoteWorkoutSet>(workoutSetsResult.data);
  const remoteHistory: WorkoutHistory[] = rows<RemoteWorkout>(workoutsResult.data).map(workout => ({
    id: workout.id,
    routineName: workout.routine_name,
    effortMode: effortMode(workout.effort_mode),
    date: workout.completed_at,
    durationSeconds: workout.duration_seconds,
    totalVolume: Number(workout.total_volume) || 0,
    setsCompleted: workout.sets_completed,
    notes: workout.notes ?? '',
    exercises: workoutExerciseRows.filter(item => item.workout_id === workout.id).sort((a, b) => a.position - b.position).map((item): ActiveExercise => ({
      id: item.id,
      exerciseId: item.exercise_id,
      name: item.exercise_name,
      muscle: item.muscle,
      notes: item.notes ?? '',
      sets: workoutSetRows.filter(set => set.workout_exercise_id === item.id).sort((a, b) => a.position - b.position).map((set): ActiveSet => ({
        id: set.id,
        type: setType(set.set_type),
        weight: String(set.weight),
        reps: String(set.reps),
        targetRepsMin: set.target_reps_min ?? set.reps,
        targetRepsMax: set.target_reps_max ?? set.reps,
        rpe: set.rpe == null ? '' : String(set.rpe),
        rir: set.rir == null ? '' : String(set.rir),
        completed: set.completed,
        completedAt: set.completed_at ?? undefined,
      })),
    })),
  }));

  const profileRow = profileResult.data as RemoteProfile | null;
  const remoteProfile: Profile = profileRow ? {
    displayName: profileRow.display_name ?? '',
    bodyWeight: profileRow.body_weight == null ? '' : String(profileRow.body_weight),
    height: profileRow.height_cm == null ? '' : String(profileRow.height_cm),
    goal: profileRow.goal,
    level: profileRow.level,
    defaultRestSeconds: profileRow.default_rest_seconds,
    updatedAt: profileRow.updated_at,
  } : localData.profile;

  const remoteData: PersistedData = {
    routines: remoteRoutines,
    history: remoteHistory,
    profile: remoteProfile,
    tombstones: rows<RemoteTombstone>(tombstonesResult.data)
      .filter(item => item.entity_type === 'routine')
      .map(item => ({ entityType: 'routine', recordId: item.record_id, deletedAt: item.deleted_at })),
  };
  const remoteAccountUntouched = remoteRoutines.length === 0
    && remoteHistory.length === 0
    && remoteData.tombstones.length === 0
    && (profileRow?.display_name == null || profileRow.display_name === '')
    && profileRow?.body_weight == null
    && profileRow?.height_cm == null
    && profileRow?.default_rest_seconds === 180;
  const merged = migratePrototypeData(
    !options.includeLocalData && remoteAccountUntouched
      ? localData
      : mergePersistedData(localData, remoteData, options.includeLocalData),
  );
  pulledUsers.add(userId);
  return { status: 'pulled', data: merged };
}

export async function syncDataToCloud(data: PersistedData): Promise<PushResult> {
  if (!supabase) return 'no-session';
  const userId = await getUserId();
  if (!userId) return 'no-session';
  if (!pulledUsers.has(userId)) return 'pull-required';

  const liveRoutines = withoutDeletedRoutines(data.routines, data.tombstones);
  const profileResult = await supabase.from('profiles').upsert({
    id: userId,
    display_name: data.profile.displayName.trim() || null,
    body_weight: Number(data.profile.bodyWeight) || null,
    height_cm: Number(data.profile.height) || null,
    goal: data.profile.goal,
    level: data.profile.level,
    default_rest_seconds: data.profile.defaultRestSeconds,
    updated_at: data.profile.updatedAt,
  });
  ensure(profileResult.error);

  if (liveRoutines.length) {
    const routinesResult = await supabase.from('routines').upsert(liveRoutines.map(routine => ({ id: routine.id, user_id: userId, name: routine.name, training_day: routine.day, effort_mode: routine.effortMode, created_at: routine.createdAt, updated_at: routine.updatedAt })));
    ensure(routinesResult.error);
    const routineExercises = liveRoutines.flatMap(routine => routine.exercises.map((exercise, position) => ({ id: exercise.id, user_id: userId, routine_id: routine.id, exercise_id: exercise.exerciseId, position })));
    if (routineExercises.length) { const result = await supabase.from('routine_exercises').upsert(routineExercises); ensure(result.error); }
    const routineSets = liveRoutines.flatMap(routine => routine.exercises.flatMap(exercise => exercise.sets.map((set, position) => ({ id: set.id, user_id: userId, routine_exercise_id: exercise.id, position, set_type: set.type, weight: set.weight, reps: set.repsMin, reps_min: set.repsMin, reps_max: set.repsMax, rpe: set.rpe ?? null, rir: set.rir ?? null }))));
    if (routineSets.length) { const result = await supabase.from('routine_sets').upsert(routineSets); ensure(result.error); }
  }

  if (data.history.length) {
    const workoutsResult = await supabase.from('workouts').upsert(data.history.map(workout => ({ id: workout.id, user_id: userId, routine_id: null, routine_name: workout.routineName, effort_mode: workout.effortMode, notes: workout.notes || null, started_at: new Date(new Date(workout.date).getTime() - workout.durationSeconds * 1000).toISOString(), completed_at: workout.date, duration_seconds: workout.durationSeconds, total_volume: workout.totalVolume, sets_completed: workout.setsCompleted })));
    ensure(workoutsResult.error);
    const workoutExercises = data.history.flatMap(workout => workout.exercises.map((exercise, position) => ({ id: exercise.id, user_id: userId, workout_id: workout.id, exercise_id: exercise.exerciseId, exercise_name: exercise.name, muscle: exercise.muscle, notes: exercise.notes || null, position })));
    if (workoutExercises.length) { const result = await supabase.from('workout_exercises').upsert(workoutExercises); ensure(result.error); }
    const workoutSets = data.history.flatMap(workout => workout.exercises.flatMap(exercise => exercise.sets.map((set, position) => ({ id: set.id, user_id: userId, workout_exercise_id: exercise.id, position, set_type: set.type, weight: Number(set.weight) || 0, reps: Number(set.reps) || 0, target_reps_min: set.targetRepsMin, target_reps_max: set.targetRepsMax, rpe: optionalEffort(set.rpe, 1), rir: optionalEffort(set.rir, 0), completed: set.completed, completed_at: set.completedAt ?? null }))));
    if (workoutSets.length) { const result = await supabase.from('workout_sets').upsert(workoutSets); ensure(result.error); }
  }

  if (data.tombstones.length) {
    const tombstonesResult = await supabase.from('deletion_tombstones').upsert(data.tombstones.map(item => ({ user_id: userId, entity_type: item.entityType, record_id: item.recordId, deleted_at: item.deletedAt })), { onConflict: 'user_id,entity_type,record_id' });
    ensure(tombstonesResult.error);
  }

  return 'synced';
}
