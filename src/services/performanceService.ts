import { estimatePerformedSet, EstimateConfidence } from '@/src/domain/prFormulas';
import { SessionExposure } from '@/src/domain/performance';
import { MovementFamily } from '@/src/domain/types';
import { supabase } from '@/src/lib/supabase';

type WorkoutRow = { id: string; block_id: string | null; block_week_id: string | null; completed_at: string };
type WorkoutExerciseRow = { id: string; workout_id: string; exercise_id: string; exercise_name: string };
type WorkoutSetRow = {
  workout_exercise_id: string;
  set_type: string;
  weight: number | string;
  reps: number;
  actual_rpe: number | string | null;
  actual_rir: number | string | null;
  rpe: number | string | null;
  rir: number | string | null;
  completed: boolean;
  estimated_1rm: number | string | null;
  estimate_confidence: EstimateConfidence | null;
};
type ExerciseRow = { id: string; name: string; movement_family: MovementFamily | null };
type BlockRow = { id: string; name: string };
type WeekRow = { id: string; block_id: string; name: string; week_number: number; is_warmup: boolean };

function optionalNumber(value: number | string | null, minimum: number) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= 10 ? parsed : null;
}

export async function getAthletePerformanceExposures(athleteId: string): Promise<SessionExposure[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const workoutsResult = await supabase.from('workouts')
    .select('id,block_id,block_week_id,completed_at')
    .eq('user_id', athleteId)
    .order('completed_at');
  if (workoutsResult.error) throw workoutsResult.error;
  const workouts = (workoutsResult.data ?? []) as WorkoutRow[];
  if (!workouts.length) return [];

  const workoutIds = workouts.map(workout => workout.id);
  const workoutExercisesResult = await supabase.from('workout_exercises')
    .select('id,workout_id,exercise_id,exercise_name')
    .eq('user_id', athleteId)
    .in('workout_id', workoutIds);
  if (workoutExercisesResult.error) throw workoutExercisesResult.error;
  const workoutExercises = (workoutExercisesResult.data ?? []) as WorkoutExerciseRow[];
  const workoutExerciseIds = workoutExercises.map(exercise => exercise.id);

  const blockIds = [...new Set(workouts.flatMap(workout => workout.block_id ? [workout.block_id] : []))];
  const [setsResult, exercisesResult, blocksResult, weeksResult] = await Promise.all([
    workoutExerciseIds.length
      ? supabase.from('workout_sets')
        .select('workout_exercise_id,set_type,weight,reps,actual_rpe,actual_rir,rpe,rir,completed,estimated_1rm,estimate_confidence')
        .eq('user_id', athleteId)
        .in('workout_exercise_id', workoutExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('exercises').select('id,name,movement_family'),
    blockIds.length
      ? supabase.from('coach_blocks').select('id,name').in('id', blockIds)
      : Promise.resolve({ data: [], error: null }),
    blockIds.length
      ? supabase.from('coach_block_weeks').select('id,block_id,name,week_number,is_warmup').in('block_id', blockIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (setsResult.error) throw setsResult.error;
  if (exercisesResult.error) throw exercisesResult.error;
  if (blocksResult.error) throw blocksResult.error;
  if (weeksResult.error) throw weeksResult.error;

  const sets = (setsResult.data ?? []) as WorkoutSetRow[];
  const exercises = new Map(((exercisesResult.data ?? []) as ExerciseRow[]).map(item => [item.id, item]));
  const blocks = new Map(((blocksResult.data ?? []) as BlockRow[]).map(item => [item.id, item]));
  const weeks = new Map(((weeksResult.data ?? []) as WeekRow[]).filter(item => !item.is_warmup).map(item => [item.id, item]));

  return workoutExercises.flatMap(performedExercise => {
    const workout = workouts.find(item => item.id === performedExercise.workout_id);
    if (!workout) return [];
    const valid = sets.filter(set => set.workout_exercise_id === performedExercise.id && set.completed && set.set_type === 'working').flatMap(set => {
      if (set.estimated_1rm != null) {
        return [{ value: Number(set.estimated_1rm), confidence: set.estimate_confidence ?? 'medium' as EstimateConfidence }];
      }
      const estimate = estimatePerformedSet(
        Number(set.weight),
        Number(set.reps),
        optionalNumber(set.actual_rpe ?? set.rpe, 1),
        optionalNumber(set.actual_rir ?? set.rir, 0),
      );
      return estimate ? [{ value: estimate.value, confidence: estimate.confidence }] : [];
    });
    if (!valid.length) return [];
    const best = valid.reduce((winner, candidate) => candidate.value > winner.value ? candidate : winner);
    const week = workout.block_week_id ? weeks.get(workout.block_week_id) : undefined;
    const block = workout.block_id ? blocks.get(workout.block_id) : undefined;
    const catalog = exercises.get(performedExercise.exercise_id);
    return [{
      sessionId: workout.id,
      date: workout.completed_at,
      exerciseId: performedExercise.exercise_id,
      exerciseName: catalog?.name ?? performedExercise.exercise_name,
      family: catalog?.movement_family ?? null,
      mesocycleId: workout.block_id,
      mesocycleName: block?.name ?? 'Historial',
      microcycleId: week?.id ?? workout.block_week_id ?? workout.id,
      microcycleName: week?.name ?? new Date(workout.completed_at).toLocaleDateString('es-CL'),
      microcycleOrder: week?.week_number ?? new Date(workout.completed_at).getTime(),
      bestE1rm: best.value,
      confidence: best.confidence,
    }];
  }).sort((a, b) => a.microcycleOrder - b.microcycleOrder || a.date.localeCompare(b.date));
}
