import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercise, MovementFamily } from '@/src/domain/types';
import {
  createCoachExerciseVariant,
  getExerciseLibrary,
} from '@/src/services/exerciseLibraryService';
import { colors } from '@/src/theme';

type Folder = { id: string; name: string; exercises: Exercise[] };
type Filter = 'all' | 'sbd' | 'custom';

const FAMILY_LABELS: Record<Exclude<MovementFamily, 'other'>, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

function exerciseFolders(exercises: Exercise[], filter: Filter): Folder[] {
  const visible = filter === 'custom'
    ? exercises.filter(exercise => !exercise.isSystem)
    : exercises;
  const sbdFolders = (Object.entries(FAMILY_LABELS) as [Exclude<MovementFamily, 'other'>, string][])
    .map(([family, label]) => ({
      id: `sbd-${family}`,
      name: `SBD / ${label}`,
      exercises: visible.filter(exercise => exercise.movementFamily === family),
    }))
    .filter(folder => folder.exercises.length > 0);
  if (filter === 'sbd') return sbdFolders;

  const otherMap = new Map<string, Exercise[]>();
  visible
    .filter(exercise => !['squat', 'bench', 'deadlift'].includes(exercise.movementFamily ?? ''))
    .forEach(exercise => {
      const category = exercise.category || exercise.muscle || 'Otros';
      const bucket = otherMap.get(category) ?? [];
      bucket.push(exercise);
      otherMap.set(category, bucket);
    });
  const otherFolders = [...otherMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'es-CL'))
    .map(([category, items]) => ({
      id: `category-${category}`,
      name: category,
      exercises: items.sort((left, right) => left.name.localeCompare(right.name, 'es-CL')),
    }));
  return [...sbdFolders, ...otherFolders];
}

