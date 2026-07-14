import { PropsWithChildren, createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_DATA, EXERCISES } from '@/src/data/seed';
import { ActiveExercise, ActiveSession, PersistedData, Profile, Routine, RoutineExercise, WorkoutHistory, makeId } from '@/src/domain/types';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { syncDataToCloud } from '@/src/services/cloudSync';
import { loadActiveSession, loadData, saveActiveSession, saveData } from '@/src/storage/appStorage';

type CreateRoutineInput = { name: string; day: number; exerciseIds: string[] };
type SetField = 'weight' | 'reps' | 'rpe';
export type SyncState = 'local' | 'syncing' | 'synced' | 'error';
type Store = PersistedData & {
  hydrated: boolean; activeSession: ActiveSession | null; exercises: typeof EXERCISES; syncState: SyncState; syncNow(): Promise<boolean>;
  createRoutine(input: CreateRoutineInput): Routine; duplicateRoutine(id: string): void; deleteRoutine(id: string): void;
  startWorkout(routineId?: string): void; addExerciseToActive(exerciseId: string): void; updateActiveSet(exerciseId: string, setId: string, field: SetField, value: string): void;
  toggleActiveSet(exerciseId: string, setId: string): void; addActiveSet(exerciseId: string): void; finishWorkout(): WorkoutHistory | null; cancelWorkout(): void;
  updateProfile(profile: Profile): void;
};

const Context = createContext<Store | null>(null);

