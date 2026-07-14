import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_DATA, EXERCISES } from '@/src/data/seed';
import { ActiveExercise, ActiveSession, PersistedData, Profile, Routine, RoutineExercise, WorkoutHistory, makeId } from '@/src/domain/types';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { pullDataFromCloud, syncDataToCloud } from '@/src/services/cloudSync';
import { loadActiveSession, loadData, saveActiveSession, saveData } from '@/src/storage/appStorage';

type CreateRoutineInput = { name: string; day: number; exerciseIds: string[] };
type SetField = 'weight' | 'reps' | 'rpe';
export type SyncState = 'local' | 'pulling' | 'syncing' | 'synced' | 'error';
type Store = PersistedData & {
  hydrated: boolean; activeSession: ActiveSession | null; exercises: typeof EXERCISES; syncState: SyncState;
  initializeCloudSync(): Promise<boolean>; syncNow(): Promise<boolean>;
  createRoutine(input: CreateRoutineInput): Routine; duplicateRoutine(id: string): void; deleteRoutine(id: string): void;
  startWorkout(routineId?: string): void; addExerciseToActive(exerciseId: string): void; updateActiveSet(exerciseId: string, setId: string, field: SetField, value: string): void;
  toggleActiveSet(exerciseId: string, setId: string): void; addActiveSet(exerciseId: string): void; finishWorkout(): WorkoutHistory | null; cancelWorkout(): void;
  updateProfile(profile: Profile): void;
};

const Context = createContext<Store | null>(null);

function toActiveExercise(exercise: RoutineExercise): ActiveExercise {
  return { id: makeId('ae'), exerciseId: exercise.exerciseId, name: exercise.name, muscle: exercise.muscle, sets: exercise.sets.map(set => ({ id: makeId('as'), type: set.type, weight: String(set.weight), reps: String(set.reps), rpe: set.rpe ? String(set.rpe) : '', completed: false })) };
}

function isUnmodifiedSeedData(data: PersistedData) {
  const routineIds = data.routines.map(item => item.id).sort().join(',');
  return routineIds === 'routine-a,routine-b,routine-c'
    && data.history.length === 1 && data.history[0]?.id === 'history-demo'
    && data.tombstones.length === 0
    && data.profile.bodyWeight === '85' && data.profile.height === '178'
    && data.profile.goal === 'Fuerza máxima' && data.profile.level === 'Intermedio'
    && data.profile.defaultRestSeconds === 180;
}

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<PersistedData>(DEFAULT_DATA);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
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
    const exercises = input.exerciseIds.map(exerciseId => { const exercise = EXERCISES.find(item => item.id === exerciseId)!; return { id: makeId('re'), exerciseId, name: exercise.name, muscle: exercise.muscle, sets: [1,2,3].map(index => ({ id: makeId('rs'), type: 'working' as const, weight: 0, reps: 5, rpe: 7 + index * .5 })) }; });
    const routine = { id: makeId('routine'), name: input.name.trim(), day: input.day, exercises, createdAt: timestamp, updatedAt: timestamp };
    setData(current => current.routines.length >= 7 ? current : ({ ...current, routines: [routine, ...current.routines] })); return routine;
  };
  const duplicateRoutine = (id: string) => setData(current => { const source = current.routines.find(item => item.id === id); if (!source || current.routines.length >= 7) return current; const timestamp = new Date().toISOString(); const copy = { ...source, id: makeId('routine'), name: `${source.name} copia`, createdAt: timestamp, updatedAt: timestamp, exercises: source.exercises.map(exercise => ({ ...exercise, id: makeId('re'), sets: exercise.sets.map(set => ({ ...set, id: makeId('rs') })) })) }; return { ...current, routines: [copy, ...current.routines] }; });
  const deleteRoutine = (id: string) => setData(current => {
    if (!current.routines.some(item => item.id === id)) return current;
    const tombstone = { entityType: 'routine' as const, recordId: id, deletedAt: new Date().toISOString() };
    return { ...current, routines: current.routines.filter(item => item.id !== id), tombstones: [...current.tombstones.filter(item => !(item.entityType === 'routine' && item.recordId === id)), tombstone] };
  });
  const startWorkout = (routineId?: string) => { const routine = data.routines.find(item => item.id === routineId); setActiveSession({ id: makeId('session'), routineId, routineName: routine?.name ?? 'Entrenamiento libre', startedAt: Date.now(), exercises: routine?.exercises.map(toActiveExercise) ?? [] }); };
  const addExerciseToActive = (exerciseId: string) => setActiveSession(current => { if (!current || current.exercises.some(item => item.exerciseId === exerciseId)) return current; const exercise = EXERCISES.find(item => item.id === exerciseId); if (!exercise) return current; return { ...current, exercises: [...current.exercises, { id: makeId('ae'), exerciseId, name: exercise.name, muscle: exercise.muscle, sets: [1,2,3].map(() => ({ id: makeId('as'), type: 'working', weight: '0', reps: '5', rpe: '', completed: false })) }] }; });
  const updateActiveSet = (exerciseId: string, setId: string, field: SetField, value: string) => setActiveSession(current => current ? ({ ...current, exercises: current.exercises.map(exercise => exercise.id !== exerciseId ? exercise : ({ ...exercise, sets: exercise.sets.map(set => set.id === setId ? { ...set, [field]: value } : set) })) }) : current);
  const toggleActiveSet = (exerciseId: string, setId: string) => setActiveSession(current => current ? ({ ...current, exercises: current.exercises.map(exercise => exercise.id !== exerciseId ? exercise : ({ ...exercise, sets: exercise.sets.map(set => set.id !== setId ? set : ({ ...set, completed: !set.completed, completedAt: !set.completed ? new Date().toISOString() : undefined })) })) }) : current);
  const addActiveSet = (exerciseId: string) => setActiveSession(current => current ? ({ ...current, exercises: current.exercises.map(exercise => { if (exercise.id !== exerciseId) return exercise; const last = exercise.sets.at(-1); return { ...exercise, sets: [...exercise.sets, { id: makeId('as'), type: 'working', weight: last?.weight ?? '0', reps: last?.reps ?? '5', rpe: '', completed: false }] }; }) }) : current);
  const finishWorkout = () => { if (!activeSession) return null; const completed = activeSession.exercises.flatMap(exercise => exercise.sets).filter(set => set.completed); const history: WorkoutHistory = { id: activeSession.id, routineName: activeSession.routineName, date: new Date().toISOString(), durationSeconds: Math.max(1, Math.floor((Date.now() - activeSession.startedAt) / 1000)), setsCompleted: completed.length, totalVolume: Math.round(completed.reduce((sum, set) => set.type === 'working' ? sum + (Number(set.weight) || 0) * (Number(set.reps) || 0) : sum, 0)), exercises: activeSession.exercises }; setData(current => ({ ...current, history: [history, ...current.history] })); setActiveSession(null); return history; };
  const cancelWorkout = () => setActiveSession(null);
  const updateProfile = (profile: Profile) => setData(current => ({ ...current, profile: { ...profile, updatedAt: new Date().toISOString() } }));

  const value: Store = { ...data, hydrated, activeSession, exercises: EXERCISES, syncState, initializeCloudSync, syncNow, createRoutine, duplicateRoutine, deleteRoutine, startWorkout, addExerciseToActive, updateActiveSet, toggleActiveSet, addActiveSet, finishWorkout, cancelWorkout, updateProfile };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() { const store = useContext(Context); if (!store) throw new Error('useAppStore debe usarse dentro de AppStoreProvider'); return store; }
