import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EXERCISES, SEED_ROUTINE_IDS, freshDefaultData } from '@/src/data/seed';
import { DEFAULT_BLOCK, GOAL_OPTIONS, MAX_REST_SECONDS } from '@/src/domain/profileOptions';
import { bestByRepCount, bestRpeAtOrAbove, heaviestWeight, previousSetPerformance } from '@/src/domain/records';
import { ActiveExercise, ActiveSession, EffortMode, PersistedData, Profile, Routine, RoutineExercise, SetType, WorkoutHistory, makeId } from '@/src/domain/types';
import { normalizeRepRange } from '@/src/domain/training';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { pullDataFromCloud, resetCloudSyncGuard, syncDataToCloud } from '@/src/services/cloudSync';
import { loadActiveSession, loadData, saveActiveSession, saveData } from '@/src/storage/appStorage';

export type CreateRoutineSetInput = { type: SetType; weight: number; repsMin: number; repsMax: number; rpe?: number; rir?: number };
export type CreateRoutineInput = {
  name: string;
  day: number;
  effortMode: EffortMode;
  exercises: { exerciseId: string; sets: CreateRoutineSetInput[] }[];
};

type SetField = 'weight' | 'reps' | 'rpe' | 'rir';
export type SyncState = 'local' | 'pulling' | 'syncing' | 'synced' | 'error';
export type PrEvent = { exerciseName: string; kind: 'weight' | 'reps' | 'rpe' };
type Store = PersistedData & {
  hydrated: boolean;
  activeSession: ActiveSession | null;
  exercises: typeof EXERCISES;
  syncState: SyncState;
  lastPrEvent: PrEvent | null;
  clearPrEvent(): void;
  initializeCloudSync(): Promise<boolean>;
  syncNow(): Promise<boolean>;
  createRoutine(input: CreateRoutineInput): Routine;
  updateRoutine(id: string, input: CreateRoutineInput): Routine;
  duplicateRoutine(id: string): void;
  deleteRoutine(id: string): void;
  startWorkout(routineId?: string): void;
  addExerciseToActive(exerciseId: string): void;
  updateActiveSet(exerciseId: string, setId: string, field: SetField, value: string): void;
  updateActiveExerciseNotes(exerciseId: string, notes: string): void;
  updateActiveSessionNotes(notes: string): void;
  toggleActiveSet(exerciseId: string, setId: string): void;
  addActiveSet(exerciseId: string): void;
  removeActiveSet(exerciseId: string, setId: string): void;
  updateActiveSessionSettings(effortMode: EffortMode, restSeconds: number): void;
  finishWorkout(): WorkoutHistory | null;
  cancelWorkout(): void;
  updateProfile(profile: Profile): void;
  resetAfterSignOut(): void;
};

const Context = createContext<Store | null>(null);

function toActiveExercise(exercise: RoutineExercise, history: WorkoutHistory[]): ActiveExercise {
  return {
    id: makeId('ae'),
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    notes: '',
    sets: exercise.sets.map((set, index) => {
      const previous = previousSetPerformance(history, exercise.exerciseId, index);
      return {
        id: makeId('as'),
        type: set.type,
        weight: previous?.weight ?? String(set.weight),
        reps: previous?.reps ?? String(set.repsMin),
        targetRepsMin: set.repsMin,
        targetRepsMax: set.repsMax,
        rpe: set.rpe == null ? '' : String(set.rpe),
        rir: set.rir == null ? '' : String(set.rir),
        completed: false,
      };
    }),
  };
}

function isUnmodifiedSeedData(data: PersistedData) {
  const routineIds = data.routines.map(item => item.id).sort().join(',');
  return routineIds === [...SEED_ROUTINE_IDS].sort().join(',')
    && data.history.length === 0
    && data.tombstones.length === 0
    && data.profile.displayName === ''
    && data.profile.bodyWeight === '85' && data.profile.height === '178'
    && data.profile.goal === GOAL_OPTIONS[0] && data.profile.level === DEFAULT_BLOCK
    && data.profile.defaultRestSeconds === 180;
}

