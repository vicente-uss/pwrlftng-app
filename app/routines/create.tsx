import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppStore } from '@/store/AppStore';
import { colors, radius, spacing } from '@/theme/colors';
import { IntensityMode } from '@/types/training';

const INTENSITY_OPTIONS: IntensityMode[] = ['none', 'rpe', 'rir', 'both'];

export default function CreateRoutineScreen() {
  const { exercises, createRoutine } = useAppStore();
  const [name, setName] = useState('Día 2 · Banca técnica');
  const [dayIndex, setDayIndex] = useState(2);
  const [intensityMode, setIntensityMode] = useState<IntensityMode>('rpe');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>(['bench-press', 'barbell-row']);

  function toggleExercise(exerciseId: string) {
    setSelectedExerciseIds((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  }

  function saveRoutine() {
    const routine = createRoutine({
      name,
      dayIndex,
      intensityMode,
      exerciseIds: selectedExerciseIds,
    });

    router.replace(`/routines/${routine.id}`);
  }

  return (
    <AppScreen>
      <SectionHeader
        eyebrow="Constructor MVP"
        title="Crear rutina"
        subtitle="Primero validamos flujo. La edición avanzada de series irá en la siguiente iteración."
      />

      <Card style={styles.cardGap}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Ej: Día 1 · SBD"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={name}
        />

        <Text style={styles.label}>Día</Text>
        <View style={styles.chipsRow}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Pressable
              key={day}
              onPress={() => setDayIndex(day)}
              style={[styles.chip, dayIndex === day && styles.chipSelected]}
            >
              <Text style={[styles.chipText, dayIndex === day && styles.chipTextSelected]}>{day}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>RPE/RIR</Text>
        <View style={styles.chipsRow}>
          {INTENSITY_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setIntensityMode(option)}
              style={[styles.chip, intensityMode === option && styles.chipSelected]}
            >
              <Text style={[styles.chipText, intensityMode === option && styles.chipTextSelected]}>{option.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Seleccionar ejercicios</Text>
        <Text style={styles.cardText}>Base inicial precargada. El usuario no crea ejercicios personalizados en MVP.</Text>
        {exercises.map((exercise) => {
          const selected = selectedExerciseIds.includes(exercise.id);
          return (
            <Pressable
              key={exercise.id}
              onPress={() => toggleExercise(exercise.id)}
              style={[styles.exerciseRow, selected && styles.exerciseSelected]}
            >
              <View style={styles.exerciseTextGroup}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>{exercise.primaryMuscle}</Text>
              </View>
              <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : '+'}</Text>
            </Pressable>
          );
        })}
      </Card>

      <AppButton title="Guardar rutina" onPress={saveRoutine} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardGap: {
    gap: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: colors.text,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextSelected: {
    color: colors.background,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  exerciseSelected: {
    borderColor: colors.text,
  },
  exerciseTextGroup: {
    gap: 4,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: colors.subtle,
    fontSize: 13,
  },
  check: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: '900',
  },
  checkSelected: {
    color: colors.success,
  },
});
