import { StyleSheet, Text } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, spacing } from '@/theme/colors';

export default function ProfileScreen() {
  return (
    <AppScreen>
      <SectionHeader
        eyebrow="Atleta demo"
        title="Perfil"
        subtitle="Configuración inicial. Luego será editable y se vinculará a la cuenta real."
      />

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Datos físicos</Text>
        <Text style={styles.item}>Peso corporal: pendiente</Text>
        <Text style={styles.item}>Altura: pendiente</Text>
        <Text style={styles.item}>Nivel: powerlifting inicial/intermedio</Text>
        <Text style={styles.item}>Objetivo: progresar con datos</Text>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Configuración de entrenamiento</Text>
        <Text style={styles.item}>Descanso por defecto: 3:00 min</Text>
        <Text style={styles.item}>Unidad de peso: kg</Text>
        <Text style={styles.item}>Modo: oscuro premium</Text>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.cardTitle}>Solicitar ejercicio</Text>
        <Text style={styles.cardText}>En el MVP el usuario no crea ejercicios. Aquí irá el formulario para solicitar nuevos movimientos.</Text>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
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
    lineHeight: 22,
  },
  item: {
    color: colors.muted,
    fontSize: 15,
  },
});
