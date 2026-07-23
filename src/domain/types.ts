export type Tab = 'training' | 'history' | 'profile';
export type Screen = 'login' | 'account-type' | 'training' | 'create-routine' | 'edit-routine' | 'routine-detail' | 'active-session' | 'summary' | 'history' | 'session-detail' | 'profile' | 'exercise-library' | 'exercise-detail' | 'activation-viewer' | 'coach-athletes' | 'coach-dashboard' | 'coach-athlete-detail' | 'coach-block-editor' | 'coach-program-editor' | 'coach-program-import' | 'coach-program-assign' | 'coach-program-update' | 'coach-macrocycle-editor' | 'coach-activation-editor';
export type SetType = 'warmup' | 'working';
export type EffortMode = 'rpe' | 'rir' | 'both' | 'none';

export type MovementFamily = 'squat' | 'bench' | 'deadlift' | 'other';
export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  isSystem?: boolean;
  movementFamily?: MovementFamily | null;
  parentExerciseId?: string | null;
  category?: string;
  creatorId?: string | null;
  archivedAt?: string | null;
};
export type RoutineSet = { id: string; type: SetType; weight: number; repsMin: number; repsMax: number; rpe?: number; rir?: number; effortLinked?: boolean };
export type RoutineExercise = { id: string; exerciseId: string; name: string; muscle: string; sets: RoutineSet[] };
export type Routine = { id: string; name: string; day: number; effortMode: EffortMode; exercises: RoutineExercise[]; createdAt: string; updatedAt: string; blockWeekId?: string | null };

export type WorkoutModification = 'planned' | 'edited' | 'added' | 'replaced' | 'skipped';
export type ActiveSet = {
  id: string;
  type: SetType;
  weight: string;
  reps: string;
  targetRepsMin: number;
  targetRepsMax: number;
  rpe: string;
  rir: string;
  prescribedWeight?: number;
  prescribedRpe?: number;
  prescribedRir?: number;
  effortLinked?: boolean;
  completed: boolean;
  completedAt?: string;
  sourceRoutineSetId?: string;
  modificationType?: WorkoutModification;
};
export type ActiveExercise = { id: string; exerciseId: string; name: string; muscle: string; notes: string; sets: ActiveSet[]; sourceRoutineExerciseId?: string; modificationType?: WorkoutModification };
export type ActiveSession = { id: string; routineId?: string; routineName: string; effortMode: EffortMode; restSeconds: number; startedAt: number; notes: string; exercises: ActiveExercise[]; blockId?: string | null; blockWeekId?: string | null };

export type WorkoutHistory = {
  id: string;
  routineId?: string | null;
  blockId?: string | null;
  blockWeekId?: string | null;
  athleteModified?: boolean;
  routineName: string;
  effortMode: EffortMode;
  date: string;
  durationSeconds: number;
  totalVolume: number;
  setsCompleted: number;
  notes: string;
  exercises: ActiveExercise[];
};

export type Profile = { displayName: string; bodyWeight: string; height: string; goal: string; level: string; defaultRestSeconds: number; updatedAt: string };
export type DeletionTombstone = { entityType: 'routine'; recordId: string; deletedAt: string };
export type PersistedData = { routines: Routine[]; history: WorkoutHistory[]; profile: Profile; tombstones: DeletionTombstone[] };

export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
