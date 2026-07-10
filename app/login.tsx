import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { colors, radius, spacing } from '@/theme/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('demo@pwrlftng.app');
  const [password, setPassword] = useState('demo123');

  function enterDemo() {
    router.replace('/(tabs)/home');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <AppScreen>
        <View style={styles.hero}>
          <Text style={styles.logo}>PWRLFTNG</Text>
          <Text style={styles.tagline}>Tracking rápido, minimalista y hecho para powerlifting.</Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Login demo</Text>
          <Text style={styles.helper}>Por ahora cualquier credencial entra. Luego conectamos Supabase Auth.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="tu@email.com"
            placeholderTextColor={colors.subtle}
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <AppButton title="Entrar" onPress={enterDemo} />
          <AppButton title="Entrar como atleta demo" onPress={enterDemo} variant="secondary" />
        </Card>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.xl,
  },
  logo: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  tagline: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  formCard: {
    gap: spacing.md,
  },
  formTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: spacing.md,
  },
});
