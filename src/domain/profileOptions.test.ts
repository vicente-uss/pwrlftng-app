import { describe, expect, it } from 'vitest';
import { formatRestDuration, normalizeGoal, parseRestDuration } from '@/src/domain/profileOptions';

describe('profile options', () => {
  it('convierte descansos entre segundos y MM:SS', () => {
    expect(formatRestDuration(90)).toBe('1:30');
    expect(parseRestDuration('7:00')).toBe(420);
    expect(parseRestDuration('15:00')).toBe(900);
  });

  it('rechaza descansos con formato o duración inválida', () => {
    expect(parseRestDuration('3 minutos')).toBeNull();
    expect(parseRestDuration('16:00')).toBeNull();
    expect(parseRestDuration('3:75')).toBeNull();
  });

  it('migra objetivos anteriores a las opciones actuales', () => {
    expect(normalizeGoal('Fuerza máxima')).toBe('Ganar fuerza máxima');
    expect(normalizeGoal('Recomposición')).toBe('Recomposición corporal');
  });
});
