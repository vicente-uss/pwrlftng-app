import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrCelebration } from '@/src/components/PrCelebration';
import { Card, ConfirmDialog, PrimaryButton, formatDate, formatTime } from '@/src/components/ui';
import { REST_PRESETS, formatRestDuration, isPresetRest, parseRestDuration } from '@/src/domain/profileOptions';
import { previousSetPerformance } from '@/src/domain/records';
import { EffortMode } from '@/src/domain/types';
import { EFFORT_MODES, effortModeLabel, formatRepRange, usesRir, usesRpe } from '@/src/domain/training';
import { useAppStore } from '@/src/store/AppStore';
import { colors, condensed } from '@/src/theme';

type DeleteTarget = { exerciseId: string; setId: string; label: string };

function ExerciseSheet({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const store = useAppStore();
  const selected = new Set(store.activeSession?.exercises.map(exercise => exercise.exerciseId));
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.sheetBackdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar ejercicios" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
        <View style={styles.sheetHead}><View><Text style={styles.sheetTitle}>Agregar ejercicio</Text><Text style={styles.dim}>Elige uno para añadirlo al entrenamiento.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose}><Ionicons name="close" color={colors.muted} size={22} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.sheetList}>{store.exercises.map(exercise => {
          const alreadySelected = selected.has(exercise.id);
          return <Pressable accessibilityRole="button" accessibilityLabel={`Agregar ${exercise.name}`} accessibilityState={{ disabled: alreadySelected }} disabled={alreadySelected} key={exercise.id} onPress={() => { store.addExerciseToActive(exercise.id); onClose(); }} style={[styles.addExercise, alreadySelected && styles.exerciseSelected]}><View><Text style={styles.strong}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View><Ionicons name={alreadySelected ? 'checkmark' : 'add'} color={alreadySelected ? colors.success : colors.orange} size={19} /></Pressable>;
        })}</ScrollView>
      </View>
    </View>
  </Modal>;
}

function SettingsSheet({ visible, effortMode, restSeconds, onClose, onSave }: { visible: boolean; effortMode: EffortMode; restSeconds: number; onClose(): void; onSave(mode: EffortMode, seconds: number): void }) {
  const [mode, setMode] = useState(effortMode);
  const [rest, setRest] = useState(restSeconds);
  const [customMode, setCustomMode] = useState(!isPresetRest(restSeconds));
  const [customRest, setCustomRest] = useState(isPresetRest(restSeconds) ? '' : formatRestDuration(restSeconds));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setMode(effortMode);
    setRest(restSeconds);
    setCustomMode(!isPresetRest(restSeconds));
    setCustomRest(isPresetRest(restSeconds) ? '' : formatRestDuration(restSeconds));
  }, [visible, effortMode, restSeconds]);

  const parsedCustom = parseRestDuration(customRest);
  const invalid = customMode && parsedCustom === null;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.sheetBackdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar configuración" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
        <View style={styles.sheetHead}><View><Text style={styles.sheetTitle}>Configuración</Text><Text style={styles.dim}>Estos ajustes se aplican solo a esta sesión.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose}><Ionicons name="close" color={colors.muted} size={22} /></Pressable></View>

        <Text style={styles.section}>REGISTRO DE ESFUERZO</Text>
        <View style={styles.effortGrid}>{EFFORT_MODES.map(option => <Pressable accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected: mode === option.value }} key={option.value} onPress={() => setMode(option.value)} style={[styles.effortOption, mode === option.value && styles.optionActive]}><Text style={[styles.effortTitle, mode === option.value && styles.optionTextActive]}>{option.label}</Text><Text style={styles.effortDescription}>{option.description}</Text></Pressable>)}</View>

        <Text style={styles.section}>DESCANSO</Text>
        <View style={styles.restGrid}>{REST_PRESETS.map(seconds => <Pressable accessibilityRole="radio" accessibilityLabel={`Descanso ${formatRestDuration(seconds)}`} accessibilityState={{ selected: !customMode && rest === seconds }} key={seconds} onPress={() => { setCustomMode(false); setRest(seconds); }} style={[styles.restOption, !customMode && rest === seconds && styles.optionActive]}><Text style={[styles.restText, !customMode && rest === seconds && styles.optionTextActive]}>{formatRestDuration(seconds)}</Text></Pressable>)}<Pressable accessibilityRole="radio" accessibilityLabel="Descanso personalizado" accessibilityState={{ selected: customMode }} onPress={() => { setCustomMode(true); if (!customRest) setCustomRest(formatRestDuration(rest)); }} style={[styles.restOption, customMode && styles.optionActive]}><Text style={[styles.restText, customMode && styles.optionTextActive]}>Personalizado</Text></Pressable></View>
        {customMode ? <><TextInput accessibilityLabel="Descanso personalizado" value={customRest} onChangeText={setCustomRest} placeholder="Ej. 2:30" placeholderTextColor={colors.subtle} keyboardType="numbers-and-punctuation" maxLength={5} style={[styles.customInput, invalid && styles.inputError]} />{invalid ? <Text style={styles.warning}>Usa MM:SS, con un máximo de 15:00.</Text> : null}</> : null}

        <PrimaryButton title="Guardar configuración" disabled={invalid} onPress={() => { const seconds = customMode ? parsedCustom : rest; if (seconds === null) return; onSave(mode, seconds); onClose(); }} />
      </View>
    </View>
  </Modal>;
}

