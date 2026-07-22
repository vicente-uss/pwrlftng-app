import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, TopBar } from '@/src/components/ui';
import { EXERCISES } from '@/src/data/seed';
import { EFFORT_MODES, usesRir, usesRpe } from '@/src/domain/training';
import { EffortMode, Exercise, makeId } from '@/src/domain/types';
import { DraftInput, RepsControl } from '@/src/screens/RoutineScreens';
import { BlockDraftDay, createAthleteBlock } from '@/src/services/coachService';
import { colors } from '@/src/theme';

type DraftSet = { id: string; weight: string; repsMin: string; repsMax: string; rpe: string; rir: string };
type DraftField = 'weight' | 'repsMin' | 'repsMax' | 'rpe' | 'rir';
type DraftExercise = { id: string; exerciseId: string; sets: DraftSet[] };
type DraftDay = { id: string; name: string; effortMode: EffortMode; exercises: DraftExercise[] };

function newDraftExercise(exerciseId: string): DraftExercise {
  return {
    id: makeId('block-ex'),
    exerciseId,
    sets: [1, 2, 3].map(() => ({ id: makeId('block-set'), weight: '0', repsMin: '5', repsMax: '5', rpe: '8', rir: '2' })),
  };
}

function newDay(index: number): DraftDay {
  return { id: makeId('block-day'), name: `Día ${index}`, effortMode: 'rpe', exercises: [] };
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

export function CoachBlockEditorScreen({ athleteId, onBack, onSaved }: { athleteId: string; onBack(): void; onSaved(): void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [blockName, setBlockName] = useState('');
  const [goalText, setGoalText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weeksText, setWeeksText] = useState('4');
  const [days, setDays] = useState<DraftDay[]>(() => [newDay(1)]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const updateDayName = (dayId: string, name: string) => setDays(current => current.map(day => day.id === dayId ? { ...day, name } : day));
  const updateDayEffort = (dayId: string, effortMode: EffortMode) => setDays(current => current.map(day => day.id === dayId ? { ...day, effortMode } : day));
  const removeDay = (dayId: string) => setDays(current => current.filter(day => day.id !== dayId));
  const addDay = () => setDays(current => [...current, newDay(current.length + 1)]);

  const toggleExercise = (dayId: string, exercise: Exercise) => setDays(current => current.map(day => {
    if (day.id !== dayId) return day;
    const exists = day.exercises.some(item => item.exerciseId === exercise.id);
    return { ...day, exercises: exists ? day.exercises.filter(item => item.exerciseId !== exercise.id) : [...day.exercises, newDraftExercise(exercise.id)] };
  }));

  const updateSet = (dayId: string, exerciseDraftId: string, setId: string, field: DraftField, value: string) => setDays(current => current.map(day => day.id !== dayId ? day : ({
    ...day,
    exercises: day.exercises.map(exercise => exercise.id !== exerciseDraftId ? exercise : ({
      ...exercise,
      sets: exercise.sets.map(set => set.id === setId ? { ...set, [field]: value } : set),
    })),
  })));

  const toggleRepsMode = (dayId: string, exerciseDraftId: string, setId: string) => setDays(current => current.map(day => day.id !== dayId ? day : ({
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
  })));

  const hasDaysWithExercises = days.some(day => day.exercises.length > 0);
  const hasInvalidRange = days.some(day => day.exercises.some(exercise => exercise.sets.some(set => {
    const minimum = Number(set.repsMin);
    const maximum = Number(set.repsMax);
    return !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum;
  })));
  const hasInvalidEffort = days.some(day => day.exercises.some(exercise => exercise.sets.some(set =>
    (usesRpe(day.effortMode) && !validOptionalEffort(set.rpe, 1))
    || (usesRir(day.effortMode) && !validOptionalEffort(set.rir, 0)))));
  const disabled = !blockName.trim() || !hasDaysWithExercises || hasInvalidRange || hasInvalidEffort;

  const save = async () => {
    if (disabled || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload: BlockDraftDay[] = days.filter(day => day.exercises.length > 0).map((day, index) => ({
        name: `${blockName.trim()} · ${day.name.trim() || `Día ${index + 1}`}`,
        trainingDay: index + 1,
        effortMode: day.effortMode,
        exercises: day.exercises.map(exercise => ({
          exerciseId: exercise.exerciseId,
          sets: exercise.sets.map(set => ({
            weight: Math.max(0, Number(set.weight) || 0),
            repsMin: Math.max(0, Math.round(Number(set.repsMin) || 0)),
            repsMax: Math.max(0, Math.round(Number(set.repsMax) || 0)),
            rpe: usesRpe(day.effortMode) ? optionalNumber(set.rpe) : null,
            rir: usesRir(day.effortMode) ? optionalNumber(set.rir) : null,
          })),
        })),
      }));
      await createAthleteBlock(athleteId, payload);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'No pudimos guardar el bloque. Inténtalo otra vez.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 1) {
    return <View style={styles.fill}>
      <TopBar title="Nuevo bloque" onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.label}>NOMBRE DEL BLOQUE</Text>
        <TextInput accessibilityLabel="Nombre del bloque" value={blockName} onChangeText={setBlockName} placeholder="Ej. Mesociclo IV" placeholderTextColor={colors.subtle} style={styles.input} />

        <Text style={styles.label}>META</Text>
        <TextInput accessibilityLabel="Meta del bloque" value={goalText} onChangeText={setGoalText} placeholder="Ej. Fuerza base III" placeholderTextColor={colors.subtle} style={styles.input} />

        <Text style={styles.label}>FECHA DE INICIO</Text>
        <TextInput accessibilityLabel="Fecha de inicio" value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-DD" placeholderTextColor={colors.subtle} style={styles.input} />

        <Text style={styles.label}>DURACIÓN EN SEMANAS</Text>
        <TextInput accessibilityLabel="Duración en semanas" value={weeksText} onChangeText={setWeeksText} keyboardType="number-pad" placeholder="Ej. 4" placeholderTextColor={colors.subtle} style={styles.input} />

        <PrimaryButton title="Siguiente" onPress={() => setStep(2)} disabled={!blockName.trim()} />
      </ScrollView>
    </View>;
  }

  return <View style={styles.fill}>
    <TopBar title={blockName} eyebrow="NUEVO BLOQUE" onBack={() => setStep(1)} action={<Pressable accessibilityRole="button" accessibilityLabel="Guardar bloque" disabled={disabled || saving} onPress={save}><Text style={[styles.save, (disabled || saving) && styles.disabled]}>{saving ? 'Guardando…' : 'Guardar'}</Text></Pressable>} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {days.map((day, dayIndex) => <View key={day.id} style={styles.dayBlock}>
        <View style={styles.dayHeadRow}>
          <TextInput accessibilityLabel={`Nombre del día ${dayIndex + 1}`} value={day.name} onChangeText={value => updateDayName(day.id, value)} placeholder={`Día ${dayIndex + 1}`} placeholderTextColor={colors.subtle} style={styles.dayNameInput} />
          {days.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${day.name || `día ${dayIndex + 1}`}`} onPress={() => removeDay(day.id)} hitSlop={8}><Ionicons name="trash-outline" color={colors.danger} size={18} /></Pressable>}
        </View>

        <View style={styles.effortGrid}>{EFFORT_MODES.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: day.effortMode === option.value }} onPress={() => updateDayEffort(day.id, option.value)} style={[styles.effortOption, day.effortMode === option.value && styles.effortOptionActive]}><Text style={[styles.effortTitle, day.effortMode === option.value && styles.effortTextActive]}>{option.label}</Text></Pressable>)}</View>

        {EXERCISES.map(exercise => {
          const draft = day.exercises.find(item => item.exerciseId === exercise.id);
          return <View key={exercise.id} style={styles.exerciseSelector}>
            <Pressable accessibilityRole="checkbox" accessibilityLabel={exercise.name} accessibilityState={{ checked: Boolean(draft) }} onPress={() => toggleExercise(day.id, exercise)} style={[styles.exerciseRow, draft && styles.exerciseActive]}>
              <View><Text style={styles.strong}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View>
              <Ionicons name={draft ? 'checkmark' : 'add'} color={draft ? colors.orange : colors.dim} size={18} />
            </Pressable>
            {draft && <View style={styles.setEditor}>
              {draft.sets.map((set, index) => <View key={set.id} style={styles.draftSet}>
                <Text style={styles.setTitle}>SERIE {index + 1}</Text>
                <View style={styles.draftFields}>
                  <DraftInput label={`Peso serie ${index + 1}`} value={set.weight} onChange={value => updateSet(day.id, draft.id, set.id, 'weight', value)} decimal />
                  <RepsControl
                    index={index}
                    repsMin={set.repsMin}
                    repsMax={set.repsMax}
                    onChangeMin={value => updateSet(day.id, draft.id, set.id, 'repsMin', value)}
                    onChangeMax={value => updateSet(day.id, draft.id, set.id, 'repsMax', value)}
                    onToggleMode={() => toggleRepsMode(day.id, draft.id, set.id)}
                  />
                  {usesRpe(day.effortMode) && <DraftInput label={`RPE serie ${index + 1}`} value={set.rpe} onChange={value => updateSet(day.id, draft.id, set.id, 'rpe', value)} decimal />}
                  {usesRir(day.effortMode) && <DraftInput label={`RIR serie ${index + 1}`} value={set.rir} onChange={value => updateSet(day.id, draft.id, set.id, 'rir', value)} decimal />}
                </View>
              </View>)}
            </View>}
          </View>;
        })}
      </View>)}

      <Pressable accessibilityRole="button" accessibilityLabel="Agregar día" onPress={addDay} style={styles.addDayButton}>
        <Ionicons name="add" color={colors.orange} size={18} />
        <Text style={styles.addDayText}>Agregar día</Text>
      </Pressable>

      {hasInvalidRange && <Text style={styles.warning}>El máximo de repeticiones debe ser igual o mayor que el mínimo.</Text>}
      {hasInvalidEffort && <Text style={styles.warning}>RPE debe estar entre 1 y 10; RIR debe estar entre 0 y 10.</Text>}
      {saveError && <Text style={styles.warning}>{saveError}</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  label: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, color: colors.text, fontSize: 15 },
  save: { color: colors.orange, fontWeight: '700' },
  disabled: { color: colors.subtle },
  warning: { color: colors.warning, fontSize: 12 },
  strong: { color: colors.text, fontWeight: '700' },
  dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  dayBlock: { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 4 },
  dayHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayNameInput: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 11, padding: 12, color: colors.text, fontSize: 15, fontWeight: '700' },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effortOption: { flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  effortOptionActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  effortTitle: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  effortTextActive: { color: colors.text },
  exerciseSelector: { gap: 0 },
  exerciseRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseActive: { borderColor: colors.orange, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  setEditor: { borderWidth: 1, borderTopWidth: 0, borderColor: colors.orange, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 12, gap: 10, backgroundColor: '#0f0f0f' },
  draftSet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 7 },
  setTitle: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  draftFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  addDayButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, marginTop: 6 },
  addDayText: { color: colors.orange, fontWeight: '700', fontSize: 13 },
});
