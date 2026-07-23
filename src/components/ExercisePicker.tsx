import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EXERCISE_CATALOG } from '@/src/data/seed';
import { Exercise } from '@/src/domain/types';
import { colors } from '@/src/theme';

const SBD_EXERCISE_IDS = new Set(['squat', 'bench', 'deadlift']);

type Folder = { id: string; name: string; exercises: Exercise[] };

function buildFolders(): Folder[] {
  const sbd = EXERCISE_CATALOG.filter(exercise => SBD_EXERCISE_IDS.has(exercise.id));
  const byMuscle = new Map<string, Exercise[]>();
  EXERCISE_CATALOG.forEach(exercise => {
    if (SBD_EXERCISE_IDS.has(exercise.id)) return;
    const bucket = byMuscle.get(exercise.muscle) ?? [];
    bucket.push(exercise);
    byMuscle.set(exercise.muscle, bucket);
  });
  const others: Folder[] = [...byMuscle.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es-CL'))
    .map(([muscle, exercises]) => ({
      id: muscle,
      name: muscle,
      exercises: [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'es-CL')),
    }));
  return [{ id: 'sbd', name: 'SBD', exercises: sbd }, ...others];
}

export function ExercisePicker({ selectedIds, onToggle }: { selectedIds: string[]; onToggle(exercise: Exercise): void }) {
  const [query, setQuery] = useState('');
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const folders = useMemo(buildFolders, []);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const trimmed = query.trim();

  const renderRow = (exercise: Exercise) => {
    const selected = selectedSet.has(exercise.id);
    return <Pressable
      key={exercise.id}
      accessibilityRole="checkbox"
      accessibilityLabel={exercise.name}
      accessibilityState={{ checked: selected }}
      onPress={() => onToggle(exercise)}
      style={[styles.exerciseRow, selected && styles.exerciseRowActive]}
    >
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseMuscle}>{exercise.muscle}</Text>
      </View>
      <Ionicons name={selected ? 'checkmark' : 'add'} color={selected ? colors.orange : colors.dim} size={18} />
    </Pressable>;
  };

  return <View style={styles.container}>
    <View style={styles.searchRow}>
      <Ionicons name="search" color={colors.dim} size={16} />
      <TextInput
        accessibilityLabel="Buscar ejercicio"
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar ejercicio…"
        placeholderTextColor={colors.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.searchInput}
      />
      {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery('')} hitSlop={8}>
        <Ionicons name="close-circle" color={colors.dim} size={16} />
      </Pressable> : null}
    </View>

    {trimmed ? (() => {
      const normalized = trimmed.toLocaleLowerCase('es-CL');
      const filtered = EXERCISE_CATALOG.filter(exercise =>
        exercise.name.toLocaleLowerCase('es-CL').includes(normalized));
      return filtered.length === 0
        ? <Text style={styles.empty}>Ningún ejercicio coincide con “{trimmed}”.</Text>
        : <View style={styles.searchResults}>{filtered.map(renderRow)}</View>;
    })() : folders.map(folder => {
      const isOpen = openFolderId === folder.id;
      const selectedCount = folder.exercises.reduce((sum, exercise) => sum + (selectedSet.has(exercise.id) ? 1 : 0), 0);
      return <View key={folder.id} style={styles.folder}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Colapsar' : 'Expandir'} carpeta ${folder.name}`}
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setOpenFolderId(current => current === folder.id ? null : folder.id)}
          style={[styles.folderHead, isOpen && styles.folderHeadActive]}
        >
          <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} color={colors.dim} size={18} />
          <Text style={styles.folderName}>{folder.name.toUpperCase()}</Text>
          <Text style={styles.folderMeta}>{selectedCount > 0 ? `${selectedCount}/${folder.exercises.length}` : String(folder.exercises.length)}</Text>
        </Pressable>
        {isOpen ? <View style={styles.folderBody}>{folder.exercises.map(renderRow)}</View> : null}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },
  searchResults: { gap: 6 },
  folder: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  folderHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface },
  folderHeadActive: { borderBottomWidth: 1, borderBottomColor: colors.border },
  folderName: { flex: 1, color: colors.text, fontWeight: '800', letterSpacing: 1, fontSize: 12 },
  folderMeta: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
  folderBody: { padding: 8, gap: 6, backgroundColor: colors.background },
  exerciseRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseRowActive: { borderColor: colors.orange },
  exerciseInfo: { flex: 1, gap: 3 },
  exerciseName: { color: colors.text, fontWeight: '700' },
  exerciseMuscle: { color: colors.dim, fontSize: 11 },
  empty: { color: colors.dim, fontSize: 12, padding: 12, textAlign: 'center' },
});
