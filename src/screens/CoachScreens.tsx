import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ConfirmDialog, PrimaryButton, TopBar, formatDate } from '@/src/components/ui';
import {
  CoachAthlete,
  CoachComment,
  CoachProgramBlock,
  CoachWorkoutSummary,
  addComment,
  archiveCoachProgram,
  getAthleteProgramTree,
  getAthleteWorkouts,
  getComments,
  getMyAthletes,
} from '@/src/services/coachService';
import { colors } from '@/src/theme';

export function CoachAthletesScreen({ onBack, onAthlete }: { onBack(): void; onAthlete(athleteId: string): void }) {
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMyAthletes()
      .then(list => { if (active) setAthletes(list); })
      .catch(cause => {
        console.error('coach athletes load error', cause);
        if (active) {
          const remote = cause as { message?: string; error_description?: string } | null;
          setError(remote?.message ?? remote?.error_description ?? 'No pudimos cargar tus atletas.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <View style={styles.fill}>
    <TopBar title="Mis atletas" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={styles.dim}>Cargando atletas…</Text> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {!loading && !error && athletes.length === 0 ? <Card><Text style={styles.dim}>Todavía no tienes atletas vinculados. Comparte tu código de invitación desde tu perfil.</Text></Card> : null}
      {athletes.map(athlete => {
        const displayLabel = athlete.displayName ?? athlete.email;
        return <Pressable accessibilityRole="button" accessibilityLabel={`Ver atleta ${displayLabel}`} key={athlete.athleteId} onPress={() => onAthlete(athlete.athleteId)} style={styles.athleteCard}>
          <View style={styles.athleteIcon}><Ionicons name="person" color={colors.orange} size={18} /></View>
          <View style={styles.grow}>
            <Text style={styles.strong}>{displayLabel}</Text>
            <Text style={styles.dim}>{athlete.bodyWeight != null ? `${athlete.bodyWeight}kg` : 'Sin peso registrado'}</Text>
          </View>
          <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function CoachAthleteDetailScreen({ athleteId, onBack, onNewBlock, onEditBlock }: { athleteId: string; onBack(): void; onNewBlock(): void; onEditBlock(blockId: string): void }) {
  const [athlete, setAthlete] = useState<CoachAthlete | null>(null);
  const [programs, setPrograms] = useState<CoachProgramBlock[]>([]);
  const [workouts, setWorkouts] = useState<CoachWorkoutSummary[]>([]);
  const [comments, setComments] = useState<CoachComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [archiveTarget, setArchiveTarget] = useState<{ entity: 'block' | 'week' | 'day'; id: string; label: string } | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([getMyAthletes(), getAthleteProgramTree(athleteId), getAthleteWorkouts(athleteId), getComments(athleteId)])
      .then(([athletes, programList, workoutList, commentList]) => {
        setAthlete(athletes.find(item => item.athleteId === athleteId) ?? null);
        setPrograms(programList);
        setWorkouts(workoutList);
        setComments(commentList);
      })
      .catch(cause => {
        console.error('coach athlete load error', cause);
        const remote = cause as { message?: string; error_description?: string } | null;
        setError(remote?.message ?? remote?.error_description ?? 'No pudimos cargar la información del atleta.');
      })
      .finally(() => setLoading(false));
  }, [athleteId]);

  const toggle = (id: string) => setExpanded(current => ({ ...current, [id]: !current[id] }));

  const confirmArchive = async () => {
    if (!archiveTarget || archiveBusy) return;
    setArchiveBusy(true);
    try {
      await archiveCoachProgram(archiveTarget.entity, archiveTarget.id);
      setArchiveTarget(null);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos archivar este elemento.');
    } finally {
      setArchiveBusy(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentBusy(true);
    setCommentError('');
    try {
      await addComment(athleteId, text);
      setCommentText('');
      setComments(await getComments(athleteId));
    } catch (cause) {
      setCommentError(cause instanceof Error ? cause.message : 'No pudimos agregar el comentario.');
    } finally {
      setCommentBusy(false);
    }
  };

  return <View style={styles.fill}>
    <TopBar title={athlete?.displayName ?? athlete?.email ?? 'Atleta'} onBack={onBack} />
    <View style={styles.cta}><PrimaryButton title="Nuevo bloque" onPress={onNewBlock} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={styles.dim}>Cargando…</Text> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      <Text style={styles.section}>PLANIFICACIÓN</Text>
      {programs.map(block => {
        const blockOpen = Boolean(expanded[block.id]);
        return <View key={block.id} style={[styles.folder, block.status === 'archived' && styles.archived]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${blockOpen ? 'Cerrar' : 'Abrir'} ${block.name}`} onPress={() => toggle(block.id)} style={styles.folderHeader}>
            <View style={styles.folderIcon}><Ionicons name={blockOpen ? 'folder-open-outline' : 'folder-outline'} color={colors.orange} size={20} /></View>
            <View style={styles.grow}><Text style={styles.folderTitle}>{block.name}</Text><Text style={styles.dim}>{block.weeks.length} carpetas · {block.status === 'draft' ? 'Sin fecha / borrador' : block.status === 'archived' ? 'Archivado' : block.status === 'completed' ? 'Completado' : `Semana ${block.currentWeekNumber}`}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${block.name}`} onPress={() => onEditBlock(block.id)} hitSlop={8} style={styles.iconButton}><Ionicons name="create-outline" color={colors.text} size={18} /></Pressable>
            {block.status !== 'archived' ? <Pressable accessibilityRole="button" accessibilityLabel={`Archivar ${block.name}`} onPress={() => setArchiveTarget({ entity: 'block', id: block.id, label: block.name })} hitSlop={8} style={styles.iconButton}><Ionicons name="archive-outline" color={colors.danger} size={18} /></Pressable> : null}
          </Pressable>
          {blockOpen ? <View style={styles.folderBody}>{block.weeks.map(week => {
            const weekOpen = Boolean(expanded[week.id]);
            return <View key={week.id} style={[styles.weekFolder, week.status === 'archived' && styles.archived]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${weekOpen ? 'Cerrar' : 'Abrir'} ${week.name}`} onPress={() => toggle(week.id)} style={styles.weekHeader}>
                <Ionicons name={weekOpen ? 'chevron-down' : 'chevron-forward'} color={colors.dim} size={16} />
                <View style={styles.grow}><Text style={styles.strong}>{week.name}</Text><Text style={styles.dim}>{week.days.length} días · {week.status === 'draft' ? 'Borrador' : week.status === 'completed' ? 'Completada' : week.status === 'archived' ? 'Archivada' : 'Publicada'}</Text></View>
                {week.status !== 'archived' ? <Pressable accessibilityRole="button" accessibilityLabel={`Archivar ${week.name}`} onPress={() => setArchiveTarget({ entity: 'week', id: week.id, label: week.name })} hitSlop={8} style={styles.iconButton}><Ionicons name="trash-outline" color={colors.danger} size={17} /></Pressable> : null}
              </Pressable>
              {weekOpen ? <View style={styles.dayList}>{week.days.map(day => <View key={day.id} style={[styles.dayRow, day.status === 'archived' && styles.archived]}>
                <View style={styles.dayNumber}><Text style={styles.dayNumberText}>D{day.day}</Text></View>
                <View style={styles.grow}><Text style={styles.strong}>{day.name}</Text><Text style={styles.dim}>{day.exerciseCount} ejercicios · {day.setCount} series{day.prescriptionNotes ? ' · Con indicaciones' : ''}</Text></View>
                {day.status !== 'archived' ? <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${day.name}`} onPress={() => setArchiveTarget({ entity: 'day', id: day.id, label: day.name })} hitSlop={8} style={styles.iconButton}><Ionicons name="trash-outline" color={colors.danger} size={16} /></Pressable> : null}
              </View>)}</View> : null}
            </View>;
          })}</View> : null}
        </View>;
      })}
      {!loading && programs.length === 0 ? <Card><Text style={styles.dim}>Este atleta todavía no tiene bloques. Crea el primero con una carpeta por semana.</Text></Card> : null}

      <Text style={styles.section}>ÚLTIMOS ENTRENAMIENTOS</Text>
      {workouts.map(workout => <Card key={workout.id}>
        <View style={styles.between}>
          <View style={styles.grow}>
            <Text style={styles.strong}>{workout.routineName}</Text>
            <Text style={styles.dim}>{formatDate(workout.date)} · {Math.round(workout.durationSeconds / 60)} min · {workout.setsCompleted} {workout.setsCompleted === 1 ? 'serie' : 'series'}</Text>
          </View>
          <Text style={styles.orange}>{workout.totalVolume.toLocaleString('es-CL')}kg</Text>
        </View>
        {workout.exerciseNames.length ? <Text numberOfLines={1} style={styles.exerciseList}>{workout.exerciseNames.join(' · ')}</Text> : null}
      </Card>)}
      {!loading && workouts.length === 0 ? <Card><Text style={styles.dim}>Este atleta no ha registrado entrenamientos todavía.</Text></Card> : null}

      <Text style={styles.section}>COMENTARIOS</Text>
      {comments.map(comment => <Card key={comment.id}>
        <Text style={styles.dim}>{formatDate(comment.createdAt)}</Text>
        <Text style={styles.commentText}>{comment.text}</Text>
      </Card>)}
      {!loading && comments.length === 0 ? <Text style={styles.dim}>Todavía no hay comentarios para este atleta.</Text> : null}
      <TextInput accessibilityLabel="Nuevo comentario" value={commentText} onChangeText={setCommentText} placeholder="Escribe un comentario para tu atleta" placeholderTextColor={colors.subtle} multiline style={styles.commentInput} />
      {commentError ? <Text style={styles.warning}>{commentError}</Text> : null}
      <PrimaryButton title={commentBusy ? 'Guardando…' : 'Agregar comentario'} onPress={submitComment} disabled={commentBusy || !commentText.trim()} light />
    </ScrollView>
    <ConfirmDialog visible={archiveTarget !== null} title="Archivar planificación" message={archiveTarget ? `${archiveTarget.label} dejará de aparecer como planificación activa, pero sus entrenamientos realizados seguirán en el historial.` : ''} confirmLabel={archiveBusy ? 'Archivando…' : 'Archivar'} destructive onCancel={() => setArchiveTarget(null)} onConfirm={confirmArchive} />
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  cta: { paddingHorizontal: 20, paddingBottom: 8 },
  section: { color: colors.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  strong: { color: colors.text, fontWeight: '700' },
  dim: { color: colors.dim, fontSize: 12, marginTop: 3 },
  orange: { color: colors.orange, fontSize: 11, fontWeight: '700' },
  exerciseList: { color: colors.subtle, fontSize: 11, marginTop: 6 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  athleteCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  athleteIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  commentText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  commentInput: { marginTop: 4, minHeight: 70, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
  folder: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' },
  folderHeader: { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  folderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  folderTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  folderBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 10, gap: 8 },
  weekFolder: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.background, overflow: 'hidden' },
  weekHeader: { padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 8, gap: 7 },
  dayRow: { minHeight: 52, borderRadius: 9, backgroundColor: colors.surface, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  dayNumber: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  dayNumberText: { color: colors.orange, fontWeight: '800', fontSize: 10 },
  iconButton: { minWidth: 30, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  archived: { opacity: 0.55 },
});
