import { EffortMode, makeId } from '@/src/domain/types';
import { supabase } from '@/src/lib/supabase';
import { ProgramStatus, ProgramWeekType } from '@/src/services/athleteBlockService';

export type MyRoleInfo = { role: string | null; coachId: string | null };
export type CoachAthlete = { athleteId: string; email: string; displayName: string | null; bodyWeight: number | null; heightCm: number | null; goal: string | null; level: string | null };
export type CoachRoutineSummary = { id: string; name: string; day: number; effortMode: string; exerciseCount: number; setCount: number };
export type CoachWorkoutSummary = { id: string; routineName: string; effortMode: string; date: string; durationSeconds: number; totalVolume: number; setsCompleted: number; exerciseNames: string[] };
export type CoachComment = { id: string; text: string; createdAt: string; routineId: string | null; workoutId: string | null };

export type BlockDraftSet = { id?: string; weight: number; repsMin: number; repsMax: number; rpe: number | null; rir: number | null };
export type BlockDraftExercise = { id?: string; exerciseId: string; sets: BlockDraftSet[] };
export type BlockDraftDay = { id?: string; name: string; trainingDay: number; effortMode: EffortMode; prescriptionNotes?: string | null; status?: 'draft' | 'published'; exercises: BlockDraftExercise[] };
export type BlockDraftWeek = { id?: string; name: string; weekNumber: number; isWarmup: boolean; weekType?: ProgramWeekType; status?: ProgramStatus; startDateOverride?: string | null; days: BlockDraftDay[] };
export type BlockDraftInfo = { id?: string; name: string; goalText: string | null; startDate: string | null; totalWeeks: number; status?: ProgramStatus; currentWeekNumber?: number };

export type CoachProgramDay = CoachRoutineSummary & { blockWeekId: string; status: string; prescriptionNotes: string | null; archivedAt: string | null };
export type CoachProgramWeek = { id: string; blockId: string; name: string; weekNumber: number; weekType: ProgramWeekType; status: ProgramStatus; startDateOverride: string | null; archivedAt: string | null; days: CoachProgramDay[] };
export type CoachProgramBlock = { id: string; name: string; goalText: string | null; startDate: string | null; totalWeeks: number; currentWeekNumber: number; status: ProgramStatus; createdAt: string; archivedAt: string | null; weeks: CoachProgramWeek[] };

type RemoteAthleteRow = { athlete_id: string; email: string; display_name: string | null; body_weight: number | string | null; height_cm: number | string | null; goal: string | null; level: string | null };
type RemoteRoutineSetRow = { id: string };
type RemoteRoutineExerciseRow = { id: string; routine_sets: RemoteRoutineSetRow[] | null };
type RemoteRoutineRow = { id: string; name: string; training_day: number; effort_mode: string; routine_exercises: RemoteRoutineExerciseRow[] | null };
type RemoteWorkoutExerciseRow = { exercise_name: string };
type RemoteWorkoutRow = { id: string; routine_name: string; effort_mode: string; completed_at: string; duration_seconds: number; total_volume: number | string; sets_completed: number; workout_exercises: RemoteWorkoutExerciseRow[] | null };
type RemoteCommentRow = { id: string; comment: string; created_at: string; routine_id: string | null; workout_id: string | null };

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
    .select('id,comment,created_at,routine_id,workout_id')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RemoteCommentRow[]).map(row => ({
    id: row.id,
    text: row.comment,
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
    comment: text,
    routine_id: routineId ?? null,
    workout_id: workoutId ?? null,
  });
  if (error) throw error;
}

