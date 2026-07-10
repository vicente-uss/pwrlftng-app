export type IntensityMode = 'none' | 'rpe' | 'rir' | 'both';
export type SetType = 'warmup' | 'working';

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  isUnilateral: boolean;
  videoUrl?: string;
};

export type RoutineSet = {
  id: string;
  setIndex: number;
  type: SetType;
  targetWeightKg?: number;
  targetReps?: number;
  targetRepRangeMin?: number;
  targetRepRangeMax?: number;
  targetRpe?: number;
  targetRir?: number;
  restSeconds: number;
};

export type RoutineExercise = {
  id: string;
  exerciseId: string;
  orderIndex: number;
  notes?: string;
  sets: RoutineSet[];
};

export type Routine = {
  id: string;
  name: string;
  dayIndex: number;
  notes?: string;
  intensityMode: IntensityMode;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
};

export type WorkoutSet = RoutineSet & {
  completed: boolean;
  actualWeightKg?: number;
  actualReps?: number;
  actualRpe?: number;
  actualRir?: number;
  completedAt?: string;
};

export type WorkoutExercise = Omit<RoutineExercise, 'sets'> & {
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: string;
  routineId?: string;
  name: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds: number;
  totalVolumeKg: number;
  exercises: WorkoutExercise[];
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
};
