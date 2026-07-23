import { Routine } from '@/src/domain/types';
import { isEffortMode } from '@/src/domain/training';
import { supabase } from '@/src/lib/supabase';

export type ProgramStatus = 'draft' | 'published' | 'completed' | 'archived';
export type ProgramWeekType = 'activation' | 'training' | 'low_stress' | 'deload' | 'closing';

export type AthleteBlock = {
  id: string;
  name: string;
  goalText: string | null;
  startDate: string | null;
  totalWeeks: number;
  currentWeekNumber: number;
  status: ProgramStatus;
  createdAt: string;
  completedAt: string | null;
  archivedAt: string | null;
};

export type AthleteBlockWeek = {
  id: string;
  blockId: string;
  weekNumber: number;
  name: string;
  isWarmup: boolean;
  weekType: ProgramWeekType;
  status: ProgramStatus;
  startDateOverride: string | null;
  completedAt: string | null;
};

export type AthleteBlockRoutine = {
  id: string;
  name: string;
  trainingDay: number;
  blockWeekId: string;
  prescriptionNotes: string | null;
};

export type AthleteProgramTree = AthleteBlock & {
  weeks: (AthleteBlockWeek & { routines: AthleteBlockRoutine[] })[];
};

type RemoteBlockRow = { id: string; name: string; goal_text: string | null; start_date: string | null; total_weeks: number; current_week_number: number; status: ProgramStatus; created_at: string; completed_at: string | null; archived_at: string | null };
type RemoteBlockWeekRow = { id: string; block_id: string; week_number: number; name: string; is_warmup: boolean; week_type: ProgramWeekType; status: ProgramStatus; start_date_override: string | null; completed_at: string | null };
type RemoteBlockRoutineRow = { id: string; name: string; training_day: number; block_week_id: string; prescription_notes: string | null };
type RemoteRoutineRow = { id: string; name: string; training_day: number; effort_mode: string; created_at: string; updated_at: string; block_week_id: string | null; routine_exercises: RemoteRoutineExerciseRow[] | null };
type RemoteRoutineExerciseRow = { id: string; exercise_id: string; position: number; exercises: { name: string; muscle: string } | { name: string; muscle: string }[] | null; routine_sets: RemoteRoutineSetRow[] | null };
type RemoteRoutineSetRow = { id: string; position: number; set_type: string; weight: number | string; reps: number; reps_min: number; reps_max: number; rpe: number | string | null; rir: number | string | null };

function requireClient() {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  return supabase;
}

async function currentUserId() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('No hay una sesión activa.');
  return userId;
}

function toBlock(row: RemoteBlockRow): AthleteBlock {
  return {
    id: row.id,
    name: row.name,
    goalText: row.goal_text,
    startDate: row.start_date,
    totalWeeks: row.total_weeks,
    currentWeekNumber: row.current_week_number,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
  };
}

function toWeek(row: RemoteBlockWeekRow): AthleteBlockWeek {
  return {
    id: row.id,
    blockId: row.block_id,
    weekNumber: row.week_number,
    name: row.name,
    isWarmup: row.is_warmup,
    weekType: row.week_type,
    status: row.status,
    startDateOverride: row.start_date_override,
    completedAt: row.completed_at,
  };
}

function toRoutine(row: RemoteBlockRoutineRow): AthleteBlockRoutine {
  return { id: row.id, name: row.name, trainingDay: row.training_day, blockWeekId: row.block_week_id, prescriptionNotes: row.prescription_notes };
}

const blockFields = 'id,name,goal_text,start_date,total_weeks,current_week_number,status,created_at,completed_at,archived_at';