export function ActiveSessionScreen({ onCancel, onFinished }: { onCancel(): void; onFinished(): void }) {
  const store = useAppStore();
  const session = store.activeSession;
  const { lastPrEvent, clearPrEvent } = store;
  const [elapsed, setElapsed] = useState(session ? Math.floor((Date.now() - session.startedAt) / 1000) : 0);
  const [rest, setRest] = useState(0);
  const [confirmation, setConfirmation] = useState<'cancel' | 'finish' | null>(null);
  const [exerciseSheet, setExerciseSheet] = useState(false);
  const [settingsSheet, setSettingsSheet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
      setRest(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !session) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setConfirmation('cancel');
      return true;
    });
    return () => subscription.remove();
  }, [session]);

  useEffect(() => {
    if (!lastPrEvent) return;
    const timeout = setTimeout(() => clearPrEvent(), 2500);
    return () => clearTimeout(timeout);
  }, [lastPrEvent, clearPrEvent]);

  if (!session) return <SafeAreaView style={styles.page}><View style={styles.empty}><Text style={styles.title}>No hay sesión activa</Text><PrimaryButton title="Volver" onPress={onCancel} /></View></SafeAreaView>;

  const showRpe = usesRpe(session.effortMode);
  const showRir = usesRir(session.effortMode);
  const confirmAction = () => {
    if (confirmation === 'cancel') {
      store.cancelWorkout();
      setConfirmation(null);
      onCancel();
      return;
    }
    if (confirmation === 'finish') {
      store.finishWorkout();
      setConfirmation(null);
      onFinished();
    }
  };

  return <SafeAreaView style={styles.page}>
    <PrCelebration event={lastPrEvent} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Descartar entreno" onPress={() => setConfirmation('cancel')}><Text style={styles.discard}>Descartar entreno</Text></Pressable>
      <Text style={styles.timer}>{formatTime(elapsed)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Finalizar entrenamiento" onPress={() => setConfirmation('finish')} style={styles.finish}><Text style={styles.strong}>Finalizar</Text></Pressable>
    </View>
    <Text numberOfLines={1} style={styles.sessionName}>{session.routineName} · {effortModeLabel(session.effortMode)}</Text>

    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Agregar ejercicio" onPress={() => setExerciseSheet(true)} style={styles.actionButton}><Ionicons name="add" color={colors.orange} size={17} /><Text style={styles.actionText}>Agregar ejercicio</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Configuración" onPress={() => setSettingsSheet(true)} style={styles.actionButton}><Ionicons name="options-outline" color={colors.orange} size={17} /><Text style={styles.actionText}>Configuración</Text></Pressable>
    </View>

    {rest > 0 ? <View style={styles.rest}>
      <Text style={styles.restLabel}>DESCANSO</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Restar 30 segundos" onPress={() => setRest(Math.max(0, rest - 30))}><Text style={styles.adjust}>−30</Text></Pressable>
      <Text style={styles.restTime}>{formatTime(rest)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sumar 30 segundos" onPress={() => setRest(rest + 30)}><Text style={styles.adjust}>+30</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Omitir descanso" onPress={() => setRest(0)}><Ionicons name="close" color={colors.muted} size={20} /></Pressable>
    </View> : null}

    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {session.exercises.length === 0 ? <Card><Text style={styles.cardTitle}>Entrenamiento libre</Text><Text style={styles.muted}>Agrega el primer ejercicio para comenzar a registrar.</Text><PrimaryButton title="Agregar ejercicio" onPress={() => setExerciseSheet(true)} /></Card> : null}

      {session.exercises.map(exercise => {
        return <View key={exercise.id} style={styles.exerciseBlock}>
          <View style={styles.exerciseHead}><View><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View><Text style={styles.dim}>{exercise.sets.filter(set => set.completed).length}/{exercise.sets.length}</Text></View>
          <View style={styles.tableHead}><Text style={styles.setCol}>SET</Text><Text style={styles.flexCol}>KG</Text><Text style={styles.tinyCol}>×</Text><Text style={styles.repCol}>REPS</Text>{showRpe ? <Text style={styles.effortCol}>RPE</Text> : null}{showRir ? <Text style={styles.effortCol}>RIR</Text> : null}<View style={styles.checkCol} /></View>
          {exercise.sets.map((set, index) => {
            const previous = previousSetPerformance(store.history, exercise.exerciseId, index);
            const setNumber = set.type === 'warmup' ? 'calentamiento' : exercise.sets.slice(0, index + 1).filter(item => item.type === 'working').length;
            const previousEffort = `${previous?.rpe ? ` · RPE ${previous.rpe}` : ''}${previous?.rir ? ` · RIR ${previous.rir}` : ''}`;
            return <View key={set.id}>
              <View style={styles.setMeta}>
                <Text style={styles.metaLabel}>OBJETIVO:</Text>
                <Text style={styles.metaValue}>{formatRepRange(set.targetRepsMin, set.targetRepsMax)} reps</Text>
                {previous ? <>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaLabel}>ANTERIOR:</Text>
                  <Text style={styles.metaValue}>{previous.weight}kg × {previous.reps} reps{previousEffort}</Text>
                </> : null}
              </View>
              <View style={[styles.setRow, set.completed && styles.completed]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Serie ${setNumber}. Mantén presionado para eliminar`} delayLongPress={450} onLongPress={() => setDeleteTarget({ exerciseId: exercise.id, setId: set.id, label: `${exercise.name}, serie ${setNumber}` })} style={styles.setPressable}><Text style={[styles.setColText, set.type === 'warmup' && styles.warmup]}>{set.type === 'warmup' ? 'W' : setNumber}</Text></Pressable>
                <TextInput accessibilityLabel={`Peso ${exercise.name}, serie ${setNumber}`} value={set.weight} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'weight', value)} editable={!set.completed} selectTextOnFocus keyboardType="decimal-pad" style={[styles.input, styles.flexCol]} />
                <Text style={styles.tinyCol}>×</Text>
                <TextInput accessibilityLabel={`Repeticiones realizadas ${exercise.name}, serie ${setNumber}`} value={set.reps} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'reps', value)} editable={!set.completed} selectTextOnFocus keyboardType="number-pad" style={[styles.input, styles.repCol]} />
                {showRpe ? <TextInput accessibilityLabel={`RPE ${exercise.name}, serie ${setNumber}`} value={set.rpe} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'rpe', value)} editable={!set.completed} selectTextOnFocus keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.dim} style={[styles.input, styles.effortInput]} /> : null}
                {showRir ? <TextInput accessibilityLabel={`RIR ${exercise.name}, serie ${setNumber}`} value={set.rir} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'rir', value)} editable={!set.completed} selectTextOnFocus keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.dim} style={[styles.input, styles.effortInput]} /> : null}
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`${set.completed ? 'Desmarcar' : 'Completar'} ${exercise.name}, serie ${setNumber}`} accessibilityState={{ checked: set.completed }} onPress={() => { const shouldRest = !set.completed; store.toggleActiveSet(exercise.id, set.id); if (shouldRest) setRest(session.restSeconds); }} style={[styles.check, set.completed && styles.checkDone]}><Ionicons name="checkmark" size={15} color={set.completed ? colors.canvas : colors.subtle} /></Pressable>
              </View>
            </View>;
          })}
          <Pressable accessibilityRole="button" accessibilityLabel={`Agregar serie a ${exercise.name}`} onPress={() => store.addActiveSet(exercise.id)}><Text style={styles.addSet}>+ Agregar serie</Text></Pressable>
          <Text style={styles.longPressHint}>Mantén presionado el número de una serie para eliminarla.</Text>
          <TextInput accessibilityLabel={`Notas de ${exercise.name}`} value={exercise.notes} onChangeText={value => store.updateActiveExerciseNotes(exercise.id, value)} placeholder="Nota del ejercicio (opcional)" placeholderTextColor={colors.subtle} multiline maxLength={2000} style={styles.notesInput} />
        </View>;
      })}

      <View style={styles.sessionNotes}><Text style={styles.section}>NOTA DE LA SESIÓN</Text><TextInput accessibilityLabel="Nota general de la sesión" value={session.notes} onChangeText={store.updateActiveSessionNotes} placeholder="¿Cómo se sintió el entrenamiento? (opcional)" placeholderTextColor={colors.subtle} multiline maxLength={2000} style={[styles.notesInput, styles.sessionNotesInput]} /></View>
    </ScrollView>

    <ExerciseSheet visible={exerciseSheet} onClose={() => setExerciseSheet(false)} />
    <SettingsSheet visible={settingsSheet} effortMode={session.effortMode} restSeconds={session.restSeconds} onClose={() => setSettingsSheet(false)} onSave={store.updateActiveSessionSettings} />
    <ConfirmDialog visible={confirmation !== null} title={confirmation === 'cancel' ? 'Descartar entreno' : 'Finalizar entrenamiento'} message={confirmation === 'cancel' ? 'Esta sesión no se guardará en el historial.' : '¿Guardar esta sesión en tu historial?'} confirmLabel={confirmation === 'cancel' ? 'Descartar' : 'Finalizar'} destructive={confirmation === 'cancel'} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />
    <ConfirmDialog visible={deleteTarget !== null} title="Eliminar serie" message={deleteTarget ? `¿Eliminar ${deleteTarget.label}?` : ''} confirmLabel="Eliminar serie" destructive onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) store.removeActiveSet(deleteTarget.exerciseId, deleteTarget.setId); setDeleteTarget(null); }} />
  </SafeAreaView>;
}

export function SummaryScreen({ onDone }: { onDone(): void }) {
  const latest = useAppStore().history[0];
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.summary}>
    <Text style={styles.orangeKicker}>ENTRENAMIENTO COMPLETADO</Text>
    <Text style={styles.summaryTitle}>{latest?.routineName ?? 'Entrenamiento'}</Text>
    <Text style={styles.dim}>{latest ? formatDate(latest.date) : ''}</Text>
    <View style={styles.metrics}><Card><Text style={styles.metric}>{latest ? Math.round(latest.durationSeconds / 60) : 0}</Text><Text style={styles.metricUnit}>MIN</Text><Text style={styles.dim}>Duración</Text></Card><Card><Text style={styles.metric}>{latest?.setsCompleted ?? 0}</Text><Text style={styles.metricUnit}>SETS</Text><Text style={styles.dim}>Completadas</Text></Card></View>
    <Card><Text style={styles.volume}>{latest?.totalVolume.toLocaleString('es-CL') ?? 0} kg</Text><Text style={styles.dim}>Volumen efectivo total</Text></Card>
    {latest?.notes ? <Card><Text style={styles.noteTitle}>NOTA DE LA SESIÓN</Text><Text style={styles.noteText}>{latest.notes}</Text></Card> : null}
    <PrimaryButton title="Volver a Entreno" light onPress={onDone} />
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  discard: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  muted: { color: colors.muted },
  timer: { color: colors.orange, fontFamily: 'monospace', fontSize: 17, fontWeight: '700' },
  finish: { backgroundColor: colors.elevated, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  strong: { color: colors.text, fontWeight: '700' },
  sessionName: { color: colors.dim, fontSize: 11, textAlign: 'center', paddingBottom: 10, paddingHorizontal: 18 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  actionButton: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  rest: { marginHorizontal: 18, backgroundColor: '#15100d', borderWidth: 1, borderColor: '#4a240e', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restLabel: { color: colors.orange, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  restTime: { color: colors.orange, fontFamily: 'monospace', fontSize: 18, fontWeight: '700' },
  adjust: { color: colors.muted, fontFamily: 'monospace', fontSize: 11 },
  content: { padding: 18, gap: 22, paddingBottom: 45 },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: '800', fontFamily: condensed },
  section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  exerciseBlock: { gap: 6 },
  exerciseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  exerciseName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  tableHead: { flexDirection: 'row', alignItems: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  completed: { opacity: 0.45 },
  setCol: { width: 24, color: colors.dim, textAlign: 'center', fontSize: 10, fontFamily: 'monospace' },
  setPressable: { width: 24, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  setColText: { color: colors.dim, textAlign: 'center', fontSize: 10, fontFamily: 'monospace' },
  flexCol: { flex: 1, minWidth: 0 },
  tinyCol: { width: 10, color: colors.dim, textAlign: 'center' },
  repCol: { width: 44 },
  effortCol: { width: 38, color: colors.dim, textAlign: 'center', fontSize: 10 },
  effortInput: { width: 38, color: colors.text },
  checkCol: { width: 30 },
  input: { backgroundColor: '#141414', borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 3, color: colors.text, textAlign: 'center', fontFamily: 'monospace' },
  check: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  warmup: { color: colors.warning },
  setMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginLeft: 29, marginTop: 10, paddingVertical: 3 },
  metaLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  metaValue: { color: colors.muted, fontSize: 12, fontFamily: 'monospace' },
  metaDivider: { color: colors.subtle, fontSize: 12 },
  addSet: { color: colors.orange, fontSize: 12, marginLeft: 29, marginTop: 10 },
  longPressHint: { color: colors.subtle, fontSize: 9, marginLeft: 29, marginTop: 2 },
  notesInput: { marginTop: 10, minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 12, color: colors.text, fontSize: 13, textAlignVertical: 'top' },
  sessionNotes: { gap: 6 },
  sessionNotesInput: { minHeight: 78, marginTop: 0 },
  empty: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  summary: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 14 },
  orangeKicker: { color: colors.orange, fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
  summaryTitle: { color: colors.text, fontSize: 38, fontWeight: '900', fontFamily: condensed, lineHeight: 42 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { color: colors.text, fontSize: 30, fontWeight: '900', fontFamily: condensed },
  metricUnit: { color: colors.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  volume: { color: colors.orange, fontSize: 27, fontWeight: '900', fontFamily: condensed },
  noteTitle: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  noteText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.76)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border, padding: 18, gap: 13 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetTitle: { color: colors.text, fontFamily: condensed, fontSize: 24, fontWeight: '900' },
  sheetList: { gap: 8, paddingBottom: 4 },
  addExercise: { backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseSelected: { opacity: 0.48 },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effortOption: { width: '48%', minHeight: 68, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 4 },
  effortTitle: { color: colors.muted, fontWeight: '800' },
  effortDescription: { color: colors.dim, fontSize: 10, lineHeight: 14 },
  optionActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  optionTextActive: { color: colors.text },
  restGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  restOption: { minWidth: 76, flexGrow: 1, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center' },
  restText: { color: colors.muted, fontFamily: 'monospace', fontWeight: '700' },
  customInput: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 13, color: colors.text, fontFamily: 'monospace', fontSize: 17 },
  inputError: { borderColor: colors.danger },
  warning: { color: colors.warning, fontSize: 11 },
});
