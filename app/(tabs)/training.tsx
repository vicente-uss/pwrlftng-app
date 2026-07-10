import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppStore } from '@/store/AppStore';
import { colors, spacing } from '@/theme/colors';
import { findExercise } from '@/data/exercises';

export default function TrainingScreen() {
  const { routines, startWorkout } = useAppStore();

  function startFreeWorkout() {
    startWorkout();
    router.push('/workout/active');
  }

  function startRoutineWorkout(routineId: string) {
    startWorkout(routineId);
    router.push('/workout/active');
  }

  return (
    <AppScreen>
      <SectionHeader
        eyebrow="Entrenar"
        title="Tracking"
        subtitle="Inicia una sesión libre o ejecuta una rutina guardada."
      />

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Entrenamiento libre</Text>
        <Text style={styles.cardText}>Úsalo cuando quieras registrar algo sin rutina base.</Text>
        <AppButton title="Iniciar libre" onPress={startFreeWorkout} />
      </Card>

      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>Rutinas guardadas</Text>
        <Link href="/routines" style={styles.link}>Gestionar</Link>
      </View>

      {routines.map((routine) => (
        <Card key={routine.id} style={styles.cardGap}>
          <Text style={styles.cardTitle}>{routine.name}</Text>
          <Text style={styles.cardText}>Día {routine.dayIndex} · {routine.exercises.length} ejercicios</Text>
          <Text style={styles.muted} numberOfLines={1}>
            {routine.exercises.map((item) => findExercise(item.exerciseId)?.name).filter(Boolean).join(' · ')}
          </Text>
          <AppButton title="Iniciar entrenamiento" onPress={() => startRoutineWorkout(routine.id)} />
        </Card>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardGap: {
    gap: spacing.md,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  link: {
    color: colors.text,
    fontWeight: '800',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.subtle,
    fontSize: 13,
  },
});
