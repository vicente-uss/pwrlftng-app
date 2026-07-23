import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlockDraftInfo,
  BlockDraftWeek,
  buildCoachProgramSavePayload,
  createAthleteBlock,
  saveAthleteBlock,
} from '@/src/services/coachService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

const info: BlockDraftInfo = {
  id: 'block-1',
  name: '  Mesociclo IV  ',
  goalText: 'Fuerza',
  startDate: '2026-07-27',
  totalWeeks: 8,
  status: 'published',
  currentWeekNumber: 1,
};

const weeks: BlockDraftWeek[] = [{
  id: 'week-1',
  name: '  Semana 1  ',
  weekNumber: 1,
  isWarmup: false,
  weekType: 'training',
  status: 'published',
  startDateOverride: null,
  days: [{
    id: 'routine-1',
    name: '  Día de sentadilla  ',
    trainingDay: 6,
    effortMode: 'both',
    prescriptionNotes: 'Técnica',
    status: 'published',
    exercises: [{
      id: 'routine-exercise-1',
      exerciseId: 'squat',
      sets: [{
        id: 'routine-set-1',
        weight: 130,
        repsMin: 5,
        repsMax: 6,
        rpe: 8,
        rir: 2,
      }],
    }],
  }],
}];

describe('guardado atómico de programas de coaching', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
  });

  it('serializa el árbol completo con IDs estables y posiciones normalizadas', () => {
    expect(buildCoachProgramSavePayload(info, weeks)).toEqual({
      block: {
        id: 'block-1',
        name: 'Mesociclo IV',
        goalText: 'Fuerza',
        startDate: '2026-07-27',
        totalWeeks: 1,
        status: 'published',
        currentWeekNumber: 1,
      },
      weeks: [{
        id: 'week-1',
        name: 'Semana 1',
        weekNumber: 1,
        isWarmup: false,
        weekType: 'training',
        status: 'published',
        startDateOverride: null,
        days: [{
          id: 'routine-1',
          name: 'Día de sentadilla',
          trainingDay: 1,
          effortMode: 'both',
          prescriptionNotes: 'Técnica',
          status: 'published',
          exercises: [{
            id: 'routine-exercise-1',
            exerciseId: 'squat',
            position: 0,
            sets: [{
              id: 'routine-set-1',
              effortLinked: true,
              position: 0,
              setType: 'working',
              weight: 130,
              repsMin: 5,
              repsMax: 6,
              rpe: 8,
              rir: 2,
            }],
          }],
        }],
      }],
    });
  });

  it('crea o edita mediante una sola llamada RPC sin escrituras REST parciales', async () => {
    mocks.rpc.mockResolvedValue({ data: 'block-1', error: null });

    await expect(saveAthleteBlock('athlete-1', info, weeks)).resolves.toBe('block-1');

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('save_coach_program_v3', {
      p_athlete_id: 'athlete-1',
      p_program: buildCoachProgramSavePayload(info, weeks),
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propaga el error transaccional y no intenta continuar con hijos', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('rollback') });

    await expect(saveAthleteBlock('athlete-1', info, weeks)).rejects.toThrow('rollback');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('mantiene la ruta de creación heredada dentro de la misma operación atómica', async () => {
    mocks.rpc.mockResolvedValue({ data: 'block-1', error: null });

    await expect(createAthleteBlock('athlete-1', info, weeks)).resolves.toBe('block-1');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
