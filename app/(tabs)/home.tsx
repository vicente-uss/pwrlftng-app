import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppStore } from '@/store/AppStore';
import { colors, spacing } from '@/theme/colors';

export default function HomeScreen() {
  const { routines, sessions } = useAppStore();
  const lastSession = sessions[0];

  return (
    <AppScreen>
      <SectionHeader
        eyebrow="MVP · Demo 1"
        title="Inicio"
        subtitle="Base funcional para validar flujo con atleta y coach."
      />

      <View style={styles.metricsRow}>
        <MetricCard label="Rutinas" value={`${routines.length}/7`} helper="Días activos" />
        <MetricCard label="Sesiones" value={`${sessions.length}`} helper="Guardadas localmente" />
      </View>

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Próxima acción</Text>
        <Text style={styles.cardText}>Crea una rutina o inicia el Día 1 demo para probar el tracking.</Text>
        <Link href="/routines" asChild>
          <AppButton title="Ver rutinas" />
        </Link>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Último entrenamiento</Text>
        {lastSession ? (
          <>
            <Text style={styles.cardText}>{lastSession.name}</Text>
            <Text style={styles.muted}>{lastSession.totalVolumeKg} kg de volumen efectivo</Text>
          </>
        ) : (
          <Text style={styles.cardText}>Aún no hay sesiones terminadas.</Text>
        )}
      </Card>
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
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.subtle,
    fontSize: 13,
  },
});
