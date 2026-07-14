import { ActiveExercise, ActiveSet, PersistedData, Profile, Routine, RoutineExercise, RoutineSet, SetType, WorkoutHistory } from '@/src/domain/types';
import { supabase } from '@/src/lib/supabase';
import { mergePersistedData, withoutDeletedRoutines } from '@/src/services/syncMerge';

type PullResult = { status: 'no-session' } | { status: 'pulled'; data: PersistedData };
export type PushResult = 'no-session' | 'pull-required' | 'synced';

type RemoteProfile = { body_weight: number | string | null; height_cm: number | null; goal: string; level: string; default_rest_seconds: number; updated_at: string };
type RemoteExercise = { id: string; name: string; muscle: string };
type RemoteRoutine = { id: string; name: string; training_day: number; created_at: string; updated_at: string };
type RemoteRoutineExercise = { id: string; routine_id: string; exercise_id: string; position: number };
type RemoteRoutineSet = { id: string; routine_exercise_id: string; position: number; set_type: string; weight: number | string; reps: number; rpe: number | string | null };
type RemoteWorkout = { id: string; routine_name: string; completed_at: string; duration_seconds: number; total_volume: number | string; sets_completed: number };
type RemoteWorkoutExercise = { id: string; workout_id: string; exercise_id: string; exercise_name: string; muscle: string; position: number };
type RemoteWorkoutSet = { id: string; workout_exercise_id: string; position: number; set_type: string; weight: number | string; reps: number; rpe: number | string | null; completed: boolean; completed_at: string | null };
type RemoteTombstone = { entity_type: string; record_id: string; deleted_at: string };

const pulledUsers = new Set<string>();

