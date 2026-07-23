export type EstimateConfidence = 'high' | 'medium' | 'low';
export type OneRepMaxEstimate = {
  value: number;
  confidence: EstimateConfidence;
  effectiveRir: number;
  method: 'reps-in-reserve-epley';
  formulaVersion: 'rir-epley-v1';
};

export const E1RM_FORMULA_VERSION = 'rir-epley-v1' as const;

export const epley1RM = (weight: number, reps: number) => (
  reps <= 1 ? weight : weight * (1 + reps / 30)
);

function validEffort(rpe?: number | null, rir?: number | null) {
  if (rir != null && Number.isFinite(rir) && rir >= 0 && rir <= 10) return rir;
  if (rpe != null && Number.isFinite(rpe) && rpe >= 1 && rpe <= 10) return 10 - rpe;
  return null;
}

function confidenceFor(reps: number, effectiveRir: number): EstimateConfidence {
  if (effectiveRir > 4 || reps + effectiveRir > 12) return 'low';
  if (effectiveRir > 2 || reps + effectiveRir > 8) return 'medium';
  return 'high';
}

/**
 * Projects the performed set to failure and then applies Epley. This keeps the
 * model continuous below RPE 6 instead of silently treating every low-effort
 * set as RPE 6. Low-effort estimates are returned with lower confidence.
 */
export function estimatePerformedSet(
  weight: number,
  reps: number,
  rpe?: number | null,
  rir?: number | null,
): OneRepMaxEstimate | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps < 1) return null;
  const effectiveRir = validEffort(rpe, rir);
  if (effectiveRir == null) return null;
  const projectedReps = reps + effectiveRir;
  return {
    value: weight * (1 + projectedReps / 30),
    confidence: confidenceFor(reps, effectiveRir),
    effectiveRir,
    method: 'reps-in-reserve-epley',
    formulaVersion: E1RM_FORMULA_VERSION,
  };
}

// Compatibility helpers used by records and legacy callers.
export function estimate1RMFromRpeTable(weight: number, reps: number, rpe?: number | null): number | null {
  return estimatePerformedSet(weight, reps, rpe, null)?.value ?? null;
}

export function estimate1RMAccessory(weight: number, reps: number, rpe?: number | null, rir?: number | null): number | null {
  return estimatePerformedSet(weight, reps, rpe, rir)?.value ?? null;
}

export function estimateOneRepMax(
  _exerciseId: string,
  weight: number,
  reps: number,
  rpe?: number | null,
  rir?: number | null,
): number | null {
  return estimatePerformedSet(weight, reps, rpe, rir)?.value ?? null;
}
