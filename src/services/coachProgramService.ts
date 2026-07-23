import { makeId } from '@/src/domain/types';
import { supabase } from '@/src/lib/supabase';
import {
  BlockDraftInfo,
  BlockDraftWeek,
  CoachAthlete,
  getMyAthletes,
} from '@/src/services/coachService';
import { ProgramStatus, ProgramWeekType } from '@/src/services/athleteBlockService';

export type CoachProgramKind = 'mesocycle' | 'template';
export type CoachLibraryStatus = 'draft' | 'ready' | 'archived';

export type CoachLibraryProgram = {
  id: string;
  kind: CoachProgramKind;
  name: string;
  goalText: string | null;
  startDate: string | null;
  status: CoachLibraryStatus;
  revision: number;
  sourceProgramId: string | null;
  updatedAt: string;
  weekCount: number;
  assignmentCount: number;
  macrocycleName: string | null;
};

export type CoachMacrocycle = {
  id: string;
  name: string;
  goalText: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived' | null;
  programIds: string[];
};

export type CoachAssignmentPreview = {
  assignmentId: string;
  athlete: CoachAthlete;
  blockId: string;
  sourceRevision: number;
  lastSyncedRevision: number;
  customizedWeekIds: string[];
  completedWeekIds: string[];
  activeWeekIds: string[];
  needsUpdate: boolean;
};

export type CoachDashboardSummary = {
  athletes: number;
  mesocycles: number;
  templates: number;
  assignmentsNeedingUpdate: number;
  legacyTemplates: number;
};

type ProgramRow = {
  id: string;
  kind: CoachProgramKind;
  name: string;
  goal_text: string | null;
  start_date: string | null;
  status: CoachLibraryStatus;
  revision: number;
  source_program_id: string | null;
  updated_at: string;
};
type ProgramWeekRow = {
  id: string;
  program_id: string;
  week_number: number;
  name: string;
  week_type: ProgramWeekType;
  status: 'draft' | 'published';
  start_date_override: string | null;
};
type ProgramDayRow = {
  id: string;
  program_week_id: string;
  name: string;
  training_day: number;
  effort_mode: 'rpe' | 'rir' | 'both' | 'none';
  prescription_notes: string | null;
  status: 'draft' | 'published';
};
type ProgramExerciseRow = {
  id: string;
  program_day_id: string;
  exercise_id: string;
  position: number;
};
type ProgramSetRow = {
  id: string;
  program_exercise_id: string;
  position: number;
  weight: string | number;
  reps_min: number;
  reps_max: number;
  rpe: string | number | null;
  rir: string | number | null;
  effort_linked: boolean;
};
type AssignmentRow = {
  id: string;
  athlete_id: string;
  block_id: string;
  source_revision: number;
  last_synced_revision: number;
  status: 'active' | 'archived';
};

function requireClient() {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  return supabase;
}

async function currentUserId() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('No hay una sesión activa.');
  return data.user.id;
}

function libraryPayload(
  info: BlockDraftInfo,
  weeks: BlockDraftWeek[],
  kind: CoachProgramKind,
  sourceProgramId?: string | null,
) {
  return {
    program: {
      id: info.id ?? makeId('program'),
      kind,
      name: info.name.trim(),
      goalText: info.goalText,
      startDate: info.startDate,
      status: info.status === 'archived' ? 'archived' : 'ready',
      sourceProgramId: sourceProgramId ?? null,
    },
    weeks: weeks.filter(week => !week.isWarmup).map(week => ({
      id: week.id ?? makeId('program-week'),
      name: week.name.trim(),
      weekNumber: week.weekNumber,
      weekType: week.weekType === 'activation' ? 'training' : (week.weekType ?? 'training'),
      status: week.status === 'draft' ? 'draft' : 'published',
      startDateOverride: week.startDateOverride ?? null,
      days: week.days.map((day, dayIndex) => ({
        id: day.id ?? makeId('program-day'),
        name: day.name.trim(),
        trainingDay: dayIndex + 1,
        effortMode: day.effortMode,
        prescriptionNotes: day.prescriptionNotes ?? null,
        status: day.status ?? 'published',
        exercises: day.exercises.map((exercise, exerciseIndex) => ({
          id: exercise.id ?? makeId('program-exercise'),
          exerciseId: exercise.exerciseId,
          position: exerciseIndex,
          sets: exercise.sets.map((set, setIndex) => ({
            id: set.id ?? makeId('program-set'),
            position: setIndex,
            setType: 'working' as const,
            weight: set.weight,
            repsMin: set.repsMin,
            repsMax: set.repsMax,
            rpe: set.rpe,
            rir: set.rir,
            effortLinked: set.effortLinked ?? true,
          })),
        })),
      })),
    })),
  };
}

