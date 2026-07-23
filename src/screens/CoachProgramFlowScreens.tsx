import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, TopBar } from '@/src/components/ui';
import { BlockDraftInfo, BlockDraftWeek, CoachAthlete, getMyAthletes } from '@/src/services/coachService';
import { ActivationResource } from '@/src/services/activationService';
import { CoachWorkbookImport, parseCoachWorkbook } from '@/src/services/coachExcelImport';
import {
  CoachAssignmentPreview,
  CoachLibraryProgram,
  CoachMacrocycle,
  assignCoachProgram,
  getCoachAssignmentPreview,
  getCoachLibraryProgramDraft,
  getCoachLibraryPrograms,
  getCoachMacrocycles,
  saveCoachMacrocycle,
  updateCoachProgramAssignments,
} from '@/src/services/coachProgramService';
import { colors, condensed } from '@/src/theme';

export function CoachExcelImportScreen({ onBack, onUseDraft }: {
  onBack(): void;
  onUseDraft(draft: { info: BlockDraftInfo; weeks: BlockDraftWeek[]; activation: ActivationResource | null }): void;
}) {
  const [result, setResult] = useState<CoachWorkbookImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const select = async () => {
    setBusy(true);
    setError('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const buffer = await new File(asset.uri).arrayBuffer();
      const parsed = parseCoachWorkbook(buffer, asset.name);
      setFileName(asset.name);
      setResult(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer el Excel.');
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.fill}>
    <TopBar title="Importar Excel" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons name="document-text-outline" color={colors.orange} size={24} />
        <Text style={styles.heroTitle}>Una hoja por semana efectiva</Text>
        <Text style={styles.copy}>Las hojas de Activación se importan como una guía independiente; nunca se convierten en semana, rutina o checklist. Antes de guardar podrás revisar el mesociclo.</Text>
      </View>
      <PrimaryButton title={busy ? 'Leyendo archivo…' : result ? 'Elegir otro Excel' : 'Elegir archivo Excel'} onPress={select} disabled={busy} />
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {result ? <>
        <Text style={styles.section}>VISTA PREVIA</Text>
        <Card>
          <Text style={styles.title}>{result.info.name}</Text>
          <Text style={styles.dim}>{fileName}</Text>
          <View style={styles.metrics}>
            <Metric value={result.weeks.length} label="SEMANAS" />
            <Metric value={result.weeks.reduce((sum, week) => sum + week.days.length, 0)} label="DÍAS" />
            <Metric value={result.importedExerciseCount} label="EJERCICIOS" />
          </View>
        </Card>
        {result.activationSheetNames.length ? <View style={styles.notice}>
          <Ionicons name="checkmark-circle-outline" color={colors.success} size={19} />
          <Text style={styles.noticeText}>{result.activation ? `${result.activation.sections.length} fases de Activación importadas` : 'Hoja de Activación detectada'} desde {result.activationSheetNames.join(', ')}. Quedó fuera de las semanas efectivas.</Text>
        </View> : null}
        {result.skippedExercises.length ? <View style={styles.warningCard}>
          <Ionicons name="alert-circle-outline" color={colors.warning} size={19} />
          <View style={styles.grow}><Text style={styles.strong}>Revisión necesaria</Text><Text style={styles.warningText}>{result.skippedExercises.length} ejercicios no existen aún en el catálogo y se omitieron. Podrás agregarlos o reemplazarlos en el editor: {result.skippedExercises.slice(0, 8).join(', ')}{result.skippedExercises.length > 8 ? '…' : ''}</Text></View>
        </View> : null}
        {result.weeks.map(week => <View key={week.id} style={styles.weekRow}><View style={styles.weekNo}><Text style={styles.weekNoText}>{week.weekNumber}</Text></View><View style={styles.grow}><Text style={styles.strong}>{week.name}</Text><Text style={styles.dim}>{week.days.length} días · {(week.weekType ?? 'training').replace('_', ' ')}</Text></View></View>)}
        <PrimaryButton title="Revisar en el editor" onPress={() => onUseDraft({ info: result.info, weeks: result.weeks, activation: result.activation })} light />
      </> : null}
    </ScrollView>
  </View>;
}

export function CoachProgramAssignScreen({ programId, onBack, onDone }: {
  programId: string;
  onBack(): void;
  onDone(): void;
}) {
  const [program, setProgram] = useState<CoachLibraryProgram | null>(null);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCoachLibraryPrograms(), getMyAthletes()])
      .then(([programs, nextAthletes]) => {
        setProgram(programs.find(item => item.id === programId) ?? null);
        setAthletes(nextAthletes);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'No pudimos preparar la asignación.'));
  }, [programId]);

  const toggle = (id: string) => setSelected(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const assign = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError('');
    try {
      await assignCoachProgram(programId, selected);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos asignar el mesociclo.');
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.fill}>
    <TopBar title="Asignar mesociclo" eyebrow={program?.name} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.copy}>Cada atleta recibirá una copia independiente que podrás personalizar sin modificar el mesociclo maestro.</Text>
      <SelectionList athletes={athletes} selected={selected} onToggle={toggle} />
      {!athletes.length ? <Card><Text style={styles.dim}>No hay atletas vinculados para asignar.</Text></Card> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      <PrimaryButton title={busy ? 'Asignando…' : `Asignar a ${selected.length} ${selected.length === 1 ? 'atleta' : 'atletas'}`} onPress={assign} disabled={busy || !selected.length} />
    </ScrollView>
  </View>;
}

