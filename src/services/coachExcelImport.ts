import * as XLSX from 'xlsx';
import { EXERCISE_CATALOG } from '@/src/data/seed';
import { Exercise, makeId } from '@/src/domain/types';
import { BlockDraftInfo, BlockDraftWeek } from '@/src/services/coachService';
import { ProgramWeekType } from '@/src/services/athleteBlockService';
import { ActivationResource } from '@/src/services/activationService';

type Cell = string | number | boolean | Date | null | undefined;

export type CoachWorkbookImport = {
  info: BlockDraftInfo;
  weeks: BlockDraftWeek[];
  activationSheetNames: string[];
  activation: ActivationResource | null;
  skippedExercises: string[];
  importedExerciseCount: number;
};

function text(value: Cell) {
  return value == null ? '' : String(value).trim();
}

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function firstNumber(value: Cell) {
  const match = text(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseDateMetadata(rows: Cell[][]) {
  const dateRow = rows.flat().map(text).find(value => /^fecha de inicio\s*:/i.test(value));
  const raw = dateRow?.split(':').slice(1).join(':').trim() ?? '';
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseGoalMetadata(rows: Cell[][]) {
  const goalRow = rows.flat().map(text).find(value => /^metas?\s*:/i.test(value));
  return goalRow?.split(':').slice(1).join(':').trim() || null;
}

function weekTypeFromName(name: string): ProgramWeekType {
  const value = normalized(name);
  if (value.includes('low stress')) return 'low_stress';
  if (value.includes('deload')) return 'deload';
  if (value.includes('cierre')) return 'closing';
  return 'training';
}

export function parseActivationRows(rows: Cell[][]): ActivationResource | null {
  const headerIndex = rows.findIndex(row => normalized(text(row[0])) === 'ejercicios');
  if (headerIndex < 0) return null;
  const endIndex = rows.findIndex((row, index) =>
    index > headerIndex && normalized(text(row[0])).startsWith('observaciones instrucciones'));
  const itemRows = rows
    .slice(headerIndex + 1, endIndex > headerIndex ? endIndex : rows.length)
    .filter(row => text(row[0]));
  if (!itemRows.length) return null;

  const sectionMap = new Map<string, ActivationResource['sections'][number]>();
  itemRows.forEach(row => {
    const movementName = text(row[0]);
    const sectionName = text(row[4]) || 'Activación general';
    const repetitions = text(row[6]);
    const durationMatch = repetitions.match(/(\d+)\s*(?:seg|sec|s)\b/i);
    const section = sectionMap.get(sectionName) ?? {
      id: makeId('activation-section'),
      name: sectionName,
      items: [],
    };
    section.items.push({
      id: makeId('activation-item'),
      exerciseId: null,
      movementName,
      repetitions: durationMatch ? '' : repetitions,
      durationSeconds: durationMatch ? Number(durationMatch[1]) : null,
      rounds: firstNumber(row[5]),
      restSeconds: null,
      loadText: text(row[7]),
      equipment: '',
      instructions: text(row[8]),
      notes: '',
      videoUrl: text(row[10]),
    });
    sectionMap.set(sectionName, section);
  });
  const introduction = endIndex > headerIndex
    ? rows.slice(endIndex + 1).map(row => text(row[0])).filter(Boolean).join('\n')
    : '';
  return {
    title: 'Activación',
    introduction,
    sections: [...sectionMap.values()],
  };
}

function resolveExerciseId(name: string, catalog: Exercise[]) {
  const target = normalized(name);
  const exact = catalog.find(exercise => normalized(exercise.name) === target);
  if (exact) return exact.id;
  const aliases: [RegExp, string][] = [
    [/\bsquat\b|\bsentadilla\b/, 'squat'],
    [/\bbench\b|\bbanca\b/, 'bench'],
    [/\bdeadlift\b|\bpeso muerto\b/, 'deadlift'],
    [/\boverhead\b|\bohp\b|\bmilitary press\b/, 'ohp'],
    [/\bromanian\b|\brdl\b/, 'rdl'],
    [/\brow\b|\bremo\b/, 'row'],
    [/\bpulldown\b|\bjalon\b/, 'pulldown'],
    [/\bcurl\b/, 'curl'],
    [/\btricep\b|\btriceps\b|\bpushdown\b/, 'pushdown'],
    [/\bleg curl\b/, 'leg-curl'],
  ];
  return aliases.find(([pattern]) => pattern.test(target))?.[1] ?? null;
}

function isDayLabel(value: Cell) {
  return /^d[ií]a\s+[ivx0-9]+(?:\s*:|$)/i.test(text(value));
}

function dayName(value: Cell, index: number) {
  const raw = text(value).split(':')[0]?.trim();
  return raw || `Día ${index + 1}`;
}

export function parseWeekRows(
  sheetName: string,
  rows: Cell[][],
  weekNumber: number,
  catalog = EXERCISE_CATALOG,
) {
  const dayStarts = rows
    .map((row, index) => ({ index, label: row[0] }))
    .filter(item => isDayLabel(item.label));
  const skipped = new Set<string>();
  let importedExerciseCount = 0;

  const days = dayStarts.map((start, dayIndex) => {
    const end = dayStarts[dayIndex + 1]?.index ?? rows.length;
    const exerciseRows = rows.slice(start.index + 2, end).filter(row => text(row[0]));
    const groups: { name: string; rows: Cell[][] }[] = [];
    exerciseRows.forEach(row => {
      const name = text(row[0]);
      if (!name || /^ejercicios?$/i.test(name)) return;
      const previous = groups.at(-1);
      if (previous && normalized(previous.name) === normalized(name)) previous.rows.push(row);
      else groups.push({ name, rows: [row] });
    });

    const prescriptionNotes: string[] = [];
    const exercises = groups.flatMap(group => {
      const exerciseId = resolveExerciseId(group.name, catalog);
      if (!exerciseId) {
        skipped.add(group.name);
        return [];
      }
      importedExerciseCount += 1;
      const sets = group.rows.flatMap(row => {
        const series = Math.max(1, Math.min(20, Math.round(firstNumber(row[4]) ?? 1)));
        const reps = Math.max(0, Math.round(firstNumber(row[5]) ?? 0));
        const weight = Math.max(0, firstNumber(row[8]) ?? 0);
        const rpe = firstNumber(row[6]);
        const rir = firstNumber(row[7]);
        const rawWeight = text(row[8]);
        const details = [text(row[9]), text(row[10])].filter(Boolean).join(' · ');
        if (rawWeight && (rawWeight.includes('-') || /%|ultima|bw|b\/w/i.test(rawWeight))) {
          prescriptionNotes.push(`${group.name}: ${rawWeight}${details ? ` · ${details}` : ''}`);
        } else if (details) {
          prescriptionNotes.push(`${group.name}: ${details}`);
        }
        return Array.from({ length: series }, () => ({
          id: makeId('program-set'),
          weight,
          repsMin: reps,
          repsMax: reps,
          rpe: rpe != null && rpe >= 1 && rpe <= 10 ? rpe : null,
          rir: rir != null && rir >= 0 && rir <= 10 ? rir : null,
        }));
      });
      return [{
        id: makeId('program-exercise'),
        exerciseId,
        sets,
      }];
    });

    const hasRpe = exercises.some(exercise => exercise.sets.some(set => set.rpe != null));
    const hasRir = exercises.some(exercise => exercise.sets.some(set => set.rir != null));
    return {
      id: makeId('program-day'),
      name: dayName(start.label, dayIndex),
      trainingDay: dayIndex + 1,
      effortMode: hasRpe && hasRir ? 'both' as const : hasRir ? 'rir' as const : hasRpe ? 'rpe' as const : 'none' as const,
      prescriptionNotes: [...new Set(prescriptionNotes)].join('\n') || null,
      status: 'published' as const,
      exercises,
    };
  }).filter(day => day.exercises.length > 0);

  const week: BlockDraftWeek = {
    id: makeId('program-week'),
    name: sheetName,
    weekNumber,
    isWarmup: false,
    weekType: weekTypeFromName(sheetName),
    status: 'published',
    startDateOverride: null,
    days,
  };
  return { week, skippedExercises: [...skipped], importedExerciseCount };
}

export function parseCoachWorkbook(
  buffer: ArrayBuffer,
  fallbackName = 'Mesociclo importado',
  catalog = EXERCISE_CATALOG,
): CoachWorkbookImport {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const activationSheetNames = workbook.SheetNames.filter(name => {
    const value = normalized(name);
    return value.includes('activacion') || value.includes('calentamiento')
      || value.includes('warm up') || value.includes('warmup') || value.includes('drill');
  });
  const effectiveSheetNames = workbook.SheetNames.filter(name => !activationSheetNames.includes(name));
  if (!effectiveSheetNames.length) throw new Error('El Excel no contiene hojas de semanas efectivas.');

  const matrices = effectiveSheetNames.map(name => XLSX.utils.sheet_to_json<Cell[]>(
    workbook.Sheets[name],
    { header: 1, defval: null, raw: false },
  ));
  const imported = matrices.map((rows, index) =>
    parseWeekRows(effectiveSheetNames[index], rows, index + 1, catalog));
  const activation = activationSheetNames.length
    ? parseActivationRows(XLSX.utils.sheet_to_json<Cell[]>(
      workbook.Sheets[activationSheetNames[0]],
      { header: 1, defval: null, raw: false },
    ))
    : null;
  const weeks = imported.map(item => item.week).filter(week => week.days.length > 0);
  if (!weeks.length) {
    throw new Error('No encontramos días entrenables con ejercicios reconocidos en las hojas semanales.');
  }

  return {
    info: {
      name: fallbackName.replace(/\.(xlsx|xls)$/i, '').trim() || 'Mesociclo importado',
      goalText: parseGoalMetadata(matrices[0]),
      startDate: parseDateMetadata(matrices[0]),
      totalWeeks: weeks.length,
      status: 'draft',
      currentWeekNumber: 1,
    },
    weeks,
    activationSheetNames,
    activation,
    skippedExercises: [...new Set(imported.flatMap(item => item.skippedExercises))],
    importedExerciseCount: imported.reduce((sum, item) => sum + item.importedExerciseCount, 0),
  };
}