export async function getCoachLibraryPrograms(): Promise<CoachLibraryProgram[]> {
  const client = requireClient();
  const [programResult, weekResult, assignmentResult, macroResult] = await Promise.all([
    client.from('coach_programs').select('id,kind,name,goal_text,start_date,status,revision,source_program_id,updated_at').order('updated_at', { ascending: false }),
    client.from('coach_program_weeks').select('id,program_id'),
    client.from('coach_program_assignments').select('id,program_id,status'),
    client.from('coach_macrocycle_programs').select('program_id,coach_macrocycles(name)'),
  ]);
  if (programResult.error) throw programResult.error;
  if (weekResult.error) throw weekResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  if (macroResult.error) throw macroResult.error;
  const weekRows = (weekResult.data ?? []) as { id: string; program_id: string }[];
  const assignmentRows = (assignmentResult.data ?? []) as { id: string; program_id: string | null; status: string }[];
  const macroRows = (macroResult.data ?? []) as unknown as {
    program_id: string;
    coach_macrocycles: { name: string } | { name: string }[] | null;
  }[];
  return ((programResult.data ?? []) as ProgramRow[]).map(row => {
    const macroRelation = macroRows.find(item => item.program_id === row.id)?.coach_macrocycles;
    const macrocycle = Array.isArray(macroRelation) ? macroRelation[0] : macroRelation;
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      goalText: row.goal_text,
      startDate: row.start_date,
      status: row.status,
      revision: row.revision,
      sourceProgramId: row.source_program_id,
      updatedAt: row.updated_at,
      weekCount: weekRows.filter(week => week.program_id === row.id).length,
      assignmentCount: assignmentRows.filter(item => item.program_id === row.id && item.status === 'active').length,
      macrocycleName: macrocycle?.name ?? null,
    };
  });
}

