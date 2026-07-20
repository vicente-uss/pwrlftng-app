import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ConfirmDialog, PrimaryButton, TopBar, formatDate } from '@/src/components/ui';
import { DEFAULT_BLOCK, GOAL_OPTIONS, REST_PRESETS, formatRestDuration, isPresetRest, parseRestDuration } from '@/src/domain/profileOptions';
import { Profile } from '@/src/domain/types';
import { useAppStore } from '@/src/store/AppStore';
import { colors, condensed } from '@/src/theme';

export function HistoryScreen() {
  const { history } = useAppStore();
  const records = useMemo(() => {
    const map = new Map<string, { name: string; max: number; e1rm: number; sessions: number }>();
    history.forEach(session => session.exercises.forEach(exercise => {
      const working = exercise.sets.filter(set => set.completed && set.type === 'working');
      if (!working.length) return;
      const max = Math.max(...working.map(set => Number(set.weight) || 0));
      const e1rm = Math.max(...working.map(set => Math.round((Number(set.weight) || 0) * (1 + (Number(set.reps) || 0) / 30))));
      const previous = map.get(exercise.exerciseId);
      map.set(exercise.exerciseId, { name: exercise.name, max: Math.max(previous?.max ?? 0, max), e1rm: Math.max(previous?.e1rm ?? 0, e1rm), sessions: (previous?.sessions ?? 0) + 1 });
    }));
    return [...map.values()];
  }, [history]);

  return <View style={styles.fill}>
    <TopBar title="Historial" />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>SESIONES RECIENTES</Text>
      {history.map(session => {
        const exerciseNotes = session.exercises.filter(exercise => exercise.notes.trim());
        return <Card key={session.id}>
          <View style={styles.between}><View style={styles.grow}><Text style={styles.strong}>{session.routineName}</Text><Text style={styles.dim}>{formatDate(session.date)} · {Math.round(session.durationSeconds / 60)} min · {session.setsCompleted} {session.setsCompleted === 1 ? 'serie' : 'series'}</Text></View><Text style={styles.orange}>{session.totalVolume.toLocaleString('es-CL')}kg</Text></View>
          <Text numberOfLines={1} style={styles.exerciseList}>{session.exercises.map(item => item.name).join(' · ')}</Text>
          {session.notes ? <View style={styles.note}><Text style={styles.noteLabel}>NOTA DE LA SESIÓN</Text><Text style={styles.noteText}>{session.notes}</Text></View> : null}
          {exerciseNotes.map(exercise => <View key={exercise.id} style={styles.exerciseNote}><Text style={styles.exerciseNoteName}>{exercise.name}</Text><Text style={styles.noteText}>{exercise.notes}</Text></View>)}
        </Card>;
      })}
      {history.length === 0 ? <Card><Text style={styles.dim}>Termina tu primer entrenamiento para ver el historial.</Text></Card> : null}

      <Text style={styles.section}>RÉCORDS POR EJERCICIO</Text>
      {records.map(record => <View key={record.name} style={styles.record}><View style={styles.recordIcon}><Ionicons name="trophy-outline" color={colors.orange} size={17} /></View><View style={styles.grow}><Text style={styles.strong}>{record.name}</Text><Text style={styles.dim}>{record.sessions} {record.sessions === 1 ? 'sesión registrada' : 'sesiones registradas'}</Text></View><View style={styles.recordMetric}><Text style={styles.metric}>{record.max}kg</Text><Text style={styles.metricLabel}>MÁXIMO</Text></View><View style={styles.recordMetric}><Text style={styles.metric}>{record.e1rm}kg</Text><Text style={styles.metricLabel}>E1RM</Text></View></View>)}
      {records.length === 0 ? <Text style={styles.emptyHint}>Tus récords aparecerán después de completar series de trabajo.</Text> : null}
    </ScrollView>
  </View>;
}

