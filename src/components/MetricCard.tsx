import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { Card } from './Card';

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  helper: {
    color: colors.subtle,
    fontSize: 12,
    marginTop: 4,
  },
});
