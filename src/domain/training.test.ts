import { describe, expect, it } from 'vitest';
import { effortModeLabel, formatRepRange, linkedEffortUpdate, linkedRirFromRpe, linkedRpeFromRir, normalizeRepRange, usesRir, usesRpe } from '@/src/domain/training';

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

describe('RPE/RIR vinculados', () => {
  it('convierte en ambas direcciones', () => {
    expect(linkedRirFromRpe(8.5)).toBe(1.5);
    expect(linkedRpeFromRir(3)).toBe(7);
  });

  it('actualiza el campo opuesto solo mientras están vinculados', () => {
    expect(linkedEffortUpdate('rpe', '8', true)).toEqual({ rpe: '8', rir: '2' });
    expect(linkedEffortUpdate('rir', '1.5', true)).toEqual({ rir: '1.5', rpe: '8.5' });
    expect(linkedEffortUpdate('rpe', '8', false)).toEqual({ rpe: '8' });
  });
});
