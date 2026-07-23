import { describe, expect, it } from 'vitest';
import { estimate1RMAccessory, estimate1RMFromRpeTable, estimateOneRepMax, estimatePerformedSet } from '@/src/domain/prFormulas';

describe('e1RM con esfuerzo ejecutado', () => {
  it('proyecta repeticiones hasta el fallo usando RIR', () => {
    expect(estimatePerformedSet(100, 5, undefined, 2)?.value).toBeCloseTo(100 * (1 + 7 / 30));
  });

  it('deriva RIR desde RPE cuando no se registró RIR', () => {
    expect(estimatePerformedSet(100, 5, 8)?.value).toBeCloseTo(100 * (1 + 7 / 30));
  });

  it('no transforma silenciosamente RPE bajo en RPE 6', () => {
    const rpe5 = estimatePerformedSet(100, 5, 5);
    const rpe6 = estimatePerformedSet(100, 5, 6);
    expect(rpe5?.value).toBeGreaterThan(rpe6?.value ?? 0);
    expect(rpe5?.confidence).toBe('low');
  });

  it('marca menor confianza lejos del fallo', () => {
    expect(estimatePerformedSet(100, 5, 9)?.confidence).toBe('high');
    expect(estimatePerformedSet(100, 5, 7)?.confidence).toBe('medium');
    expect(estimatePerformedSet(100, 5, 5)?.confidence).toBe('low');
  });

  it('no inventa e1RM sin RPE ni RIR', () => {
    expect(estimatePerformedSet(100, 5)).toBeNull();
    expect(estimateOneRepMax('squat', 100, 5)).toBeNull();
  });

  it('mantiene helpers compatibles sin distinguir kilos entre variantes', () => {
    expect(estimate1RMFromRpeTable(100, 5, 8)).toBeCloseTo(100 * (1 + 7 / 30));
    expect(estimate1RMAccessory(50, 10, undefined, 2)).toBeCloseTo(50 * (1 + 12 / 30));
  });
});