export function CoachProgramUpdateScreen({ programId, onBack, onDone }: {
  programId: string;
  onBack(): void;
  onDone(): void;
}) {
  const [program, setProgram] = useState<CoachLibraryProgram | null>(null);
  const [weeks, setWeeks] = useState<BlockDraftWeek[]>([]);
  const [previews, setPreviews] = useState<CoachAssignmentPreview[]>([]);
  const [athleteIds, setAthleteIds] = useState<string[]>([]);
  const [weekIds, setWeekIds] = useState<string[]>([]);
  const [policy, setPolicy] = useState<'keep' | 'replace'>('keep');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultText, setResultText] = useState('');

  useEffect(() => {
    Promise.all([
      getCoachLibraryPrograms(),
      getCoachLibraryProgramDraft(programId),
      getCoachAssignmentPreview(programId),
    ]).then(([programs, draft, nextPreviews]) => {
      setProgram(programs.find(item => item.id === programId) ?? null);
      setWeeks(draft.weeks);
      setPreviews(nextPreviews);
      setAthleteIds(nextPreviews.filter(item => item.needsUpdate).map(item => item.athlete.athleteId));
      setWeekIds(draft.weeks.map(week => week.id).filter((id): id is string => Boolean(id)));
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'No pudimos comparar las versiones.'));
  }, [programId]);

  const selectedPreviews = previews.filter(item => athleteIds.includes(item.athlete.athleteId));
  const customizationCount = selectedPreviews.reduce((sum, item) => sum + item.customizedWeekIds.filter(id => weekIds.includes(id)).length, 0);
  const completedCount = selectedPreviews.reduce((sum, item) => sum + item.completedWeekIds.filter(id => weekIds.includes(id)).length, 0);
  const activeCount = selectedPreviews.reduce((sum, item) => sum + item.activeWeekIds.filter(id => weekIds.includes(id)).length, 0);

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const results = await updateCoachProgramAssignments(programId, athleteIds, weekIds, policy);
      const deferred = results.reduce((sum, item) => sum + item.deferredWeekIds.length, 0);
      const skipped = results.reduce((sum, item) => sum + item.skippedWeekIds.length, 0);
      setResultText(`Actualización procesada para ${results.length} atletas.${deferred ? ` ${deferred} semanas quedaron pendientes hasta terminar la sesión activa.` : ''}${skipped ? ` ${skipped} semanas completadas o personalizadas se conservaron.` : ''}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos aplicar la actualización.');
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.fill}>
    <TopBar title="Actualizar atletas" eyebrow={program?.name} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>1 · ATLETAS</Text>
      <SelectionList
        athletes={previews.map(item => item.athlete)}
        selected={athleteIds}
        onToggle={id => setAthleteIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])}
        meta={athlete => {
          const preview = previews.find(item => item.athlete.athleteId === athlete.athleteId);
          return preview?.needsUpdate ? `v${preview.lastSyncedRevision} → v${program?.revision ?? preview.sourceRevision}` : 'Ya actualizado';
        }}
      />
      <Text style={styles.section}>2 · SEMANAS FUTURAS</Text>
      {weeks.map(week => <CheckRow key={week.id} checked={Boolean(week.id && weekIds.includes(week.id))} title={week.name} subtitle={`Semana ${week.weekNumber} · ${(week.weekType ?? 'training').replace('_', ' ')}`} onPress={() => {
        if (!week.id) return;
        setWeekIds(current => current.includes(week.id!) ? current.filter(item => item !== week.id) : [...current, week.id!]);
      }} />)}
      <Text style={styles.section}>3 · PERSONALIZACIONES</Text>
      <View style={styles.policyRow}>
        <PolicyOption selected={policy === 'keep'} title="Conservar" subtitle="No reemplaza semanas personalizadas." onPress={() => setPolicy('keep')} />
        <PolicyOption selected={policy === 'replace'} title="Reemplazar" subtitle="Usa la versión maestra seleccionada." onPress={() => setPolicy('replace')} />
      </View>
      {customizationCount ? <WarningLine text={`${customizationCount} semanas seleccionadas tienen personalizaciones del coach.`} /> : null}
      {completedCount ? <WarningLine text={`${completedCount} semanas completadas se conservarán siempre, independiente de esta opción.`} /> : null}
      {activeCount ? <WarningLine text={`${activeCount} semanas tienen una sesión activa; el cambio se aplicará al terminarla.`} /> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {resultText ? <View style={styles.notice}><Ionicons name="checkmark-circle-outline" color={colors.success} size={19} /><Text style={styles.noticeText}>{resultText}</Text></View> : null}
      {resultText ? <PrimaryButton title="Volver a Programaciones" onPress={onDone} light /> : <PrimaryButton title={busy ? 'Aplicando…' : 'Aplicar actualización'} onPress={apply} disabled={busy || !athleteIds.length || !weekIds.length} />}
    </ScrollView>
  </View>;
}

export function CoachMacrocycleEditorScreen({ macrocycleId, onBack, onSaved }: {
  macrocycleId?: string | null;
  onBack(): void;
  onSaved(): void;
}) {
  const [programs, setPrograms] = useState<CoachLibraryProgram[]>([]);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<CoachMacrocycle['status']>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCoachLibraryPrograms(), getCoachMacrocycles()]).then(([allPrograms, macros]) => {
      setPrograms(allPrograms.filter(item => item.kind === 'mesocycle' && item.status !== 'archived'));
      const current = macros.find(item => item.id === macrocycleId);
      if (current) {
        setName(current.name);
        setGoal(current.goalText ?? '');
        setStartDate(current.startDate ?? '');
        setEndDate(current.endDate ?? '');
        setStatus(current.status);
        setSelected(current.programIds);
      }
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'No pudimos cargar el macrociclo.'));
  }, [macrocycleId]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveCoachMacrocycle({
        id: macrocycleId ?? undefined,
        name,
        goalText: goal.trim() || null,
        startDate: startDate.trim() || null,
        endDate: endDate.trim() || null,
        status,
        programIds: selected,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar el macrociclo.');
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.fill}>
    <TopBar title={macrocycleId ? 'Editar macrociclo' : 'Nuevo macrociclo'} onBack={onBack} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.copy}>El macrociclo es opcional: agrupa mesociclos existentes. Solo el nombre es obligatorio.</Text>
      <Field label="NOMBRE *" value={name} onChange={setName} placeholder="Ej. Temporada 2026" />
      <Field label="OBJETIVO (OPCIONAL)" value={goal} onChange={setGoal} placeholder="Ej. Clasificar al nacional" />
      <View style={styles.twoCols}><Field label="INICIO" value={startDate} onChange={setStartDate} placeholder="AAAA-MM-DD" /><Field label="FIN" value={endDate} onChange={setEndDate} placeholder="AAAA-MM-DD" /></View>
      <Text style={styles.section}>ESTADO OPCIONAL</Text>
      <View style={styles.statusRow}>{([null, 'draft', 'active', 'completed'] as const).map(value => <Pressable key={value ?? 'none'} onPress={() => setStatus(value)} style={[styles.statusOption, status === value && styles.statusActive]}><Text style={[styles.statusText, status === value && styles.statusTextActive]}>{value ?? 'Sin estado'}</Text></Pressable>)}</View>
      <Text style={styles.section}>MESOCICLOS INCLUIDOS</Text>
      {programs.map(program => <CheckRow key={program.id} checked={selected.includes(program.id)} title={program.name} subtitle={`${program.weekCount} semanas`} onPress={() => setSelected(current => current.includes(program.id) ? current.filter(item => item !== program.id) : [...current, program.id])} />)}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      <PrimaryButton title={busy ? 'Guardando…' : 'Guardar macrociclo'} onPress={save} disabled={busy || !name.trim()} />
    </ScrollView>
  </View>;
}

function SelectionList({ athletes, selected, onToggle, meta }: {
  athletes: CoachAthlete[];
  selected: string[];
  onToggle(id: string): void;
  meta?(athlete: CoachAthlete): string;
}) {
  return <>{athletes.map(athlete => <CheckRow key={athlete.athleteId} checked={selected.includes(athlete.athleteId)} title={athlete.displayName ?? athlete.email} subtitle={meta?.(athlete) ?? athlete.goal ?? 'Sin objetivo'} onPress={() => onToggle(athlete.athleteId)} />)}</>;
}

function CheckRow({ checked, title, subtitle, onPress }: { checked: boolean; title: string; subtitle: string; onPress(): void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={[styles.checkRow, checked && styles.checkRowActive]}><View style={[styles.check, checked && styles.checkActive]}>{checked ? <Ionicons name="checkmark" color={colors.canvas} size={15} /> : null}</View><View style={styles.grow}><Text style={styles.strong}>{title}</Text><Text style={styles.dim}>{subtitle}</Text></View></Pressable>;
}

function PolicyOption({ selected, title, subtitle, onPress }: { selected: boolean; title: string; subtitle: string; onPress(): void }) {
  return <Pressable onPress={onPress} style={[styles.policy, selected && styles.policyActive]}><Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} color={selected ? colors.orange : colors.dim} size={18} /><Text style={styles.strong}>{title}</Text><Text style={styles.dim}>{subtitle}</Text></Pressable>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange(value: string): void; placeholder: string }) {
  return <View style={styles.field}><Text style={styles.section}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.subtle} style={styles.input} /></View>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function WarningLine({ text }: { text: string }) {
  return <View style={styles.warningCard}><Ionicons name="warning-outline" color={colors.warning} size={18} /><Text style={styles.warningText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  content: { padding: 19, gap: 11, paddingBottom: 44 },
  hero: { padding: 18, gap: 9, backgroundColor: '#130d09', borderWidth: 1, borderColor: '#372116', borderRadius: 17 },
  heroTitle: { color: colors.text, fontSize: 25, fontWeight: '900', fontFamily: condensed },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', fontFamily: condensed },
  section: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 5 },
  strong: { color: colors.text, fontWeight: '800' },
  dim: { color: colors.dim, fontSize: 11, marginTop: 3 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 5 },
  metric: { flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10 },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily: condensed },
  metricLabel: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  notice: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#174631', backgroundColor: '#0c1712', flexDirection: 'row', alignItems: 'center', gap: 9 },
  noticeText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  warningCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#493315', backgroundColor: '#17130c', flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  warningText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  weekRow: { minHeight: 55, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekNo: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  weekNoText: { color: colors.orange, fontWeight: '900' },
  checkRow: { minHeight: 61, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkRowActive: { borderColor: colors.orange, backgroundColor: '#15100d' },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  policyRow: { flexDirection: 'row', gap: 9 },
  policy: { flex: 1, minHeight: 105, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 13, padding: 12, gap: 5 },
  policyActive: { borderColor: colors.orange, backgroundColor: '#15100d' },
  field: { flex: 1, gap: 7 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 14 },
  twoCols: { flexDirection: 'row', gap: 9 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statusOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.surface },
  statusActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  statusText: { color: colors.dim, fontWeight: '700', fontSize: 10, textTransform: 'capitalize' },
  statusTextActive: { color: colors.text },
});
