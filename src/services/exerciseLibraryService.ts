import { EXERCISE_CATALOG } from '@/src/data/seed';
import { Exercise, makeId } from '@/src/domain/types';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

type ExerciseRow = {
  id: string;
  name: string;
  muscle: string;
  is_system: boolean;
  movement_family: Exercise['movementFamily'] | null;
  parent_exercise_id: string | null;
  category: string;
  creator_id: string | null;
  archived_at: string | null;
};

function fromRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscle: row.muscle,
    isSystem: row.is_system,
    movementFamily: row.movement_family,
    parentExerciseId: row.parent_exercise_id,
    category: row.category,
    creatorId: row.creator_id,
    archivedAt: row.archived_at,
  };
}

export async function getExerciseLibrary(includeArchived = false): Promise<Exercise[]> {
  if (!isSupabaseConfigured || !supabase) return EXERCISE_CATALOG;
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  if (!sessionResult.data.session) return EXERCISE_CATALOG;
  let query = supabase
    .from('exercises')
    .select('id,name,muscle,is_system,movement_family,parent_exercise_id,category,creator_id,archived_at')
    .order('name');
  if (!includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ExerciseRow[]).map(fromRow);
}

export async function createCoachExerciseVariant(input: {
  name: string;
  muscle: string;
  category: string;
  movementFamily: NonNullable<Exercise['movementFamily']>;
  parentExerciseId: string | null;
}) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const userResult = await supabase.auth.getUser();
  if (userResult.error) throw userResult.error;
  const creatorId = userResult.data.user?.id;
  if (!creatorId) throw new Error('No hay una sesión activa.');
  const row = {
    id: makeId('exercise'),
    name: input.name.trim(),
    muscle: input.muscle.trim() || 'General',
    category: input.category.trim() || 'General',
    movement_family: input.movementFamily,
    parent_exercise_id: input.parentExerciseId,
    creator_id: creatorId,
    is_system: false,
    is_active: true,
  };
  const { data, error } = await supabase
    .from('exercises')
    .insert(row)
    .select('id,name,muscle,is_system,movement_family,parent_exercise_id,category,creator_id,archived_at')
    .single();
  if (error) throw error;
  return fromRow(data as ExerciseRow);
}

export async function archiveCoachExercise(exerciseId: string) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { error } = await supabase
    .from('exercises')
    .update({ archived_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
    .eq('id', exerciseId);
  if (error) throw error;
}
