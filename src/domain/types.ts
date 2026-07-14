export type Tab = 'home' | 'workout' | 'profile';
export type Screen = 'login' | 'home' | 'routines' | 'create-routine' | 'routine-detail' | 'active-session' | 'summary' | 'history' | 'profile';
export type SetType = 'warmup' | 'working';

export type Exercise = { id: string; name: string; muscle: string };
export type RoutineSet = { id: string; type: SetType; weight: number; reps: number; rpe?: number };
export type RoutineExercise = { id: string; exerciseId: string; name: string; muscle: string; sets: RoutineSet[] };
export type Routine = { id: string; name: string; day: number; exercises: RoutineExercise[]; createdAt: string; updatedAt: string };

export type ActiveSet = { id: string; type: SetType; weight: string; reps: string; rpe: string; completed: boolean; completedAt?: string };
export type ActiveExercise = { id: string; exerciseId: string; name: string; muscle: string; sets: ActiveSet[] };
export type ActiveSession = { id: string; routineId?: string; routineName: string; startedAt: number; exercises: ActiveExercise[] };

export type WorkoutHistory = {
  id: string;
  routineName: string;
  date: string;
  durationSeconds: number;
  totalVolume: number;
  setsCompleted: number;
  exercises: ActiveExercise[];
};

export type Profile = { bodyWeight: string; height: string; goal: string; level: string; defaultRestSeconds: number; updatedAt: string };
export type DeletionTombstone = { entityType: 'routine'; recordId: string; deletedAt: string };
export type PersistedData = { routines: Routine[]; history: WorkoutHistory[]; profile: Profile; tombstones: DeletionTombstone[] };

export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
