import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PrEvent } from '@/src/store/AppStore';
import { colors } from '@/src/theme';

export function PrCelebration({ event }: { event: PrEvent | null }) {
  const [displayed, setDisplayed] = useState<PrEvent | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (event) {
      setDisplayed(event);
      progress.value = withTiming(1, { duration: 220 });
    } else if (displayed) {
      progress.value = withTiming(0, { duration: 220 }, finished => {
        if (finished) runOnJS(setDisplayed)(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  if (!displayed) return null;

  const message = displayed.kind === 'weight'
    ? `¡Nuevo récord de peso en ${displayed.exerciseName}!`
    : `¡Nuevo récord de repeticiones en ${displayed.exerciseName}!`;

  return <Animated.View pointerEvents="none" style={[styles.wrap, animatedStyle]}>
    <View style={styles.badge}><Ionicons name="trophy" color={colors.background} size={20} /></View>
    <Text style={styles.text}>{message}</Text>
  </Animated.View>;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    left: 18,
    right: 18,
    zIndex: 50,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  badge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
});
