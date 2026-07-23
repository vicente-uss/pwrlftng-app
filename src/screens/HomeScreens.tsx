import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, Card, PrimaryButton, formatDate } from '@/src/components/ui';
import { Routine } from '@/src/domain/types';
import { effortModeLabel } from '@/src/domain/training';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { signInWithEmail, signUpWithEmail } from '@/src/services/authService';
import { AthleteBlock, AthleteBlockRoutine, AthleteBlockWeek, derivedWeekStartDate, getBlockRoutines, getBlockWeeks, getMyActiveBlock, subscribeToProgramChanges } from '@/src/services/athleteBlockService';
import { generateInviteCode, redeemCoachCode } from '@/src/services/coachService';
import { useAppStore } from '@/src/store/AppStore';
import { colors, condensed, shortDays } from '@/src/theme';

export function LoginScreen({ onLogin, onSignedUp, onDemo }: { onLogin(): Promise<void>; onSignedUp(): Promise<void>; onDemo(): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyMode, setBusyMode] = useState<'login' | 'signup' | null>(null);
  const [error, setError] = useState('');
  const busy = busyMode !== null;

  const validate = () => {
    if (!isSupabaseConfigured) {
      setError('El backend aún no tiene credenciales. Por ahora usa la cuenta demo.');
      return false;
    }
    if (!email.trim() || !password) {
      setError('Ingresa tu email y contraseña.');
      return false;
    }
    return true;
  };

  const submit = async (mode: 'login' | 'signup') => {
    if (busy || !validate()) return;
    setBusyMode(mode);
    setError('');
    try {
      const session = mode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
      if (session) await (mode === 'signup' ? onSignedUp() : onLogin());
      else setError('Revisa tu correo para confirmar la cuenta y luego inicia sesión.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No pudimos conectar con tu cuenta.';
      setError(message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : message);
    } finally {
      setBusyMode(null);
    }
  };

  return <SafeAreaView style={styles.login}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <View style={styles.loginInner}>
        <Brand />
        <View style={styles.form}>
          <TextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#3a3a3a" style={styles.input} />
          <TextInput accessibilityLabel="Contraseña" value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor="#3a3a3a" secureTextEntry style={styles.input} />
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Continuar con Google" disabled style={styles.google}><Text style={styles.muted}>G  Google · próximamente</Text></Pressable>
          <PrimaryButton
            title={busyMode === 'login' ? 'Recuperando tus datos…' : 'Iniciar sesión'}
            disabled={busy}
            onPress={() => submit('login')}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Crear cuenta" disabled={busy} onPress={() => submit('signup')} style={({ pressed }) => [styles.signupButton, busy && styles.signupDisabled, pressed && styles.signupPressed]}>
            <Text style={styles.signupText}>{busyMode === 'signup' ? 'Creando tu cuenta…' : 'Crear cuenta'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Probar con cuenta demo" disabled={busy} onPress={onDemo}><Text style={styles.demo}>Probar con cuenta demo →</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function AccountTypeScreen({ onDone }: { onDone(): void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [code, setCode] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linked, setLinked] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const openLinkCoach = () => {
    setLinkOpen(true);
    setLinkError('');
  };

  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLinkBusy(true);
    setLinkError('');
    try {
      await redeemCoachCode(trimmed);
      setLinked(true);
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : 'No pudimos vincular el código. Inténtalo otra vez.');
    } finally {
      setLinkBusy(false);
    }
  };

  const becomeCoach = async () => {
    setCoachOpen(true);
    setGenerateBusy(true);
    setGenerateError('');
    try {
      setGeneratedCode(await generateInviteCode());
    } catch (cause) {
      setGenerateError(cause instanceof Error ? cause.message : 'No pudimos generar tu código. Podrás generarlo luego desde tu perfil.');
    } finally {
      setGenerateBusy(false);
    }
  };

  const copyCode = async () => {
    if (!generatedCode) return;
    await Clipboard.setStringAsync(generatedCode);
    setCodeCopied(true);
  };

  return <SafeAreaView style={styles.login}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.welcomeContent}>
      <Brand compact />
      <Text style={styles.welcomeTitle}>¿Cómo vas a usar PWRLFTNG?</Text>
      <Text style={styles.welcomeSubtitle}>Puedes cambiar esto en cualquier momento desde tu perfil.</Text>

      <Card>
        <Text style={styles.strong}>Quiero entrenar</Text>
        <Text style={styles.dim}>Registra tus rutinas y sesiones. Podrás vincularte con un coach después.</Text>
        <PrimaryButton title="Empezar a entrenar" onPress={onDone} light />
      </Card>

      <Card>
        <Text style={styles.strong}>Ya tengo coach</Text>
        <Text style={styles.dim}>Ingresa el código de invitación que te compartió tu coach.</Text>
        {linkOpen ? (linked ? <Text style={styles.success}>¡Cuenta vinculada con tu coach!</Text> : <>
          <TextInput accessibilityLabel="Código de invitación del coach" value={code} onChangeText={setCode} placeholder="Código de invitación" placeholderTextColor={colors.subtle} autoCapitalize="characters" style={styles.input} />
          {linkError ? <Text style={styles.error}>{linkError}</Text> : null}
          <PrimaryButton title={linkBusy ? 'Vinculando…' : 'Vincular'} onPress={redeem} disabled={linkBusy || !code.trim()} />
        </>) : <PrimaryButton title="Ya tengo coach" onPress={openLinkCoach} light />}
      </Card>

      <Card>
        <Text style={styles.strong}>Soy coach</Text>
        <Text style={styles.dim}>Genera un código para invitar a tu primer atleta.</Text>
        {coachOpen ? <>
          {generateBusy ? <Text style={styles.dim}>Generando código…</Text> : null}
          {generateError ? <Text style={styles.error}>{generateError}</Text> : null}
          {generatedCode ? <>
            <Text style={styles.code}>{generatedCode}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Copiar código" onPress={copyCode} style={styles.copyButton}>
              <Ionicons name={codeCopied ? 'checkmark' : 'copy-outline'} color={colors.text} size={16} />
              <Text style={styles.copyButtonText}>{codeCopied ? 'Copiado' : 'Copiar código'}</Text>
            </Pressable>
          </> : null}
        </> : <PrimaryButton title="Soy coach" onPress={becomeCoach} light />}
      </Card>

      <PrimaryButton title="Continuar a Entreno" onPress={onDone} />
    </ScrollView>
  </SafeAreaView>;
}

