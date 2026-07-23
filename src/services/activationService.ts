import { supabase } from '@/src/lib/supabase';
import { makeId } from '@/src/domain/types';

export type ActivationItem = {
  id: string;
  exerciseId: string | null;
  movementName: string;
  repetitions: string;
  durationSeconds: number | null;
  rounds: number | null;
  restSeconds: number | null;
  loadText: string;
  equipment: string;
  instructions: string;
  notes: string;
  videoUrl: string;
};

export type ActivationSection = {
  id: string;
  name: string;
  items: ActivationItem[];
};

export type ActivationResource = {
  id?: string;
  title: string;
  introduction: string;
  sections: ActivationSection[];
};

type ResourceRow = { id: string; title: string; introduction: string | null };
type SectionRow = { id: string; resource_id: string; name: string; position: number };
type ItemRow = {
  id: string;
  section_id: string;
  exercise_id: string | null;
  movement_name: string;
  repetitions: string | null;
  duration_seconds: number | null;
  rounds: number | null;
  rest_seconds: number | null;
  load_text: string | null;
  equipment: string | null;
  instructions: string | null;
  notes: string | null;
  video_url: string | null;
  position: number;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  return supabase;
}

export function emptyActivationResource(): ActivationResource {
  return {
    title: 'Activación',
    introduction: '',
    sections: [],
  };
}

export function newActivationItem(): ActivationItem {
  return {
    id: makeId('activation-item'),
    exerciseId: null,
    movementName: '',
    repetitions: '',
    durationSeconds: null,
    rounds: null,
    restSeconds: null,
    loadText: '',
    equipment: '',
    instructions: '',
    notes: '',
    videoUrl: '',
  };
}

export function newActivationSection(position = 0): ActivationSection {
  return {
    id: makeId('activation-section'),
    name: position === 0 ? 'Activación general' : `Fase ${position + 1}`,
    items: [],
  };
}

export async function getActivationResource(target: { programId?: string; blockId?: string }) {
  const client = requireClient();
  let resourceQuery = client
    .from('coach_activation_resources')
    .select('id,title,introduction');
  resourceQuery = target.programId
    ? resourceQuery.eq('program_id', target.programId)
    : resourceQuery.eq('block_id', target.blockId ?? '');
  const resourceResult = await resourceQuery.maybeSingle();
  if (resourceResult.error) throw resourceResult.error;
  if (!resourceResult.data) return null;

  const resource = resourceResult.data as ResourceRow;
  const sectionResult = await client
    .from('coach_activation_sections')
    .select('id,resource_id,name,position')
    .eq('resource_id', resource.id)
    .order('position');
  if (sectionResult.error) throw sectionResult.error;
  const sections = (sectionResult.data ?? []) as SectionRow[];
  const sectionIds = sections.map(section => section.id);
  const itemResult = sectionIds.length
    ? await client
      .from('coach_activation_items')
      .select('id,section_id,exercise_id,movement_name,repetitions,duration_seconds,rounds,rest_seconds,load_text,equipment,instructions,notes,video_url,position')
      .in('section_id', sectionIds)
      .order('position')
    : { data: [], error: null };
  if (itemResult.error) throw itemResult.error;
  const items = (itemResult.data ?? []) as ItemRow[];

  return {
    id: resource.id,
    title: resource.title,
    introduction: resource.introduction ?? '',
    sections: sections.map(section => ({
      id: section.id,
      name: section.name,
      items: items
        .filter(item => item.section_id === section.id)
        .sort((a, b) => a.position - b.position)
        .map(item => ({
          id: item.id,
          exerciseId: item.exercise_id,
          movementName: item.movement_name,
          repetitions: item.repetitions ?? '',
          durationSeconds: item.duration_seconds,
          rounds: item.rounds,
          restSeconds: item.rest_seconds,
          loadText: item.load_text ?? '',
          equipment: item.equipment ?? '',
          instructions: item.instructions ?? '',
          notes: item.notes ?? '',
          videoUrl: item.video_url ?? '',
        })),
    })),
  } satisfies ActivationResource;
}

function payload(resource: ActivationResource) {
  return {
    title: resource.title.trim() || 'Activación',
    introduction: resource.introduction.trim() || null,
    sections: resource.sections.map((section, sectionIndex) => ({
      id: section.id,
      name: section.name.trim(),
      position: sectionIndex,
      items: section.items.map((item, itemIndex) => ({
        id: item.id,
        exerciseId: item.exerciseId,
        movementName: item.movementName.trim(),
        repetitions: item.repetitions.trim() || null,
        durationSeconds: item.durationSeconds,
        rounds: item.rounds,
        restSeconds: item.restSeconds,
        loadText: item.loadText.trim() || null,
        equipment: item.equipment.trim() || null,
        instructions: item.instructions.trim() || null,
        notes: item.notes.trim() || null,
        videoUrl: item.videoUrl.trim() || null,
        position: itemIndex,
      })),
    })),
  };
}

export async function saveActivationResource(
  target: { programId?: string; blockId?: string },
  resource: ActivationResource,
) {
  const client = requireClient();
  if (!target.programId && !target.blockId) throw new Error('Falta el mesociclo de Activación.');
  const functionName = target.programId
    ? 'save_coach_program_activation'
    : 'save_coach_block_activation';
  const args = target.programId
    ? { p_program_id: target.programId, p_activation: payload(resource) }
    : { p_block_id: target.blockId, p_activation: payload(resource) };
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw error;
  return data as string;
}