function validEffortInput(field: SetField, value: string) {
  if ((field !== 'rpe' && field !== 'rir') || value === '') return true;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return false;
  return field === 'rpe' ? parsed >= 1 && parsed <= 10 : parsed >= 0 && parsed <= 10;
}

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<PersistedData>(() => freshDefaultData());
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [lastPrEvent, setLastPrEvent] = useState<PrEvent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('local');
  const [cloudReady, setCloudReady] = useState(false);
  const dataRef = useRef(data);
  const hasLocalUserDataRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const skipNextAutoSyncRef = useRef(false);
  const bootstrapPromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => {
    let active = true;
    Promise.all([loadData(), loadActiveSession()]).then(([saved, session]) => {
      if (!active) return;
      if (saved) {
        dataRef.current = saved;
        setData(saved);
        hasLocalUserDataRef.current = !isUnmodifiedSeedData(saved);
      }
      if (session) setActiveSession(session);
    }).finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (hydrated) saveData(data).catch(() => undefined); }, [data, hydrated]);
  useEffect(() => { if (hydrated) saveActiveSession(activeSession).catch(() => undefined); }, [activeSession, hydrated]);

  const initializeCloudSync = useCallback((): Promise<boolean> => {
    if (!isSupabaseConfigured) { setSyncState('local'); return Promise.resolve(false); }
    if (bootstrapPromiseRef.current) return bootstrapPromiseRef.current;
    const operation = (async () => {
      setSyncState('pulling');
      try {
        const pullResult = await pullDataFromCloud(dataRef.current, { includeLocalData: hasLocalUserDataRef.current });
        if (pullResult.status !== 'pulled') { setSyncState('local'); return false; }
        skipNextAutoSyncRef.current = true;
        dataRef.current = pullResult.data;
        setData(pullResult.data);
        await saveData(pullResult.data);
        hasLocalUserDataRef.current = true;
        cloudReadyRef.current = true;
        setCloudReady(true);
        setSyncState('syncing');
        const pushResult = await syncDataToCloud(pullResult.data);
        if (pushResult === 'synced') { setSyncState('synced'); return true; }
        if (pushResult === 'no-session') {
          cloudReadyRef.current = false;
          setCloudReady(false);
          setSyncState('local');
          return false;
        }
        setSyncState('error');
        return false;
      } catch {
        setSyncState('error');
        return false;
      }
    })();
    bootstrapPromiseRef.current = operation;
    operation.finally(() => { if (bootstrapPromiseRef.current === operation) bootstrapPromiseRef.current = null; });
    return operation;
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) { setSyncState('local'); return false; }
    if (!cloudReadyRef.current) return initializeCloudSync();
    setSyncState('syncing');
    try {
      const result = await syncDataToCloud(dataRef.current);
      if (result === 'synced') { setSyncState('synced'); return true; }
      if (result === 'pull-required') {
        cloudReadyRef.current = false;
        setCloudReady(false);
        return initializeCloudSync();
      }
      setSyncState('local');
      return false;
    } catch {
      setSyncState('error');
      return false;
    }
  }, [initializeCloudSync]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !cloudReady) return;
    if (skipNextAutoSyncRef.current) { skipNextAutoSyncRef.current = false; return; }
    const timeout = setTimeout(() => { syncNow().catch(() => undefined); }, 1200);
    return () => clearTimeout(timeout);
  }, [data, hydrated, cloudReady, syncNow]);

  const createRoutine = (input: CreateRoutineInput) => {
    const timestamp = new Date().toISOString();
    const exercises = input.exercises.flatMap(item => {
      const exercise = EXERCISES.find(candidate => candidate.id === item.exerciseId);
      if (!exercise) return [];
      return [{
        id: makeId('re'),
        exerciseId: item.exerciseId,
        name: exercise.name,
        muscle: exercise.muscle,
        sets: item.sets.map(set => {
          const range = normalizeRepRange(set.repsMin, set.repsMax);
          return { ...set, id: makeId('rs'), repsMin: range.min, repsMax: range.max };
        }),
      }];
    });
    const routine: Routine = {
      id: makeId('routine'),
      name: input.name.trim(),
      day: input.day,
      effortMode: input.effortMode,
      exercises,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setData(current => current.routines.length >= 7 ? current : ({ ...current, routines: [routine, ...current.routines] }));
    return routine;
  };

  const updateRoutine = (id: string, input: CreateRoutineInput): Routine => {
    const existing = data.routines.find(item => item.id === id);
    const timestamp = new Date().toISOString();
    const exercises = input.exercises.flatMap(item => {
      const exercise = EXERCISES.find(candidate => candidate.id === item.exerciseId);
      if (!exercise) return [];
      return [{
        id: makeId('re'),
        exerciseId: item.exerciseId,
        name: exercise.name,
        muscle: exercise.muscle,
        sets: item.sets.map(set => {
          const range = normalizeRepRange(set.repsMin, set.repsMax);
          return { ...set, id: makeId('rs'), repsMin: range.min, repsMax: range.max };
        }),
      }];
    });
    const routine: Routine = {
      id,
      name: input.name.trim(),
      day: input.day,
      effortMode: input.effortMode,
      exercises,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    setData(current => ({ ...current, routines: current.routines.map(item => item.id === id ? routine : item) }));
    return routine;
  };

  const duplicateRoutine = (id: string) => setData(current => {
    const source = current.routines.find(item => item.id === id);
    if (!source || current.routines.length >= 7) return current;
    const timestamp = new Date().toISOString();
    const copy = {
      ...source,
      id: makeId('routine'),
      name: `${source.name} copia`,
      createdAt: timestamp,
      updatedAt: timestamp,
      exercises: source.exercises.map(exercise => ({ ...exercise, id: makeId('re'), sets: exercise.sets.map(set => ({ ...set, id: makeId('rs') })) })),
    };
    return { ...current, routines: [copy, ...current.routines] };
  });

  const deleteRoutine = (id: string) => setData(current => {
    if (!current.routines.some(item => item.id === id)) return current;
    const tombstone = { entityType: 'routine' as const, recordId: id, deletedAt: new Date().toISOString() };
    return {
      ...current,
      routines: current.routines.filter(item => item.id !== id),
      tombstones: [...current.tombstones.filter(item => !(item.entityType === 'routine' && item.recordId === id)), tombstone],
    };
  });

  const startWorkout = (routineId?: string) => {
    const routine = data.routines.find(item => item.id === routineId);
    setActiveSession({
      id: makeId('session'),
      routineId,
      routineName: routine?.name ?? 'Entrenamiento libre',
      effortMode: routine?.effortMode ?? 'rpe',
      restSeconds: data.profile.defaultRestSeconds,
      startedAt: Date.now(),
      notes: '',
      exercises: routine?.exercises.map(exercise => toActiveExercise(exercise, data.history)) ?? [],
    });
  };

  const addExerciseToActive = (exerciseId: string) => setActiveSession(current => {
    if (!current || current.exercises.some(item => item.exerciseId === exerciseId)) return current;
    const exercise = EXERCISES.find(item => item.id === exerciseId);
    if (!exercise) return current;
    return {
      ...current,
      exercises: [...current.exercises, {
        id: makeId('ae'), exerciseId, name: exercise.name, muscle: exercise.muscle, notes: '',
        sets: [1, 2, 3].map((_, index) => {
          const previous = previousSetPerformance(data.history, exerciseId, index);
          return { id: makeId('as'), type: 'working', weight: previous?.weight ?? '0', reps: previous?.reps ?? '5', targetRepsMin: 5, targetRepsMax: 5, rpe: '', rir: '', completed: false };
        }),
      }],
    };
  });

  const updateActiveSet = (exerciseId: string, setId: string, field: SetField, value: string) => {
    if (!validEffortInput(field, value)) return;
    setActiveSession(current => current ? ({
      ...current,
      exercises: current.exercises.map(exercise => exercise.id !== exerciseId ? exercise : ({
        ...exercise,
        sets: exercise.sets.map(set => set.id === setId ? { ...set, [field]: value } : set),
      })),
    }) : current);
  };

  const updateActiveExerciseNotes = (exerciseId: string, notes: string) => setActiveSession(current => current ? ({
    ...current,
    exercises: current.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, notes } : exercise),
  }) : current);

  const updateActiveSessionNotes = (notes: string) => setActiveSession(current => current ? { ...current, notes } : current);

  const toggleActiveSet = (exerciseId: string, setId: string) => {
    const exercise = activeSession?.exercises.find(item => item.id === exerciseId);
    const set = exercise?.sets.find(item => item.id === setId);
    if (exercise && set && set.type === 'working' && !set.completed) {
      const hasPriorSession = data.history.some(session => session.exercises.some(item => item.exerciseId === exercise.exerciseId));
      if (hasPriorSession) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        const rpe = set.rpe.trim() ? Number(set.rpe) : null;
        const heaviest = heaviestWeight(data.history, exercise.exerciseId);
        const repRecord = bestByRepCount(data.history, exercise.exerciseId).find(item => item.reps === reps);
        if (heaviest && weight > heaviest.weight) {
          setLastPrEvent({ exerciseName: exercise.name, kind: 'weight' });
        } else if (reps > 0 && (!repRecord || weight > repRecord.weight)) {
          setLastPrEvent({ exerciseName: exercise.name, kind: 'reps' });
        } else if (rpe != null) {
          const bestRpe = bestRpeAtOrAbove(data.history, exercise.exerciseId, weight, reps);
          if (bestRpe != null && rpe < bestRpe) {
            setLastPrEvent({ exerciseName: exercise.name, kind: 'rpe' });
          }
        }
      }
    }
    setActiveSession(current => current ? ({
      ...current,
      exercises: current.exercises.map(item => item.id !== exerciseId ? item : ({
        ...item,
        sets: item.sets.map(s => s.id !== setId ? s : ({ ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined })),
      })),
    }) : current);
  };

  const addActiveSet = (exerciseId: string) => setActiveSession(current => current ? ({
    ...current,
    exercises: current.exercises.map(exercise => {
      if (exercise.id !== exerciseId) return exercise;
      const last = exercise.sets.at(-1);
      return {
        ...exercise,
        sets: [...exercise.sets, {
          id: makeId('as'),
          type: 'working',
          weight: last?.weight ?? '0',
          reps: last?.reps ?? '5',
          targetRepsMin: last?.targetRepsMin ?? 5,
          targetRepsMax: last?.targetRepsMax ?? 5,
          rpe: '',
          rir: '',
          completed: false,
        }],
      };
    }),
  }) : current);

  const removeActiveSet = (exerciseId: string, setId: string) => setActiveSession(current => current ? ({
    ...current,
    exercises: current.exercises.map(exercise => exercise.id === exerciseId
      ? { ...exercise, sets: exercise.sets.filter(set => set.id !== setId) }
      : exercise),
  }) : current);

  const updateActiveSessionSettings = (effortMode: EffortMode, restSeconds: number) => setActiveSession(current => current ? ({
    ...current,
    effortMode,
    restSeconds: Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(restSeconds))),
  }) : current);

  const finishWorkout = () => {
    if (!activeSession) return null;
    const exercises = activeSession.exercises.map(exercise => ({ ...exercise, notes: exercise.notes.trim() }));
    const completed = exercises.flatMap(exercise => exercise.sets).filter(set => set.completed);
    const history: WorkoutHistory = {
      id: activeSession.id,
      routineName: activeSession.routineName,
      effortMode: activeSession.effortMode,
      date: new Date().toISOString(),
      durationSeconds: Math.max(1, Math.floor((Date.now() - activeSession.startedAt) / 1000)),
      setsCompleted: completed.length,
      totalVolume: Math.round(completed.reduce((sum, set) => set.type === 'working' ? sum + (Number(set.weight) || 0) * (Number(set.reps) || 0) : sum, 0)),
      notes: activeSession.notes.trim(),
      exercises,
    };
    setData(current => ({ ...current, history: [history, ...current.history] }));
    setActiveSession(null);
    return history;
  };

  const clearPrEvent = useCallback(() => setLastPrEvent(null), []);
  const cancelWorkout = () => setActiveSession(null);
  const updateProfile = (profile: Profile) => setData(current => ({ ...current, profile: { ...profile, updatedAt: new Date().toISOString() } }));
  const resetAfterSignOut = () => {
    const defaults = freshDefaultData();
    dataRef.current = defaults;
    hasLocalUserDataRef.current = false;
    cloudReadyRef.current = false;
    skipNextAutoSyncRef.current = false;
    bootstrapPromiseRef.current = null;
    resetCloudSyncGuard();
    setCloudReady(false);
    setSyncState('local');
    setActiveSession(null);
    setData(defaults);
  };

  const value: Store = {
    ...data, hydrated, activeSession, exercises: EXERCISES, syncState, lastPrEvent, clearPrEvent, initializeCloudSync, syncNow,
    createRoutine, updateRoutine, duplicateRoutine, deleteRoutine, startWorkout, addExerciseToActive, updateActiveSet,
    updateActiveExerciseNotes, updateActiveSessionNotes, toggleActiveSet, addActiveSet, finishWorkout,
    removeActiveSet, updateActiveSessionSettings, cancelWorkout, updateProfile, resetAfterSignOut,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() {
  const store = useContext(Context);
  if (!store) throw new Error('useAppStore debe usarse dentro de AppStoreProvider');
  return store;
}
