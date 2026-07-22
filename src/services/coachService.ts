import { EffortMode, makeId } from '@/src/domain/types';
import { supabase } from '@/src/lib/supabase';

export type MyRoleInfo = { role: string | null; coachId: string | null };
export type CoachAthlete = { athleteId: string; email: string; displayName: string | null; bodyWeight: number | null; heightCm: number | null; goal: string | null; level: string | null };
export type CoachRoutineSummary = { id: string; name: string; day: number; effortMode: string; exerciseCount: number; setCount: number };
export type CoachWorkoutSummary = { id: string; routineName: string; effortMode: string; date: string; durationSeconds: number; totalVolume: number; setsCompleted: number; exerciseNames: string[] };
export type CoachComment = { id: string; text: string; createdAt: string; routineId: string | null; workoutId: string | null };

export type BlockDraftSet = { weight: number; repsMin: number; repsMax: number; rpe: number | null; rir: number | null };
export type BlockDraftExercise = { exerciseId: string; sets: BlockDraftSet[] };
export type BlockDraftDay = { name: string; trainingDay: number; effortMode: EffortMode; exercises: BlockDraftExercise[] };

type RemoteAthleteRow = { athlete_id: string; email: string; display_name: string | null; body_weight: number | string | null; height_cm: number | string | null; goal: string | null; level: string | null };
type RemoteRoutineSetRow = { id: string };
type RemoteRoutineExerciseRow = { id: string; routine_sets: RemoteRoutineSetRow[] | null };
type RemoteRoutineRow = { id: string; name: string; training_day: number; effort_mode: string; routine_exercises: RemoteRoutineExerciseRow[] | null };
type RemoteWorkoutExerciseRow = { exercise_name: string };
type RemoteWorkoutRow = { id: string; routine_name: string; effort_mode: string; completed_at: string; duration_seconds: number; total_volume: number | string; sets_completed: number; workout_exercises: RemoteWorkoutExerciseRow[] | null };
type RemoteCommentRow = { id: string; text: string; created_at: string; routine_id: string | null; workout_id: string | null };

async function currentUserId() {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('No hay una sesión activa.');
  return userId;
}

export async function getMyRole(): Promise<MyRoleInfo> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const userId = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('role,coach_id').eq('id', userId).maybeSingle();
  if (error) throw error;
  return { role: data?.role ?? null, coachId: data?.coach_id ?? null };
}

export async function generateInviteCode(): Promise<string> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const userId = await currentUserId();
  const { data, error } = await supabase.from('coach_invite_codes').insert({ coach_id: userId }).select('code').single();
  if (error) throw error;
  return data.code as string;
}

export async function redeemCoachCode(code: string) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { error } = await supabase.rpc('redeem_coach_code', { code });
  if (error) throw error;
}

export async function getMyAthletes(): Promise<CoachAthlete[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase.rpc('get_my_athletes');
  if (error) throw error;
  return ((data ?? []) as RemoteAthleteRow[]).map(row => ({
    athleteId: row.athlete_id,
    email: row.email,
    displayName: row.display_name && row.display_name.trim() ? row.display_name : null,
    bodyWeight: row.body_weight == null ? null : Number(row.body_weight),
    heightCm: row.height_cm == null ? null : Number(row.height_cm),
    goal: row.goal,
    level: row.level,
  }));
}

export async function getAthleteRoutines(athleteId: string): Promise<CoachRoutineSummary[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase
    .from('routines')
    .select('id,name,training_day,effort_mode,routine_exercises(id,routine_sets(id))')
    .eq('user_id', athleteId)
    .order('training_day');
  if (error) throw error;
  return ((data ?? []) as unknown as RemoteRoutineRow[]).map(routine => {
    const routineExercises = routine.routine_exercises ?? [];
    return {
      id: routine.id,
      name: routine.name,
      day: routine.training_day,
      effortMode: routine.effort_mode,
      exerciseCount: routineExercises.length,
      setCount: routineExercises.reduce((sum, exercise) => sum + (exercise.routine_sets?.length ?? 0), 0),
    };
  });
}

export async function getAthleteWorkouts(athleteId: string, limit = 10): Promise<CoachWorkoutSummary[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase
    .from('workouts')
    .select('id,routine_name,effort_mode,completed_at,duration_seconds,total_volume,sets_completed,workout_exercises(exercise_name)')
    .eq('user_id', athleteId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as RemoteWorkoutRow[]).map(workout => ({
    id: workout.id,
    routineName: workout.routine_name,
    effortMode: workout.effort_mode,
    date: workout.completed_at,
    durationSeconds: workout.duration_seconds,
    totalVolume: Number(workout.total_volume) || 0,
    setsCompleted: workout.sets_completed,
    exerciseNames: (workout.workout_exercises ?? []).map(item => item.exercise_name),
  }));
}

export async function getComments(athleteId: string): Promise<CoachComment[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase
    .from('coach_comments')
    .select('id,text,created_at,routine_id,workout_id')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RemoteCommentRow[]).map(row => ({
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    routineId: row.routine_id,
    workoutId: row.workout_id,
  }));
}

export async function addComment(athleteId: string, text: string, routineId?: string, workoutId?: string) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const coachId = await currentUserId();
  const { error } = await supabase.from('coach_comments').insert({
    athlete_id: athleteId,
    coach_id: coachId,
    text,
    routine_id: routineId ?? null,
    workout_id: workoutId ?? null,
  });
  if (error) throw error;
}

export async function createAthleteBlock(athleteId: string, days: BlockDraftDay[]) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  if (!days.length) return;
  const timestamp = new Date().toISOString();

  const routineRows = days.map(day => ({
    id: makeId('routine'),
    user_id: athleteId,
    name: day.name,
    training_day: day.trainingDay,
    effort_mode: day.effortMode,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  const routinesResult = await supabase.from('routines').insert(routineRows);
  if (routinesResult.error) throw routinesResult.error;

  const routineExercisePlans = days.flatMap((day, dayIndex) => day.exercises.map((exercise, position) => ({
    id: makeId('re'),
    routineId: routineRows[dayIndex].id,
    exercise,
    position,
  })));

  if (routineExercisePlans.length) {
    const result = await supabase.from('routine_exercises').insert(routineExercisePlans.map(plan => ({
      id: plan.id,
      user_id: athleteId,
      routine_id: plan.routineId,
      exercise_id: plan.exercise.exerciseId,
      position: plan.position,
    })));
    if (result.error) throw result.error;
  }

  const routineSetRows = routineExercisePlans.flatMap(plan => plan.exercise.sets.map((set, position) => ({
    id: makeId('rs'),
    user_id: athleteId,
    routine_exercise_id: plan.id,
    position,
    set_type: 'working',
    weight: set.weight,
    reps: set.repsMin,
    reps_min: set.repsMin,
    reps_max: set.repsMax,
    rpe: set.rpe,
    rir: set.rir,
  })));
  if (routineSetRows.length) {
    const result = await supabase.from('routine_sets').insert(routineSetRows);
    if (result.error) throw result.error;
  }
}
