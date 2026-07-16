import { useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from '@/src/components/ui';
import { Routine, Screen, Tab } from '@/src/domain/types';
import { HistoryScreen, ProfileScreen } from '@/src/screens/HistoryProfileScreens';
import { LoginScreen, TrainingScreen } from '@/src/screens/HomeScreens';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { popScreen, pushScreen, replaceScreen, resetScreen, screenForTab, tabForScreen } from '@/src/navigation/navigationState';
import { CreateRoutineScreen, RoutineDetailScreen } from '@/src/screens/RoutineScreens';
import { ActiveSessionScreen, SummaryScreen } from '@/src/screens/WorkoutScreens';
import { restoreSession, signOut } from '@/src/services/authService';
import { useAppStore } from '@/src/store/AppStore';
import { colors } from '@/src/theme';

type AuthMode = 'account' | 'demo' | null;

export function PwrlftngApp() {
  const store = useAppStore();
  const [routes, setRoutes] = useState<Screen[]>(['login']);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const { activeSession, hydrated, initializeCloudSync } = store;
  const screen = routes.at(-1) ?? 'login';

  useEffect(() => {
    if (!hydrated || authChecked) return;
    let active = true;
    restoreSession().then(async session => {
      if (!session) return;
      await initializeCloudSync();
      if (!active) return;
      setAuthMode('account');
      setRoutes(resetScreen(activeSession ? 'active-session' : 'training'));
    }).catch(() => undefined).finally(() => {
      if (active) setAuthChecked(true);
    });
    return () => { active = false; };
  }, [hydrated, initializeCloudSync, authChecked, activeSession]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = routes.at(-1);
      if (current === 'active-session') return true;
      if (routes.length > 1) {
        setRoutes(popScreen(routes));
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [routes]);

  useEffect(() => {
    if (screen === 'routine-detail' && !store.routines.some(routine => routine.id === selectedRoutineId)) {
      setRoutes(resetScreen('training'));
    }
  }, [screen, selectedRoutineId, store.routines]);

  if (!hydrated || !authChecked) return <SafeAreaView style={styles.loading} />;

  const navigate = (next: Screen) => setRoutes(current => pushScreen(current, next));
  const replace = (next: Screen) => setRoutes(current => replaceScreen(current, next));
  const reset = (next: Screen) => setRoutes(resetScreen(next));
  const goBack = () => setRoutes(current => popScreen(current));
  const goTab = (next: Tab) => navigate(screenForTab(next));
  const selectRoutine = (routine: Routine) => {
    setSelectedRoutineId(routine.id);
    navigate('routine-detail');
  };
  const start = (routineId?: string) => {
    store.startWorkout(routineId);
    navigate('active-session');
  };
  const selectedRoutine = store.routines.find(item => item.id === selectedRoutineId);

  const handleSignOut = async () => {
    if (authMode === 'account') {
      await store.syncNow();
      await signOut();
    }
    store.resetAfterSignOut();
    setSelectedRoutineId(null);
    setAuthMode(null);
    reset('login');
  };

  if (screen === 'login') return <LoginScreen onLogin={async () => {
    await initializeCloudSync();
    setAuthMode('account');
    reset(activeSession ? 'active-session' : 'training');
  }} onDemo={() => {
    setAuthMode('demo');
    reset(activeSession ? 'active-session' : 'training');
  }} />;

  if (screen === 'active-session') return <ActiveSessionScreen onCancel={() => reset('training')} onFinished={() => replace('summary')} />;
  if (screen === 'summary') return <SummaryScreen onDone={() => reset('training')} />;
  if (screen === 'create-routine') return <SafeAreaView style={styles.page}><CreateRoutineScreen onBack={goBack} onSaved={routine => {
    setSelectedRoutineId(routine.id);
    replace('routine-detail');
  }} /></SafeAreaView>;
  if (screen === 'routine-detail' && selectedRoutine) return <SafeAreaView style={styles.page}><RoutineDetailScreen routine={selectedRoutine} onBack={goBack} onStart={() => start(selectedRoutine.id)} onDeleted={() => reset('training')} /></SafeAreaView>;

  const tab = tabForScreen(screen);
  return <AppShell tab={tab} onTab={goTab}><View style={styles.body}>
    {screen === 'training' ? <TrainingScreen onCreate={() => navigate('create-routine')} onRoutine={selectRoutine} onHistory={() => goTab('history')} onStart={start} /> : null}
    {screen === 'history' ? <HistoryScreen /> : null}
    {screen === 'profile' ? <ProfileScreen onSignOut={handleSignOut} /> : null}
  </View></AppShell>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
});