export async function getCoachLibraryProgramDraft(programId: string): Promise<{
  info: BlockDraftInfo;
  weeks: BlockDraftWeek[];
  kind: CoachProgramKind;
  revision: number;
}> {
  const client = requireClient();
  const programResult = await client.from('coach_programs')
    .select('id,kind,name,goal_text,start_date,status,revision,source_program_id,updated_at')
    .eq('id', programId).single();
  if (programResult.error) throw programResult.error;
  const program = programResult.data as ProgramRow;
  const weekResult = await client.from('coach_program_weeks')
    .select('id,program_id,week_number,name,week_type,status,start_date_override')
    .eq('program_id', programId).order('week_number');
  if (weekResult.error) throw weekResult.error;
  const weeks = (weekResult.data ?? []) as ProgramWeekRow[];
  const weekIds = weeks.map(week => week.id);
  const dayResult = weekIds.length
    ? await client.from('coach_program_days')
      .select('id,program_week_id,name,training_day,effort_mode,prescription_notes,status')
      .in('program_week_id', weekIds).order('training_day')
    : { data: [], error: null };
  if (dayResult.error) throw dayResult.error;
  const days = (dayResult.data ?? []) as ProgramDayRow[];
  const dayIds = days.map(day => day.id);
  const exerciseResult = dayIds.length
    ? await client.from('coach_program_exercises')
      .select('id,program_day_id,exercise_id,position')
      .in('program_day_id', dayIds).order('position')
    : { data: [], error: null };
  if (exerciseResult.error) throw exerciseResult.error;
  const exercises = (exerciseResult.data ?? []) as ProgramExerciseRow[];
  const exerciseIds = exercises.map(exercise => exercise.id);
  const setResult = exerciseIds.length
    ? await client.from('coach_program_sets')
      .select('id,program_exercise_id,position,weight,reps_min,reps_max,rpe,rir,effort_linked')
      .in('program_exercise_id', exerciseIds).order('position')
    : { data: [], error: null };
  if (setResult.error) throw setResult.error;
  const sets = (setResult.data ?? []) as ProgramSetRow[];
  return {
    info: {
      id: program.id,
      name: program.name,
      goalText: program.goal_text,
      startDate: program.start_date,
      totalWeeks: weeks.length,
      status: program.status === 'archived' ? 'archived' : 'published',
      currentWeekNumber: 1,
    },
    kind: program.kind,
    revision: program.revision,
    weeks: weeks.map(week => ({
      id: week.id,
      name: week.name,
      weekNumber: week.week_number,
      isWarmup: false,
      weekType: week.week_type,
      status: week.status,
      startDateOverride: week.start_date_override,
      days: days.filter(day => day.program_week_id === week.id).map(day => ({
        id: day.id,
        name: day.name,
        trainingDay: day.training_day,
        effortMode: day.effort_mode,
        prescriptionNotes: day.prescription_notes,
        status: day.status,
        exercises: exercises.filter(exercise => exercise.program_day_id === day.id).map(exercise => ({
          id: exercise.id,
          exerciseId: exercise.exercise_id,
          sets: sets.filter(set => set.program_exercise_id === exercise.id).map(set => ({
            id: set.id,
            weight: Number(set.weight) || 0,
            repsMin: set.reps_min,
            repsMax: set.reps_max,
            rpe: set.rpe == null ? null : Number(set.rpe),
            rir: set.rir == null ? null : Number(set.rir),
            effortLinked: set.effort_linked,
          })),
        })),
      })),
    })),
  };
}

export async function saveCoachLibraryProgram(
  info: BlockDraftInfo,
  weeks: BlockDraftWeek[],
  kind: CoachProgramKind,
  sourceProgramId?: string | null,
) {
  const client = requireClient();
  const payload = libraryPayload(info, weeks, kind, sourceProgramId);
  const { data, error } = await client.rpc('save_coach_library_program_v3', { p_program: payload });
  if (error) throw error;
  return (data as string | null) ?? payload.program.id;
}

export async function duplicateCoachLibraryProgram(programId: string) {
  const draft = await getCoachLibraryProgramDraft(programId);
  const duplicatedWeeks = draft.weeks.map((week, weekIndex) => ({
    ...week,
    id: makeId('program-week'),
    weekNumber: weekIndex + 1,
    days: week.days.map(day => ({
      ...day,
      id: makeId('program-day'),
      exercises: day.exercises.map(exercise => ({
        ...exercise,
        id: makeId('program-exercise'),
        sets: exercise.sets.map(set => ({ ...set, id: makeId('program-set') })),
      })),
    })),
  }));
  return saveCoachLibraryProgram({
    ...draft.info,
    id: undefined,
    name: `${draft.info.name} · Copia`,
    status: 'published',
  }, duplicatedWeeks, draft.kind, programId);
}

export async function setCoachLibraryProgramArchived(programId: string, archived: boolean) {
  const client = requireClient();
  const { error } = await client.rpc('set_coach_library_program_archived', {
    p_program_id: programId,
    p_archived: archived,
  });
  if (error) throw error;
}

