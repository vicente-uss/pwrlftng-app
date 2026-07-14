import { DeletionTombstone, PersistedData, Profile, Routine, WorkoutHistory } from '@/src/domain/types';

function time(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mergeById<T extends { id: string }>(local: T[], remote: T[], updatedAt: (item: T) => string): T[] {
  const merged = new Map(local.map(item => [item.id, item]));
  remote.forEach(item => {
    const current = merged.get(item.id);
    if (!current || time(updatedAt(item)) >= time(updatedAt(current))) merged.set(item.id, item);
  });
  return [...merged.values()];
}

export function mergeTombstones(local: DeletionTombstone[], remote: DeletionTombstone[]) {
  const merged = new Map<string, DeletionTombstone>();
  [...local, ...remote].forEach(item => {
    const key = `${item.entityType}:${item.recordId}`;
    const current = merged.get(key);
    if (!current || time(item.deletedAt) >= time(current.deletedAt)) merged.set(key, item);
  });
  return [...merged.values()];
}

export function withoutDeletedRoutines(routines: Routine[], tombstones: DeletionTombstone[]) {
  const deletedIds = new Set(tombstones.filter(item => item.entityType === 'routine').map(item => item.recordId));
  return routines.filter(routine => !deletedIds.has(routine.id));
}

function newestProfile(local: Profile, remote: Profile) {
  return time(remote.updatedAt) >= time(local.updatedAt) ? remote : local;
}

function newestHistory(local: WorkoutHistory[], remote: WorkoutHistory[]) {
  return mergeById(local, remote, workout => workout.date).sort((a, b) => time(b.date) - time(a.date));
}

export function mergePersistedData(local: PersistedData, remote: PersistedData, includeLocalData: boolean): PersistedData {
  const tombstones = includeLocalData ? mergeTombstones(local.tombstones, remote.tombstones) : remote.tombstones;
  const routines = includeLocalData ? mergeById(local.routines, remote.routines, routine => routine.updatedAt) : remote.routines;
  return {
    routines: withoutDeletedRoutines(routines, tombstones),
    history: includeLocalData ? newestHistory(local.history, remote.history) : [...remote.history].sort((a, b) => time(b.date) - time(a.date)),
    profile: includeLocalData ? newestProfile(local.profile, remote.profile) : remote.profile,
    tombstones,
  };
}