export async function getMyProgramBlocks(): Promise<AthleteBlock[]> {
  const client = requireClient();
  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  const userId = sessionResult.data.session?.user.id;
  if (!userId) return [];
  const { data, error } = await client.from('coach_blocks').select(blockFields).eq('athlete_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RemoteBlockRow[]).map(toBlock);
}

export async function getMyActiveBlock(): Promise<AthleteBlock | null> {
  const blocks = await getMyProgramBlocks();
  return blocks.find(block => block.status === 'published' && block.startDate !== null && block.archivedAt === null) ?? null;
}

export async function getBlockWeeks(blockId: string): Promise<AthleteBlockWeek[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('coach_block_weeks')
    .select('id,block_id,week_number,name,is_warmup,week_type,status,start_date_override,completed_at')
    .eq('block_id', blockId)
    .order('week_number');
  if (error) throw error;
  return ((data ?? []) as RemoteBlockWeekRow[]).map(toWeek);
}

export async function getBlockRoutines(blockId: string): Promise<AthleteBlockRoutine[]> {
  const client = requireClient();
  const weeks = await getBlockWeeks(blockId);
  const weekIds = weeks.map(row => row.id);
  if (!weekIds.length) return [];
  const { data, error } = await client
    .from('routines')
    .select('id,name,training_day,block_week_id,prescription_notes')
    .in('block_week_id', weekIds)
    .order('training_day');
  if (error) throw error;
  return ((data ?? []) as RemoteBlockRoutineRow[]).map(toRoutine);
}

export async function getMyProgramTree(): Promise<AthleteProgramTree[]> {
  const blocks = await getMyProgramBlocks();
  const trees = await Promise.all(blocks.map(async block => {
    const [weeks, routines] = await Promise.all([getBlockWeeks(block.id), getBlockRoutines(block.id)]);
    return {
      ...block,
      weeks: weeks.map(week => ({ ...week, routines: routines.filter(routine => routine.blockWeekId === week.id).sort((a, b) => a.trainingDay - b.trainingDay) })),
    };
  }));
  return trees;
}

export function derivedWeekStartDate(block: AthleteBlock, week: AthleteBlockWeek) {
  if (week.startDateOverride) return week.startDateOverride;
  if (!block.startDate || week.weekType === 'activation') return null;
  const date = new Date(`${block.startDate}T12:00:00`);
  date.setDate(date.getDate() + Math.max(0, week.weekNumber - 1) * 7);
  return date.toISOString().slice(0, 10);
}

export async function getLatestRoutine(routineId: string): Promise<Routine> {
  const client = requireClient();
  const { data, error } = await client
    .from('routines')
    .select('id,name,training_day,effort_mode,created_at,updated_at,block_week_id,routine_exercises(id,exercise_id,position,exercises(name,muscle),routine_sets(id,position,set_type,weight,reps,reps_min,reps_max,rpe,rir))')
    .eq('id', routineId)
    .single();
  if (error) throw error;
  const row = data as unknown as RemoteRoutineRow;
  return {
    id: row.id,
    name: row.name,
    day: row.training_day,
    effortMode: isEffortMode(row.effort_mode) ? row.effort_mode : 'rpe',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    blockWeekId: row.block_week_id,
    exercises: (row.routine_exercises ?? []).slice().sort((a, b) => a.position - b.position).map(item => {
      const relation = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
      return {
        id: item.id,
        exerciseId: item.exercise_id,
        name: relation?.name ?? item.exercise_id,
        muscle: relation?.muscle ?? '',
        sets: (item.routine_sets ?? []).slice().sort((a, b) => a.position - b.position).map(set => ({
          id: set.id,
          type: set.set_type === 'warmup' ? 'warmup' : 'working',
          weight: Number(set.weight) || 0,
          repsMin: set.reps_min ?? set.reps,
          repsMax: set.reps_max ?? set.reps,
          rpe: set.rpe == null ? undefined : Number(set.rpe),
          rir: set.rir == null ? undefined : Number(set.rir),
        })),
      };
    }),
  };
}

export async function isCurrentWeekReady(block: AthleteBlock, week: AthleteBlockWeek) {
  const client = requireClient();
  const userId = await currentUserId();
  const [routineResult, workoutResult] = await Promise.all([
    client.from('routines').select('id').eq('block_week_id', week.id),
    client.from('workouts').select('routine_id').eq('user_id', userId).eq('block_week_id', week.id),
  ]);
  if (routineResult.error) throw routineResult.error;
  if (workoutResult.error) throw workoutResult.error;
  const required = new Set(((routineResult.data ?? []) as { id: string }[]).map(item => item.id));
  const completed = new Set(((workoutResult.data ?? []) as { routine_id: string | null }[]).flatMap(item => item.routine_id ? [item.routine_id] : []));
  return block.currentWeekNumber === week.weekNumber && required.size > 0 && [...required].every(id => completed.has(id));
}

export async function completeCurrentWeek(blockId: string) {
  const client = requireClient();
  const { data, error } = await client.rpc('complete_current_coach_week', { block_id: blockId });
  if (error) throw error;
  return (data?.[0] ?? null) as { block_status: ProgramStatus; next_week_id: string | null; next_week_status: ProgramStatus | null } | null;
}

export async function setWeekStartDate(weekId: string, startDate: string | null) {
  const client = requireClient();
  const { error } = await client.rpc('set_coach_week_start_date', { week_id: weekId, start_date: startDate });
  if (error) throw error;
}

export function subscribeToProgramChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client.channel(`program-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_blocks' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_block_weeks' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routines' }, onChange)
    .subscribe();
  return () => { client.removeChannel(channel); };
}
