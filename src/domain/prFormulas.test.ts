import { describe, expect, it } from 'vitest';
import { epley1RM, estimate1RMAccessory, estimate1RMFromRpeTable, estimateOneRepMax } from '@/src/domain/prFormulas';

describe('estimate1RMFromRpeTable', () => {
  it('calcula el e1RM usando el porcentaje de la tabla Tuchscherer', () => {
    expect(estimate1RMFromRpeTable(100, 5, 8)).toBeCloseTo(100 / 0.8);
  });

  it('redondea el RPE al 0.5 más cercano y hace clamp entre 6 y 10', () => {
    expect(estimate1RMFromRpeTable(100, 5, 8.2)).toBeCloseTo(100 / 0.8);
    expect(estimate1RMFromRpeTable(100, 5, 4)).toBeCloseTo(100 / 0.75);
    expect(estimate1RMFromRpeTable(100, 5, 11)).toBeCloseTo(100 / 0.86);
  });

  it('hace clamp de reps entre 1 y 12', () => {
    expect(estimate1RMFromRpeTable(100, 20, 8)).toBeCloseTo(estimate1RMFromRpeTable(100, 12, 8) as number);
  });

  it('devuelve null si no hay RPE', () => {
    expect(estimate1RMFromRpeTable(100, 5, null)).toBeNull();
    expect(estimate1RMFromRpeTable(100, 5, undefined)).toBeNull();
  });
});

describe('estimate1RMAccessory', () => {
  it('usa el RIR directo si viene', () => {
    expect(estimate1RMAccessory(50, 10, undefined, 2)).toBeCloseTo(50 * (1 + 12 / 30));
  });

  it('deriva el RIR desde el RPE si no viene RIR', () => {
    expect(estimate1RMAccessory(50, 10, 8, undefined)).toBeCloseTo(50 * (1 + 12 / 30));
  });

  it('devuelve null si no hay ni RPE ni RIR', () => {
    expect(estimate1RMAccessory(50, 10)).toBeNull();
  });
});

describe('estimateOneRepMax', () => {
  it('usa la tabla RPE para squat, bench y deadlift', () => {
    expect(estimateOneRepMax('squat', 100, 5, 8)).toBeCloseTo(100 / 0.8);
    expect(estimateOneRepMax('bench', 100, 5, 8)).toBeCloseTo(100 / 0.8);
    expect(estimateOneRepMax('deadlift', 100, 5, 8)).toBeCloseTo(100 / 0.8);
  });

  it('usa la fórmula de accesorios para cualquier otro ejercicio', () => {
    expect(estimateOneRepMax('curl', 20, 10, 8)).toBeCloseTo(20 * (1 + 12 / 30));
  });

  it('cae a epley1RM cuando no hay RPE ni RIR disponibles', () => {
    expect(estimateOneRepMax('squat', 100, 5)).toBe(epley1RM(100, 5));
    expect(estimateOneRepMax('curl', 20, 10)).toBe(epley1RM(20, 10));
  });
});
