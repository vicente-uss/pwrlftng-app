import { useLocalSearchParams, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { findExercise } from '@/data/exercises';
import { useAppStore } from '@/store/AppStore';
import { colors, spacing } from '@/theme/colors';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, duplicateRoutine, startWorkout } = useAppStore();
  const routine = routines.find((item) => item.id === id);

  if (!routine) {
    return (
      <AppScreen>
        <SectionHeader title="Rutina no encontrada" subtitle="Vuelve a la lista y selecciona otra rutina." />
        <AppButton title="Volver" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  function start() {
    startWorkout(routine.id);
    router.push('/workout/active');
  }

  return (
    <AppScreen>
      <SectionHeader
        eyebrow={`Día ${routine.dayIndex}`}
        title={routine.name}
        subtitle="Detalle de rutina. En la próxima iteración agregaremos edición avanzada de cada serie."
      />

      <View style={styles.actions}>
        <AppButton title="Iniciar entrenamiento" onPress={start} style={styles.actionButton} />
        <AppButton title="Duplicar" onPress={() => duplicateRoutine(routine.id)} variant="secondary" style={styles.actionButton} />
      </View>

      {routine.exercises.map((routineExercise) => {
        const exercise = findExercise(routineExercise.exerciseId);
        return (
          <Card key={routineExercise.id} style={styles.cardGap}>
            <Text style={styles.exerciseName}>{exercise?.name ?? 'Ejercicio'}</Text>
            <Text style={styles.exerciseMeta}>{exercise?.primaryMuscle ?? 'Sin músculo'} · {routineExercise.sets.length} series</Text>

            <View style={styles.tableHeader}>
              <Text style={styles.tableCell}>Tipo</Text>
              <Text style={styles.tableCell}>Kg</Text>
              <Text style={styles.tableCell}>Reps</Text>
              <Text style={styles.tableCell}>RPE</Text>
            </View>

            {routineExercise.sets.map((set) => (
              <View key={set.id} style={styles.tableRow}>
                <Text style={styles.tableCell}>{set.type === 'warmup' ? 'Warm' : 'Eff'}</Text>
                <Text style={styles.tableCell}>{set.targetWeightKg ?? '-'}</Text>
                <Text style={styles.tableCell}>{set.targetReps ?? '-'}</Text>
                <Text style={styles.tableCell}>{set.targetRpe ?? '-'}</Text>
              </View>
            ))}
          </Card>
        );
      })}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  cardGap: {
    gap: spacing.sm,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  exerciseMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  tableHeader: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  tableCell: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
