import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseActivationRows, parseCoachWorkbook, parseWeekRows } from '@/src/services/coachExcelImport';

describe('importación de planificación Excel', () => {
  it('convierte días, agrupa filas repetidas y conserva rangos como indicaciones', () => {
    const rows = [
      ['Día I : AI'],
      ['Ejercicios', null, null, 'Adjuntar video', 'Series', 'Repes', 'RPE', 'RIR', 'Peso', 'Info. adicional', 'Notas'],
      ['Squat', null, null, '🎥', 1, 5, 7, 3, '130 (kg)', 'Competencia', 'Pausa'],
      ['Squat', null, null, '🎥', 1, 5, 8, 2, '140 (kg)', 'Competencia', 'Pausa'],
      ['Bench press', null, null, '🎥', 2, 6, 8, 2, '80 (kg) - 85 (kg)', 'Soft touch', 'Controlado'],
    ];

    const parsed = parseWeekRows('Semana I', rows, 1);

    expect(parsed.week.days).toHaveLength(1);
    expect(parsed.week.days[0].effortMode).toBe('both');
    expect(parsed.week.days[0].exercises[0].sets).toHaveLength(2);
    expect(parsed.week.days[0].exercises[1].sets).toHaveLength(2);
    expect(parsed.week.days[0].prescriptionNotes).toContain('80 (kg) - 85 (kg)');
    expect(parsed.skippedExercises).toEqual([]);
  });

  it('excluye activación y reconoce semanas low stress y cierre', () => {
    const workbook = XLSX.utils.book_new();
    const activation = XLSX.utils.aoa_to_sheet([['Activación'], ['Ejercicios']]);
    const trainingRows = [
      ['Metas: Fuerza base'],
      ['Fecha de inicio: 18/05/2026'],
      [],
      ['Día I : AI'],
      ['Ejercicios', null, null, 'Adjuntar video', 'Series', 'Repes', 'RPE', 'RIR', 'Peso'],
      ['Deadlift', null, null, '🎥', 1, 3, 8, 2, '180 (kg)'],
    ];
    XLSX.utils.book_append_sheet(workbook, activation, 'ActivaciónDrills');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(trainingRows), 'Low stress week');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(trainingRows), 'Deload Cierre de bloque');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const parsed = parseCoachWorkbook(bytes, 'Programación IV.xlsx');

    expect(parsed.activationSheetNames).toEqual(['ActivaciónDrills']);
    expect(parsed.weeks.map(week => week.weekType)).toEqual(['low_stress', 'deload']);
    expect(parsed.info.name).toBe('Programación IV');
    expect(parsed.info.goalText).toBe('Fuerza base');
    expect(parsed.info.startDate).toBe('2026-05-18');
  });
  it('convierte la hoja de Activación en fases informativas sin sesiones', () => {
    const parsed = parseActivationRows([
      ['Ejercicios', null, null, null, 'Sesión*', 'Series', 'Repes', 'Peso', 'Notas', null, 'Videos'],
      ['90/90 Hip lift', null, null, null, 'Todas las sesiones', 2, 5, '(b/w)', 'Respiración controlada', null, 'https://example.com/a'],
      ['Pigeon stretch', null, null, null, 'Pre squat', 1, '10 seg.', '(b/w)', 'Posición sostenida'],
      ['Observaciones/instrucciones:'],
      ['Priorizar descansos completos.'],
    ]);

    expect(parsed?.sections.map(section => section.name)).toEqual(['Todas las sesiones', 'Pre squat']);
    expect(parsed?.sections[0].items[0].rounds).toBe(2);
    expect(parsed?.sections[1].items[0].durationSeconds).toBe(10);
    expect(parsed?.introduction).toContain('Priorizar descansos');
  });
});
