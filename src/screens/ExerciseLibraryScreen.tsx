import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, TopBar, formatDate } from '@/src/components/ui';
import { bestByRepCount, bestEstimated1RM, bestSessionVolume, bestSet, heaviestWeight } from '@/src/domain/records';
import { Exercise } from '@/src/domain/types';
import { useAppStore } from '@/src/store/AppStore';
import { colors } from '@/src/theme';

export function ExerciseLibraryScreen({ onBack, onExercise }: { onBack(): void; onExercise(exercise: Exercise): void }) {
  const { exercises } = useAppStore();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? exercises.filter(exercise => exercise.name.toLowerCase().includes(term) || exercise.muscle.toLowerCase().includes(term))
      : exercises;
    const map = new Map<string, Exercise[]>();
    filtered.forEach(exercise => map.set(exercise.muscle, [...(map.get(exercise.muscle) ?? []), exercise]));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, query]);

  return <View style={styles.fill}>
    <TopBar title="Ejercicios" onBack={onBack} />
    <View style={styles.searchWrap}>
      <Ionicons name="search" color={colors.dim} size={16} />
      <TextInput
        accessibilityLabel="Buscar ejercicio"
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por nombre o músculo"
        placeholderTextColor={colors.subtle}
        style={styles.search}
      />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {groups.map(([muscle, list]) => <View key={muscle} style={styles.group}>
        <Text style={styles.section}>{muscle.toUpperCase()}</Text>
        {list.map(exercise => <Pressable accessibilityRole="button" accessibilityLabel={exercise.name} key={exercise.id} onPress={() => onExercise(exercise)} style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="barbell-outline" color={colors.orange} size={16} /></View>
          <Text style={styles.rowText}>{exercise.name}</Text>
          <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
        </Pressable>)}
      </View>)}
      {groups.length === 0 && <Card><Text style={styles.dim}>No encontramos ejercicios con ese nombre.</Text></Card>}
    </ScrollView>
  </View>;
}

export function ExerciseDetailScreen({ exercise, onBack }: { exercise: Exercise; onBack(): void }) {
  const { history } = useAppStore();
  const heaviest = useMemo(() => heaviestWeight(history, exercise.id), [history, exercise.id]);
  const single = useMemo(() => bestSet(history, exercise.id), [history, exercise.id]);
  const volume = useMemo(() => bestSessionVolume(history, exercise.id), [history, exercise.id]);
  const oneRm = useMemo(() => bestEstimated1RM(history, exercise.id), [history, exercise.id]);
  const repRecords = useMemo(() => bestByRepCount(history, exercise.id), [history, exercise.id]);
  const hasRecords = Boolean(heaviest || single || volume || oneRm || repRecords.length);

  return <View style={styles.fill}>
    <TopBar title={exercise.name} eyebrow={exercise.muscle.toUpperCase()} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.videoPlaceholder}>
        <Ionicons name="play-circle-outline" color={colors.dim} size={34} />
        <Text style={styles.videoText}>Video próximamente</Text>
      </View>

      <Text style={styles.section}>RÉCORDS</Text>
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>PESO MÁXIMO</Text>
          <Text style={styles.metricValue}>{heaviest ? `${heaviest.weight}kg` : '—'}</Text>
          {heaviest && <Text style={styles.metricSub}>{heaviest.reps} reps · {formatDate(heaviest.date)}</Text>}
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>MEJOR SERIE</Text>
          <Text style={styles.metricValue}>{single ? `${single.weight}kg × ${single.reps}` : '—'}</Text>
          {single && <Text style={styles.metricSub}>{formatDate(single.date)}</Text>}
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>MEJOR VOLUMEN · SESIÓN</Text>
          <Text style={styles.metricValue}>{volume ? `${volume.volume.toLocaleString('es-CL')}kg` : '—'}</Text>
          {volume && <Text style={styles.metricSub}>{formatDate(volume.date)}</Text>}
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>E1RM ESTIMADO</Text>
          <Text style={styles.metricValue}>{oneRm ? `${Math.round(oneRm.estimated1RM)}kg` : '—'}</Text>
          {oneRm && <Text style={styles.metricSub}>{oneRm.weight}kg × {oneRm.reps} · {formatDate(oneRm.date)}</Text>}
        </Card>
      </View>

      <Text style={styles.section}>MEJOR MARCA POR REPETICIÓN</Text>
      {repRecords.length
        ? repRecords.map(record => <View key={record.reps} style={styles.repRow}>
          <Text style={styles.repCount}>{record.reps} {record.reps === 1 ? 'rep' : 'reps'}</Text>
          <Text style={styles.repWeight}>{record.weight}kg</Text>
          <Text style={styles.repDate}>{formatDate(record.date)}</Text>
        </View>)
        : <Text style={styles.dim}>Sin marcas registradas todavía.</Text>}

      {!hasRecords && <Card><Text style={styles.dim}>Completa series de trabajo con este ejercicio para ver tus récords.</Text></Card>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  dim: { color: colors.dim, fontSize: 12 },
  section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12 },
  search: { flex: 1, color: colors.text, paddingVertical: 11, fontSize: 14 },
  group: { gap: 8 },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, color: colors.text, fontWeight: '700' },
  videoPlaceholder: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 34, alignItems: 'center', justifyContent: 'center', gap: 8 },
  videoText: { color: colors.dim, fontSize: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', gap: 4 },
  metricLabel: { color: colors.dim, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '800', fontFamily: 'monospace' },
  metricSub: { color: colors.subtle, fontSize: 10 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 },
  repCount: { width: 56, color: colors.muted, fontSize: 11, fontWeight: '700' },
  repWeight: { flex: 1, color: colors.text, fontFamily: 'monospace', fontWeight: '700' },
  repDate: { color: colors.subtle, fontSize: 10 },
});
