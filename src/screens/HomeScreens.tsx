import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, Card, PrimaryButton } from '@/src/components/ui';
import { Routine } from '@/src/domain/types';
import { effortModeLabel } from '@/src/domain/training';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { signInWithEmail, signUpWithEmail } from '@/src/services/authService';
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

export function TrainingScreen({ onCreate, onRoutine, onHistory, onStart }: { onCreate(): void; onRoutine(routine: Routine): void; onHistory(): void; onStart(routineId?: string): void }) {
  const { routines, history } = useAppStore();
  return <View style={styles.fill}>
    <View style={styles.header}><Brand compact /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.freeCard}>
        <View style={styles.freeIcon}><Ionicons name="flash-outline" color={colors.orange} size={21} /></View>
        <Text style={styles.cardTitle}>Empezar entrenamiento libre</Text>
        <Text style={styles.dim}>Registra una sesión sin guardar una rutina nueva.</Text>
        <PrimaryButton title="Empezar entrenamiento libre" onPress={() => onStart()} />
      </Card>

      <PrimaryButton title="Nueva rutina" light onPress={onCreate} />

      <View style={styles.sectionHead}><Text style={styles.section}>MIS RUTINAS</Text><Text style={styles.count}>{routines.length}/7</Text></View>
      {routines.map(routine => <Card key={routine.id}>
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

      {routines.length === 0 ? <Card><Text style={styles.muted}>Aún no tienes rutinas.</Text><PrimaryButton title="Crear primera rutina" onPress={onCreate} /></Card> : null}

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
  freeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#24160e', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 23, fontWeight: '900', fontFamily: condensed },
  dim: { color: colors.dim, fontSize: 12, lineHeight: 17 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
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
