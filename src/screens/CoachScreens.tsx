import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, TopBar, formatDate } from '@/src/components/ui';
import {
  CoachAthlete,
  CoachComment,
  CoachRoutineSummary,
  CoachWorkoutSummary,
  addComment,
  getAthleteRoutines,
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
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus atletas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <View style={styles.fill}>
    <TopBar title="Mis atletas" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={styles.dim}>Cargando atletas…</Text> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {!loading && !error && athletes.length === 0 ? <Card><Text style={styles.dim}>Todavía no tienes atletas vinculados. Comparte tu código de invitación desde tu perfil.</Text></Card> : null}
      {athletes.map(athlete => <Pressable accessibilityRole="button" accessibilityLabel={`Ver atleta ${athlete.email}`} key={athlete.athleteId} onPress={() => onAthlete(athlete.athleteId)} style={styles.athleteCard}>
        <View style={styles.athleteIcon}><Ionicons name="person" color={colors.orange} size={18} /></View>
        <View style={styles.grow}>
          <Text style={styles.strong}>{athlete.email}</Text>
          <Text style={styles.dim}>{athlete.bodyWeight != null ? `${athlete.bodyWeight}kg` : 'Sin peso registrado'} · {athlete.goal ?? 'Sin objetivo definido'}</Text>
        </View>
        <Ionicons name="chevron-forward" color={colors.subtle} size={16} />
      </Pressable>)}
    </ScrollView>
  </View>;
}

export function CoachAthleteDetailScreen({ athleteId, onBack, onNewBlock }: { athleteId: string; onBack(): void; onNewBlock(): void }) {
  const [athlete, setAthlete] = useState<CoachAthlete | null>(null);
  const [routines, setRoutines] = useState<CoachRoutineSummary[]>([]);
  const [workouts, setWorkouts] = useState<CoachWorkoutSummary[]>([]);
  const [comments, setComments] = useState<CoachComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([getMyAthletes(), getAthleteRoutines(athleteId), getAthleteWorkouts(athleteId), getComments(athleteId)])
      .then(([athletes, routineList, workoutList, commentList]) => {
        setAthlete(athletes.find(item => item.athleteId === athleteId) ?? null);
        setRoutines(routineList);
        setWorkouts(workoutList);
        setComments(commentList);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'No pudimos cargar la información del atleta.'))
      .finally(() => setLoading(false));
  }, [athleteId]);

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
    <TopBar title={athlete?.email ?? 'Atleta'} eyebrow={athlete?.goal ?? undefined} onBack={onBack} />
    <View style={styles.cta}><PrimaryButton title="Nuevo bloque" onPress={onNewBlock} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={styles.dim}>Cargando…</Text> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      <Text style={styles.section}>RUTINAS</Text>
      {routines.map(routine => <Card key={routine.id}>
        <Text style={styles.strong}>{routine.name}</Text>
        <Text style={styles.dim}>{routine.exerciseCount} {routine.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · {routine.setCount} series</Text>
      </Card>)}
      {!loading && routines.length === 0 ? <Card><Text style={styles.dim}>Este atleta no tiene rutinas todavía.</Text></Card> : null}

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
});
