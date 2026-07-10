import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { findExercise } from '@/data/exercises';
import { useAppStore } from '@/store/AppStore';
import { colors, spacing } from '@/theme/colors';

export default function RoutinesScreen() {
  const { routines } = useAppStore();

  return (
    <AppScreen>
      <SectionHeader
        eyebrow="Máximo 7 días"
        title="Rutinas"
        subtitle="Cada rutina representa una sesión individual."
      />

      <Link href="/routines/create" asChild>
        <AppButton title="Crear nueva rutina" />
      </Link>

      {routines.map((routine) => (
        <Link key={routine.id} href={`/routines/${routine.id}`} asChild>
          <Pressable>
            <Card style={styles.cardGap}>
              <View style={styles.rowHeader}>
                <Text style={styles.cardTitle}>{routine.name}</Text>
                <Text style={styles.dayBadge}>Día {routine.dayIndex}</Text>
              </View>
              <Text style={styles.cardText}>{routine.exercises.length} ejercicios · Intensidad: {routine.intensityMode.toUpperCase()}</Text>
              <Text style={styles.muted} numberOfLines={2}>
                {routine.exercises.map((item) => findExercise(item.exerciseId)?.name).filter(Boolean).join(' · ')}
              </Text>
            </Card>
          </Pressable>
        </Link>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardGap: {
    gap: spacing.sm,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
  },
  muted: {
    color: colors.subtle,
    fontSize: 13,
    lineHeight: 18,
  },
  dayBadge: {
    color: colors.background,
    backgroundColor: colors.text,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
