import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppStore } from '@/store/AppStore';
import { colors, spacing } from '@/theme/colors';
import { countCompletedSets } from '@/utils/metrics';
import { formatDuration } from '@/utils/time';

export default function WorkoutSummaryScreen() {
  const { lastCompletedSession } = useAppStore();

  if (!lastCompletedSession) {
    return (
      <AppScreen>
        <SectionHeader title="Sin resumen" subtitle="Termina una sesión para ver el resumen." />
        <Link href="/(tabs)/training" asChild>
          <AppButton title="Volver a entrenar" />
        </Link>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SectionHeader
        eyebrow="Entrenamiento guardado"
        title={lastCompletedSession.name}
        subtitle="Resumen básico del MVP. Luego agregaremos historial por ejercicio y PRs reales."
      />

      <View style={styles.metricsRow}>
        <MetricCard label="Duración" value={formatDuration(lastCompletedSession.durationSeconds)} />
        <MetricCard label="Volumen" value={`${lastCompletedSession.totalVolumeKg} kg`} helper="Sin calentamientos" />
      </View>

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Detalle</Text>
        <Text style={styles.cardText}>Series completadas: {countCompletedSets(lastCompletedSession.exercises)}</Text>
        <Text style={styles.cardText}>Ejercicios: {lastCompletedSession.exercises.length}</Text>
        <Text style={styles.cardText}>Estado: guardado local temporal</Text>
      </Card>

      <Link href="/(tabs)/home" asChild>
        <AppButton title="Volver al inicio" />
      </Link>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardGap: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
  },
});
