import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton, TopBar } from '@/src/components/ui';
import {
  ActivationItem,
  ActivationResource,
  emptyActivationResource,
  getActivationResource,
  newActivationItem,
  newActivationSection,
  saveActivationResource,
} from '@/src/services/activationService';
import { colors, condensed } from '@/src/theme';

type Target = { programId?: string; blockId?: string };

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function optionalPositive(value: string, allowZero = false) {
  if (!value.trim()) return null;
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed >= (allowZero ? 0 : 1) ? parsed : null;
}

export function ActivationEditorScreen({
  programId,
  blockId,
  onBack,
}: Target & { onBack(): void }) {
  const [resource, setResource] = useState<ActivationResource>(emptyActivationResource());
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    getActivationResource({ programId, blockId })
      .then(found => {
        if (active && found) setResource(found);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'No pudimos cargar la Activación.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [blockId, programId]);

  const setSection = (sectionId: string, update: (section: ActivationResource['sections'][number]) => ActivationResource['sections'][number]) => {
    setSaved(false);
    setResource(current => ({
      ...current,
      sections: current.sections.map(section => section.id === sectionId ? update(section) : section),
    }));
  };

  const addSection = () => {
    const section = newActivationSection(resource.sections.length);
    setResource(current => ({ ...current, sections: [...current.sections, section] }));
    setSaved(false);
  };

  const addItem = (sectionId: string) => {
    const item = newActivationItem();
    setSection(sectionId, section => ({ ...section, items: [...section.items, item] }));
    setExpandedItemId(item.id);
  };

  const updateItem = (sectionId: string, itemId: string, patch: Partial<ActivationItem>) => {
    setSection(sectionId, section => ({
      ...section,
      items: section.items.map(item => item.id === itemId ? { ...item, ...patch } : item),
    }));
  };

  const valid = resource.title.trim().length > 0
    && resource.sections.every(section =>
      section.name.trim().length > 0
      && section.items.every(item => item.movementName.trim().length > 0));

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveActivationResource({ programId, blockId }, resource);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar la Activación.');
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.fill}>
    <TopBar title="Editar Activación" eyebrow="RECURSO DEL MESOCICLO" onBack={onBack} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editorContent}>
        <View style={styles.infoNotice}>
          <Ionicons name="information-circle-outline" color={colors.orange} size={20} />
          <Text style={styles.noticeText}>Es una guía permanente de lectura. No crea sesiones, checklist, volumen, récords ni progreso semanal.</Text>
        </View>
        {loading ? <Text style={styles.dim}>Cargando Activación…</Text> : null}
        <Field label="TÍTULO" value={resource.title} onChange={title => { setSaved(false); setResource(current => ({ ...current, title })); }} placeholder="Activación" />
        <Field label="INTRODUCCIÓN (OPCIONAL)" value={resource.introduction} onChange={introduction => { setSaved(false); setResource(current => ({ ...current, introduction })); }} placeholder="Cómo y cuándo usar esta guía" multiline />

        <View style={styles.sectionHeading}>
          <View style={styles.grow}>
            <Text style={styles.sectionLabel}>FASES ORDENADAS</Text>
            <Text style={styles.dim}>Agrupa movimientos por momento o propósito.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Agregar fase" onPress={addSection} style={styles.addCompact}>
            <Ionicons name="add" color={colors.orange} size={17} />
            <Text style={styles.addCompactText}>Fase</Text>
          </Pressable>
        </View>

        {resource.sections.map((section, sectionIndex) => <View key={section.id} style={styles.sectionCard}>
          <View style={styles.sectionTop}>
            <TextInput
              accessibilityLabel={`Nombre de la fase ${sectionIndex + 1}`}
              value={section.name}
              onChangeText={name => setSection(section.id, current => ({ ...current, name }))}
              placeholder="Nombre de la fase"
              placeholderTextColor={colors.subtle}
              style={styles.sectionName}
            />
            <MoveButtons
              label={section.name}
              canUp={sectionIndex > 0}
              canDown={sectionIndex < resource.sections.length - 1}
              onUp={() => setResource(current => ({ ...current, sections: move(current.sections, sectionIndex, -1) }))}
              onDown={() => setResource(current => ({ ...current, sections: move(current.sections, sectionIndex, 1) }))}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar fase ${section.name}`}
              onPress={() => setResource(current => ({ ...current, sections: current.sections.filter(item => item.id !== section.id) }))}
              style={styles.iconButton}
            >
              <Ionicons name="trash-outline" color={colors.danger} size={17} />
            </Pressable>
          </View>

          <View style={styles.itemList}>
            {section.items.map((item, itemIndex) => {
              const open = expandedItemId === item.id;
              return <View key={item.id} style={styles.itemCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${open ? 'Cerrar' : 'Editar'} ${item.movementName || `movimiento ${itemIndex + 1}`}`}
                  onPress={() => setExpandedItemId(current => current === item.id ? null : item.id)}
                  style={styles.itemHead}
                >
                  <View style={styles.itemNumber}><Text style={styles.itemNumberText}>{itemIndex + 1}</Text></View>
                  <View style={styles.grow}>
                    <Text style={styles.itemTitle}>{item.movementName || 'Movimiento sin nombre'}</Text>
                    <Text style={styles.itemMeta}>{[
                      item.rounds ? `${item.rounds} rondas` : '',
                      item.repetitions,
                      item.durationSeconds ? `${item.durationSeconds}s` : '',
                    ].filter(Boolean).join(' · ') || 'Toca para completar los detalles'}</Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'create-outline'} color={colors.muted} size={17} />
                </Pressable>
                {open ? <View style={styles.itemBody}>
                  <Field label="MOVIMIENTO *" value={item.movementName} onChange={movementName => updateItem(section.id, item.id, { movementName })} placeholder="Ej. 90/90 Hip lift" />
                  <View style={styles.twoColumns}>
                    <Field label="REPETICIONES" value={item.repetitions} onChange={repetitions => updateItem(section.id, item.id, { repetitions })} placeholder="Ej. 5 por lado" />
                    <NumberField label="DURACIÓN (SEG)" value={item.durationSeconds} onChange={durationSeconds => updateItem(section.id, item.id, { durationSeconds })} />
                  </View>
                  <View style={styles.twoColumns}>
                    <NumberField label="RONDAS" value={item.rounds} onChange={rounds => updateItem(section.id, item.id, { rounds })} />
                    <NumberField label="DESCANSO (SEG)" value={item.restSeconds} onChange={restSeconds => updateItem(section.id, item.id, { restSeconds })} allowZero />
                  </View>
                  <View style={styles.twoColumns}>
                    <Field label="CARGA" value={item.loadText} onChange={loadText => updateItem(section.id, item.id, { loadText })} placeholder="Ej. 5 kg / banda ligera" />
                    <Field label="EQUIPAMIENTO" value={item.equipment} onChange={equipment => updateItem(section.id, item.id, { equipment })} placeholder="Foam roller" />
                  </View>
                  <Field label="INSTRUCCIONES" value={item.instructions} onChange={instructions => updateItem(section.id, item.id, { instructions })} placeholder="Ejecución y puntos técnicos" multiline />
                  <Field label="NOTAS" value={item.notes} onChange={notes => updateItem(section.id, item.id, { notes })} placeholder="Observaciones opcionales" multiline />
                  <Field label="VIDEO O ENLACE" value={item.videoUrl} onChange={videoUrl => updateItem(section.id, item.id, { videoUrl })} placeholder="https://…" autoCapitalize="none" />
                  <View style={styles.itemActions}>
                    <MoveButtons
                      label={item.movementName}
                      canUp={itemIndex > 0}
                      canDown={itemIndex < section.items.length - 1}
                      onUp={() => setSection(section.id, current => ({ ...current, items: move(current.items, itemIndex, -1) }))}
                      onDown={() => setSection(section.id, current => ({ ...current, items: move(current.items, itemIndex, 1) }))}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${item.movementName}`} onPress={() => setSection(section.id, current => ({ ...current, items: current.items.filter(currentItem => currentItem.id !== item.id) }))} style={styles.deleteItem}>
                      <Ionicons name="trash-outline" color={colors.danger} size={16} />
                      <Text style={styles.deleteText}>Eliminar movimiento</Text>
                    </Pressable>
                  </View>
                </View> : null}
              </View>;
            })}
            {!section.items.length ? <Text style={styles.empty}>Esta fase todavía no tiene movimientos.</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Agregar movimiento a ${section.name}`} onPress={() => addItem(section.id)} style={styles.addMovement}>
            <Ionicons name="add-circle-outline" color={colors.orange} size={18} />
            <Text style={styles.addMovementText}>Agregar movimiento</Text>
          </Pressable>
        </View>)}
        {!resource.sections.length ? <View style={styles.emptyState}><Ionicons name="book-outline" color={colors.dim} size={28} /><Text style={styles.emptyTitle}>Crea la primera fase</Text><Text style={styles.dim}>Por ejemplo: Activación general, Pre squat, Pre bench y Pre deadlift.</Text></View> : null}
        {!valid && resource.sections.length ? <Text style={styles.warning}>Todas las fases y movimientos necesitan un nombre.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.success}>Activación guardada. Las copias ya asignadas no se modificaron silenciosamente.</Text> : null}
        <PrimaryButton title={saving ? 'Guardando…' : 'Guardar Activación'} onPress={save} disabled={saving || !valid} />
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

