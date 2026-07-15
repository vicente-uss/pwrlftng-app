import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ConfirmDialog, PrimaryButton, formatDate, formatTime } from '@/src/components/ui';
import { effortModeLabel, formatRepRange, usesRir, usesRpe } from '@/src/domain/training';
import { useAppStore } from '@/src/store/AppStore';
import { colors, condensed } from '@/src/theme';

export function ActiveSessionScreen({ onCancel, onFinished }: { onCancel(): void; onFinished(): void }) {
  const store = useAppStore();
  const session = store.activeSession;
  const [elapsed, setElapsed] = useState(session ? Math.floor((Date.now() - session.startedAt) / 1000) : 0);
  const [rest, setRest] = useState(0);
  const [confirmation, setConfirmation] = useState<'cancel' | 'finish' | null>(null);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
      setRest(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

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
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancelar entrenamiento" onPress={() => setConfirmation('cancel')}><Text style={styles.muted}>Cancelar</Text></Pressable>
      <Text style={styles.timer}>{formatTime(elapsed)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Finalizar entrenamiento" onPress={() => setConfirmation('finish')} style={styles.finish}><Text style={styles.strong}>Finalizar</Text></Pressable>
    </View>
    <Text numberOfLines={1} style={styles.sessionName}>{session.routineName} · {effortModeLabel(session.effortMode)}</Text>

    {rest > 0 && <View style={styles.rest}>
      <Text style={styles.restLabel}>DESCANSO</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Restar 30 segundos" onPress={() => setRest(Math.max(0, rest - 30))}><Text style={styles.adjust}>−30</Text></Pressable>
      <Text style={styles.restTime}>{formatTime(rest)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sumar 30 segundos" onPress={() => setRest(rest + 30)}><Text style={styles.adjust}>+30</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Omitir descanso" onPress={() => setRest(0)}><Ionicons name="close" color={colors.muted} size={20} /></Pressable>
    </View>}

    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {session.exercises.length === 0 && <>
        <Card><Text style={styles.cardTitle}>Entrenamiento libre</Text><Text style={styles.muted}>Agrega el primer ejercicio para comenzar a registrar.</Text></Card>
        <Text style={styles.section}>EJERCICIOS</Text>
        {store.exercises.map(exercise => <Pressable accessibilityRole="button" accessibilityLabel={`Agregar ${exercise.name}`} key={exercise.id} onPress={() => store.addExerciseToActive(exercise.id)} style={styles.addExercise}><View><Text style={styles.strong}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View><Ionicons name="add" color={colors.orange} size={19} /></Pressable>)}
      </>}

      {session.exercises.map(exercise => {
        const lastExercise = store.history.find(item => item.exercises.some(saved => saved.exerciseId === exercise.exerciseId))?.exercises.find(saved => saved.exerciseId === exercise.exerciseId);
        return <View key={exercise.id} style={styles.exerciseBlock}>
          <View style={styles.exerciseHead}><View><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.dim}>{exercise.muscle}</Text></View><Text style={styles.dim}>{exercise.sets.filter(set => set.completed).length}/{exercise.sets.length}</Text></View>
          <View style={styles.tableHead}>
            <Text style={styles.setCol}>SET</Text><Text style={styles.flexCol}>KG</Text><Text style={styles.tinyCol}>×</Text><Text style={styles.repCol}>REPS</Text>
            {showRpe && <Text style={styles.effortCol}>RPE</Text>}{showRir && <Text style={styles.effortCol}>RIR</Text>}<View style={styles.checkCol} />
          </View>
          {exercise.sets.map((set, index) => {
            const previous = lastExercise?.sets[index];
            const setNumber = set.type === 'warmup' ? 'calentamiento' : exercise.sets.slice(0, index + 1).filter(item => item.type === 'working').length;
            const previousEffort = `${previous?.rpe ? ` · RPE ${previous.rpe}` : ''}${previous?.rir ? ` · RIR ${previous.rir}` : ''}`;
            return <View key={set.id}>
              <View style={[styles.setRow, set.completed && styles.completed]}>
                <Text style={[styles.setCol, set.type === 'warmup' && styles.warmup]}>{set.type === 'warmup' ? 'W' : setNumber}</Text>
                <TextInput accessibilityLabel={`Peso ${exercise.name}, serie ${setNumber}`} value={set.weight} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'weight', value)} editable={!set.completed} selectTextOnFocus keyboardType="decimal-pad" style={[styles.input, styles.flexCol]} />
                <Text style={styles.tinyCol}>×</Text>
                <TextInput accessibilityLabel={`Repeticiones realizadas ${exercise.name}, serie ${setNumber}`} value={set.reps} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'reps', value)} editable={!set.completed} selectTextOnFocus keyboardType="number-pad" style={[styles.input, styles.repCol]} />
                {showRpe && <TextInput accessibilityLabel={`RPE ${exercise.name}, serie ${setNumber}`} value={set.rpe} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'rpe', value)} editable={!set.completed} selectTextOnFocus keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.dim} style={[styles.input, styles.effortInput]} />}
                {showRir && <TextInput accessibilityLabel={`RIR ${exercise.name}, serie ${setNumber}`} value={set.rir} onChangeText={value => store.updateActiveSet(exercise.id, set.id, 'rir', value)} editable={!set.completed} selectTextOnFocus keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.dim} style={[styles.input, styles.effortInput]} />}
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`${set.completed ? 'Desmarcar' : 'Completar'} ${exercise.name}, serie ${setNumber}`} accessibilityState={{ checked: set.completed }} onPress={() => { const shouldRest = !set.completed; store.toggleActiveSet(exercise.id, set.id); if (shouldRest) setRest(store.profile.defaultRestSeconds); }} style={[styles.check, set.completed && styles.checkDone]}><Ionicons name="checkmark" size={15} color={set.completed ? colors.canvas : colors.subtle} /></Pressable>
              </View>
              <Text style={styles.target}>Objetivo: {formatRepRange(set.targetRepsMin, set.targetRepsMax)} reps</Text>
              {previous && <Text style={styles.last}>Última vez: {previous.weight}kg × {previous.reps}{previousEffort}</Text>}
            </View>;
          })}
          <Pressable accessibilityRole="button" accessibilityLabel={`Agregar serie a ${exercise.name}`} onPress={() => store.addActiveSet(exercise.id)}><Text style={styles.addSet}>+ Agregar serie</Text></Pressable>
          <TextInput
            accessibilityLabel={`Notas de ${exercise.name}`}
            value={exercise.notes}
            onChangeText={value => store.updateActiveExerciseNotes(exercise.id, value)}
            placeholder="Nota del ejercicio (opcional)"
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={2000}
            style={styles.notesInput}
          />
        </View>;
      })}

      <View style={styles.sessionNotes}>
        <Text style={styles.section}>NOTA DE LA SESIÓN</Text>
        <TextInput accessibilityLabel="Nota general de la sesión" value={session.notes} onChangeText={store.updateActiveSessionNotes} placeholder="¿Cómo se sintió el entrenamiento? (opcional)" placeholderTextColor={colors.subtle} multiline maxLength={2000} style={[styles.notesInput, styles.sessionNotesInput]} />
      </View>
    </ScrollView>

    <ConfirmDialog visible={confirmation !== null} title={confirmation === 'cancel' ? 'Cancelar entrenamiento' : 'Finalizar entrenamiento'} message={confirmation === 'cancel' ? 'Esta sesión no se guardará en el historial.' : '¿Guardar esta sesión en tu historial?'} confirmLabel={confirmation === 'cancel' ? 'Descartar' : 'Finalizar'} destructive={confirmation === 'cancel'} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />
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
    <PrimaryButton title="Guardar entrenamiento" light onPress={onDone} />
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, muted: { color: colors.muted }, timer: { color: colors.orange, fontFamily: 'monospace', fontSize: 17, fontWeight: '700' }, finish: { backgroundColor: colors.elevated, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 }, strong: { color: colors.text, fontWeight: '700' }, sessionName: { color: colors.dim, fontSize: 11, textAlign: 'center', paddingBottom: 12 },
  rest: { marginHorizontal: 18, backgroundColor: '#15100d', borderWidth: 1, borderColor: '#4a240e', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, restLabel: { color: colors.orange, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }, restTime: { color: colors.orange, fontFamily: 'monospace', fontSize: 18, fontWeight: '700' }, adjust: { color: colors.muted, fontFamily: 'monospace', fontSize: 11 },
  content: { padding: 18, gap: 22, paddingBottom: 45 }, cardTitle: { color: colors.text, fontSize: 19, fontWeight: '800', fontFamily: condensed }, section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }, addExercise: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  exerciseBlock: { gap: 6 }, exerciseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, exerciseName: { color: colors.text, fontSize: 17, fontWeight: '700' }, tableHead: { flexDirection: 'row', alignItems: 'center' }, setRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }, completed: { opacity: 0.45 }, setCol: { width: 24, color: colors.dim, textAlign: 'center', fontSize: 10, fontFamily: 'monospace' }, flexCol: { flex: 1, minWidth: 0 }, tinyCol: { width: 10, color: colors.dim, textAlign: 'center' }, repCol: { width: 44 }, effortCol: { width: 38, color: colors.dim, textAlign: 'center', fontSize: 10 }, effortInput: { width: 38, color: colors.text }, checkCol: { width: 30 }, input: { backgroundColor: '#141414', borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 3, color: colors.text, textAlign: 'center', fontFamily: 'monospace' }, check: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: colors.success, borderColor: colors.success }, warmup: { color: colors.warning }, target: { color: colors.orange, fontSize: 9, fontFamily: 'monospace', marginLeft: 29, marginTop: 3 }, last: { color: colors.subtle, fontSize: 9, fontFamily: 'monospace', marginLeft: 29, marginTop: 2 }, addSet: { color: colors.orange, fontSize: 12, marginLeft: 29, marginTop: 10 },
  notesInput: { marginTop: 10, minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 12, color: colors.text, fontSize: 13, textAlignVertical: 'top' }, sessionNotes: { gap: 6 }, sessionNotesInput: { minHeight: 78, marginTop: 0 },
  empty: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 }, title: { color: colors.text, fontSize: 26, fontWeight: '900' }, summary: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 14 }, orangeKicker: { color: colors.orange, fontSize: 10, fontWeight: '700', letterSpacing: 2.2 }, summaryTitle: { color: colors.text, fontSize: 38, fontWeight: '900', fontFamily: condensed, lineHeight: 42 }, metrics: { flexDirection: 'row', gap: 10 }, metric: { color: colors.text, fontSize: 30, fontWeight: '900', fontFamily: condensed }, metricUnit: { color: colors.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }, volume: { color: colors.orange, fontSize: 27, fontWeight: '900', fontFamily: condensed }, noteTitle: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 }, noteText: { color: colors.text, fontSize: 13, lineHeight: 19 },
});