export async function assignCoachProgram(programId: string, athleteIds: string[]) {
  const client = requireClient();
  const { data, error } = await client.rpc('assign_coach_program_v3', {
    p_program_id: programId,
    p_athlete_ids: athleteIds,
  });
  if (error) throw error;
  return data as { assignmentId: string; athleteId: string; blockId: string }[];
}

export async function getCoachAssignmentPreview(programId: string): Promise<CoachAssignmentPreview[]> {
  const client = requireClient();
  const [programs, athletes, assignmentResult] = await Promise.all([
    getCoachLibraryPrograms(),
    getMyAthletes(),
    client.from('coach_program_assignments')
      .select('id,athlete_id,block_id,source_revision,last_synced_revision,status')
      .eq('program_id', programId).eq('status', 'active'),
  ]);
  if (assignmentResult.error) throw assignmentResult.error;
  const program = programs.find(item => item.id === programId);
  if (!program) return [];
  const assignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const blockIds = assignments.map(item => item.block_id);
  const weekResult = blockIds.length
    ? await client.from('coach_block_weeks')
      .select('id,block_id,status,source_program_week_id')
      .in('block_id', blockIds)
    : { data: [], error: null };
  if (weekResult.error) throw weekResult.error;
  const copyWeeks = (weekResult.data ?? []) as {
    id: string; block_id: string; status: ProgramStatus; source_program_week_id: string | null;
  }[];
  const copyWeekIds = copyWeeks.map(item => item.id);
  const [routineResult, activeResult] = await Promise.all([
    copyWeekIds.length
      ? client.from('routines').select('block_week_id,coach_revision').in('block_week_id', copyWeekIds).is('archived_at', null)
      : Promise.resolve({ data: [], error: null }),
    client.from('athlete_active_program_sessions').select('athlete_id,block_week_id'),
  ]);
  if (routineResult.error) throw routineResult.error;
  if (activeResult.error) throw activeResult.error;
  const routines = (routineResult.data ?? []) as { block_week_id: string; coach_revision: number }[];
  const active = (activeResult.data ?? []) as { athlete_id: string; block_week_id: string }[];
  return assignments.flatMap(assignment => {
    const athlete = athletes.find(item => item.athleteId === assignment.athlete_id);
    if (!athlete) return [];
    const assignmentWeeks = copyWeeks.filter(week => week.block_id === assignment.block_id);
    return [{
      assignmentId: assignment.id,
      athlete,
      blockId: assignment.block_id,
      sourceRevision: assignment.source_revision,
      lastSyncedRevision: assignment.last_synced_revision,
      customizedWeekIds: assignmentWeeks.filter(week =>
        routines.some(routine => routine.block_week_id === week.id && routine.coach_revision > 1))
        .flatMap(week => week.source_program_week_id ? [week.source_program_week_id] : []),
      completedWeekIds: assignmentWeeks.filter(week => week.status === 'completed')
        .flatMap(week => week.source_program_week_id ? [week.source_program_week_id] : []),
      activeWeekIds: assignmentWeeks.filter(week =>
        active.some(session => session.athlete_id === assignment.athlete_id && session.block_week_id === week.id))
        .flatMap(week => week.source_program_week_id ? [week.source_program_week_id] : []),
      needsUpdate: program.revision > assignment.last_synced_revision,
    }];
  });
}

export async function updateCoachProgramAssignments(
  programId: string,
  athleteIds: string[],
  weekIds: string[],
  customizationPolicy: 'keep' | 'replace',
) {
  const client = requireClient();
  const { data, error } = await client.rpc('update_coach_program_assignments_v3', {
    p_program_id: programId,
    p_athlete_ids: athleteIds,
    p_program_week_ids: weekIds,
    p_customization_policy: customizationPolicy,
  });
  if (error) throw error;
  return data as {
    assignmentId: string;
    athleteId: string;
    status: 'applied' | 'partially_applied' | 'deferred';
    appliedWeekIds: string[];
    skippedWeekIds: string[];
    deferredWeekIds: string[];
  }[];
}