export function ActivationViewerScreen({
  blockId,
  onBack,
}: {
  blockId: string;
  onBack(): void;
}) {
  const [resource, setResource] = useState<ActivationResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getActivationResource({ blockId })
      .then(found => {
        if (active) setResource(found);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'No pudimos cargar la Activación.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [blockId]);

  return <View style={styles.fill}>
    <TopBar title={resource?.title ?? 'Activación'} eyebrow="GUÍA DE LECTURA" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.viewerContent}>
      <View style={styles.readerNotice}>
        <Ionicons name="book-outline" color={colors.orange} size={22} />
        <View style={styles.grow}><Text style={styles.readerTitle}>Úsala cuando la necesites</Text><Text style={styles.noticeText}>No necesitas marcarla ni completarla para avanzar.</Text></View>
      </View>
      {resource?.introduction ? <Text style={styles.introduction}>{resource.introduction}</Text> : null}
      {loading ? <Text style={styles.dim}>Cargando guía…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {resource?.sections.map((section, sectionIndex) => <View key={section.id} style={styles.readerSection}>
        <View style={styles.readerSectionHead}><Text style={styles.readerSectionNumber}>{String(sectionIndex + 1).padStart(2, '0')}</Text><Text style={styles.readerSectionTitle}>{section.name}</Text></View>
        {section.items.map(item => <View key={item.id} style={styles.readerItem}>
          <Text style={styles.readerItemTitle}>{item.movementName}</Text>
          <View style={styles.detailChips}>
            {item.rounds ? <DetailChip label={`${item.rounds} rondas`} /> : null}
            {item.repetitions ? <DetailChip label={item.repetitions} /> : null}
            {item.durationSeconds ? <DetailChip label={`${item.durationSeconds} seg`} /> : null}
            {item.restSeconds != null ? <DetailChip label={`Descanso ${item.restSeconds} seg`} /> : null}
            {item.loadText ? <DetailChip label={item.loadText} /> : null}
            {item.equipment ? <DetailChip label={item.equipment} /> : null}
          </View>
          {item.instructions ? <Text style={styles.readerCopy}>{item.instructions}</Text> : null}
          {item.notes ? <Text style={styles.readerNote}>{item.notes}</Text> : null}
          {item.videoUrl ? <Pressable accessibilityRole="link" accessibilityLabel={`Abrir video de ${item.movementName}`} onPress={() => Linking.openURL(item.videoUrl)} style={styles.videoButton}><Ionicons name="play-circle-outline" color={colors.orange} size={18} /><Text style={styles.videoText}>Ver demostración</Text></Pressable> : null}
        </View>)}
      </View>)}
      {!loading && !error && (!resource || !resource.sections.length) ? <View style={styles.emptyState}><Ionicons name="book-outline" color={colors.dim} size={30} /><Text style={styles.emptyTitle}>Sin guía de Activación</Text><Text style={styles.dim}>Tu coach todavía no ha publicado este recurso.</Text></View> : null}
    </ScrollView>
  </View>;
}

function DetailChip({ label }: { label: string }) {
  return <View style={styles.detailChip}><Text style={styles.detailChipText}>{label}</Text></View>;
}

function MoveButtons({
  label,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp(): void;
  onDown(): void;
}) {
  return <View style={styles.moveButtons}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Subir ${label}`} accessibilityState={{ disabled: !canUp }} disabled={!canUp} onPress={onUp} style={[styles.iconButton, !canUp && styles.disabled]}>
      <Ionicons name="arrow-up" color={colors.muted} size={15} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Bajar ${label}`} accessibilityState={{ disabled: !canDown }} disabled={!canDown} onPress={onDown} style={[styles.iconButton, !canDown && styles.disabled]}>
      <Ionicons name="arrow-down" color={colors.muted} size={15} />
    </Pressable>
  </View>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.subtle}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      style={[styles.input, multiline && styles.multiline]}
    />
  </View>;
}

