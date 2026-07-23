import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  aggregateMicrocycles,
  classifyPerformanceTrend,
  normalizeFamilyPerformance,
  SessionExposure,
} from '@/src/domain/performance';
import { MovementFamily } from '@/src/domain/types';
import { colors, condensed } from '@/src/theme';

type FamilyFilter = 'all' | Exclude<MovementFamily, 'other'>;

const FAMILY_OPTIONS: { id: FamilyFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'squat', label: 'Squat' },
  { id: 'bench', label: 'Bench' },
  { id: 'deadlift', label: 'Deadlift' },
];

const TREND_COPY = {
  ascending: ['Tendencia ascendente', 'Los últimos microciclos muestran una evolución superior a +2%.'],
  stable: ['Tendencia estable', 'La variación reciente se mantiene entre −2% y +2%.'],
  descending: ['Tendencia descendente', 'La variación reciente es inferior a −2%.'],
  insufficient: ['Aún sin tendencia', 'Se necesitan al menos 3 microciclos válidos para clasificarla.'],
} as const;

export function PerformanceDashboard({ exposures, loading, error }: {
  exposures: SessionExposure[];
  loading?: boolean;
  error?: string;
}) {
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [mesocycle, setMesocycle] = useState<string>('all');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);

  const mesocycles = useMemo(() => {
    const map = new Map<string, string>();
    exposures.forEach(item => {
      if (item.mesocycleId) map.set(item.mesocycleId, item.mesocycleName);
    });
    return [...map.entries()];
  }, [exposures]);

  const scoped = useMemo(() => exposures.filter(item =>
    (mesocycle === 'all' || item.mesocycleId === mesocycle)
    && (family === 'all' || item.family === family)
  ), [exposures, family, mesocycle]);

  const variants = useMemo(() => {
    const map = new Map<string, string>();
    scoped.forEach(item => map.set(item.exerciseId, item.exerciseName));
    return [...map.entries()];
  }, [scoped]);
  const effectiveSelection = selectedExercises.filter(id => variants.some(([variantId]) => variantId === id));
  const visible = effectiveSelection.length
    ? scoped.filter(item => effectiveSelection.includes(item.exerciseId))
    : scoped;
  const rows = useMemo(() => aggregateMicrocycles(visible), [visible]);
  const trend = classifyPerformanceTrend(rows);
  const [trendTitle, trendDescription] = TREND_COPY[trend];
  const maxE1rm = Math.max(1, ...rows.map(row => row.bestE1rm));
  const selectedFamily = family === 'all' ? null : family;
  const normalized = selectedFamily ? normalizeFamilyPerformance(rows, selectedFamily) : [];

  const toggleExercise = (id: string) => setSelectedExercises(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  if (loading) return <View style={styles.empty}><Text style={styles.dim}>Calculando rendimiento…</Text></View>;
  if (error) return <View style={styles.error}><Ionicons name="alert-circle-outline" color={colors.warning} size={18} /><Text style={styles.errorText}>{error}</Text></View>;
  if (!exposures.length) return <View style={styles.empty}><Ionicons name="analytics-outline" color={colors.dim} size={28} /><Text style={styles.emptyTitle}>Aún no hay estimaciones válidas</Text><Text style={styles.dim}>Se necesitan series de trabajo completadas con kilos, repeticiones y RPE o RIR ejecutado.</Text></View>;

  return <View style={styles.wrap}>
    <Text style={styles.label}>MESOCICLO</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <FilterChip label="Historial completo" active={mesocycle === 'all'} onPress={() => setMesocycle('all')} />
      {mesocycles.map(([id, name]) => <FilterChip key={id} label={name} active={mesocycle === id} onPress={() => setMesocycle(id)} />)}
    </ScrollView>

    <Text style={styles.label}>FAMILIA</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {FAMILY_OPTIONS.map(option => <FilterChip key={option.id} label={option.label} active={family === option.id} onPress={() => { setFamily(option.id); setSelectedExercises([]); }} />)}
    </ScrollView>

    {variants.length > 1 ? <>
      <Text style={styles.label}>VARIANTES · PUEDES COMPARAR VARIAS</Text>
      <View style={styles.variantGrid}>{variants.map(([id, name]) => <FilterChip key={id} label={name} active={!effectiveSelection.length || effectiveSelection.includes(id)} onPress={() => toggleExercise(id)} />)}</View>
    </> : null}

    <View style={styles.trendCard}>
      <View style={[styles.trendIcon, trend === 'ascending' && styles.trendPositive, trend === 'descending' && styles.trendNegative]}>
        <Ionicons name={trend === 'ascending' ? 'trending-up' : trend === 'descending' ? 'trending-down' : 'remove'} color={colors.text} size={20} />
      </View>
      <View style={styles.grow}><Text style={styles.trendTitle}>{trendTitle}</Text><Text style={styles.dim}>{trendDescription}</Text></View>
    </View>

    <View style={styles.chartCard}>
      <View style={styles.between}><View><Text style={styles.chartTitle}>e1RM por microciclo</Text><Text style={styles.dim}>Mejor serie y mediana de los mejores por sesión</Text></View><View style={styles.legend}><Legend color={colors.orange} label="Mejor" /><Legend color="#a5a5a5" label="Mediana" /></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
        {rows.map(row => <View key={`${row.exerciseId}-${row.microcycleId}`} style={styles.barGroup}>
          <View style={styles.barPlot}>
            <View accessibilityLabel={`Mejor ${Math.round(row.bestE1rm)} kilos`} style={[styles.bar, styles.bestBar, { height: Math.max(8, row.bestE1rm / maxE1rm * 116) }]} />
            <View accessibilityLabel={`Mediana ${Math.round(row.medianSessionBestE1rm)} kilos`} style={[styles.bar, styles.medianBar, { height: Math.max(8, row.medianSessionBestE1rm / maxE1rm * 116) }]} />
          </View>
          <Text style={styles.barValue}>{Math.round(row.bestE1rm)}kg</Text>
          <Text numberOfLines={1} style={styles.barLabel}>{row.microcycleName}</Text>
          <Text numberOfLines={1} style={styles.variantLabel}>{row.exerciseName}</Text>
          <Text style={[styles.change, (row.percentChange ?? 0) > 2 && styles.changePositive, (row.percentChange ?? 0) < -2 && styles.changeNegative]}>
            {row.percentChange == null ? 'Base' : `${row.percentChange > 0 ? '+' : ''}${row.percentChange.toFixed(1)}%`}
          </Text>
          {row.confidence === 'low' ? <Text style={styles.lowConfidence}>Confianza baja</Text> : null}
        </View>)}
      </ScrollView>
    </View>

    {selectedFamily && normalized.length ? <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Evolución normalizada · {selectedFamily.toUpperCase()}</Text>
      <Text style={styles.dim}>Cada variante parte en base 100; se combinan porcentajes, nunca kilos entre variantes.</Text>
      <View style={styles.normalizedList}>{normalized.map(point => <View key={point.microcycleId} style={styles.normalizedRow}>
        <Text style={styles.normalizedName}>{point.microcycleName}</Text>
        <View style={styles.normalizedTrack}><View style={[styles.normalizedFill, { width: `${Math.min(100, Math.max(4, point.normalizedIndex / 1.25))}%` }]} /></View>
        <Text style={styles.normalizedValue}>{point.normalizedIndex.toFixed(1)}</Text>
      </View>)}</View>
    </View> : null}

    <Text style={styles.disclaimer}>Estas curvas describen una tendencia del rendimiento registrado; no demuestran por sí solas causalidad del programa.</Text>
  </View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  grow: { flex: 1 },
  label: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 3 },
  chips: { gap: 7 },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 38, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.orange, backgroundColor: '#21130d' },
  chipText: { color: colors.dim, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: colors.text },
  trendCard: { borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  trendIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#3a3a3a', alignItems: 'center', justifyContent: 'center' },
  trendPositive: { backgroundColor: '#1e4a34' },
  trendNegative: { backgroundColor: '#572525' },
  trendTitle: { color: colors.text, fontFamily: condensed, fontSize: 19, fontWeight: '900' },
  dim: { color: colors.dim, fontSize: 11, lineHeight: 16 },
  chartCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, gap: 13 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  chartTitle: { color: colors.text, fontSize: 17, fontWeight: '900', fontFamily: condensed },
  legend: { gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: colors.dim, fontSize: 8 },
  chart: { minHeight: 194, alignItems: 'flex-end', gap: 12, paddingRight: 10 },
  barGroup: { width: 68, alignItems: 'center' },
  barPlot: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 15, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bestBar: { backgroundColor: colors.orange },
  medianBar: { backgroundColor: '#a5a5a5' },
  barValue: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 4 },
  barLabel: { color: colors.dim, fontSize: 8, width: 68, textAlign: 'center' },
  variantLabel: { color: colors.muted, fontSize: 8, width: 68, textAlign: 'center' },
  change: { color: colors.dim, fontSize: 9, fontWeight: '800', marginTop: 2 },
  changePositive: { color: '#66d49a' },
  changeNegative: { color: '#ee8585' },
  lowConfidence: { color: colors.warning, fontSize: 7, marginTop: 2 },
  normalizedList: { gap: 9 },
  normalizedRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  normalizedName: { color: colors.muted, fontSize: 10, width: 70 },
  normalizedTrack: { flex: 1, height: 7, borderRadius: 99, backgroundColor: colors.elevated, overflow: 'hidden' },
  normalizedFill: { height: 7, borderRadius: 99, backgroundColor: colors.orange },
  normalizedValue: { width: 38, color: colors.text, fontSize: 10, fontFamily: 'monospace', textAlign: 'right' },
  disclaimer: { color: colors.subtle, fontSize: 10, lineHeight: 15 },
  empty: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 22 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  error: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#56331c', backgroundColor: '#18100b', borderRadius: 13, padding: 13 },
  errorText: { flex: 1, color: colors.warning, fontSize: 11 },
});
