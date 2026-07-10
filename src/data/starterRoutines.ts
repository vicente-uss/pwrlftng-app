import { Routine } from '@/types/training';

export const STARTER_ROUTINES: Routine[] = [
  {
    id: 'routine-day-1',
    name: 'Día 1 · SBD Base',
    dayIndex: 1,
    intensityMode: 'rpe',
    notes: 'Rutina demo editable para validar el flujo del MVP.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exercises: [
      {
        id: 'routine-ex-squat',
        exerciseId: 'squat',
        orderIndex: 1,
        notes: 'Mantener técnica sólida y registrar RPE real.',
        sets: [
          {
            id: 'set-squat-warmup-1',
            setIndex: 1,
            type: 'warmup',
            targetWeightKg: 60,
            targetReps: 5,
            restSeconds: 180,
          },
          {
            id: 'set-squat-working-1',
            setIndex: 2,
            type: 'working',
            targetWeightKg: 100,
            targetReps: 5,
            targetRpe: 6,
            restSeconds: 180,
          },
          {
            id: 'set-squat-working-2',
            setIndex: 3,
            type: 'working',
            targetWeightKg: 105,
            targetReps: 5,
            targetRpe: 7,
            restSeconds: 180,
          },
        ],
      },
      {
        id: 'routine-ex-bench',
        exerciseId: 'bench-press',
        orderIndex: 2,
        sets: [
          {
            id: 'set-bench-working-1',
            setIndex: 1,
            type: 'working',
            targetWeightKg: 80,
            targetReps: 5,
            targetRpe: 6,
            restSeconds: 180,
          },
          {
            id: 'set-bench-working-2',
            setIndex: 2,
            type: 'working',
            targetWeightKg: 82.5,
            targetReps: 5,
            targetRpe: 7,
            restSeconds: 180,
          },
        ],
      },
    ],
  },
];