function NumberField({
  label,
  value,
  onChange,
  allowZero,
}: {
  label: string;
  value: number | null;
  onChange(value: number | null): void;
  allowZero?: boolean;
}) {
  return <Field
    label={label}
    value={value == null ? '' : String(value)}
    onChange={text => onChange(optionalPositive(text, allowZero))}
    placeholder="Opcional"
  />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  editorContent: { padding: 20, gap: 14, paddingBottom: 44 },
  viewerContent: { padding: 20, gap: 16, paddingBottom: 44 },
  infoNotice: { borderWidth: 1, borderColor: '#4a2816', borderRadius: 13, backgroundColor: '#15100d', padding: 13, flexDirection: 'row', gap: 10 },
  noticeText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.surface, color: colors.text, fontSize: 13 },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  sectionLabel: { color: colors.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  dim: { color: colors.dim, fontSize: 11, lineHeight: 16 },
  addCompact: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addCompactText: { color: colors.orange, fontSize: 11, fontWeight: '800' },
  sectionCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.surface },
  sectionTop: { minHeight: 62, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900', borderBottomWidth: 1, borderBottomColor: colors.orange, paddingVertical: 7 },
  moveButtons: { flexDirection: 'row', gap: 4 },
  iconButton: { width: 38, height: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  itemList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 9, gap: 8, backgroundColor: colors.background },
  itemCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  itemHead: { minHeight: 60, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemNumber: { width: 31, height: 31, borderRadius: 8, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  itemNumberText: { color: colors.orange, fontSize: 11, fontWeight: '900' },
  itemTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  itemMeta: { color: colors.dim, fontSize: 9, marginTop: 4 },
  itemBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 12, gap: 11, backgroundColor: '#0c0c0c' },
  twoColumns: { flexDirection: 'row', gap: 9 },
  itemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deleteItem: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  addMovement: { minHeight: 49, margin: 9, marginTop: 0, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  addMovementText: { color: colors.orange, fontSize: 11, fontWeight: '800' },
  empty: { padding: 12, color: colors.dim, fontSize: 11, textAlign: 'center' },
  emptyState: { borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 24, alignItems: 'center', gap: 8, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', fontFamily: condensed },
  warning: { color: colors.warning, fontSize: 11, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 17 },
  success: { color: colors.success, fontSize: 11, lineHeight: 17 },
  readerNotice: { borderWidth: 1, borderColor: '#4a2816', backgroundColor: '#15100d', borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  readerTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
  introduction: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  readerSection: { gap: 9 },
  readerSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  readerSectionNumber: { color: colors.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  readerSectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', fontFamily: condensed },
  readerItem: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface, gap: 9 },
  readerItemTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  detailChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: colors.elevated },
  detailChipText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  readerCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  readerNote: { color: colors.dim, fontSize: 11, lineHeight: 17, fontStyle: 'italic' },
  videoButton: { alignSelf: 'flex-start', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  videoText: { color: colors.orange, fontSize: 11, fontWeight: '800' },
});