export async function createAthleteBlock(athleteId: string, info: BlockDraftInfo, weeks: BlockDraftWeek[]) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const populatedWeeks = weeks.filter(week => week.days.length > 0);
  if (!populatedWeeks.length) return;
  const timestamp = new Date().toISOString();
  const coachId = await currentUserId();

  const blockId = makeId('block');
  const blockResult = await supabase.from('coach_blocks').insert({
    id: blockId,
    coach_id: coachId,
    athlete_id: athleteId,
    name: info.name,
    goal_text: info.goalText,
    start_date: info.startDate,
    total_weeks: info.totalWeeks,
  });
  if (blockResult.error) throw blockResult.error;

  const weekPlans = populatedWeeks.map(week => ({ id: makeId('block-week'), week }));
  const weeksResult = await supabase.from('coach_block_weeks').insert(weekPlans.map(plan => ({
    id: plan.id,
    block_id: blockId,
    week_number: plan.week.weekNumber,
    name: plan.week.name,
    is_warmup: plan.week.isWarmup,
  })));
  if (weeksResult.error) throw weeksResult.error;

  const routinePlans = weekPlans.flatMap(weekPlan => weekPlan.week.days.map(day => ({
    id: makeId('routine'),
    weekId: weekPlan.id,
    day,
  })));
  const routinesResult = await supabase.from('routines').insert(routinePlans.map(plan => ({
    id: plan.id,
    user_id: athleteId,
    block_week_id: plan.weekId,
    name: plan.day.name,
    training_day: plan.day.trainingDay,
    effort_mode: plan.day.effortMode,
    created_at: timestamp,
    updated_at: timestamp,
  })));
  if (routinesResult.error) throw routinesResult.error;

  const routineExercisePlans = routinePlans.flatMap(plan => plan.day.exercises.map((exercise, position) => ({
    id: makeId('re'),
    routineId: plan.id,
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

type RemoteProgramBlockRow = { id: string; name: string; goal_text: string | null; start_date: string | null; total_weeks: number; current_week_number: number; status: ProgramStatus; created_at: string; archived_at: string | null };
type RemoteProgramWeekRow = { id: string; block_id: string; name: string; week_number: number; week_type: ProgramWeekType; status: ProgramStatus; start_date_override: string | null; archived_at: string | null; is_warmup: boolean };
type RemoteProgramDayRow = RemoteRoutineRow & { block_week_id: string; status: string; prescription_notes: string | null; archived_at: string | null; effort_mode: string };
type RemoteDraftExerciseRow = { id: string; routine_id: string; exercise_id: string; position: number };
type RemoteDraftSetRow = { id: string; routine_exercise_id: string; position: number; weight: number | string; reps_min: number; reps_max: number; rpe: number | string | null; rir: number | string | null };

export async function getAthleteProgramTree(athleteId: string): Promise<CoachProgramBlock[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const blocksResult = await supabase.from('coach_blocks').select('id,name,goal_text,start_date,total_weeks,current_week_number,status,created_at,archived_at').eq('athlete_id', athleteId).order('created_at', { ascending: false });
  if (blocksResult.error) throw blocksResult.error;
  const blocks = (blocksResult.data ?? []) as RemoteProgramBlockRow[];
  if (!blocks.length) return [];
  const blockIds = blocks.map(block => block.id);
  const weeksResult = await supabase.from('coach_block_weeks').select('id,block_id,name,week_number,week_type,status,start_date_override,archived_at,is_warmup').in('block_id', blockIds).order('week_number');
  if (weeksResult.error) throw weeksResult.error;
  const weeks = (weeksResult.data ?? []) as RemoteProgramWeekRow[];
  const weekIds = weeks.map(week => week.id);
  const daysResult = weekIds.length
    ? await supabase.from('routines').select('id,name,training_day,effort_mode,block_week_id,status,prescription_notes,archived_at,routine_exercises(id,routine_sets(id))').eq('user_id', athleteId).in('block_week_id', weekIds).order('training_day')
    : { data: [], error: null };
  if (daysResult.error) throw daysResult.error;
  const days = (daysResult.data ?? []) as unknown as RemoteProgramDayRow[];
  return blocks.map(block => ({
    id: block.id,
    name: block.name,
    goalText: block.goal_text,
    startDate: block.start_date,
    totalWeeks: block.total_weeks,
    currentWeekNumber: block.current_week_number,
    status: block.status,
    createdAt: block.created_at,
    archivedAt: block.archived_at,
    weeks: weeks.filter(week => week.block_id === block.id).sort((a, b) => a.week_number - b.week_number).map(week => ({
      id: week.id,
      blockId: week.block_id,
      name: week.name,
      weekNumber: week.week_number,
      weekType: week.week_type,
      status: week.status,
      startDateOverride: week.start_date_override,
      archivedAt: week.archived_at,
      days: days.filter(day => day.block_week_id === week.id).sort((a, b) => a.training_day - b.training_day).map(day => {
        const routineExercises = day.routine_exercises ?? [];
        return {
          id: day.id,
          name: day.name,
          day: day.training_day,
          effortMode: day.effort_mode,
          exerciseCount: routineExercises.length,
          setCount: routineExercises.reduce((sum, exercise) => sum + (exercise.routine_sets?.length ?? 0), 0),
          blockWeekId: day.block_week_id,
          status: day.status,
          prescriptionNotes: day.prescription_notes,
          archivedAt: day.archived_at,
        };
      }),
    })),
  }));
}

export async function getCoachBlockDraft(blockId: string): Promise<{ info: BlockDraftInfo; weeks: BlockDraftWeek[] }> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const blockResult = await supabase.from('coach_blocks').select('id,name,goal_text,start_date,total_weeks,current_week_number,status,created_at,archived_at').eq('id', blockId).single();
  if (blockResult.error) throw blockResult.error;
  const block = blockResult.data as RemoteProgramBlockRow;
  const weeksResult = await supabase.from('coach_block_weeks').select('id,block_id,name,week_number,week_type,status,start_date_override,archived_at,is_warmup').eq('block_id', blockId).is('archived_at', null).order('week_number');
  if (weeksResult.error) throw weeksResult.error;
  const weeks = (weeksResult.data ?? []) as RemoteProgramWeekRow[];
  const weekIds = weeks.map(week => week.id);
  const daysResult = weekIds.length
    ? await supabase.from('routines').select('id,name,training_day,effort_mode,block_week_id,status,prescription_notes,archived_at').in('block_week_id', weekIds).is('archived_at', null).order('training_day')
    : { data: [], error: null };
  if (daysResult.error) throw daysResult.error;
  const days = (daysResult.data ?? []) as Omit<RemoteProgramDayRow, 'routine_exercises'>[];
  const dayIds = days.map(day => day.id);
  const exercisesResult = dayIds.length
    ? await supabase.from('routine_exercises').select('id,routine_id,exercise_id,position').in('routine_id', dayIds).order('position')
    : { data: [], error: null };
  if (exercisesResult.error) throw exercisesResult.error;
  const exercises = (exercisesResult.data ?? []) as RemoteDraftExerciseRow[];
  const exerciseIds = exercises.map(exercise => exercise.id);
  const setsResult = exerciseIds.length
    ? await supabase.from('routine_sets').select('id,routine_exercise_id,position,weight,reps_min,reps_max,rpe,rir').in('routine_exercise_id', exerciseIds).order('position')
    : { data: [], error: null };
  if (setsResult.error) throw setsResult.error;
  const sets = (setsResult.data ?? []) as RemoteDraftSetRow[];
  return {
    info: { id: block.id, name: block.name, goalText: block.goal_text, startDate: block.start_date, totalWeeks: block.total_weeks, status: block.status, currentWeekNumber: block.current_week_number },
    weeks: weeks.map(week => ({
      id: week.id,
      name: week.name,
      weekNumber: week.week_number,
      isWarmup: week.is_warmup,
      weekType: week.week_type,
      status: week.status,
      startDateOverride: week.start_date_override,
      days: days.filter(day => day.block_week_id === week.id).map(day => ({
        id: day.id,
        name: day.name,
        trainingDay: day.training_day,
        effortMode: ['rpe', 'rir', 'both', 'none'].includes(day.effort_mode) ? day.effort_mode as EffortMode : 'rpe',
        prescriptionNotes: day.prescription_notes,
        status: day.status === 'draft' ? 'draft' : 'published',
        exercises: exercises.filter(exercise => exercise.routine_id === day.id).map(exercise => ({
          id: exercise.id,
          exerciseId: exercise.exercise_id,
          sets: sets.filter(set => set.routine_exercise_id === exercise.id).map(set => ({ id: set.id, weight: Number(set.weight) || 0, repsMin: set.reps_min, repsMax: set.reps_max, rpe: set.rpe == null ? null : Number(set.rpe), rir: set.rir == null ? null : Number(set.rir) })),
        })),
      })),
    })),
  };
}

export async function saveAthleteBlock(athleteId: string, info: BlockDraftInfo, weeks: BlockDraftWeek[]) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const timestamp = new Date().toISOString();
  const coachId = await currentUserId();
  const blockId = info.id ?? makeId('block');
  const status = info.status ?? (info.startDate ? 'published' : 'draft');
  const trainingWeeks = weeks.filter(week => !week.isWarmup);
  const blockInsertRow = {
    id: blockId,
    coach_id: coachId,
    athlete_id: athleteId,
    name: info.name.trim(),
    goal_text: info.goalText,
    start_date: info.startDate,
    total_weeks: Math.max(1, trainingWeeks.length || info.totalWeeks),
    status,
    current_week_number: info.currentWeekNumber ?? trainingWeeks[0]?.weekNumber ?? 1,
    published_at: timestamp,
  };
  const blockResult = info.id
    ? await supabase.from('coach_blocks').update({
      name: blockInsertRow.name,
      goal_text: blockInsertRow.goal_text,
      start_date: blockInsertRow.start_date,
      total_weeks: blockInsertRow.total_weeks,
      status: blockInsertRow.status,
      current_week_number: blockInsertRow.current_week_number,
      published_at: blockInsertRow.published_at,
    }).eq('id', blockId)
    : await supabase.from('coach_blocks').insert(blockInsertRow);
  if (blockResult.error) throw blockResult.error;

  const existingWeeksResult = await supabase.from('coach_block_weeks').select('id').eq('block_id', blockId).is('archived_at', null);
  if (existingWeeksResult.error) throw existingWeeksResult.error;
  const existingWeekIds = ((existingWeeksResult.data ?? []) as { id: string }[]).map(item => item.id);
  const existingWeekIdSet = new Set(existingWeekIds);
  const weekPlans = weeks.map(week => ({ id: week.id ?? makeId('block-week'), week }));
  for (const plan of weekPlans) {
    const editableWeek = {
      week_number: plan.week.weekNumber,
      name: plan.week.name.trim(),
      is_warmup: plan.week.isWarmup,
      week_type: plan.week.weekType ?? (plan.week.isWarmup ? 'activation' : 'training'),
      status: plan.week.status ?? 'published',
      start_date_override: plan.week.startDateOverride ?? null,
      published_at: timestamp,
      archived_at: null,
    };
    const result = existingWeekIdSet.has(plan.id)
      ? await supabase.from('coach_block_weeks').update(editableWeek).eq('id', plan.id)
      : await supabase.from('coach_block_weeks').insert({ id: plan.id, block_id: blockId, ...editableWeek });
    if (result.error) throw result.error;
  }

  const keptWeekIds = new Set(weekPlans.map(plan => plan.id));
  const removedWeekIds = existingWeekIds.filter(id => !keptWeekIds.has(id));
  if (removedWeekIds.length) {
    const routineArchive = await supabase.from('routines').update({ status: 'archived', archived_at: timestamp }).in('block_week_id', removedWeekIds);
    if (routineArchive.error) throw routineArchive.error;
    const weekArchive = await supabase.from('coach_block_weeks').update({ status: 'archived', archived_at: timestamp }).in('id', removedWeekIds);
    if (weekArchive.error) throw weekArchive.error;
  }

  const allKnownWeekIds = [...new Set([...existingWeekIds, ...weekPlans.map(plan => plan.id)])];
  const existingRoutinesResult = allKnownWeekIds.length
    ? await supabase.from('routines').select('id,block_week_id').in('block_week_id', allKnownWeekIds).is('archived_at', null)
    : { data: [], error: null };
  if (existingRoutinesResult.error) throw existingRoutinesResult.error;
  const existingRoutines = (existingRoutinesResult.data ?? []) as { id: string; block_week_id: string }[];
  const routinePlans = weekPlans.flatMap(weekPlan => weekPlan.week.days.map((day, index) => ({ id: day.id ?? makeId('routine'), weekId: weekPlan.id, day: { ...day, trainingDay: index + 1 } })));
  if (routinePlans.length) {
    const result = await supabase.from('routines').upsert(routinePlans.map(plan => ({
      id: plan.id,
      user_id: athleteId,
      block_week_id: plan.weekId,
      name: plan.day.name.trim(),
      training_day: plan.day.trainingDay,
      effort_mode: plan.day.effortMode,
      prescription_notes: plan.day.prescriptionNotes ?? null,
      status: plan.day.status ?? 'published',
      created_at: timestamp,
      updated_at: timestamp,
      archived_at: null,
    })));
    if (result.error) throw result.error;
  }

  const keptRoutineIds = new Set(routinePlans.map(plan => plan.id));
  const removedRoutineIds = existingRoutines.map(item => item.id).filter(id => !keptRoutineIds.has(id));
  if (removedRoutineIds.length) {
    const result = await supabase.from('routines').update({ status: 'archived', archived_at: timestamp }).in('id', removedRoutineIds);
    if (result.error) throw result.error;
  }

  for (const plan of routinePlans) {
    const oldExercisesResult = await supabase.from('routine_exercises').select('id').eq('routine_id', plan.id);
    if (oldExercisesResult.error) throw oldExercisesResult.error;
    const oldExerciseIds = ((oldExercisesResult.data ?? []) as { id: string }[]).map(item => item.id);
    if (oldExerciseIds.length) {
      const setsDelete = await supabase.from('routine_sets').delete().in('routine_exercise_id', oldExerciseIds);
      if (setsDelete.error) throw setsDelete.error;
      const exercisesDelete = await supabase.from('routine_exercises').delete().in('id', oldExerciseIds);
      if (exercisesDelete.error) throw exercisesDelete.error;
    }
    const exercisePlans = plan.day.exercises.map((exercise, position) => ({ id: makeId('re'), exercise, position }));
    if (exercisePlans.length) {
      const exerciseInsert = await supabase.from('routine_exercises').insert(exercisePlans.map(item => ({ id: item.id, user_id: athleteId, routine_id: plan.id, exercise_id: item.exercise.exerciseId, position: item.position })));
      if (exerciseInsert.error) throw exerciseInsert.error;
    }
    const setRows = exercisePlans.flatMap(item => item.exercise.sets.map((set, position) => ({ id: makeId('rs'), user_id: athleteId, routine_exercise_id: item.id, position, set_type: 'working', weight: set.weight, reps: set.repsMin, reps_min: set.repsMin, reps_max: set.repsMax, rpe: set.rpe, rir: set.rir })));
    if (setRows.length) {
      const setInsert = await supabase.from('routine_sets').insert(setRows);
      if (setInsert.error) throw setInsert.error;
    }
  }
  return blockId;
}

export async function archiveCoachProgram(entity: 'block' | 'week' | 'day', id: string) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const timestamp = new Date().toISOString();
  if (entity === 'day') {
    const result = await supabase.from('routines').update({ status: 'archived', archived_at: timestamp }).eq('id', id);
    if (result.error) throw result.error;
    return;
  }
  if (entity === 'week') {
    const routinesResult = await supabase.from('routines').update({ status: 'archived', archived_at: timestamp }).eq('block_week_id', id);
    if (routinesResult.error) throw routinesResult.error;
    const weekResult = await supabase.from('coach_block_weeks').update({ status: 'archived', archived_at: timestamp }).eq('id', id);
    if (weekResult.error) throw weekResult.error;
    return;
  }
  const weeksResult = await supabase.from('coach_block_weeks').select('id').eq('block_id', id);
  if (weeksResult.error) throw weeksResult.error;
  const weekIds = ((weeksResult.data ?? []) as { id: string }[]).map(item => item.id);
  if (weekIds.length) {
    const routinesResult = await supabase.from('routines').update({ status: 'archived', archived_at: timestamp }).in('block_week_id', weekIds);
    if (routinesResult.error) throw routinesResult.error;
    const childWeeksResult = await supabase.from('coach_block_weeks').update({ status: 'archived', archived_at: timestamp }).in('id', weekIds);
    if (childWeeksResult.error) throw childWeeksResult.error;
  }
  const blockResult = await supabase.from('coach_blocks').update({ status: 'archived', archived_at: timestamp }).eq('id', id);
  if (blockResult.error) throw blockResult.error;
}

export async function setWeekPublished(weekId: string, published: boolean) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { error } = await supabase.from('coach_block_weeks').update({ status: published ? 'published' : 'draft', published_at: published ? new Date().toISOString() : null }).eq('id', weekId);
  if (error) throw error;
}

export async function saveCoachTemplate(templateType: 'activation' | 'block' | 'week' | 'day', name: string, content: object) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const coachId = await currentUserId();
  const { error } = await supabase.from('coach_program_templates').insert({ id: makeId('template'), coach_id: coachId, template_type: templateType, name: name.trim(), content });
  if (error) throw error;
}
