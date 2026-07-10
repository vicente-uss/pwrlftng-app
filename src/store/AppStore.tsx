import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { EXERCISES } from '@/data/exercises';
import { STARTER_ROUTINES } from '@/data/starterRoutines';
import { Exercise, IntensityMode, Routine, RoutineExercise, WorkoutSession } from '@/types/training';
import { createId } from '@/utils/ids';
import { calculateWorkoutVolume } from '@/utils/metrics';

export type CreateRoutineInput = {
  name: string;
  dayIndex: number;
  intensityMode: IntensityMode;
  exerciseIds: string[];
};

type AppStoreValue = {
  exercises: Exercise[];
  routines: Routine[];
  sessions: WorkoutSession[];
  activeSession?: WorkoutSession;
  lastCompletedSession?: WorkoutSession;
  createRoutine: (input: CreateRoutineInput) => Routine;
  duplicateRoutine: (routineId: string) => void;
  startWorkout: (routineId?: string) => WorkoutSession;
  toggleWorkoutSet: (exerciseId: string, setId: string) => void;
  finishWorkout: (durationSeconds: number) => WorkoutSession | undefined;
  cancelWorkout: () => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [routines, setRoutines] = useState<Routine[]>(STARTER_ROUTINES);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | undefined>();
  const [lastCompletedSession, setLastCompletedSession] = useState<WorkoutSession | undefined>();

  function createRoutine(input: CreateRoutineInput) {
    const now = new Date().toISOString();
    const routineExercises: RoutineExercise[] = input.exerciseIds.map((exerciseId, index) => ({
      id: createId('routine-exercise'),
      exerciseId,
      orderIndex: index + 1,
      sets: [
        {
          id: createId('routine-set'),
          setIndex: 1,
          type: 'working',
          targetWeightKg: 0,
          targetReps: 5,
          restSeconds: 180,
        },
        {
          id: createId('routine-set'),
          setIndex: 2,
          type: 'working',
          targetWeightKg: 0,
          targetReps: 5,
          restSeconds: 180,
        },
        {
          id: createId('routine-set'),
          setIndex: 3,
          type: 'working',
          targetWeightKg: 0,
          targetReps: 5,
          restSeconds: 180,
        },
      ],
    }));

    const routine: Routine = {
      id: createId('routine'),
      name: input.name.trim() || `Día ${input.dayIndex}`,
      dayIndex: input.dayIndex,
      intensityMode: input.intensityMode,
      exercises: routineExercises,
      createdAt: now,
      updatedAt: now,
    };

    setRoutines((current) => [routine, ...current].slice(0, 7));
    return routine;
  }

  function duplicateRoutine(routineId: string) {
    const source = routines.find((routine) => routine.id === routineId);
    if (!source) return;

    const now = new Date().toISOString();
    const copy: Routine = {
      ...source,
      id: createId('routine'),
      name: `${source.name} copia`,
      createdAt: now,
      updatedAt: now,
      exercises: source.exercises.map((exercise) => ({
        ...exercise,
        id: createId('routine-exercise'),
        sets: exercise.sets.map((set) => ({ ...set, id: createId('routine-set') })),
      })),
    };

    setRoutines((current) => [copy, ...current].slice(0, 7));
  }

  function startWorkout(routineId?: string) {
    const source = routines.find((routine) => routine.id === routineId);
    const now = new Date().toISOString();
    const workout: WorkoutSession = {
      id: createId('session'),
      routineId,
      name: source?.name ?? 'Entrenamiento libre',
      startedAt: now,
      durationSeconds: 0,
      totalVolumeKg: 0,
      status: 'active',
      exercises:
        source?.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({
            ...set,
            completed: false,
            actualWeightKg: set.targetWeightKg,
            actualReps: set.targetReps,
            actualRpe: set.targetRpe,
            actualRir: set.targetRir,
          })),
        })) ?? [],
    };

    setActiveSession(workout);
    return workout;
  }

  function toggleWorkoutSet(exerciseId: string, setId: string) {
    setActiveSession((current) => {
      if (!current) return current;

      const nextExercises = current.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  completed: !set.completed,
                  completedAt: !set.completed ? new Date().toISOString() : undefined,
                }
              : set,
          ),
        };
      });

      return {
        ...current,
        exercises: nextExercises,
        totalVolumeKg: calculateWorkoutVolume(nextExercises),
      };
    });
  }

  function finishWorkout(durationSeconds: number) {
    if (!activeSession) return undefined;

    const finished: WorkoutSession = {
      ...activeSession,
      durationSeconds,
      finishedAt: new Date().toISOString(),
      totalVolumeKg: calculateWorkoutVolume(activeSession.exercises),
      status: 'completed',
    };

    setSessions((current) => [finished, ...current]);
    setLastCompletedSession(finished);
    setActiveSession(undefined);
    return finished;
  }

  function cancelWorkout() {
    setActiveSession(undefined);
  }

  const value = useMemo<AppStoreValue>(
    () => ({
      exercises: EXERCISES,
      routines,
      sessions,
      activeSession,
      lastCompletedSession,
      createRoutine,
      duplicateRoutine,
      startWorkout,
      toggleWorkoutSet,
      finishWorkout,
      cancelWorkout,
    }),
    [activeSession, lastCompletedSession, routines, sessions],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore debe usarse dentro de AppStoreProvider');
  }
  return context;
}
