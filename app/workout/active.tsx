import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { findExercise } from '@/data/exercises';
import { useAppStore } from '@/store/AppStore';
import { colors, radius, spacing } from '@/theme/colors';
import { formatDuration } from '@/utils/time';

export default function ActiveWorkoutScreen() {
  const { activeSession, toggleWorkoutSet, finishWorkout, cancelWorkout } = useAppStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
      setRestSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const completedSets = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.exercises.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
      0,
    );
  }, [activeSession]);

  if (!activeSession) {
    return (
      <AppScreen>
        <Text style={styles.title}>No hay sesión activa</Text>
        <Text style={styles.subtitle}>Inicia una rutina desde la pestaña Entrenar.</Text>
        <AppButton title="Volver a entrenar" onPress={() => router.replace('/(tabs)/training')} />
      </AppScreen>
    );
  }

  function handleToggleSet(exerciseId: string, setId: string, rest: number) {
    toggleWorkoutSet(exerciseId, setId);
    setRestSeconds(rest || 180);
  }

  function handleFinish() {
    Alert.alert('Finalizar entrenamiento', '¿Guardar esta sesión en el historial?', [
      { text: 'Seguir entrenando', style: 'cancel' },
      {
        text: 'Finalizar',
        style: 'default',
        onPress: () => {
          finishWorkout(elapsedSeconds);
          router.replace('/workout/summary');
        },
      },
    ]);
  }

  function handleCancel() {
    Alert.alert('Cancelar sesión', 'Esta sesión activa no se guardará.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar sesión',
        style: 'destructive',
        onPress: () => {
          cancelWorkout();
          router.replace('/(tabs)/training');
        },
      },
    ]);
  }

  return (
    <AppScreen scroll={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Sesión activa</Text>
          <Text style={styles.title}>{activeSession.name}</Text>
        </View>
        <Text style={styles.timer}>{formatDuration(elapsedSeconds)}</Text>
      </View>

      {restSeconds > 0 ? (
        <View style={styles.restBar}>
          <Text style={styles.restText}>Descanso</Text>
          <Text style={styles.restTimer}>{formatDuration(restSeconds)}</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        {activeSession.exercises.length === 0 ? (
          <Card style={styles.cardGap}>
            <Text style={styles.cardTitle}>Entrenamiento libre</Text>
            <Text style={styles.cardText}>En esta primera iteración, el entrenamiento libre abre la sesión. En la siguiente agregamos “añadir ejercicio en vivo”.</Text>
          </Card>
        ) : (
          activeSession.exercises.map((workoutExercise) => {
            const exercise = findExercise(workoutExercise.exerciseId);
            return (
              <Card key={workoutExercise.id} style={styles.cardGap}>
                <Text style={styles.exerciseName}>{exercise?.name ?? 'Ejercicio'}</Text>
                <Text style={styles.exerciseMeta}>Última vez: placeholder histórico · {exercise?.primaryMuscle}</Text>

                <View style={styles.tableHeader}>
                  <Text style={styles.colSmall}>#</Text>
                  <Text style={styles.col}>Kg</Text>
                  <Text style={styles.col}>Reps</Text>
                  <Text style={styles.col}>RPE</Text>
                  <Text style={styles.colSmall}>✓</Text>
                </View>

                {workoutExercise.sets.map((set, index) => (
                  <Pressable
                    key={set.id}
                    onPress={() => handleToggleSet(workoutExercise.id, set.id, set.restSeconds)}
                    style={[styles.setRow, set.completed && styles.setRowCompleted]}
                  >
                    <Text style={styles.colSmall}>{index + 1}</Text>
                    <Text style={styles.col}>{set.actualWeightKg ?? '-'}</Text>
                    <Text style={styles.col}>{set.actualReps ?? '-'}</Text>
                    <Text style={styles.col}>{set.actualRpe ?? '-'}</Text>
                    <Text style={[styles.colSmall, set.completed && styles.completedCheck]}>{set.completed ? '✓' : '○'}</Text>
                  </Pressable>
                ))}
              </Card>
            );
          })
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{completedSets} series completadas · {activeSession.totalVolumeKg} kg volumen</Text>
        <View style={styles.footerButtons}>
          <AppButton title="Cancelar" onPress={handleCancel} variant="secondary" style={styles.footerButton} />
          <AppButton title="Finalizar" onPress={handleFinish} style={styles.footerButton} />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  timer: {
    color: colors.text,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  restBar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  restText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  restTimer: {
    color: colors.text,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  body: {
    flex: 1,
    gap: spacing.md,
  },
  cardGap: {
    gap: spacing.sm,
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
  exerciseName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  exerciseMeta: {
    color: colors.subtle,
    fontSize: 13,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
  },
  setRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  setRowCompleted: {
    borderColor: colors.success,
  },
  col: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    textAlign: 'center',
  },
  colSmall: {
    color: colors.muted,
    flex: 0.55,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  completedCheck: {
    color: colors.success,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footerText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
});
