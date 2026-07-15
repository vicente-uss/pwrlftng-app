import { describe, expect, it } from 'vitest';
import { effortModeLabel, formatRepRange, normalizeRepRange, usesRir, usesRpe } from '@/src/domain/training';

describe('training helpers', () => {
  it('muestra repeticiones fijas o como rango', () => {
    expect(formatRepRange(5, 5)).toBe('5');
    expect(formatRepRange(5, 7)).toBe('5–7');
  });

  it('corrige rangos invertidos sin producir datos inválidos', () => {
    expect(normalizeRepRange(7, 5)).toEqual({ min: 7, max: 7 });
    expect(normalizeRepRange(-2, 5)).toEqual({ min: 0, max: 5 });
  });

  it('activa los campos correctos para cada modo', () => {
    expect(usesRpe('rpe')).toBe(true);
    expect(usesRir('rpe')).toBe(false);
    expect(usesRpe('both')).toBe(true);
    expect(usesRir('both')).toBe(true);
    expect(usesRpe('none')).toBe(false);
    expect(usesRir('none')).toBe(false);
    expect(effortModeLabel('rir')).toBe('RIR');
  });
});
