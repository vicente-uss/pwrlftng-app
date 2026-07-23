import { supabase } from '@/src/lib/supabase';

export type AthleteBlock = {
  id: string;
  name: string;
  goalText: string | null;
  startDate: string | null;
  totalWeeks: number;
  createdAt: string;
};

export type AthleteBlockWeek = {
  id: string;
  weekNumber: number;
  name: string;
  isWarmup: boolean;
};

export type AthleteBlockRoutine = {
  id: string;
  name: string;
  trainingDay: number;
  blockWeekId: string;
};

type RemoteBlockRow = { id: string; name: string; goal_text: string | null; start_date: string | null; total_weeks: number; created_at: string };
type RemoteBlockWeekRow = { id: string; week_number: number; name: string; is_warmup: boolean };
type RemoteBlockRoutineRow = { id: string; name: string; training_day: number; block_week_id: string };

async function currentUserId() {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('No hay una sesión activa.');
  return userId;
}

export async function getMyActiveBlock(): Promise<AthleteBlock | null> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('coach_blocks')
    .select('id,name,goal_text,start_date,total_weeks,created_at')
    .eq('athlete_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as RemoteBlockRow;
  return {
    id: row.id,
    name: row.name,
    goalText: row.goal_text,
    startDate: row.start_date,
    totalWeeks: row.total_weeks,
    createdAt: row.created_at,
  };
}

export async function getBlockWeeks(blockId: string): Promise<AthleteBlockWeek[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase
    .from('coach_block_weeks')
    .select('id,week_number,name,is_warmup')
    .eq('block_id', blockId)
    .order('week_number');
  if (error) throw error;
  return ((data ?? []) as RemoteBlockWeekRow[]).map(row => ({
    id: row.id,
    weekNumber: row.week_number,
    name: row.name,
    isWarmup: row.is_warmup,
  }));
}

export async function getBlockRoutines(blockId: string): Promise<AthleteBlockRoutine[]> {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const weeksResult = await supabase
    .from('coach_block_weeks')
    .select('id')
    .eq('block_id', blockId);
  if (weeksResult.error) throw weeksResult.error;
  const weekIds = ((weeksResult.data ?? []) as { id: string }[]).map(row => row.id);
  if (!weekIds.length) return [];
  const { data, error } = await supabase
    .from('routines')
    .select('id,name,training_day,block_week_id')
    .in('block_week_id', weekIds)
    .order('training_day');
  if (error) throw error;
  return ((data ?? []) as RemoteBlockRoutineRow[]).map(row => ({
    id: row.id,
    name: row.name,
    trainingDay: row.training_day,
    blockWeekId: row.block_week_id,
  }));
}
