import { PersistedData } from '@/src/domain/types';
import { supabase } from '@/src/lib/supabase';

function ensure(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function syncDataToCloud(data: PersistedData): Promise<'no-session' | 'synced'> {
  if (!supabase) return 'no-session';
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  ensure(sessionError);
  const userId = sessionData.session?.user.id;
  if (!userId) return 'no-session';

  const profileResult = await supabase.from('profiles').upsert({
    id: userId,
    body_weight: Number(data.profile.bodyWeight) || null,
    height_cm: Number(data.profile.height) || null,
    goal: data.profile.goal,
    level: data.profile.level,
    default_rest_seconds: data.profile.defaultRestSeconds,
  });
  ensure(profileResult.error);

  const remoteRoutinesResult = await supabase.from('routines').select('id');
  ensure(remoteRoutinesResult.error);
  const localRoutineIds = new Set(data.routines.map(routine => routine.id));
  const staleRoutineIds = (remoteRoutinesResult.data ?? []).map(item => item.id as string).filter(id => !localRoutineIds.has(id));
  if (staleRoutineIds.length) {
    const deletion = await supabase.from('routines').delete().in('id', staleRoutineIds);
    ensure(deletion.error);
  }

  if (data.routines.length) {
    const routinesResult = await supabase.from('routines').upsert(data.routines.map(routine => ({ id:routine.id, user_id:userId, name:routine.name, training_day:routine.day, created_at:routine.createdAt, updated_at:routine.updatedAt })));
    ensure(routinesResult.error);
    const routineExercises = data.routines.flatMap(routine => routine.exercises.map((exercise, position) => ({ id:exercise.id, user_id:userId, routine_id:routine.id, exercise_id:exercise.exerciseId, position })));
    if (routineExercises.length) { const result = await supabase.from('routine_exercises').upsert(routineExercises); ensure(result.error); }
    const routineSets = data.routines.flatMap(routine => routine.exercises.flatMap(exercise => exercise.sets.map((set, position) => ({ id:set.id, user_id:userId, routine_exercise_id:exercise.id, position, set_type:set.type, weight:set.weight, reps:set.reps, rpe:set.rpe ?? null }))));
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

  return 'synced';
}
