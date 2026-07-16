export type Tab = 'training' | 'history' | 'profile';
export type Screen = 'login' | 'training' | 'create-routine' | 'routine-detail' | 'active-session' | 'summary' | 'history' | 'profile';
export type SetType = 'warmup' | 'working';
export type EffortMode = 'rpe' | 'rir' | 'both' | 'none';

export type Exercise = { id: string; name: string; muscle: string };
export type RoutineSet = { id: string; type: SetType; weight: number; repsMin: number; repsMax: number; rpe?: number; rir?: number };
export type RoutineExercise = { id: string; exerciseId: string; name: string; muscle: string; sets: RoutineSet[] };
export type Routine = { id: string; name: string; day: number; effortMode: EffortMode; exercises: RoutineExercise[]; createdAt: string; updatedAt: string };

export type ActiveSet = { id: string; type: SetType; weight: string; reps: string; targetRepsMin: number; targetRepsMax: number; rpe: string; rir: string; completed: boolean; completedAt?: string };
export type ActiveExercise = { id: string; exerciseId: string; name: string; muscle: string; notes: string; sets: ActiveSet[] };
export type ActiveSession = { id: string; routineId?: string; routineName: string; effortMode: EffortMode; restSeconds: number; startedAt: number; notes: string; exercises: ActiveExercise[] };

export type WorkoutHistory = {
  id: string;
  routineName: string;
  effortMode: EffortMode;
  date: string;
  durationSeconds: number;
  totalVolume: number;
  setsCompleted: number;
  notes: string;
  exercises: ActiveExercise[];
};

export type Profile = { bodyWeight: string; height: string; goal: string; level: string; defaultRestSeconds: number; updatedAt: string };
export type DeletionTombstone = { entityType: 'routine'; recordId: string; deletedAt: string };
export type PersistedData = { routines: Routine[]; history: WorkoutHistory[]; profile: Profile; tombstones: DeletionTombstone[] };

export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
