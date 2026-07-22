// Tabla Tuchscherer de %1RM por RPE (filas) y reps (columnas), RPE 6–10 en pasos de 0.5.
const RPE_TABLE: Record<number, Record<string, number>> = {
  1: { '6': 83, '6.5': 85, '7': 86, '7.5': 88, '8': 89, '8.5': 91, '9': 92, '9.5': 94, '10': 100 },
  2: { '6': 81, '6.5': 82, '7': 84, '7.5': 85, '8': 87, '8.5': 88, '9': 90, '9.5': 91, '10': 92 },
  3: { '6': 79, '6.5': 80, '7': 82, '7.5': 83, '8': 85, '8.5': 86, '9': 88, '9.5': 89, '10': 90 },
  4: { '6': 77, '6.5': 78, '7': 80, '7.5': 81, '8': 83, '8.5': 84, '9': 86, '9.5': 87, '10': 88 },
  5: { '6': 75, '6.5': 76, '7': 78, '7.5': 79, '8': 80, '8.5': 82, '9': 83, '9.5': 85, '10': 86 },
  6: { '6': 73, '6.5': 74, '7': 76, '7.5': 77, '8': 78, '8.5': 80, '9': 81, '9.5': 83, '10': 84 },
  7: { '6': 71, '6.5': 72, '7': 74, '7.5': 75, '8': 76, '8.5': 78, '9': 79, '9.5': 81, '10': 82 },
  8: { '6': 69, '6.5': 70, '7': 72, '7.5': 73, '8': 74, '8.5': 76, '9': 77, '9.5': 79, '10': 80 },
  9: { '6': 67, '6.5': 68, '7': 70, '7.5': 71, '8': 72, '8.5': 74, '9': 75, '9.5': 77, '10': 78 },
  10: { '6': 65, '6.5': 66, '7': 68, '7.5': 69, '8': 70, '8.5': 72, '9': 73, '9.5': 75, '10': 76 },
  11: { '6': 63, '6.5': 64, '7': 66, '7.5': 67, '8': 68, '8.5': 70, '9': 71, '9.5': 73, '10': 74 },
  12: { '6': 61, '6.5': 62, '7': 64, '7.5': 65, '8': 66, '8.5': 68, '9': 69, '9.5': 71, '10': 72 },
};

const SBD_EXERCISE_IDS = new Set(['squat', 'bench', 'deadlift']);

// Fallback genérico cuando no hay RPE/RIR suficiente para las fórmulas específicas.
export const epley1RM = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

function clampReps(reps: number) {
  return Math.min(12, Math.max(1, Math.round(reps)));
}

function roundRpeToTableKey(rpe: number) {
  const clamped = Math.min(10, Math.max(6, rpe));
  return String(Math.round(clamped * 2) / 2);
}

export function estimate1RMFromRpeTable(weight: number, reps: number, rpe?: number | null): number | null {
  if (rpe == null) return null;
  const row = RPE_TABLE[clampReps(reps)];
  const percent = row[roundRpeToTableKey(rpe)];
  if (!percent) return null;
  return weight / (percent / 100);
}

export function estimate1RMAccessory(weight: number, reps: number, rpe?: number | null, rir?: number | null): number | null {
  const effectiveRir = rir != null ? rir : (rpe != null ? 10 - rpe : null);
  if (effectiveRir == null) return null;
  const projectedReps = reps + effectiveRir;
  return weight * (1 + projectedReps / 30);
}

export function estimateOneRepMax(exerciseId: string, weight: number, reps: number, rpe?: number | null, rir?: number | null): number {
  const specific = SBD_EXERCISE_IDS.has(exerciseId)
    ? estimate1RMFromRpeTable(weight, reps, rpe)
    : estimate1RMAccessory(weight, reps, rpe, rir);
  return specific ?? epley1RM(weight, reps);
}
