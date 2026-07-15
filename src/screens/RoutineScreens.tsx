import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ConfirmDialog, PrimaryButton, TopBar } from '@/src/components/ui';
import { EffortMode, Exercise, Routine, makeId } from '@/src/domain/types';
import { EFFORT_MODES, effortModeLabel, formatRepRange, usesRir, usesRpe } from '@/src/domain/training';
import { CreateRoutineSetInput, useAppStore } from '@/src/store/AppStore';
import { colors } from '@/src/theme';

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const shortDays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type DraftSet = { id: string; weight: string; repsMin: string; repsMax: string; rpe: string; rir: string };
type DraftExercise = { exerciseId: string; sets: DraftSet[] };
type DraftField = 'weight' | 'repsMin' | 'repsMax' | 'rpe' | 'rir';

function newDraftExercise(exerciseId: string): DraftExercise {
  return {
    exerciseId,
    sets: [1, 2, 3].map(() => ({ id: makeId('draft-set'), weight: '0', repsMin: '5', repsMax: '5', rpe: '8', rir: '2' })),
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validOptionalEffort(value: string, minimum: number) {
  if (!value.trim()) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= 10;
}

function DraftInput({ label, value, onChange, decimal = false }: { label: string; value: string; onChange(value: string): void; decimal?: boolean }) {
  return <View style={styles.draftField}>
    <Text style={styles.draftLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      selectTextOnFocus
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      style={styles.draftInput}
    />
  </View>;
}

export function RoutinesScreen({ onCreate, onRoutine }: { onCreate(): void; onRoutine(routine: Routine): void }) {
  const { routines } = useAppStore();
  return <View style={styles.fill}>
    <TopBar title="Mis Rutinas" action={<Pressable accessibilityRole="button" accessibilityLabel="Crear rutina" onPress={onCreate} style={styles.plus}><Ionicons name="add" color={colors.text} size={22} /></Pressable>} />
    <ScrollView contentContainerStyle={styles.content}>
      {routines.map(routine => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir rutina ${routine.name}`} key={routine.id} onPress={() => onRoutine(routine)} style={styles.routineCard}>
        <View style={styles.dayBox}><Text style={styles.day}>{shortDays[routine.day - 1]}</Text><Ionicons name="barbell-outline" color={colors.dim} size={16} /></View>
        <View style={styles.grow}><Text style={styles.strong}>{routine.name}</Text><Text style={styles.dim}>{routine.exercises.length} ejercicios · {routine.exercises.reduce((sum, item) => sum + item.sets.length, 0)} series · {effortModeLabel(routine.effortMode)}</Text></View>
        <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
      </Pressable>)}
      {routines.length === 0 && <Card><Text style={styles.muted}>Aún no tienes rutinas.</Text><PrimaryButton title="Crear primera rutina" onPress={onCreate} /></Card>}
    </ScrollView>
  </View>;
}

export function CreateRoutineScreen({ onBack, onSaved }: { onBack(): void; onSaved(routine: Routine): void }) {
  const { exercises, routines, createRoutine } = useAppStore();
  const [name, setName] = useState('');
  const [day, setDay] = useState(1);
  const [effortMode, setEffortMode] = useState<EffortMode>('rpe');
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const atLimit = routines.length >= 7;
  const hasInvalidRange = drafts.some(exercise => exercise.sets.some(set => {
    const minimum = Number(set.repsMin);
    const maximum = Number(set.repsMax);
    return !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum;
  }));
  const hasInvalidEffort = drafts.some(exercise => exercise.sets.some(set =>
    (usesRpe(effortMode) && !validOptionalEffort(set.rpe, 1))
    || (usesRir(effortMode) && !validOptionalEffort(set.rir, 0))));
  const disabled = !name.trim() || !drafts.length || atLimit || hasInvalidRange || hasInvalidEffort;

  const toggleExercise = (exercise: Exercise) => setDrafts(current => current.some(item => item.exerciseId === exercise.id)
    ? current.filter(item => item.exerciseId !== exercise.id)
    : [...current, newDraftExercise(exercise.id)]);

  const updateSet = (exerciseId: string, setId: string, field: DraftField, value: string) => setDrafts(current => current.map(exercise => exercise.exerciseId !== exerciseId ? exercise : ({
    ...exercise,
    sets: exercise.sets.map(set => set.id === setId ? { ...set, [field]: value } : set),
  })));

  const save = () => {
    if (disabled) return;
    const exercises = drafts.map(exercise => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set): CreateRoutineSetInput => ({
        type: 'working',
        weight: Math.max(0, Number(set.weight) || 0),
        repsMin: Math.max(0, Math.round(Number(set.repsMin) || 0)),
        repsMax: Math.max(0, Math.round(Number(set.repsMax) || 0)),
        rpe: usesRpe(effortMode) ? optionalNumber(set.rpe) : undefined,
        rir: usesRir(effortMode) ? optionalNumber(set.rir) : undefined,
      })),
    }));
    onSaved(createRoutine({ name, day, effortMode, exercises }));
  };

  return <View style={styles.fill}>
    <TopBar title="Nueva rutina" onBack={onBack} action={<Pressable accessibilityRole="button" accessibilityLabel="Guardar rutina" disabled={disabled} onPress={save}><Text style={[styles.save, disabled && styles.disabled]}>Guardar</Text></Pressable>} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.label}>NOMBRE</Text>
      <TextInput accessibilityLabel="Nombre de la rutina" value={name} onChangeText={setName} placeholder="Ej. Día A · Sentadilla" placeholderTextColor={colors.subtle} style={styles.input} />

      <Text style={styles.label}>DÍA</Text>
      <View style={styles.chips}>{days.map((label, index) => <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: day === index + 1 }} key={label} onPress={() => setDay(index + 1)} style={[styles.chip, day === index + 1 && styles.chipActive]}><Text style={[styles.chipText, day === index + 1 && styles.chipTextActive]}>{label.slice(0, 3)}</Text></Pressable>)}</View>

      <Text style={styles.label}>REGISTRO DE ESFUERZO</Text>
      <View style={styles.effortGrid}>{EFFORT_MODES.map(option => <Pressable accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: effortMode === option.value }} key={option.value} onPress={() => setEffortMode(option.value)} style={[styles.effortOption, effortMode === option.value && styles.effortOptionActive]}><Text style={[styles.effortTitle, effortMode === option.value && styles.chipTextActive]}>{option.label}</Text><Text style={styles.effortDescription}>{option.description}</Text></Pressable>)}</View>

      <Text style={styles.label}>EJERCICIOS Y SERIES</Text>
      {exercises.map(exercise => {
        const draft = drafts.find(item => item.exerciseId === exercise.id);
        return <View key={exercise.id} style={styles.exerciseSelector}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={exercise.name} accessibilityState={{ checked: Boolean(draft) }} onPress={() => toggleExercise(exercise)} style={[styles.exerciseRow, draft && styles.exerciseActive]}>
            <View><Text style={styles.strong}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View>
            <Ionicons name={draft ? 'checkmark' : 'add'} color={draft ? colors.orange : colors.dim} size={18} />
          </Pressable>
          {draft && <View style={styles.setEditor}>
            <Text style={styles.editorHint}>Define un valor fijo usando el mismo mínimo y máximo, o crea un rango como 5–7.</Text>
            {draft.sets.map((set, index) => <View key={set.id} style={styles.draftSet}>
              <Text style={styles.setTitle}>SERIE {index + 1}</Text>
              <View style={styles.draftFields}>
                <DraftInput label={`Peso serie ${index + 1}`} value={set.weight} onChange={value => updateSet(exercise.id, set.id, 'weight', value)} decimal />
                <DraftInput label={`Reps mínimas serie ${index + 1}`} value={set.repsMin} onChange={value => updateSet(exercise.id, set.id, 'repsMin', value)} />
                <DraftInput label={`Reps máximas serie ${index + 1}`} value={set.repsMax} onChange={value => updateSet(exercise.id, set.id, 'repsMax', value)} />
                {usesRpe(effortMode) && <DraftInput label={`RPE serie ${index + 1}`} value={set.rpe} onChange={value => updateSet(exercise.id, set.id, 'rpe', value)} decimal />}
                {usesRir(effortMode) && <DraftInput label={`RIR serie ${index + 1}`} value={set.rir} onChange={value => updateSet(exercise.id, set.id, 'rir', value)} decimal />}
              </View>
            </View>)}
          </View>}
        </View>;
      })}
      {hasInvalidRange && <Text style={styles.warning}>El máximo de repeticiones debe ser igual o mayor que el mínimo.</Text>}
      {hasInvalidEffort && <Text style={styles.warning}>RPE debe estar entre 1 y 10; RIR debe estar entre 0 y 10.</Text>}
      {atLimit && <Text style={styles.warning}>Ya tienes el máximo de 7 rutinas activas. Elimina una para crear otra.</Text>}
    </ScrollView>
  </View>;
}

export function RoutineDetailScreen({ routine, onBack, onStart, onDeleted }: { routine: Routine; onBack(): void; onStart(): void; onDeleted(): void }) {
  const { duplicateRoutine, deleteRoutine } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showRpe = usesRpe(routine.effortMode);
  const showRir = usesRir(routine.effortMode);
  const remove = () => { deleteRoutine(routine.id); setConfirmDelete(false); onDeleted(); };

  return <View style={styles.fill}>
    <TopBar title={routine.name} eyebrow={`${days[routine.day - 1].toUpperCase()} · ${effortModeLabel(routine.effortMode)}`} onBack={onBack} action={<Pressable accessibilityRole="button" accessibilityLabel="Duplicar rutina" onPress={() => duplicateRoutine(routine.id)}><Text style={styles.muted}>Duplicar</Text></Pressable>} />
    <View style={styles.cta}><PrimaryButton title="Iniciar entrenamiento" onPress={onStart} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      {routine.exercises.map(exercise => <View key={exercise.id} style={styles.exerciseBlock}>
        <View style={styles.rowBetween}><Text style={styles.strong}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View>
        <Card>
          <View style={styles.tableHead}><Text style={styles.setNo}>SET</Text><Text style={styles.col}>PESO</Text><Text style={styles.col}>REPS</Text>{showRpe && <Text style={styles.effortCol}>RPE</Text>}{showRir && <Text style={styles.effortCol}>RIR</Text>}</View>
          {exercise.sets.map((set, index) => <View key={set.id} style={styles.tableRow}>
            <Text style={[styles.setNo, set.type === 'warmup' && styles.warmup]}>{set.type === 'warmup' ? 'W' : exercise.sets.slice(0, index + 1).filter(item => item.type === 'working').length}</Text>
            <Text style={styles.colValue}>{set.weight}kg</Text>
            <Text style={styles.colValue}>{formatRepRange(set.repsMin, set.repsMax)}</Text>
            {showRpe && <Text style={styles.effortValue}>{set.rpe == null ? '—' : set.rpe}</Text>}
            {showRir && <Text style={styles.effortValue}>{set.rir == null ? '—' : set.rir}</Text>}
          </View>)}
        </Card>
      </View>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Eliminar rutina" onPress={() => setConfirmDelete(true)} style={styles.delete}><Text style={styles.deleteText}>Eliminar rutina</Text></Pressable>
    </ScrollView>
    <ConfirmDialog visible={confirmDelete} title="Eliminar rutina" message={`¿Eliminar “${routine.name}”? Esta acción no se puede deshacer.`} confirmLabel="Eliminar" destructive onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, grow: { flex: 1 }, content: { padding: 20, gap: 12, paddingBottom: 40 },
  plus: { backgroundColor: colors.orange, width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routineCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', gap: 4 },
  day: { color: colors.orange, fontSize: 10, fontWeight: '700' }, strong: { color: colors.text, fontWeight: '700' }, dim: { color: colors.dim, fontSize: 12, marginTop: 3 }, muted: { color: colors.muted },
  label: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, color: colors.text, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { backgroundColor: colors.orange, borderColor: colors.orange }, chipText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, chipTextActive: { color: colors.text },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, effortOption: { width: '48%', minHeight: 68, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 4 }, effortOptionActive: { borderColor: colors.orange, backgroundColor: '#21130d' }, effortTitle: { color: colors.muted, fontWeight: '800' }, effortDescription: { color: colors.dim, fontSize: 10, lineHeight: 14 },
  exerciseSelector: { gap: 0 }, exerciseRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, exerciseActive: { borderColor: colors.orange, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  setEditor: { borderWidth: 1, borderTopWidth: 0, borderColor: colors.orange, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 12, gap: 10, backgroundColor: '#0f0f0f' }, editorHint: { color: colors.dim, fontSize: 11, lineHeight: 16 }, draftSet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 7 }, setTitle: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 }, draftFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, draftField: { width: 72, gap: 4 }, draftLabel: { color: colors.dim, fontSize: 8, height: 20 }, draftInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 6, color: colors.text, textAlign: 'center', fontFamily: 'monospace' },
  save: { color: colors.orange, fontWeight: '700' }, disabled: { color: colors.subtle }, warning: { color: colors.warning, fontSize: 12 }, cta: { paddingHorizontal: 20, paddingBottom: 8 }, exerciseBlock: { gap: 8 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableHead: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }, tableRow: { flexDirection: 'row', paddingVertical: 7 }, setNo: { width: 42, color: colors.dim, fontFamily: 'monospace', fontSize: 11 }, col: { flex: 1, color: colors.dim, fontFamily: 'monospace', fontSize: 11 }, colValue: { flex: 1, color: colors.text, fontFamily: 'monospace', fontSize: 13 }, effortCol: { width: 42, color: colors.dim, fontFamily: 'monospace', fontSize: 11 }, effortValue: { width: 42, color: colors.text, fontFamily: 'monospace', fontSize: 13 }, warmup: { color: colors.warning },
  delete: { padding: 16, alignItems: 'center' }, deleteText: { color: colors.danger, fontSize: 13 },
});
