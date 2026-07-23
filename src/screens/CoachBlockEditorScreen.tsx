import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConfirmDialog, PrimaryButton, TopBar } from '@/src/components/ui';
import { ExercisePicker } from '@/src/components/ExercisePicker';
import { EXERCISE_CATALOG } from '@/src/data/seed';
import { EFFORT_MODES, linkedEffortUpdate, usesRir, usesRpe } from '@/src/domain/training';
import { EffortMode, Exercise, makeId } from '@/src/domain/types';
import { DraftInput, RepsControl } from '@/src/screens/RoutineScreens';
import { BlockDraftInfo, BlockDraftWeek, getCoachBlockDraft, saveAthleteBlock, saveCoachTemplate } from '@/src/services/coachService';
import { ProgramWeekType } from '@/src/services/athleteBlockService';
import {
  CoachProgramKind,
  getCoachLibraryProgramDraft,
  saveCoachLibraryProgram,
} from '@/src/services/coachProgramService';
import { colors, condensed } from '@/src/theme';
import { ActivationResource, saveActivationResource } from '@/src/services/activationService';

type DraftSet = { id: string; weight: string; repsMin: string; repsMax: string; rpe: string; rir: string; effortLinked: boolean };
type DraftField = 'weight' | 'repsMin' | 'repsMax' | 'rpe' | 'rir';
type DraftExercise = { id: string; exerciseId: string; sets: DraftSet[] };
type DraftDay = { id: string; name: string; effortMode: EffortMode; prescriptionNotes: string; status: 'draft' | 'published'; exercises: DraftExercise[] };
type DraftWeek = { id: string; name: string; weekNumber: number; isWarmup: boolean; weekType: ProgramWeekType; status: 'draft' | 'published' | 'completed' | 'archived'; startDateOverride: string | null; days: DraftDay[] };
type ConfirmState = { title: string; message: string; confirmLabel: string; onConfirm(): void } | null;

const MAX_DAYS_PER_WEEK = 7;

function blankDraftSet(): DraftSet {
  return { id: makeId('block-set'), weight: '', repsMin: '5', repsMax: '5', rpe: '8', rir: '2', effortLinked: true };
}

function newDraftExercise(exerciseId: string): DraftExercise {
  return {
    id: makeId('block-ex'),
    exerciseId,
    sets: [blankDraftSet()],
  };
}

function newDay(index: number): DraftDay {
  return { id: makeId('block-day'), name: `Día ${index}`, effortMode: 'rpe', prescriptionNotes: '', status: 'published', exercises: [] };
}

function newWeek(weekNumber: number, isWarmup: boolean): DraftWeek {
  return {
    id: makeId('block-week'),
    name: isWarmup ? 'Calentamientos' : `Semana ${weekNumber}`,
    weekNumber,
    isWarmup,
    weekType: isWarmup ? 'activation' : 'training',
    status: 'published',
    startDateOverride: null,
    days: [],
  };
}

function seedWeeks(totalWeeks: number, includeActivation: boolean): DraftWeek[] {
  const numbered = Array.from({ length: Math.max(1, totalWeeks) }, (_, index) => newWeek(index + 1, false));
  return includeActivation ? [newWeek(0, true), ...numbered] : numbered;
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validOptionalEffort(value: string, minimum: number) {
  if (!value.trim()) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= 10;
}

function maskDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('-');
}