export async function getCoachMacrocycles(): Promise<CoachMacrocycle[]> {
  const client = requireClient();
  const [macroResult, linkResult] = await Promise.all([
    client.from('coach_macrocycles').select('id,name,goal_text,start_date,end_date,status').order('updated_at', { ascending: false }),
    client.from('coach_macrocycle_programs').select('macrocycle_id,program_id,position').order('position'),
  ]);
  if (macroResult.error) throw macroResult.error;
  if (linkResult.error) throw linkResult.error;
  const links = (linkResult.data ?? []) as { macrocycle_id: string; program_id: string; position: number }[];
  return ((macroResult.data ?? []) as {
    id: string; name: string; goal_text: string | null; start_date: string | null;
    end_date: string | null; status: CoachMacrocycle['status'];
  }[]).map(row => ({
    id: row.id,
    name: row.name,
    goalText: row.goal_text,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    programIds: links.filter(link => link.macrocycle_id === row.id).map(link => link.program_id),
  }));
}

export async function saveCoachMacrocycle(
  macrocycle: Omit<CoachMacrocycle, 'id'> & { id?: string },
) {
  const client = requireClient();
  const coachId = await currentUserId();
  const id = macrocycle.id ?? makeId('macrocycle');
  const { error } = await client.from('coach_macrocycles').upsert({
    id,
    coach_id: coachId,
    name: macrocycle.name.trim(),
    goal_text: macrocycle.goalText,
    start_date: macrocycle.startDate,
    end_date: macrocycle.endDate,
    status: macrocycle.status,
  });
  if (error) throw error;
  const deleteResult = await client.from('coach_macrocycle_programs').delete().eq('macrocycle_id', id);
  if (deleteResult.error) throw deleteResult.error;
  if (macrocycle.programIds.length) {
    const insertResult = await client.from('coach_macrocycle_programs').insert(
      macrocycle.programIds.map((programId, position) => ({
        macrocycle_id: id,
        program_id: programId,
        position,
      })),
    );
    if (insertResult.error) throw insertResult.error;
  }
  return id;
}

export async function getCoachDashboardSummary(): Promise<CoachDashboardSummary> {
  const client = requireClient();
  const [athletes, programs, assignments, legacy] = await Promise.all([
    getMyAthletes(),
    getCoachLibraryPrograms(),
    client.from('coach_program_assignments').select('program_id,last_synced_revision').eq('status', 'active'),
    client.from('coach_program_templates').select('id', { count: 'exact', head: true }),
  ]);
  if (assignments.error) throw assignments.error;
  if (legacy.error) throw legacy.error;
  return {
    athletes: athletes.length,
    mesocycles: programs.filter(item => item.kind === 'mesocycle' && item.status !== 'archived').length,
    templates: programs.filter(item => item.kind === 'template' && item.status !== 'archived').length,
    assignmentsNeedingUpdate: ((assignments.data ?? []) as { program_id: string; last_synced_revision: number }[])
      .filter((assignment) => {
        const sourceProgram = programs.find(program => program.id === assignment.program_id);
        return sourceProgram != null && sourceProgram.revision > assignment.last_synced_revision;
      }).length,
    legacyTemplates: legacy.count ?? 0,
  };
}

export async function beginAssignedProgramSession(sessionId: string, routineId: string) {
  const client = requireClient();
  const { error } = await client.rpc('begin_athlete_program_session', {
    p_session_id: sessionId,
    p_routine_id: routineId,
  });
  if (error) throw error;
}

export async function finishAssignedProgramSession(sessionId: string) {
  const client = requireClient();
  const { error } = await client.rpc('finish_athlete_program_session', {
    p_session_id: sessionId,
  });
  if (error) throw error;
}
