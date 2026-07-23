import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ConfirmDialog, PrimaryButton, TopBar, formatDate } from '@/src/components/ui';
import { PerformanceDashboard } from '@/src/components/PerformanceDashboard';
import { SessionExposure } from '@/src/domain/performance';
import {
  CoachAthlete,
  CoachWorkoutSummary,
  getAthleteWorkouts,
  getMyAthletes,
} from '@/src/services/coachService';
import {
  CoachDashboardSummary,
  CoachLibraryProgram,
  CoachMacrocycle,
  CoachProgramKind,
  duplicateCoachLibraryProgram,
  getCoachDashboardSummary,
  getCoachLibraryPrograms,
  getCoachMacrocycles,
  setCoachLibraryProgramArchived,
} from '@/src/services/coachProgramService';
import { getAthletePerformanceExposures } from '@/src/services/performanceService';
import { colors, condensed } from '@/src/theme';

type Area = 'summary' | 'athletes' | 'programs' | 'performance';
type LibraryFilter = 'mesocycles' | 'templates' | 'macrocycles' | 'archived';

type Props = {
  onBack(): void;
  onAthlete(athleteId: string): void;
  onCreateProgram(kind: CoachProgramKind): void;
  onImport(): void;
  onEditProgram(programId: string, kind: CoachProgramKind): void;
  onAssign(programId: string): void;
  onUpdate(programId: string): void;
  onActivation(programId: string): void;
  onMacrocycle(macrocycleId?: string): void;
};

const AREAS: { id: Area; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'summary', label: 'Resumen', icon: 'grid-outline' },
  { id: 'athletes', label: 'Atletas', icon: 'people-outline' },
  { id: 'programs', label: 'Programaciones', icon: 'layers-outline' },
  { id: 'performance', label: 'Rendimiento', icon: 'pulse-outline' },
];