function displayDateToIso(display: string): string | null {
  const match = display.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDisplay(value: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
}

const WEEK_TYPES: ProgramWeekType[] = ['training', 'low_stress', 'deload', 'closing'];
const WEEK_TYPE_LABELS: Record<ProgramWeekType, string> = { activation: 'Activación', training: 'Entrenamiento', low_stress: 'Low stress', deload: 'Deload', closing: 'Cierre' };

type CoachBlockEditorProps = {
  athleteId?: string | null;
  blockId?: string | null;
  programId?: string | null;
  programKind?: CoachProgramKind;
  initialDraft?: { info: BlockDraftInfo; weeks: BlockDraftWeek[] } | null;
  initialActivation?: ActivationResource | null;
  onBack(): void;
  onSaved(savedId?: string): void;
};

export function CoachBlockEditorScreen({
  athleteId,
  blockId,
  programId,
  programKind = 'mesocycle',
  initialDraft,
  initialActivation,
  onBack,
  onSaved,
}: CoachBlockEditorProps) {
  const libraryMode = !athleteId;
  const [step, setStep] = useState<1 | 2>(1);
  const [blockName, setBlockName] = useState('');
  const [goalText, setGoalText] = useState('');
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [weeksText, setWeeksText] = useState('4');
  const [weeks, setWeeks] = useState<DraftWeek[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [renamingWeekId, setRenamingWeekId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(Boolean(blockId || programId));
  const [loadedBlockId, setLoadedBlockId] = useState<string | null>(blockId ?? programId ?? null);
  const [blockStatus, setBlockStatus] = useState<'draft' | 'published' | 'completed' | 'archived'>('published');
  const [currentWeekNumber, setCurrentWeekNumber] = useState(1);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [exerciseCatalog, setExerciseCatalog] = useState<Exercise[]>(EXERCISE_CATALOG);

  useEffect(() => {
    if (initialDraft && !blockId && !programId) {
      setBlockName(initialDraft.info.name);
      setGoalText(initialDraft.info.goalText ?? '');
      setStartDateDisplay(isoToDisplay(initialDraft.info.startDate));
      setWeeksText(String(initialDraft.info.totalWeeks));
      setWeeks(initialDraft.weeks.map(week => ({
        id: week.id ?? makeId('program-week'),
        name: week.name,
        weekNumber: week.weekNumber,
        isWarmup: false,
        weekType: week.weekType === 'activation' ? 'training' : week.weekType ?? 'training',
        status: week.status ?? 'published',
        startDateOverride: week.startDateOverride ?? null,
        days: week.days.map(day => ({
          id: day.id ?? makeId('program-day'),
          name: day.name,
          effortMode: day.effortMode,
          prescriptionNotes: day.prescriptionNotes ?? '',
          status: day.status ?? 'published',
          exercises: day.exercises.map(exercise => ({
            id: exercise.id ?? makeId('program-exercise'),
            exerciseId: exercise.exerciseId,
            sets: exercise.sets.map(set => ({
              id: set.id ?? makeId('program-set'),
              weight: String(set.weight || ''),
              repsMin: String(set.repsMin),
              repsMax: String(set.repsMax),
              rpe: set.rpe == null ? '' : String(set.rpe),
              rir: set.rir == null ? '' : String(set.rir),
              effortLinked: set.effortLinked ?? true,
            })),
          })),
        })),
      })));
      return;
    }
    const editingId = programId ?? blockId;
    if (!editingId) return;
    let active = true;
    const loadDraft = programId
      ? getCoachLibraryProgramDraft(programId)
      : getCoachBlockDraft(editingId);
    loadDraft.then(({ info, weeks: remoteWeeks }) => {
      if (!active) return;
      setLoadedBlockId(info.id ?? editingId);
      setBlockName(info.name);
      setGoalText(info.goalText ?? '');
      setStartDateDisplay(isoToDisplay(info.startDate));
      setWeeksText(String(info.totalWeeks));
      setBlockStatus(info.status ?? 'published');
      setCurrentWeekNumber(info.currentWeekNumber ?? 1);
      setWeeks(remoteWeeks.filter(week => !week.isWarmup).map(week => ({
        id: week.id ?? makeId('block-week'),
        name: week.name,
        weekNumber: week.weekNumber,
        isWarmup: week.isWarmup,
        weekType: week.weekType ?? (week.isWarmup ? 'activation' : 'training'),
        status: week.status ?? 'published',
        startDateOverride: week.startDateOverride ?? null,
        days: week.days.map(day => ({
          id: day.id ?? makeId('block-day'),
          name: day.name,
          effortMode: day.effortMode,
          prescriptionNotes: day.prescriptionNotes ?? '',
          status: day.status ?? 'published',
          exercises: day.exercises.map(exercise => ({
            id: exercise.id ?? makeId('block-ex'),
            exerciseId: exercise.exerciseId,
            sets: exercise.sets.map(set => ({ id: set.id ?? makeId('block-set'), weight: String(set.weight || ''), repsMin: String(set.repsMin), repsMax: String(set.repsMax), rpe: set.rpe == null ? '' : String(set.rpe), rir: set.rir == null ? '' : String(set.rir), effortLinked: set.effortLinked ?? true })),
          })),
        })),
      })));
    }).catch(cause => setSaveError(cause instanceof Error ? cause.message : 'No pudimos cargar la programación.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [blockId, initialDraft, programId]);

  const parsedWeeks = Math.max(1, Math.min(52, Math.round(Number(weeksText) || 0)));
  const startDateInvalid = startDateDisplay.length > 0 && displayDateToIso(startDateDisplay) === null;
  const step1Disabled = !blockName.trim() || !weeksText.trim() || parsedWeeks < 1 || startDateInvalid;

  const goToDays = () => {
    if (step1Disabled) return;
    setWeeks(current => current.length ? current : seedWeeks(parsedWeeks, false));
    setStep(2);
  };

  const toggleExpanded = (weekId: string) => setExpanded(current => ({ ...current, [weekId]: !current[weekId] }));

  const renameWeek = (weekId: string, name: string) => setWeeks(current => current.map(week => week.id === weekId ? { ...week, name } : week));

  const toggleWeekPublished = (weekId: string) => setWeeks(current => current.map(week => week.id === weekId && week.status !== 'completed'
    ? { ...week, status: week.status === 'published' ? 'draft' : 'published' }
    : week));

  const cycleWeekType = (weekId: string) => setWeeks(current => current.map(week => {
    if (week.id !== weekId || week.isWarmup) return week;
    const index = WEEK_TYPES.indexOf(week.weekType);
    return { ...week, weekType: WEEK_TYPES[(index + 1) % WEEK_TYPES.length] };
  }));

  const addWeek = () => setWeeks(current => {
    const highest = current.reduce((max, week) => week.isWarmup ? max : Math.max(max, week.weekNumber), 0);
    const week = newWeek(highest + 1, false);
    setExpanded(state => ({ ...state, [week.id]: true }));
    return [...current, week];
  });

  const deleteWeek = (weekId: string) => setWeeks(current => current.filter(week => week.id !== weekId));

  const addDay = (weekId: string) => setWeeks(current => current.map(week => {
    if (week.id !== weekId || week.days.length >= MAX_DAYS_PER_WEEK) return week;
    return { ...week, days: [...week.days, newDay(week.days.length + 1)] };
  }));

  const deleteDay = (weekId: string, dayId: string) => setWeeks(current => current.map(week => week.id !== weekId
    ? week
    : { ...week, days: week.days.filter(day => day.id !== dayId) }));

  const updateDayName = (weekId: string, dayId: string, name: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id === dayId ? { ...day, name } : day),
  })));

  const updateDayEffort = (weekId: string, dayId: string, effortMode: EffortMode) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id === dayId ? { ...day, effortMode } : day),
  })));

  const updateDayNotes = (weekId: string, dayId: string, prescriptionNotes: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id === dayId ? { ...day, prescriptionNotes } : day),
  })));

  const toggleExercise = (weekId: string, dayId: string, exercise: Exercise) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => {
      if (day.id !== dayId) return day;
      const exists = day.exercises.some(item => item.exerciseId === exercise.id);
      return { ...day, exercises: exists ? day.exercises.filter(item => item.exerciseId !== exercise.id) : [...day.exercises, newDraftExercise(exercise.id)] };
    }),
  })));

  const removeExercise = (weekId: string, dayId: string, exerciseDraftId: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id !== dayId ? day : ({
      ...day,
      exercises: day.exercises.filter(exercise => exercise.id !== exerciseDraftId),
    })),
  })));

  const addSet = (weekId: string, dayId: string, exerciseDraftId: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id !== dayId ? day : ({
      ...day,
      exercises: day.exercises.map(exercise => {
        if (exercise.id !== exerciseDraftId) return exercise;
        const last = exercise.sets.at(-1);
        return {
          ...exercise,
          sets: [...exercise.sets, {
            id: makeId('block-set'),
            weight: last?.weight ?? '',
            repsMin: last?.repsMin ?? '5',
            repsMax: last?.repsMax ?? '5',
            rpe: last?.rpe ?? '8',
            rir: last?.rir ?? '2',
            effortLinked: last?.effortLinked ?? true,
          }],
        };
      }),
    })),
  })));

  const removeSet = (weekId: string, dayId: string, exerciseDraftId: string, setId: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id !== dayId ? day : ({
      ...day,
      exercises: day.exercises.map(exercise => {
        if (exercise.id !== exerciseDraftId) return exercise;
        if (exercise.sets.length <= 1) return exercise;
        return { ...exercise, sets: exercise.sets.filter(set => set.id !== setId) };
      }),
    })),
  })));

  const updateSet = (weekId: string, dayId: string, exerciseDraftId: string, setId: string, field: DraftField, value: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id !== dayId ? day : ({
      ...day,
      exercises: day.exercises.map(exercise => exercise.id !== exerciseDraftId ? exercise : ({
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId) return set;
          const patch = field === 'rpe' || field === 'rir'
            ? linkedEffortUpdate(field, value, set.effortLinked)
            : { [field]: value };
          return { ...set, ...patch };
        }),
      })),
    })),
  })));

  const toggleEffortLinked = (weekId: string, dayId: string, exerciseDraftId: string, setId: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id !== dayId ? day : ({
      ...day,
      exercises: day.exercises.map(exercise => exercise.id !== exerciseDraftId ? exercise : ({
        ...exercise,
        sets: exercise.sets.map(set => set.id === setId ? { ...set, effortLinked: !set.effortLinked } : set),
      })),
    })),
  })));

  const toggleRepsMode = (weekId: string, dayId: string, exerciseDraftId: string, setId: string) => setWeeks(current => current.map(week => week.id !== weekId ? week : ({
    ...week,
    days: week.days.map(day => day.id !== dayId ? day : ({
      ...day,
      exercises: day.exercises.map(exercise => exercise.id !== exerciseDraftId ? exercise : ({
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId) return set;
          const min = Number(set.repsMin) || 0;
          const max = Number(set.repsMax) || 0;
          return min === max ? { ...set, repsMax: String(min + 2) } : { ...set, repsMax: set.repsMin };
        }),
      })),
    })),
  })));

  const allDays = weeks.flatMap(week => week.days);
  const hasDaysWithExercises = allDays.some(day => day.exercises.length > 0);
  const hasInvalidRange = allDays.some(day => day.exercises.some(exercise => exercise.sets.some(set => {
    const minimum = Number(set.repsMin);
    const maximum = Number(set.repsMax);
    return !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum;
  })));
  const hasInvalidEffort = allDays.some(day => day.exercises.some(exercise => exercise.sets.some(set =>
    (usesRpe(day.effortMode) && !validOptionalEffort(set.rpe, 1))
    || (usesRir(day.effortMode) && !validOptionalEffort(set.rir, 0)))));
  const disabled = !blockName.trim() || !hasDaysWithExercises || hasInvalidRange || hasInvalidEffort;

  const save = async () => {
    if (disabled || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload: BlockDraftWeek[] = weeks.map(week => ({
          id: week.id,
          name: week.name.trim() || (week.isWarmup ? 'Calentamientos' : `Semana ${week.weekNumber}`),
          weekNumber: week.weekNumber,
          isWarmup: week.isWarmup,
          weekType: week.weekType,
          status: week.status,
          startDateOverride: week.startDateOverride,
          days: week.days.map((day, index) => ({
            id: day.id,
            name: day.name.trim() || `Día ${index + 1}`,
            trainingDay: index + 1,
            effortMode: day.effortMode,
            prescriptionNotes: day.prescriptionNotes.trim() || null,
            status: day.status,
            exercises: day.exercises.map(exercise => ({
              id: exercise.id,
              exerciseId: exercise.exerciseId,
              sets: exercise.sets.map(set => ({
                id: set.id,
                weight: Math.max(0, Number(set.weight) || 0),
                repsMin: Math.max(0, Math.round(Number(set.repsMin) || 0)),
                repsMax: Math.max(0, Math.round(Number(set.repsMax) || 0)),
                rpe: usesRpe(day.effortMode) ? optionalNumber(set.rpe) : null,
                rir: usesRir(day.effortMode) ? optionalNumber(set.rir) : null,
                effortLinked: set.effortLinked,
              })),
            })),
          })),
        }));
      const infoPayload = {
        id: loadedBlockId ?? undefined,
        name: blockName.trim(),
        goalText: goalText.trim() || null,
        startDate: displayDateToIso(startDateDisplay),
        totalWeeks: parsedWeeks,
        status: startDateDisplay ? (blockStatus === 'draft' ? 'published' : blockStatus) : 'draft',
        currentWeekNumber,
      } as const;
      if (athleteId) {
        const savedId = await saveAthleteBlock(athleteId, infoPayload, payload);
        if (saveAsTemplate) await saveCoachTemplate('block', blockName.trim(), { info: { ...infoPayload, id: undefined }, weeks: payload });
        onSaved(savedId);
      } else {
        const savedId = await saveCoachLibraryProgram(infoPayload, payload, programKind);
        if (initialActivation) {
          await saveActivationResource({ programId: savedId }, initialActivation);
        }
        onSaved(savedId);
      }
    } catch (cause) {
      console.error('coach block save error', cause);
      const remote = cause as { message?: string; error_description?: string } | null;
      setSaveError(remote?.message ?? remote?.error_description ?? 'No pudimos guardar el bloque. Inténtalo otra vez.');
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteDay = (week: DraftWeek, day: DraftDay) => setConfirm({
    title: 'Eliminar día',
    message: `Se archivará ${day.name || 'este día'} de ${week.name}. Las sesiones realizadas se conservarán en el historial.`,
    confirmLabel: 'Archivar',
    onConfirm: () => { deleteDay(week.id, day.id); setConfirm(null); },
  });

  const requestDeleteWeek = (week: DraftWeek) => {
    if (week.isWarmup) return;
    setConfirm({
      title: 'Eliminar semana',
      message: `Se archivarán ${week.name} y sus ${week.days.length} días. Las sesiones realizadas se conservarán en el historial.`,
      confirmLabel: 'Archivar',
      onConfirm: () => { deleteWeek(week.id); setConfirm(null); },
    });
  };

  const entityLabel = libraryMode
    ? programKind === 'template' ? 'plantilla' : 'mesociclo'
    : 'bloque';

  if (loading) return <View style={styles.fill}><TopBar title={`Cargando ${entityLabel}`} onBack={onBack} /><View style={styles.loadingState}><Text style={styles.warning}>Preparando la planificación…</Text></View></View>;

  if (step === 1) {
    return <View style={styles.fill}>
      <TopBar title={loadedBlockId ? `Editar ${entityLabel}` : `Nuevo ${entityLabel}`} onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.label}>NOMBRE</Text>
        <TextInput accessibilityLabel={`Nombre del ${entityLabel}`} value={blockName} onChangeText={setBlockName} placeholder="Ej. Mesociclo IV" placeholderTextColor={colors.subtle} style={styles.input} />

        <Text style={styles.label}>META</Text>
        <TextInput accessibilityLabel="Meta del bloque" value={goalText} onChangeText={setGoalText} placeholder="Ej. Fuerza base III" placeholderTextColor={colors.subtle} style={styles.input} />

        <Text style={styles.label}>FECHA DE INICIO</Text>
        <TextInput
          accessibilityLabel="Fecha de inicio en formato día mes año"
          value={startDateDisplay}
          onChangeText={value => setStartDateDisplay(maskDate(value))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="DD-MM-AAAA"
          placeholderTextColor={colors.subtle}
          style={[styles.input, startDateInvalid && styles.inputError]}
        />
        {startDateInvalid ? <Text style={styles.warning}>Usa el formato DD-MM-AAAA (por ejemplo 15-03-2026).</Text> : null}

        <Text style={styles.label}>DURACIÓN EN SEMANAS</Text>
        <TextInput accessibilityLabel="Duración en semanas" value={weeksText} onChangeText={setWeeksText} keyboardType="number-pad" placeholder="Ej. 4" placeholderTextColor={colors.subtle} style={styles.input} />

        {!libraryMode ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: saveAsTemplate }} accessibilityLabel="Guardar también como plantilla" onPress={() => setSaveAsTemplate(value => !value)} style={[styles.templateToggle, saveAsTemplate && styles.templateToggleActive]}><View style={[styles.templateCheck, saveAsTemplate && styles.templateCheckActive]}>{saveAsTemplate ? <Ionicons name="checkmark" color={colors.canvas} size={14} /> : null}</View><View style={styles.grow}><Text style={styles.strong}>Guardar también como plantilla anterior</Text><Text style={styles.dim}>Se conserva por compatibilidad con el flujo previo.</Text></View></Pressable> : null}

        <PrimaryButton title="Siguiente" onPress={goToDays} disabled={step1Disabled} />
      </ScrollView>
    </View>;
  }

  return <View style={styles.fill}>
    <TopBar title={blockName} eyebrow={loadedBlockId ? `EDITAR ${entityLabel.toUpperCase()}` : `NUEVO ${entityLabel.toUpperCase()}`} onBack={() => setStep(1)} action={<Pressable accessibilityRole="button" accessibilityLabel={`Guardar ${entityLabel}`} disabled={disabled || saving} onPress={save}><Text style={[styles.save, (disabled || saving) && styles.saveDisabled]}>{saving ? 'Guardando…' : 'Guardar'}</Text></Pressable>} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {weeks.map(week => {
        const isOpen = Boolean(expanded[week.id]);
        const isRenaming = renamingWeekId === week.id;
        const canAddDay = week.days.length < MAX_DAYS_PER_WEEK;
        return <View key={week.id} style={styles.weekCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${isOpen ? 'Colapsar' : 'Expandir'} ${week.name}`}
            onPress={() => toggleExpanded(week.id)}
            onLongPress={() => requestDeleteWeek(week)}
            style={styles.weekHeader}
          >
            <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} color={colors.dim} size={18} />
            {isRenaming && !week.isWarmup ? (
              <TextInput
                accessibilityLabel={`Renombrar ${week.name}`}
                value={week.name}
                onChangeText={value => renameWeek(week.id, value)}
                onBlur={() => setRenamingWeekId(null)}
                onSubmitEditing={() => setRenamingWeekId(null)}
                autoFocus
                maxLength={60}
                style={styles.weekNameInput}
              />
            ) : (
              <Text style={styles.weekName}>{week.name}</Text>
            )}
            <Text style={styles.weekMeta}>{week.days.length}{week.days.length === 1 ? ' día' : ' días'}</Text>
            {!week.isWarmup && !isRenaming ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Renombrar ${week.name}`}
                onPress={() => setRenamingWeekId(week.id)}
                hitSlop={10}
              >
                <Ionicons name="create-outline" color={colors.dim} size={18} />
              </Pressable>
            ) : null}
          </Pressable>

          {isOpen ? <View style={styles.weekBody}>
            <View style={styles.weekSettings}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Tipo ${WEEK_TYPE_LABELS[week.weekType]}`} disabled={week.isWarmup} onPress={() => cycleWeekType(week.id)} style={styles.weekSettingButton}>
                <Ionicons name="layers-outline" color={colors.orange} size={15} />
                <Text style={styles.weekSettingText}>{WEEK_TYPE_LABELS[week.weekType]}</Text>
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: week.status === 'published', disabled: week.status === 'completed' }} accessibilityLabel={`${week.status === 'published' ? 'Publicada' : 'Borrador'} para el atleta`} disabled={week.status === 'completed'} onPress={() => toggleWeekPublished(week.id)} style={[styles.weekSettingButton, week.status === 'published' && styles.weekSettingActive]}>
                <Ionicons name={week.status === 'published' ? 'eye-outline' : 'eye-off-outline'} color={week.status === 'published' ? colors.success : colors.dim} size={15} />
                <Text style={styles.weekSettingText}>{week.status === 'completed' ? 'Completada' : week.status === 'published' ? 'Publicada' : 'Borrador'}</Text>
              </Pressable>
            </View>
            {week.days.map((day, dayIndex) => <View key={day.id} style={styles.dayBlock}>
              <View style={styles.dayHeadRow}>
                <TextInput accessibilityLabel={`Nombre del día ${dayIndex + 1}`} value={day.name} onChangeText={value => updateDayName(week.id, day.id, value)} placeholder={`Día ${dayIndex + 1}`} placeholderTextColor={colors.subtle} style={styles.dayNameInput} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Mantén presionado para eliminar ${day.name || `día ${dayIndex + 1}`}`}
                  onLongPress={() => requestDeleteDay(week, day)}
                  hitSlop={10}
                  style={styles.dayGrip}
                >
                  <Ionicons name="ellipsis-vertical" color={colors.dim} size={18} />
                </Pressable>
              </View>

              <View style={styles.effortGrid}>{EFFORT_MODES.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: day.effortMode === option.value }} onPress={() => updateDayEffort(week.id, day.id, option.value)} style={[styles.effortOption, day.effortMode === option.value && styles.effortOptionActive]}><Text style={[styles.effortTitle, day.effortMode === option.value && styles.effortTextActive]}>{option.label}</Text></Pressable>)}</View>

              <TextInput accessibilityLabel={`Indicaciones para ${day.name}`} value={day.prescriptionNotes} onChangeText={value => updateDayNotes(week.id, day.id, value)} placeholder="Indicaciones del día, rango de kilos o notas para el atleta" placeholderTextColor={colors.subtle} multiline maxLength={4000} style={styles.notesInput} />

              {day.exercises.map(draft => {
                const exercise = exerciseCatalog.find(item => item.id === draft.exerciseId);
                if (!exercise) return null;
                return <View key={draft.id} style={styles.exerciseSelector}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mantén presionado para quitar ${exercise.name}`}
                    onLongPress={() => removeExercise(week.id, day.id, draft.id)}
                    style={[styles.exerciseRow, styles.exerciseActive]}
                  >
                    <View><Text style={styles.strong}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View>
                    <Ionicons name="ellipsis-vertical" color={colors.dim} size={18} />
                  </Pressable>
                  <View style={styles.setEditor}>
                    {draft.sets.map((set, index) => <Pressable
                      key={set.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Mantén presionado para eliminar serie ${index + 1}`}
                      onLongPress={() => removeSet(week.id, day.id, draft.id, set.id)}
                      style={styles.draftSet}
                    >
                      <Text style={styles.setTitle}>SERIE {index + 1}</Text>
                      <View style={styles.draftFields}>
                        <DraftInput label="PESO" accessibilityLabel={`Peso serie ${index + 1}`} placeholder="-" value={set.weight} onChange={value => updateSet(week.id, day.id, draft.id, set.id, 'weight', value)} decimal />
                        <RepsControl
                          index={index}
                          repsMin={set.repsMin}
                          repsMax={set.repsMax}
                          onChangeMin={value => updateSet(week.id, day.id, draft.id, set.id, 'repsMin', value)}
                          onChangeMax={value => updateSet(week.id, day.id, draft.id, set.id, 'repsMax', value)}
                          onToggleMode={() => toggleRepsMode(week.id, day.id, draft.id, set.id)}
                        />
                        {usesRpe(day.effortMode) && <DraftInput label="RPE @" accessibilityLabel={`RPE serie ${index + 1}`} value={set.rpe} onChange={value => updateSet(week.id, day.id, draft.id, set.id, 'rpe', value)} decimal />}
                        {usesRir(day.effortMode) && <DraftInput label="RIR" accessibilityLabel={`RIR serie ${index + 1}`} value={set.rir} onChange={value => updateSet(week.id, day.id, draft.id, set.id, 'rir', value)} decimal />}
                      </View>
                      {day.effortMode === 'both' ? <Pressable accessibilityRole="button" accessibilityLabel={set.effortLinked ? 'Desvincular RPE y RIR' : 'Vincular RPE y RIR'} onPress={() => toggleEffortLinked(week.id, day.id, draft.id, set.id)} style={styles.linkButton}>
                        <Ionicons name={set.effortLinked ? 'link' : 'unlink'} color={set.effortLinked ? colors.orange : colors.dim} size={14} />
                        <Text style={[styles.linkText, set.effortLinked && styles.linkTextActive]}>{set.effortLinked ? 'Vinculados · Desvincular' : 'Separados · Vincular'}</Text>
                      </Pressable> : null}
                    </Pressable>)}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Agregar serie a ${exercise.name}`} onPress={() => addSet(week.id, day.id, draft.id)} style={styles.addSetButton}>
                      <Ionicons name="add" color={colors.orange} size={16} />
                      <Text style={styles.addSetText}>Agregar serie</Text>
                    </Pressable>
                  </View>
                </View>;
              })}
              <ExercisePicker
                selectedIds={day.exercises.map(item => item.exerciseId)}
                onToggle={exercise => toggleExercise(week.id, day.id, exercise)}
                onCatalogLoaded={setExerciseCatalog}
                allowCustomVariants
              />
            </View>)}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Agregar día a ${week.name}`}
              accessibilityState={{ disabled: !canAddDay }}
              onPress={() => addDay(week.id)}
              disabled={!canAddDay}
              style={[styles.addDayButton, !canAddDay && styles.addDayDisabled]}
            >
              <Ionicons name="add" color={canAddDay ? colors.orange : colors.subtle} size={18} />
              <Text style={[styles.addDayText, !canAddDay && styles.addDayTextDisabled]}>
                {canAddDay ? 'Agregar día' : `Máximo ${MAX_DAYS_PER_WEEK} días por semana`}
              </Text>
            </Pressable>
          </View> : null}
        </View>;
      })}

      <Pressable accessibilityRole="button" accessibilityLabel="Agregar semana" onPress={addWeek} style={styles.addWeekButton}>
        <Ionicons name="add-circle-outline" color={colors.orange} size={18} />
        <Text style={styles.addWeekText}>Agregar semana</Text>
      </Pressable>

      <Text style={styles.helper}>Mantén presionada una semana para eliminarla o un día para borrarlo.</Text>

      {hasInvalidRange && <Text style={styles.warning}>El máximo de repeticiones debe ser igual o mayor que el mínimo.</Text>}
      {hasInvalidEffort && <Text style={styles.warning}>RPE debe estar entre 1 y 10; RIR debe estar entre 0 y 10.</Text>}
      {saveError && <Text style={styles.warning}>{saveError}</Text>}
    </ScrollView>

    <ConfirmDialog
      visible={confirm !== null}
      title={confirm?.title ?? ''}
      message={confirm?.message ?? ''}
      confirmLabel={confirm?.confirmLabel ?? 'Eliminar'}
      destructive
      onCancel={() => setConfirm(null)}
      onConfirm={() => confirm?.onConfirm()}
    />
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  label: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, color: colors.text, fontSize: 15 },
  inputError: { borderColor: colors.danger },
  templateToggle: { minHeight: 70, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  templateToggleActive: { borderColor: colors.orange, backgroundColor: '#15100d' },
  templateCheck: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  templateCheckActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  save: { color: colors.orange, fontWeight: '700' },
  saveDisabled: { color: colors.subtle },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  helper: { color: colors.subtle, fontSize: 11, lineHeight: 16, marginTop: 4 },
  strong: { color: colors.text, fontWeight: '700' },
  dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  weekCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  weekName: { flex: 1, color: colors.text, fontFamily: condensed, fontSize: 18, fontWeight: '800' },
  weekNameInput: { flex: 1, color: colors.text, fontFamily: condensed, fontSize: 18, fontWeight: '800', padding: 0, borderBottomWidth: 1, borderBottomColor: colors.orange },
  weekMeta: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
  weekBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  weekSettings: { flexDirection: 'row', gap: 8, paddingTop: 12 },
  weekSettingButton: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.background },
  weekSettingActive: { borderColor: '#194c37' },
  weekSettingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dayBlock: { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 4 },
  dayHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayNameInput: { flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 11, padding: 12, color: colors.text, fontSize: 15, fontWeight: '700' },
  dayGrip: { padding: 6 },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effortOption: { flexGrow: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  effortOptionActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  effortTitle: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  effortTextActive: { color: colors.text },
  notesInput: { minHeight: 66, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 11, color: colors.text, fontSize: 12, lineHeight: 17, textAlignVertical: 'top' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  exerciseSelector: { gap: 0 },
  exerciseRow: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseActive: { borderColor: colors.orange, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  setEditor: { borderWidth: 1, borderTopWidth: 0, borderColor: colors.orange, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 12, gap: 10, backgroundColor: '#0f0f0f' },
  draftSet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 7 },
  setTitle: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  draftFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  addSetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 9, marginTop: 4 },
  addSetText: { color: colors.orange, fontWeight: '700', fontSize: 12 },
  linkButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8 },
  linkText: { color: colors.dim, fontSize: 10, fontWeight: '700' },
  linkTextActive: { color: colors.orange },
  addDayButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  addDayDisabled: { opacity: 0.55 },
  addDayText: { color: colors.orange, fontWeight: '700', fontSize: 13 },
  addDayTextDisabled: { color: colors.subtle },
  addWeekButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.orange, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addWeekText: { color: colors.orange, fontWeight: '800', fontSize: 13 },
});
