export const GOAL_OPTIONS = [
  'Ganar fuerza máxima',
  'Recomposición corporal',
  'Mantenimiento',
] as const;

export const REST_PRESETS = [90, 180, 300, 420] as const;
export const DEFAULT_BLOCK = 'Bloque base';
export const MAX_REST_SECONDS = 900;

export function normalizeGoal(value: string) {
  if (GOAL_OPTIONS.includes(value as (typeof GOAL_OPTIONS)[number])) return value;
  const normalized = value.toLocaleLowerCase('es-CL');
  if (normalized.includes('recompos')) return GOAL_OPTIONS[1];
  if (normalized.includes('manteni')) return GOAL_OPTIONS[2];
  return GOAL_OPTIONS[0];
}

export function formatRestDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function parseRestDuration(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds >= 0 && seconds <= MAX_REST_SECONDS ? seconds : null;
}

export function isPresetRest(seconds: number): seconds is (typeof REST_PRESETS)[number] {
  return REST_PRESETS.includes(seconds as (typeof REST_PRESETS)[number]);
}