export function CoachDashboardScreen(props: Props) {
  const [area, setArea] = useState<Area>('summary');
  const [summary, setSummary] = useState<CoachDashboardSummary | null>(null);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [programs, setPrograms] = useState<CoachLibraryProgram[]>([]);
  const [macrocycles, setMacrocycles] = useState<CoachMacrocycle[]>([]);
  const [workouts, setWorkouts] = useState<(CoachWorkoutSummary & { athleteName: string })[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>('mesocycles');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CoachLibraryProgram | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextAthletes, nextPrograms, nextMacrocycles] = await Promise.all([
        getCoachDashboardSummary(),
        getMyAthletes(),
        getCoachLibraryPrograms(),
        getCoachMacrocycles(),
      ]);
      setSummary(nextSummary);
      setAthletes(nextAthletes);
      setPrograms(nextPrograms);
      setMacrocycles(nextMacrocycles);
      const recent = await Promise.all(nextAthletes.map(async athlete => {
        const athleteName = athlete.displayName ?? athlete.email;
        const entries = await getAthleteWorkouts(athlete.athleteId, 3);
        return entries.map(entry => ({ ...entry, athleteName }));
      }));
      setWorkouts(recent.flat().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cargar el panel de coaching.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visiblePrograms = useMemo(() => programs.filter(program => {
    if (filter === 'archived') return program.status === 'archived';
    if (program.status === 'archived') return false;
    if (filter === 'templates') return program.kind === 'template';
    if (filter === 'mesocycles') return program.kind === 'mesocycle';
    return false;
  }), [filter, programs]);

  const duplicate = async (program: CoachLibraryProgram) => {
    setBusyId(program.id);
    setError('');
    try {
      await duplicateCoachLibraryProgram(program.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos duplicar la programación.');
    } finally {
      setBusyId(null);
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    setBusyId(archiveTarget.id);
    try {
      await setCoachLibraryProgramArchived(archiveTarget.id, true);
      setArchiveTarget(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos archivar la programación.');
    } finally {
      setBusyId(null);
    }
  };

  return <View style={styles.fill}>
    <TopBar title="Panel de coaching" onBack={props.onBack} />
    <View style={styles.areaBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaBarContent}>
        {AREAS.map(item => <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: area === item.id }}
          onPress={() => setArea(item.id)}
          style={[styles.areaTab, area === item.id && styles.areaTabActive]}
        >
          <Ionicons name={item.icon} color={area === item.id ? colors.orange : colors.dim} size={16} />
          <Text style={[styles.areaText, area === item.id && styles.areaTextActive]}>{item.label}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={styles.dim}>Cargando panel…</Text> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {area === 'summary' ? <SummaryArea summary={summary} programs={programs} athletes={athletes} onArea={setArea} /> : null}
      {area === 'athletes' ? <AthletesArea athletes={athletes} onAthlete={props.onAthlete} /> : null}
      {area === 'programs' ? <ProgramsArea
        filter={filter}
        onFilter={setFilter}
        programs={visiblePrograms}
        macrocycles={macrocycles}
        busyId={busyId}
        onCreate={props.onCreateProgram}
        onImport={props.onImport}
        onEdit={props.onEditProgram}
        onAssign={props.onAssign}
        onUpdate={props.onUpdate}
        onActivation={props.onActivation}
        onDuplicate={duplicate}
        onArchive={setArchiveTarget}
        onMacrocycle={props.onMacrocycle}
      /> : null}
      {area === 'performance' ? <PerformanceArea athletes={athletes} workouts={workouts} /> : null}
    </ScrollView>
    <ConfirmDialog
      visible={archiveTarget !== null}
      title="Archivar programación"
      message="Dejará la biblioteca activa. Las copias ya asignadas y el historial de los atletas no se modificarán."
      confirmLabel={busyId ? 'Archivando…' : 'Archivar'}
      destructive
      onCancel={() => setArchiveTarget(null)}
      onConfirm={archive}
    />
  </View>;
}

function SummaryArea({ summary, programs, athletes, onArea }: {
  summary: CoachDashboardSummary | null;
  programs: CoachLibraryProgram[];
  athletes: CoachAthlete[];
  onArea(area: Area): void;
}) {
  const metrics = [
    ['ATLETAS', summary?.athletes ?? athletes.length],
    ['MESOCICLOS', summary?.mesocycles ?? 0],
    ['PLANTILLAS', summary?.templates ?? 0],
    ['POR ACTUALIZAR', summary?.assignmentsNeedingUpdate ?? 0],
  ] as const;
  const recent = programs.filter(item => item.status !== 'archived').slice(0, 3);
  return <>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>CONTROL DE COACH</Text>
      <Text style={styles.heroTitle}>Todo tu equipo, sin perder el hilo.</Text>
      <Text style={styles.heroCopy}>Programa una vez, asigna copias independientes y decide qué cambios futuros recibe cada atleta.</Text>
    </View>
    <View style={styles.metricGrid}>{metrics.map(([label, value]) => <Card key={label} style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text>
    </Card>)}</View>
    {(summary?.assignmentsNeedingUpdate ?? 0) > 0 ? <Pressable onPress={() => onArea('programs')} style={styles.notice}>
      <Ionicons name="sync-outline" color={colors.orange} size={19} />
      <View style={styles.grow}><Text style={styles.strong}>Hay atletas con actualizaciones disponibles</Text><Text style={styles.dim}>Revisa los cambios antes de aplicarlos.</Text></View>
      <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
    </Pressable> : null}
    <Text style={styles.section}>PROGRAMACIONES RECIENTES</Text>
    {recent.map(program => <ProgramSummary key={program.id} program={program} />)}
    {!recent.length ? <Card><Text style={styles.dim}>Crea tu primer mesociclo desde Programaciones.</Text></Card> : null}
  </>;
}

function AthletesArea({ athletes, onAthlete }: { athletes: CoachAthlete[]; onAthlete(id: string): void }) {
  return <>
    <Text style={styles.section}>MIS ATLETAS</Text>
    {athletes.map(athlete => <Pressable key={athlete.athleteId} onPress={() => onAthlete(athlete.athleteId)} style={styles.rowCard}>
      <View style={styles.iconBox}><Ionicons name="person" color={colors.orange} size={18} /></View>
      <View style={styles.grow}><Text style={styles.strong}>{athlete.displayName ?? athlete.email}</Text><Text style={styles.dim}>{athlete.goal ?? 'Sin objetivo registrado'}{athlete.bodyWeight != null ? ` · ${athlete.bodyWeight}kg` : ''}</Text></View>
      <Ionicons name="chevron-forward" color={colors.subtle} size={17} />
    </Pressable>)}
    {!athletes.length ? <Card><Text style={styles.dim}>Todavía no tienes atletas vinculados.</Text></Card> : null}
  </>;
}

function ProgramsArea({
  filter, onFilter, programs, macrocycles, busyId, onCreate, onImport, onEdit,
  onAssign, onUpdate, onActivation, onDuplicate, onArchive, onMacrocycle,
}: {
  filter: LibraryFilter;
  onFilter(value: LibraryFilter): void;
  programs: CoachLibraryProgram[];
  macrocycles: CoachMacrocycle[];
  busyId: string | null;
  onCreate(kind: CoachProgramKind): void;
  onImport(): void;
  onEdit(id: string, kind: CoachProgramKind): void;
  onAssign(id: string): void;
  onUpdate(id: string): void;
  onActivation(id: string): void;
  onDuplicate(program: CoachLibraryProgram): void;
  onArchive(program: CoachLibraryProgram): void;
  onMacrocycle(id?: string): void;
}) {
  const filters: [LibraryFilter, string][] = [
    ['mesocycles', 'Mesociclos'], ['templates', 'Plantillas'],
    ['macrocycles', 'Macrociclos'], ['archived', 'Archivados'],
  ];
  return <>
    <View style={styles.actionGrid}>
      <Pressable onPress={() => onCreate('mesocycle')} style={styles.action}><Ionicons name="add" color={colors.text} size={20} /><Text style={styles.actionText}>Crear mesociclo</Text></Pressable>
      <Pressable onPress={onImport} style={[styles.action, styles.actionSecondary]}><Ionicons name="document-attach-outline" color={colors.orange} size={19} /><Text style={styles.actionText}>Importar Excel</Text></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {filters.map(([id, label]) => <Pressable key={id} onPress={() => onFilter(id)} style={[styles.filter, filter === id && styles.filterActive]}><Text style={[styles.filterText, filter === id && styles.filterTextActive]}>{label}</Text></Pressable>)}
    </ScrollView>
    {filter === 'macrocycles' ? <>
      <PrimaryButton title="Crear macrociclo opcional" onPress={() => onMacrocycle()} />
      {macrocycles.map(item => <Pressable key={item.id} onPress={() => onMacrocycle(item.id)} style={styles.libraryCard}>
        <View style={styles.folderIcon}><Ionicons name="albums-outline" color={colors.orange} size={20} /></View>
        <View style={styles.grow}><Text style={styles.libraryTitle}>{item.name}</Text><Text style={styles.dim}>{item.programIds.length} mesociclos · {item.status ?? 'Sin estado'}</Text></View>
        <Ionicons name="create-outline" color={colors.muted} size={18} />
      </Pressable>)}
      {!macrocycles.length ? <Card><Text style={styles.dim}>Los macrociclos son opcionales y agrupan mesociclos ya creados.</Text></Card> : null}
    </> : <>
      {filter === 'templates' ? <PrimaryButton title="Crear plantilla" onPress={() => onCreate('template')} light /> : null}
      {programs.map(program => <View key={program.id} style={styles.programCard}>
        <View style={styles.programHead}>
          <View style={styles.folderIcon}><Ionicons name={program.kind === 'template' ? 'copy-outline' : 'folder-outline'} color={colors.orange} size={20} /></View>
          <View style={styles.grow}><Text style={styles.libraryTitle}>{program.name}</Text><Text style={styles.dim}>{program.weekCount} semanas · v{program.revision} · {program.assignmentCount} asignaciones</Text>{program.macrocycleName ? <Text style={styles.tag}>{program.macrocycleName}</Text> : null}</View>
        </View>
        <View style={styles.programActions}>
          <SmallAction icon="create-outline" label="Editar" onPress={() => onEdit(program.id, program.kind)} />
          <SmallAction icon="book-outline" label="Activación" onPress={() => onActivation(program.id)} />
          <SmallAction icon="people-outline" label="Asignar" onPress={() => onAssign(program.id)} />
          {program.assignmentCount > 0 ? <SmallAction icon="sync-outline" label="Actualizar" onPress={() => onUpdate(program.id)} /> : null}
          <SmallAction icon="copy-outline" label={busyId === program.id ? 'Copiando…' : 'Duplicar'} onPress={() => onDuplicate(program)} />
          {program.status !== 'archived' ? <SmallAction icon="archive-outline" label="Archivar" danger onPress={() => onArchive(program)} /> : null}
        </View>
      </View>)}
      {!programs.length ? <Card><Text style={styles.dim}>No hay elementos en esta carpeta.</Text></Card> : null}
    </>}
  </>;
}

function PerformanceArea({ athletes, workouts }: { athletes: CoachAthlete[]; workouts: (CoachWorkoutSummary & { athleteName: string })[] }) {
  const [athleteId, setAthleteId] = useState<string | null>(athletes[0]?.athleteId ?? null);
  const [exposures, setExposures] = useState<SessionExposure[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState('');

  useEffect(() => {
    if (!athleteId) { setExposures([]); return; }
    let active = true;
    setPerformanceLoading(true);
    setPerformanceError('');
    getAthletePerformanceExposures(athleteId)
      .then(items => { if (active) setExposures(items); })
      .catch(cause => { if (active) setPerformanceError(cause instanceof Error ? cause.message : 'No pudimos cargar el rendimiento.'); })
      .finally(() => { if (active) setPerformanceLoading(false); });
    return () => { active = false; };
  }, [athleteId]);

  return <>
    <Text style={styles.section}>ATLETA</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {athletes.map(athlete => <Pressable key={athlete.athleteId} accessibilityRole="button" accessibilityState={{ selected: athleteId === athlete.athleteId }} onPress={() => setAthleteId(athlete.athleteId)} style={[styles.filter, athleteId === athlete.athleteId && styles.filterActive]}><Text style={[styles.filterText, athleteId === athlete.athleteId && styles.filterTextActive]}>{athlete.displayName ?? athlete.email}</Text></Pressable>)}
    </ScrollView>
    <PerformanceDashboard exposures={exposures} loading={performanceLoading} error={performanceError} />
    <Text style={styles.section}>SESIONES RECIENTES DEL EQUIPO</Text>
    {workouts.map(workout => <Card key={workout.id}>
      <View style={styles.between}><View style={styles.grow}><Text style={styles.strong}>{workout.athleteName}</Text><Text style={styles.dim}>{workout.routineName} · {formatDate(workout.date)}</Text></View><Text style={styles.volume}>{workout.totalVolume.toLocaleString('es-CL')}kg</Text></View>
      <Text style={styles.dim}>{workout.setsCompleted} series · {Math.round(workout.durationSeconds / 60)} min</Text>
    </Card>)}
    {!workouts.length ? <Card><Text style={styles.dim}>Aún no hay sesiones registradas por tus atletas.</Text></Card> : null}
  </>;
}

function ProgramSummary({ program }: { program: CoachLibraryProgram }) {
  return <View style={styles.rowCard}><View style={styles.folderIcon}><Ionicons name="folder-outline" color={colors.orange} size={19} /></View><View style={styles.grow}><Text style={styles.strong}>{program.name}</Text><Text style={styles.dim}>{program.weekCount} semanas · {program.assignmentCount} atletas</Text></View><Text style={styles.version}>v{program.revision}</Text></View>;
}

function SmallAction({ icon, label, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress(): void }) {
  return <Pressable onPress={onPress} style={styles.smallAction}><Ionicons name={icon} color={danger ? colors.danger : colors.muted} size={15} /><Text style={[styles.smallActionText, danger && styles.danger]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  areaBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  areaBarContent: { paddingHorizontal: 14, gap: 5 },
  areaTab: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  areaTabActive: { borderBottomColor: colors.orange },
  areaText: { color: colors.dim, fontWeight: '700', fontSize: 12 },
  areaTextActive: { color: colors.text },
  content: { padding: 18, gap: 12, paddingBottom: 44 },
  hero: { padding: 18, borderRadius: 18, backgroundColor: '#130d09', borderWidth: 1, borderColor: '#372116', gap: 8 },
  eyebrow: { color: colors.orange, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  heroTitle: { color: colors.text, fontSize: 29, lineHeight: 31, fontWeight: '900', fontFamily: condensed },
  heroCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 94, justifyContent: 'center' },
  metricValue: { color: colors.text, fontSize: 30, fontWeight: '900', fontFamily: condensed },
  metricLabel: { color: colors.dim, fontSize: 8, letterSpacing: 1.2, fontWeight: '800' },
  notice: { borderWidth: 1, borderColor: '#51301b', backgroundColor: '#17100c', borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  section: { color: colors.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 5 },
  strong: { color: colors.text, fontWeight: '800' },
  dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  rowCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', gap: 9 },
  action: { flex: 1, minHeight: 64, borderRadius: 13, padding: 12, backgroundColor: colors.orange, justifyContent: 'center', gap: 4 },
  actionSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  filters: { gap: 7 },
  filter: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  filterText: { color: colors.dim, fontWeight: '700', fontSize: 11 },
  filterTextActive: { color: colors.text },
  libraryCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  programCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 15, overflow: 'hidden' },
  programHead: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  folderIcon: { width: 39, height: 39, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  libraryTitle: { color: colors.text, fontSize: 17, fontWeight: '900', fontFamily: condensed },
  tag: { color: colors.orange, fontSize: 9, fontWeight: '800', marginTop: 5 },
  programActions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallAction: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  smallActionText: { color: colors.muted, fontWeight: '700', fontSize: 10 },
  danger: { color: colors.danger },
  phaseNotice: { backgroundColor: '#15100d', borderWidth: 1, borderColor: '#392216', borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10 },
  phaseText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  volume: { color: colors.orange, fontWeight: '800', fontSize: 11 },
  version: { color: colors.orange, fontWeight: '800', fontSize: 10 },
});