export function TrainingScreen({ onCreate, onRoutine, onHistory, onStart, onActivation }: { onCreate(): void; onRoutine(routine: Routine): void; onHistory(): void; onStart(routineId?: string, context?: { blockId?: string | null; blockWeekId?: string | null }): void | Promise<void>; onActivation(blockId: string): void }) {
  const { routines, history } = useAppStore();
  const [block, setBlock] = useState<AthleteBlock | null>(null);
  const [blockWeeks, setBlockWeeks] = useState<AthleteBlockWeek[]>([]);
  const [blockRoutines, setBlockRoutines] = useState<AthleteBlockRoutine[]>([]);
  const [blockLoading, setBlockLoading] = useState(isSupabaseConfigured);
  const [blockFailed, setBlockFailed] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const loadBlock = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const found = await getMyActiveBlock();
      if (!found) { setBlock(null); setBlockWeeks([]); setBlockRoutines([]); return; }
      const [weeks, weekRoutines] = await Promise.all([getBlockWeeks(found.id), getBlockRoutines(found.id)]);
      setBlock(found);
      setBlockWeeks(weeks);
      setBlockRoutines(weekRoutines);
      setBlockFailed(false);
    } catch (cause) {
      console.error('athlete block load error', cause);
      setBlockFailed(true);
    } finally {
      setBlockLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadBlock().catch(() => undefined);
    const unsubscribe = subscribeToProgramChanges(() => { if (active) loadBlock().catch(() => undefined); });
    return () => { active = false; unsubscribe(); };
  }, [loadBlock]);

  const localRoutines = routines.filter(routine => !routine.blockWeekId);
  const showBlock = block !== null && !blockFailed;
  const currentWeek = showBlock && block ? blockWeeks.find(week => week.weekNumber === block.currentWeekNumber && !week.isWarmup) : undefined;
  const currentRoutines = currentWeek ? blockRoutines.filter(routine => routine.blockWeekId === currentWeek.id).sort((a, b) => a.trainingDay - b.trainingDay) : [];
  const explorableWeeks = showBlock && block ? blockWeeks.filter(week => week.id !== currentWeek?.id && (week.isWarmup || week.status === 'published' || week.status === 'completed')) : [];
  const toggleWeek = (weekId: string) => setExpandedWeeks(current => ({ ...current, [weekId]: !current[weekId] }));

  return <View style={styles.fill}>
    <View style={styles.header}><Brand compact /></View>
    <ScrollView contentContainerStyle={styles.content}>
      {blockLoading ? <Text style={styles.dim}>Cargando tu bloque…</Text> : null}

      {showBlock && block ? <>
        <Card style={styles.activeBlockCard}>
          <View style={styles.blockHeading}><View style={styles.blockIcon}><Ionicons name="folder-open-outline" color={colors.orange} size={21} /></View><View style={styles.grow}><Text style={styles.cardTitle}>{block.name}</Text>{block.startDate ? <Text style={styles.dim}>Inicio {formatDate(block.startDate)}</Text> : null}</View></View>
          {block.goalText ? <Text style={styles.dim}>{block.goalText}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver Activación de ${block.name}`} onPress={() => onActivation(block.id)} style={styles.activationLink}><Ionicons name="book-outline" color={colors.orange} size={17} /><Text style={styles.activationLinkText}>Ver Activación</Text><Text style={styles.activationMeta}>Guía sin checklist</Text><Ionicons name="chevron-forward" color={colors.subtle} size={15} /></Pressable>
        </Card>
        <View style={styles.blockWeekSection}>
          <View style={styles.currentWeekHeading}><View><Text style={styles.section}>SEMANA ACTUAL</Text><Text style={styles.currentWeekTitle}>{currentWeek?.name ?? `Semana ${block.currentWeekNumber}`}</Text>{currentWeek ? <Text style={styles.dim}>{derivedWeekStartDate(block, currentWeek) ? `Desde ${formatDate(derivedWeekStartDate(block, currentWeek)!)}` : 'Avance flexible'}</Text> : null}</View><View style={styles.currentPill}><Text style={styles.currentPillText}>EN CURSO</Text></View></View>
          {!currentWeek ? <Card style={styles.waitingCard}><Ionicons name="cloud-upload-outline" color={colors.warning} size={24} /><Text style={styles.routineName}>Esperando a que tu coach publique la próxima semana…</Text><Text style={styles.dim}>Te avisaremos cuando esté disponible.</Text></Card> : null}
          {currentWeek && currentRoutines.length === 0 ? <Card><Text style={styles.dim}>Tu coach todavía no agregó días a esta semana.</Text></Card> : null}
          {currentRoutines.map(routine => <Card key={routine.id}>
            <View style={styles.routineHead}><View style={styles.dayBox}><Text style={styles.day}>D{routine.trainingDay}</Text><Ionicons name="barbell-outline" color={colors.dim} size={16} /></View><View style={styles.grow}><Text style={styles.routineName}>{routine.name}</Text>{routine.prescriptionNotes ? <Text style={styles.dim}>{routine.prescriptionNotes}</Text> : null}</View></View>
            <View style={styles.routineActions}><PrimaryButton title="Empezar" onPress={() => onStart(routine.id, { blockId: block.id, blockWeekId: currentWeek?.id })} /><Pressable accessibilityRole="button" accessibilityLabel="Ver Activación" onPress={() => onActivation(block.id)} style={styles.routineActivation}><Ionicons name="book-outline" color={colors.muted} size={15} /><Text style={styles.routineActivationText}>Ver Activación</Text></Pressable></View>
          </Card>)}
        </View>

        {explorableWeeks.length ? <><Text style={styles.section}>EXPLORAR BLOQUE</Text>{explorableWeeks.map(week => {
          const open = Boolean(expandedWeeks[week.id]);
          const weekRoutines = blockRoutines.filter(routine => routine.blockWeekId === week.id).sort((a, b) => a.trainingDay - b.trainingDay);
          return <View key={week.id} style={styles.weekFolder}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${open ? 'Cerrar' : 'Abrir'} ${week.name}`} onPress={() => toggleWeek(week.id)} style={styles.weekFolderHeader}><Ionicons name={open ? 'folder-open-outline' : 'folder-outline'} color={colors.orange} size={19} /><View style={styles.grow}><Text style={styles.routineName}>{week.name}</Text><Text style={styles.dim}>{week.isWarmup ? 'Activación' : `${weekRoutines.length} días`}{week.status === 'completed' ? ' · Completada' : ''}</Text></View><Ionicons name={open ? 'chevron-up' : 'chevron-down'} color={colors.dim} size={16} /></Pressable>
            {open ? <View style={styles.weekFolderBody}>{weekRoutines.map(routine => <View key={routine.id} style={styles.exploreDay}><View style={styles.dayBoxSmall}><Text style={styles.day}>D{routine.trainingDay}</Text></View><View style={styles.grow}><Text style={styles.routineName}>{routine.name}</Text>{routine.prescriptionNotes ? <Text style={styles.dim}>{routine.prescriptionNotes}</Text> : null}</View><PrimaryButton title="Entrenar" light onPress={() => onStart(routine.id, { blockId: block.id, blockWeekId: week.id })} /></View>)}{!weekRoutines.length ? <Text style={styles.dim}>Sin días publicados.</Text> : null}</View> : null}
          </View>;
        })}</> : null}
      </> : (!blockLoading ? <>
        <Card style={styles.freeCard}>
          <View style={styles.freeIcon}><Ionicons name="flash-outline" color={colors.orange} size={21} /></View>
          <Text style={styles.cardTitle}>Empezar entrenamiento libre</Text>
          <Text style={styles.dim}>Registra una sesión sin guardar una rutina nueva.</Text>
          <PrimaryButton title="Empezar entrenamiento libre" onPress={() => onStart()} />
        </Card>

        <PrimaryButton title="Nueva rutina" light onPress={onCreate} />

        <View style={styles.sectionHead}><Text style={styles.section}>MIS RUTINAS</Text><Text style={styles.count}>{localRoutines.length}/7</Text></View>
        {localRoutines.map(routine => <Card key={routine.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir rutina ${routine.name}`} onPress={() => onRoutine(routine)} style={styles.routineHead}>
            <View style={styles.dayBox}><Text style={styles.day}>{shortDays[routine.day - 1]}</Text><Ionicons name="barbell-outline" color={colors.dim} size={16} /></View>
            <View style={styles.grow}>
              <Text style={styles.routineName}>{routine.name}</Text>
              <Text style={styles.dim}>{routine.exercises.length} ejercicios · {routine.exercises.reduce((sum, item) => sum + item.sets.length, 0)} series · {effortModeLabel(routine.effortMode)}</Text>
            </View>
            <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
          </Pressable>
          <PrimaryButton title="Iniciar rutina" onPress={() => onStart(routine.id)} />
        </Card>)}

        {localRoutines.length === 0 ? <Card><Text style={styles.muted}>Aún no tienes rutinas.</Text><PrimaryButton title="Crear primera rutina" onPress={onCreate} /></Card> : null}
      </> : null)}

      <Pressable accessibilityRole="button" accessibilityLabel="Sesiones anteriores" onPress={onHistory} style={styles.historyButton}>
        <View style={styles.historyIcon}><Ionicons name="time-outline" color={colors.orange} size={19} /></View>
        <View style={styles.grow}><Text style={styles.routineName}>Sesiones anteriores</Text><Text style={styles.dim}>{history.length ? `${history.length} registradas` : 'Aún no hay sesiones'}</Text></View>
        <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
      </Pressable>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  login: { flex: 1, backgroundColor: colors.background },
  loginInner: { flex: 1, justifyContent: 'center', padding: 24, gap: 48 },
  form: { gap: 12 },
  input: { backgroundColor: '#141414', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, color: colors.text, fontSize: 15 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  signupButton: { borderWidth: 1, borderColor: colors.orange, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  signupText: { color: colors.orange, fontWeight: '800', fontSize: 14 },
  signupDisabled: { opacity: 0.35 },
  signupPressed: { opacity: 0.75 },
  google: { borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 15, alignItems: 'center', opacity: 0.55 },
  demo: { color: colors.orange, textAlign: 'center', padding: 12 },
  muted: { color: colors.muted },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  content: { padding: 20, paddingTop: 8, gap: 14, paddingBottom: 38 },
  freeCard: { backgroundColor: '#11100f', borderColor: '#3a2417' },
  activeBlockCard: { borderColor: '#4a2816', backgroundColor: '#12100f' },
  activationLink: { minHeight: 48, marginTop: 4, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 8 },
  activationLinkText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  activationMeta: { flex: 1, color: colors.dim, fontSize: 9, textAlign: 'right' },
  routineActions: { gap: 4 },
  routineActivation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  routineActivationText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  blockHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  blockIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#24160e', alignItems: 'center', justifyContent: 'center' },
  freeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#24160e', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 23, fontWeight: '900', fontFamily: condensed },
  dim: { color: colors.dim, fontSize: 12, lineHeight: 17 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  blockWeekSection: { gap: 10, marginTop: 8 },
  currentWeekHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  currentWeekTitle: { color: colors.text, fontSize: 21, fontWeight: '900', fontFamily: condensed, marginTop: 3 },
  currentPill: { borderWidth: 1, borderColor: '#5a2e15', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#21130d' },
  currentPillText: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  waitingCard: { alignItems: 'center', paddingVertical: 24 },
  weekFolder: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 13, overflow: 'hidden' },
  weekFolderHeader: { minHeight: 64, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekFolderBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 10, gap: 8 },
  exploreDay: { backgroundColor: colors.background, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  dayBoxSmall: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.subtle, fontSize: 10 },
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', gap: 3 },
  day: { color: colors.orange, fontSize: 10, fontWeight: '800' },
  grow: { flex: 1 },
  routineName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  historyButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  historyIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  welcomeContent: { padding: 24, paddingTop: 40, gap: 14, paddingBottom: 40 },
  welcomeTitle: { color: colors.text, fontSize: 26, fontWeight: '900', fontFamily: condensed, marginTop: 8 },
  welcomeSubtitle: { color: colors.dim, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  strong: { color: colors.text, fontWeight: '700', fontSize: 15 },
  success: { color: colors.success, fontSize: 13, fontWeight: '700' },
  code: { color: colors.text, fontSize: 26, fontWeight: '900', fontFamily: condensed, letterSpacing: 3, textAlign: 'center' },
  copyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.elevated, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  copyButtonText: { color: colors.text, fontWeight: '700', fontSize: 12 },
});