function ensure(error: { message: string } | null) { if (error) throw new Error(error.message); }
function setType(value: string): SetType { return value === 'warmup' ? 'warmup' : 'working'; }
function rows<T>(value: unknown): T[] { return (value ?? []) as T[]; }

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
    supabase.from('profiles').select('body_weight,height_cm,goal,level,default_rest_seconds,updated_at').eq('id', userId).maybeSingle(),
    supabase.from('exercises').select('id,name,muscle'),
    supabase.from('routines').select('id,name,training_day,created_at,updated_at').eq('user_id', userId).order('training_day'),
    supabase.from('routine_exercises').select('id,routine_id,exercise_id,position').eq('user_id', userId).order('position'),
    supabase.from('routine_sets').select('id,routine_exercise_id,position,set_type,weight,reps,rpe').eq('user_id', userId).order('position'),
    supabase.from('workouts').select('id,routine_name,completed_at,duration_seconds,total_volume,sets_completed').eq('user_id', userId).order('completed_at', { ascending: false }),
    supabase.from('workout_exercises').select('id,workout_id,exercise_id,exercise_name,muscle,position').eq('user_id', userId).order('position'),
    supabase.from('workout_sets').select('id,workout_exercise_id,position,set_type,weight,reps,rpe,completed,completed_at').eq('user_id', userId).order('position'),
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
          reps: set.reps,
          rpe: set.rpe == null ? undefined : Number(set.rpe),
        })),
      };
    }),
  }));

  const workoutExerciseRows = rows<RemoteWorkoutExercise>(workoutExercisesResult.data);
  const workoutSetRows = rows<RemoteWorkoutSet>(workoutSetsResult.data);
  const remoteHistory: WorkoutHistory[] = rows<RemoteWorkout>(workoutsResult.data).map(workout => ({
    id: workout.id,
    routineName: workout.routine_name,
    date: workout.completed_at,
    durationSeconds: workout.duration_seconds,
    totalVolume: Number(workout.total_volume) || 0,
    setsCompleted: workout.sets_completed,
    exercises: workoutExerciseRows.filter(item => item.workout_id === workout.id).sort((a, b) => a.position - b.position).map((item): ActiveExercise => ({
      id: item.id,
      exerciseId: item.exercise_id,
      name: item.exercise_name,
      muscle: item.muscle,
      sets: workoutSetRows.filter(set => set.workout_exercise_id === item.id).sort((a, b) => a.position - b.position).map((set): ActiveSet => ({
        id: set.id,
        type: setType(set.set_type),
        weight: String(set.weight),
        reps: String(set.reps),
        rpe: set.rpe == null ? '' : String(set.rpe),
        completed: set.completed,
        completedAt: set.completed_at ?? undefined,
      })),
    })),
  }));

  const profileRow = profileResult.data as RemoteProfile | null;
  const remoteProfile: Profile = profileRow ? {
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
  const merged = mergePersistedData(localData, remoteData, options.includeLocalData);
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
    body_weight: Number(data.profile.bodyWeight) || null,
    height_cm: Number(data.profile.height) || null,
    goal: data.profile.goal,
    level: data.profile.level,
    default_rest_seconds: data.profile.defaultRestSeconds,
    updated_at: data.profile.updatedAt,
  });
  ensure(profileResult.error);

  if (liveRoutines.length) {
    const routinesResult = await supabase.from('routines').upsert(liveRoutines.map(routine => ({ id:routine.id, user_id:userId, name:routine.name, training_day:routine.day, created_at:routine.createdAt, updated_at:routine.updatedAt })));
    ensure(routinesResult.error);
    const routineExercises = liveRoutines.flatMap(routine => routine.exercises.map((exercise, position) => ({ id:exercise.id, user_id:userId, routine_id:routine.id, exercise_id:exercise.exerciseId, position })));
    if (routineExercises.length) { const result = await supabase.from('routine_exercises').upsert(routineExercises); ensure(result.error); }
    const routineSets = liveRoutines.flatMap(routine => routine.exercises.flatMap(exercise => exercise.sets.map((set, position) => ({ id:set.id, user_id:userId, routine_exercise_id:exercise.id, position, set_type:set.type, weight:set.weight, reps:set.reps, rpe:set.rpe ?? null }))));
    if (routineSets.length) { const result = await supabase.from('routine_sets').upsert(routineSets); ensure(result.error); }
  }

  if (data.history.length) {
    const workoutsResult = await supabase.from('workouts').upsert(data.history.map(workout => ({ id:workout.id, user_id:userId, routine_id:null, routine_name:workout.routineName, started_at:new Date(new Date(workout.date).getTime() - workout.durationSeconds * 1000).toISOString(), completed_at:workout.date, duration_seconds:workout.durationSeconds, total_volume:workout.totalVolume, sets_completed:workout.setsCompleted })));
    ensure(workoutsResult.error);
    const workoutExercises = data.history.flatMap(workout => workout.exercises.map((exercise, position) => ({ id:exercise.id, user_id:userId, workout_id:workout.id, exercise_id:exercise.exerciseId, exercise_name:exercise.name, muscle:exercise.muscle, position })));
    if (workoutExercises.length) { const result = await supabase.from('workout_exercises').upsert(workoutExercises); ensure(result.error); }
    const workoutSets = data.history.flatMap(workout => workout.exercises.flatMap(exercise => exercise.sets.map((set, position) => ({ id:set.id, user_id:userId, workout_exercise_id:exercise.id, position, set_type:set.type, weight:Number(set.weight) || 0, reps:Number(set.reps) || 0, rpe:Number(set.rpe) || null, completed:set.completed, completed_at:set.completedAt ?? null }))));
    if (workoutSets.length) { const result = await supabase.from('workout_sets').upsert(workoutSets); ensure(result.error); }
  }

  if (data.tombstones.length) {
    const tombstonesResult = await supabase.from('deletion_tombstones').upsert(data.tombstones.map(item => ({ user_id:userId, entity_type:item.entityType, record_id:item.recordId, deleted_at:item.deletedAt })), { onConflict: 'user_id,entity_type,record_id' });
    ensure(tombstonesResult.error);
  }

  return 'synced';
}