export function ProfileScreen({ onSignOut, onExercises }: { onSignOut(): Promise<void>; onExercises(): void }) {
  const store = useAppStore();
  const [local, setLocal] = useState<Profile>({ ...store.profile, level: DEFAULT_BLOCK });
  const [customRest, setCustomRest] = useState(isPresetRest(store.profile.defaultRestSeconds) ? '' : formatRestDuration(store.profile.defaultRestSeconds));
  const [customMode, setCustomMode] = useState(!isPresetRest(store.profile.defaultRestSeconds));
  const [saved, setSaved] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const parsedCustomRest = parseRestDuration(customRest);
  const restInvalid = customMode && parsedCustomRest === null;

  const change = (key: keyof Profile, value: string | number) => {
    setSaved(false);
    setLocal(current => ({ ...current, [key]: value }));
  };

  const selectRest = (seconds: number) => {
    setCustomMode(false);
    setCustomRest('');
    change('defaultRestSeconds', seconds);
  };

  const changeCustomRest = (value: string) => {
    setSaved(false);
    setCustomRest(value);
    const parsed = parseRestDuration(value);
    if (parsed !== null) setLocal(current => ({ ...current, defaultRestSeconds: parsed }));
  };

  const save = () => {
    if (restInvalid) return;
    store.updateProfile({ ...local, level: DEFAULT_BLOCK });
    setSaved(true);
  };

  const logout = async () => {
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await onSignOut();
      setLogoutVisible(false);
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : 'No pudimos cerrar la sesión. Inténtalo otra vez.');
      setLogoutVisible(false);
    } finally {
      setLogoutBusy(false);
    }
  };

  const syncMessage = store.syncState === 'pulling'
    ? 'Recuperando datos de Supabase…'
    : store.syncState === 'syncing'
      ? 'Sincronizando…'
      : store.syncState === 'synced'
        ? 'Sincronizado con Supabase'
        : store.syncState === 'error'
          ? 'Pendiente de sincronización'
          : 'Modo local · guardado en este dispositivo';

  return <View style={styles.fill}>
    <TopBar title="Perfil" action={<Ionicons name="settings-outline" color={colors.dim} size={21} />} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Card><View style={styles.profileHead}><View style={styles.avatar}><Ionicons name="person" color={colors.muted} size={22} /></View><View style={styles.grow}><Text style={styles.profileName}>Atleta PWRLFTNG</Text><Text style={styles.dim}>{DEFAULT_BLOCK} · {local.goal}</Text></View></View><Text style={[styles.sync, store.syncState === 'error' && styles.syncError]}>{syncMessage}</Text></Card>

      <Text style={styles.section}>DATOS DEL ATLETA</Text>
      <View style={styles.metricsRow}><Card style={styles.metricCard}><TextInput accessibilityLabel="Peso corporal en kilogramos" value={local.bodyWeight} onChangeText={value => change('bodyWeight', value)} keyboardType="decimal-pad" style={styles.bigInput} /><Text style={styles.metricLabel}>KG · PESO</Text></Card><Card style={styles.metricCard}><TextInput accessibilityLabel="Altura en centímetros" value={local.height} onChangeText={value => change('height', value)} keyboardType="number-pad" style={styles.bigInput} /><Text style={styles.metricLabel}>CM · ALTURA</Text></Card></View>

      <Text style={styles.section}>OBJETIVO</Text>
      <View style={styles.optionList}>{GOAL_OPTIONS.map(goal => <Pressable accessibilityRole="radio" accessibilityLabel={goal} accessibilityState={{ selected: local.goal === goal }} key={goal} onPress={() => change('goal', goal)} style={[styles.option, local.goal === goal && styles.optionActive]}><Ionicons name={local.goal === goal ? 'radio-button-on' : 'radio-button-off'} color={local.goal === goal ? colors.orange : colors.dim} size={18} /><Text style={[styles.optionText, local.goal === goal && styles.optionTextActive]}>{goal}</Text></Pressable>)}</View>

      <Text style={styles.section}>BLOQUE</Text>
      <View accessibilityState={{ disabled: true }} style={styles.disabledField}><View><Text style={styles.strong}>{DEFAULT_BLOCK}</Text><Text style={styles.dim}>La edición de bloques estará disponible más adelante.</Text></View><Ionicons name="lock-closed-outline" color={colors.subtle} size={17} /></View>

      <Text style={styles.section}>DESCANSO POR DEFECTO</Text>
      <View style={styles.restGrid}>{REST_PRESETS.map(seconds => <Pressable accessibilityRole="radio" accessibilityLabel={`Descanso ${formatRestDuration(seconds)}`} accessibilityState={{ selected: !customMode && local.defaultRestSeconds === seconds }} key={seconds} onPress={() => selectRest(seconds)} style={[styles.restOption, !customMode && local.defaultRestSeconds === seconds && styles.optionActive]}><Text style={[styles.restText, !customMode && local.defaultRestSeconds === seconds && styles.optionTextActive]}>{formatRestDuration(seconds)}</Text></Pressable>)}<Pressable accessibilityRole="radio" accessibilityLabel="Descanso personalizado" accessibilityState={{ selected: customMode }} onPress={() => { setSaved(false); setCustomMode(true); if (!customRest) setCustomRest(formatRestDuration(local.defaultRestSeconds)); }} style={[styles.restOption, customMode && styles.optionActive]}><Text style={[styles.restText, customMode && styles.optionTextActive]}>Personalizado</Text></Pressable></View>
      {customMode ? <View><TextInput accessibilityLabel="Descanso personalizado en minutos y segundos" value={customRest} onChangeText={changeCustomRest} placeholder="Ej. 2:30" placeholderTextColor={colors.subtle} keyboardType="numbers-and-punctuation" maxLength={5} style={[styles.customInput, restInvalid && styles.inputError]} /><Text style={[styles.helper, restInvalid && styles.warning]}>{restInvalid ? 'Usa el formato MM:SS, con un máximo de 15:00.' : 'Formato minutos:segundos.'}</Text></View> : null}

      <PrimaryButton title={saved ? 'Guardado ✓' : 'Guardar cambios'} onPress={save} light disabled={restInvalid} />

      <Text style={styles.section}>BIBLIOTECA</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Ejercicios" onPress={onExercises} style={styles.exercisesButton}>
        <View style={styles.exercisesIcon}><Ionicons name="barbell-outline" color={colors.orange} size={18} /></View>
        <View style={styles.grow}><Text style={styles.strong}>Ejercicios</Text><Text style={styles.dim}>Catálogo, video y récords por ejercicio</Text></View>
        <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
      </Pressable>

      <Text style={styles.section}>SESIÓN</Text>
      {logoutError ? <Text accessibilityLiveRegion="polite" style={styles.warning}>{logoutError}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" disabled={logoutBusy} onPress={() => setLogoutVisible(true)} style={styles.logoutButton}><Ionicons name="log-out-outline" color={colors.danger} size={19} /><Text style={styles.logoutText}>{logoutBusy ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text></Pressable>
    </ScrollView>

    <ConfirmDialog visible={logoutVisible} title="Cerrar sesión" message="Tus datos sincronizados seguirán disponibles cuando vuelvas a entrar." confirmLabel={logoutBusy ? 'Cerrando…' : 'Cerrar sesión'} destructive onCancel={() => setLogoutVisible(false)} onConfirm={logout} />
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 42 },
  section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  strong: { color: colors.text, fontWeight: '700' },
  dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  orange: { color: colors.orange, fontSize: 11, fontWeight: '700' },
  exerciseList: { color: colors.subtle, fontSize: 11 },
  note: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 4 },
  noteLabel: { color: colors.orange, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  noteText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  exerciseNote: { backgroundColor: colors.elevated, borderRadius: 9, padding: 10, gap: 3 },
  exerciseNoteName: { color: colors.text, fontSize: 11, fontWeight: '700' },
  record: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  recordMetric: { alignItems: 'flex-end' },
  metric: { color: colors.text, fontSize: 15, fontWeight: '800', fontFamily: 'monospace' },
  metricLabel: { color: colors.dim, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  emptyHint: { color: colors.subtle, fontSize: 11, lineHeight: 16 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  profileName: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: condensed },
  sync: { color: colors.success, fontSize: 10 },
  syncError: { color: colors.warning },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1 },
  bigInput: { color: colors.text, fontSize: 30, fontWeight: '900', fontFamily: condensed, padding: 0 },
  optionList: { gap: 8 },
  option: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  optionText: { color: colors.muted, fontWeight: '600' },
  optionTextActive: { color: colors.text },
  disabledField: { opacity: 0.58, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  restOption: { minWidth: 76, flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  restText: { color: colors.muted, fontFamily: 'monospace', fontWeight: '700' },
  customInput: { marginTop: 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 13, color: colors.text, fontFamily: 'monospace', fontSize: 17 },
  inputError: { borderColor: colors.danger },
  helper: { color: colors.dim, fontSize: 10, marginTop: 5 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  logoutButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#43201f', borderRadius: 13, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  logoutText: { color: colors.danger, fontWeight: '700' },
  exercisesButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  exercisesIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
});