export function ExercisePicker({
  selectedIds,
  onToggle,
  onCatalogLoaded,
  allowCustomVariants = false,
}: {
  selectedIds: string[];
  onToggle(exercise: Exercise): void;
  onCatalogLoaded?(exercises: Exercise[]): void;
  allowCustomVariants?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openFolderId, setOpenFolderId] = useState<string | null>('sbd-squat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customFamily, setCustomFamily] = useState<MovementFamily>('squat');
  const catalogCallback = useRef(onCatalogLoaded);
  catalogCallback.current = onCatalogLoaded;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pendingSet = useMemo(() => new Set(pendingIds), [pendingIds]);
  const folders = useMemo(() => exerciseFolders(catalog, filter), [catalog, filter]);

  useEffect(() => {
    if (!visible) return;
    setPendingIds(selectedIds);
    setLoading(true);
    setError('');
    getExerciseLibrary()
      .then(exercises => {
        setCatalog(exercises);
        catalogCallback.current?.(exercises);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'No pudimos cargar los ejercicios.'))
      .finally(() => setLoading(false));
  }, [selectedIds, visible]);

  const close = () => {
    setVisible(false);
    setCreating(false);
    setQuery('');
  };

  const togglePending = (exerciseId: string) => {
    setPendingIds(current => current.includes(exerciseId)
      ? current.filter(id => id !== exerciseId)
      : [...current, exerciseId]);
  };

  const confirm = () => {
    const allIds = new Set([...selectedIds, ...pendingIds]);
    allIds.forEach(id => {
      if (selectedSet.has(id) === pendingSet.has(id)) return;
      const exercise = catalog.find(item => item.id === id);
      if (exercise) onToggle(exercise);
    });
    close();
  };

  const createVariant = async () => {
    if (!customName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const parentExerciseId = customFamily === 'other' ? null : customFamily;
      const created = await createCoachExerciseVariant({
        name: customName,
        muscle: customMuscle || FAMILY_LABELS[customFamily as Exclude<MovementFamily, 'other'>] || 'General',
        category: customFamily === 'other' ? customMuscle || 'Otros' : 'SBD',
        movementFamily: customFamily,
        parentExerciseId,
      });
      setCatalog(current => [...current, created]);
      catalogCallback.current?.([...catalog, created]);
      setPendingIds(current => [...current, created.id]);
      setCustomName('');
      setCustomMuscle('');
      setCreating(false);
      setFilter('custom');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos crear la variante.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedQuery = query.trim().toLocaleLowerCase('es-CL');
  const searchResults = normalizedQuery
    ? catalog.filter(exercise =>
      exercise.name.toLocaleLowerCase('es-CL').includes(normalizedQuery)
      || exercise.muscle.toLocaleLowerCase('es-CL').includes(normalizedQuery))
    : [];

  const exerciseRow = (exercise: Exercise) => {
    const checked = pendingSet.has(exercise.id);
    return <Pressable
      key={exercise.id}
      accessibilityRole="checkbox"
      accessibilityLabel={exercise.name}
      accessibilityState={{ checked }}
      onPress={() => togglePending(exercise.id)}
      style={[styles.exerciseRow, checked && styles.exerciseRowActive]}
    >
      <View style={styles.grow}>
        <View style={styles.nameRow}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {!exercise.isSystem ? <Text style={styles.customTag}>TU VARIANTE</Text> : null}
        </View>
        <Text style={styles.exerciseMeta}>{exercise.muscle}{exercise.parentExerciseId ? ' · Variante' : ''}</Text>
      </View>
      <View style={[styles.check, checked && styles.checkActive]}>
        {checked ? <Ionicons name="checkmark" color={colors.canvas} size={15} /> : null}
      </View>
    </Pressable>;
  };

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar ejercicio"
      onPress={() => setVisible(true)}
      style={styles.openButton}
    >
      <Ionicons name="add-circle-outline" color={colors.orange} size={20} />
      <Text style={styles.openButtonText}>Agregar ejercicio</Text>
      <Ionicons name="chevron-forward" color={colors.subtle} size={17} />
    </Pressable>

    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.page}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancelar selección" onPress={close} hitSlop={10}>
              <Text style={styles.cancel}>Cancelar</Text>
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Agregar ejercicio</Text>
              <Text style={styles.selectionCount}>{pendingIds.length} seleccionados</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Confirmar ejercicios" onPress={confirm} hitSlop={10}>
              <Text style={styles.done}>Listo</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" color={colors.dim} size={18} />
            <TextInput
              accessibilityLabel="Buscar ejercicios"
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre o músculo"
              placeholderTextColor={colors.subtle}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery('')}>
              <Ionicons name="close-circle" color={colors.dim} size={18} />
            </Pressable> : null}
          </View>

          <View style={styles.filterRow}>
            {([
              ['all', 'Todos'],
              ['sbd', 'SBD'],
              ['custom', 'Mis variantes'],
            ] as [Filter, string][]).map(([id, label]) => <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === id }}
              onPress={() => setFilter(id)}
              style={[styles.filter, filter === id && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === id && styles.filterTextActive]}>{label}</Text>
            </Pressable>)}
            {allowCustomVariants ? <Pressable accessibilityRole="button" accessibilityLabel="Crear variante personalizada" onPress={() => setCreating(value => !value)} style={styles.createButton}>
              <Ionicons name="add" color={colors.orange} size={16} />
              <Text style={styles.createButtonText}>Crear variante</Text>
            </Pressable> : null}
          </View>

          {allowCustomVariants && creating ? <View style={styles.creator}>
            <Text style={styles.sectionLabel}>NUEVA VARIANTE DEL COACH</Text>
            <TextInput value={customName} onChangeText={setCustomName} placeholder="Nombre de la variante" placeholderTextColor={colors.subtle} style={styles.input} />
            <TextInput value={customMuscle} onChangeText={setCustomMuscle} placeholder="Grupo muscular o categoría" placeholderTextColor={colors.subtle} style={styles.input} />
            <View style={styles.familyRow}>
              {(['squat', 'bench', 'deadlift', 'other'] as MovementFamily[]).map(family => <Pressable
                key={family}
                accessibilityRole="radio"
                accessibilityState={{ checked: customFamily === family }}
                onPress={() => setCustomFamily(family)}
                style={[styles.family, customFamily === family && styles.familyActive]}
              >
                <Text style={[styles.familyText, customFamily === family && styles.familyTextActive]}>{family === 'other' ? 'Otro' : FAMILY_LABELS[family]}</Text>
              </Pressable>)}
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading || !customName.trim() }} disabled={loading || !customName.trim()} onPress={createVariant} style={styles.saveVariant}>
              <Text style={styles.saveVariantText}>{loading ? 'Creando…' : 'Crear y seleccionar'}</Text>
            </Pressable>
          </View> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {loading && !catalog.length ? <Text style={styles.empty}>Cargando biblioteca…</Text> : null}
            {normalizedQuery
              ? (searchResults.length ? searchResults.map(exerciseRow) : <Text style={styles.empty}>No encontramos ejercicios con esa búsqueda.</Text>)
              : folders.map(folder => {
                const open = openFolderId === folder.id;
                const selectedCount = folder.exercises.filter(exercise => pendingSet.has(exercise.id)).length;
                return <View key={folder.id} style={styles.folder}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${open ? 'Cerrar' : 'Abrir'} ${folder.name}`}
                    onPress={() => setOpenFolderId(current => current === folder.id ? null : folder.id)}
                    style={styles.folderHead}
                  >
                    <Ionicons name={open ? 'folder-open-outline' : 'folder-outline'} color={colors.orange} size={19} />
                    <Text style={styles.folderName}>{folder.name}</Text>
                    <Text style={styles.folderCount}>{selectedCount ? `${selectedCount}/` : ''}{folder.exercises.length}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} color={colors.dim} size={15} />
                  </Pressable>
                  {open ? <View style={styles.folderBody}>{folder.exercises.map(exerciseRow)}</View> : null}
                </View>;
              })}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.background },
  openButton: { minHeight: 48, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.background },
  openButtonText: { flex: 1, color: colors.orange, fontSize: 13, fontWeight: '800' },
  topBar: { minHeight: 68, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  selectionCount: { color: colors.dim, fontSize: 9, marginTop: 2 },
  cancel: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  done: { color: colors.orange, fontWeight: '900', fontSize: 13 },
  searchRow: { marginHorizontal: 18, marginTop: 14, minHeight: 47, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  filterRow: { paddingHorizontal: 18, paddingVertical: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  filterText: { color: colors.dim, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: colors.text },
  createButton: { minHeight: 38, marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7 },
  createButtonText: { color: colors.orange, fontSize: 10, fontWeight: '800' },
  creator: { marginHorizontal: 18, padding: 13, gap: 9, borderWidth: 1, borderColor: '#4a2816', borderRadius: 13, backgroundColor: '#15100d' },
  sectionLabel: { color: colors.orange, fontSize: 9, letterSpacing: 1.2, fontWeight: '800' },
  input: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, fontSize: 13 },
  familyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  family: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 9 },
  familyActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  familyText: { color: colors.dim, fontSize: 10, fontWeight: '700' },
  familyTextActive: { color: colors.text },
  saveVariant: { minHeight: 44, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  saveVariantText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  error: { marginHorizontal: 18, color: colors.danger, fontSize: 11, lineHeight: 16 },
  content: { paddingHorizontal: 18, paddingBottom: 42, gap: 8 },
  folder: { borderWidth: 1, borderColor: colors.border, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.surface },
  folderHead: { minHeight: 56, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  folderName: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 13 },
  folderCount: { color: colors.dim, fontSize: 10, fontWeight: '700' },
  folderBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 8, gap: 6, backgroundColor: colors.background },
  exerciseRow: { minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exerciseRowActive: { borderColor: colors.orange, backgroundColor: '#15100d' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  exerciseName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  customTag: { color: colors.orange, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  exerciseMeta: { color: colors.dim, fontSize: 10, marginTop: 3 },
  check: { width: 24, height: 24, borderWidth: 1, borderColor: colors.border, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  empty: { padding: 22, color: colors.dim, textAlign: 'center', fontSize: 12 },
});