function toActiveExercise(exercise: RoutineExercise): ActiveExercise {
  return { id: makeId('ae'), exerciseId: exercise.exerciseId, name: exercise.name, muscle: exercise.muscle, sets: exercise.sets.map(set => ({ id: makeId('as'), type: set.type, weight: String(set.weight), reps: String(set.reps), rpe: set.rpe ? String(set.rpe) : '', completed: false })) };
}

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<PersistedData>(DEFAULT_DATA);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('local');

  useEffect(() => { Promise.all([loadData(), loadActiveSession()]).then(([saved, active]) => { if (saved) setData(saved); if (active) setActiveSession(active); }).finally(() => setHydrated(true)); }, []);
  useEffect(() => { if (hydrated) saveData(data).catch(() => undefined); }, [data, hydrated]);
  useEffect(() => { if (hydrated) saveActiveSession(activeSession).catch(() => undefined); }, [activeSession, hydrated]);
  useEffect(() => { if (!hydrated || !isSupabaseConfigured) return; const timeout = setTimeout(() => { setSyncState('syncing'); syncDataToCloud(data).then(result => setSyncState(result === 'synced' ? 'synced' : 'local')).catch(() => setSyncState('error')); }, 1200); return () => clearTimeout(timeout); }, [data, hydrated]);

  const createRoutine = (input: CreateRoutineInput) => {
    const timestamp = new Date().toISOString();
    const exercises = input.exerciseIds.map(exerciseId => { const exercise = EXERCISES.find(item => item.id === exerciseId)!; return { id: makeId('re'), exerciseId, name: exercise.name, muscle: exercise.muscle, sets: [1,2,3].map(index => ({ id: makeId('rs'), type: 'working' as const, weight: 0, reps: 5, rpe: 7 + index * .5 })) }; });
    const routine = { id: makeId('routine'), name: input.name.trim(), day: input.day, exercises, createdAt: timestamp, updatedAt: timestamp };
    setData(current => current.routines.length >= 7 ? current : ({ ...current, routines: [routine, ...current.routines] })); return routine;
  };
  const duplicateRoutine = (id: string) => setData(current => { const source = current.routines.find(item => item.id === id); if (!source || current.routines.length >= 7) return current; const timestamp = new Date().toISOString(); const copy = { ...source, id: makeId('routine'), name: `${source.name} copia`, createdAt: timestamp, updatedAt: timestamp, exercises: source.exercises.map(exercise => ({ ...exercise, id: makeId('re'), sets: exercise.sets.map(set => ({ ...set, id: makeId('rs') })) })) }; return { ...current, routines: [copy, ...current.routines] }; });
  const deleteRoutine = (id: string) => setData(current => ({ ...current, routines: current.routines.filter(item => item.id !== id) }));
  const startWorkout = (routineId?: string) => { const routine = data.routines.find(item => item.id === routineId); setActiveSession({ id: makeId('session'), routineId, routineName: routine?.name ?? 'Entrenamiento libre', startedAt: Date.now(), exercises: routine?.exercises.map(toActiveExercise) ?? [] }); };
  const addExerciseToActive = (exerciseId: string) => setActiveSession(current => { if (!current || current.exercises.some(item => item.exerciseId === exerciseId)) return current; const exercise = EXERCISES.find(item => item.id === exerciseId); if (!exercise) return current; return { ...current, exercises: [...current.exercises, { id: makeId('ae'), exerciseId, name: exercise.name, muscle: exercise.muscle, sets: [1,2,3].map(() => ({ id: makeId('as'), type: 'working', weight: '0', reps: '5', rpe: '', completed: false })) }] }; });
  const updateActiveSet = (exerciseId: string, setId: string, field: SetField, value: string) => setActiveSession(current => current ? ({ ...current, exercises: current.exercises.map(exercise => exercise.id !== exerciseId ? exercise : ({ ...exercise, sets: exercise.sets.map(set => set.id === setId ? { ...set, [field]: value } : set) })) }) : current);
  const toggleActiveSet = (exerciseId: string, setId: string) => setActiveSession(current => current ? ({ ...current, exercises: current.exercises.map(exercise => exercise.id !== exerciseId ? exercise : ({ ...exercise, sets: exercise.sets.map(set => set.id !== setId ? set : ({ ...set, completed: !set.completed, completedAt: !set.completed ? new Date().toISOString() : undefined })) })) }) : current);
  const addActiveSet = (exerciseId: string) => setActiveSession(current => current ? ({ ...current, exercises: current.exercises.map(exercise => { if (exercise.id !== exerciseId) return exercise; const last = exercise.sets.at(-1); return { ...exercise, sets: [...exercise.sets, { id: makeId('as'), type: 'working', weight: last?.weight ?? '0', reps: last?.reps ?? '5', rpe: '', completed: false }] }; }) }) : current);
  const finishWorkout = () => { if (!activeSession) return null; const completed = activeSession.exercises.flatMap(exercise => exercise.sets).filter(set => set.completed); const history: WorkoutHistory = { id: activeSession.id, routineName: activeSession.routineName, date: new Date().toISOString(), durationSeconds: Math.max(1, Math.floor((Date.now() - activeSession.startedAt) / 1000)), setsCompleted: completed.length, totalVolume: Math.round(completed.reduce((sum, set) => set.type === 'working' ? sum + (Number(set.weight) || 0) * (Number(set.reps) || 0) : sum, 0)), exercises: activeSession.exercises }; setData(current => ({ ...current, history: [history, ...current.history] })); setActiveSession(null); return history; };
  const cancelWorkout = () => setActiveSession(null);
  const updateProfile = (profile: Profile) => setData(current => ({ ...current, profile }));
  const syncNow = async () => { if (!isSupabaseConfigured) { setSyncState('local'); return false; } setSyncState('syncing'); try { const result = await syncDataToCloud(data); setSyncState(result === 'synced' ? 'synced' : 'local'); return result === 'synced'; } catch { setSyncState('error'); return false; } };

  const value: Store = { ...data, hydrated, activeSession, exercises: EXERCISES, syncState, syncNow, createRoutine, duplicateRoutine, deleteRoutine, startWorkout, addExerciseToActive, updateActiveSet, toggleActiveSet, addActiveSet, finishWorkout, cancelWorkout, updateProfile };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() { const store = useContext(Context); if (!store) throw new Error('useAppStore debe usarse dentro de AppStoreProvider'); return store; }
