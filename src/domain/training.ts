import { EffortMode } from '@/src/domain/types';

export const EFFORT_MODES: { value: EffortMode; label: string; description: string }[] = [
  { value: 'rpe', label: 'RPE', description: 'Esfuerzo percibido' },
  { value: 'rir', label: 'RIR', description: 'Repeticiones en reserva' },
  { value: 'both', label: 'Ambos', description: 'RPE y RIR' },
  { value: 'none', label: 'Ninguno', description: 'Solo peso y repeticiones' },
];

export function isEffortMode(value: unknown): value is EffortMode {
  return value === 'rpe' || value === 'rir' || value === 'both' || value === 'none';
}

export function usesRpe(mode: EffortMode) {
  return mode === 'rpe' || mode === 'both';
}

export function usesRir(mode: EffortMode) {
  return mode === 'rir' || mode === 'both';
}

export function effortModeLabel(mode: EffortMode) {
  return EFFORT_MODES.find(item => item.value === mode)?.label ?? 'RPE';
}

export function formatRepRange(minimum: number, maximum: number) {
  return minimum === maximum ? String(minimum) : `${minimum}–${maximum}`;
}

export function normalizeRepRange(minimum: number, maximum: number) {
  const min = Math.max(0, Math.round(Number.isFinite(minimum) ? minimum : 0));
  const max = Math.max(min, Math.round(Number.isFinite(maximum) ? maximum : min));
  return { min, max };
}
