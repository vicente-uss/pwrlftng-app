import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStoreProvider } from '@/store/AppStore';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppStoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '900' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="routines/index" options={{ title: 'Rutinas' }} />
          <Stack.Screen name="routines/create" options={{ title: 'Crear rutina' }} />
          <Stack.Screen name="routines/[id]" options={{ title: 'Detalle rutina' }} />
          <Stack.Screen name="workout/active" options={{ headerShown: false }} />
          <Stack.Screen name="workout/summary" options={{ title: 'Resumen' }} />
        </Stack>
      </AppStoreProvider>
    </GestureHandlerRootView>
  );
}
