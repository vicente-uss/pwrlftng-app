import { WorkoutExercise } from '@/types/training';

export function calculateWorkoutVolume(exercises: WorkoutExercise[]) {
  return exercises.reduce((total, exercise) => {
    const exerciseVolume = exercise.sets.reduce((setTotal, set) => {
      if (!set.completed || set.type === 'warmup') return setTotal;
      const weight = set.actualWeightKg ?? set.targetWeightKg ?? 0;
      const reps = set.actualReps ?? set.targetReps ?? set.targetRepRangeMax ?? 0;
      return setTotal + weight * reps;
    }, 0);

    return total + exerciseVolume;
  }, 0);
}

export function countCompletedSets(exercises: WorkoutExercise[]) {
  return exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0,
  );
}
