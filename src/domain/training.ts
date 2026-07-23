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

function roundedEffort(value: number) {
  return Math.round(value * 10) / 10;
}

export function linkedRirFromRpe(rpe: number): number | null {
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) return null;
  return roundedEffort(10 - rpe);
}

export function linkedRpeFromRir(rir: number): number | null {
  if (!Number.isFinite(rir) || rir < 0 || rir > 9) return null;
  return roundedEffort(10 - rir);
}

export function linkedEffortUpdate(
  field: 'rpe' | 'rir',
  value: string,
  linked: boolean,
): Partial<Record<'rpe' | 'rir', string>> {
  if (!linked || !value.trim()) return { [field]: value };
  const parsed = Number(value);
  const counterpart = field === 'rpe' ? linkedRirFromRpe(parsed) : linkedRpeFromRir(parsed);
  return counterpart == null
    ? { [field]: value }
    : field === 'rpe'
      ? { rpe: value, rir: String(counterpart) }
      : { rir: value, rpe: String(counterpart) };
}
