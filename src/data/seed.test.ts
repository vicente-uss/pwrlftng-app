import { describe, expect, it } from 'vitest';
import { SEED_ROUTINES } from '@/src/data/seed';

describe('prototype routines', () => {
  it('incluye los cuatro días definidos para el prototipo', () => {
    expect(SEED_ROUTINES.map(routine => routine.name)).toEqual(['Día 1', 'Día 2', 'Día 3', 'Día 4']);
    expect(SEED_ROUTINES.map(routine => routine.exercises.flatMap(exercise => exercise.sets).length)).toEqual([4, 4, 4, 12]);
  });

  it('usa squat, bench y deadlift en el Día 4', () => {
    expect(SEED_ROUTINES[3].exercises.map(exercise => exercise.exerciseId)).toEqual(['squat', 'bench', 'deadlift']);
  });
});
