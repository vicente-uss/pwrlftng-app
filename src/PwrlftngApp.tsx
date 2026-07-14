import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { AppShell } from '@/src/components/ui';
import { Routine, Screen, Tab } from '@/src/domain/types';
import { HistoryScreen, ProfileScreen } from '@/src/screens/HistoryProfileScreens';
import { HomeScreen, LoginScreen } from '@/src/screens/HomeScreens';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { CreateRoutineScreen, RoutineDetailScreen, RoutinesScreen } from '@/src/screens/RoutineScreens';
import { ActiveSessionScreen, SummaryScreen } from '@/src/screens/WorkoutScreens';
import { restoreSession } from '@/src/services/authService';
import { useAppStore } from '@/src/store/AppStore';
import { colors } from '@/src/theme';

export function PwrlftngApp() {
  const store = useAppStore(); const [screen, setScreen] = useState<Screen>('login'); const [tab, setTab] = useState<Tab>('home'); const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null); const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  useEffect(() => { if (store.hydrated && store.activeSession) setScreen('active-session'); }, [store.hydrated, store.activeSession]);
  useEffect(() => { if (!store.hydrated || authChecked) return; restoreSession().then(session => { if (session) setScreen(current => current === 'login' ? 'home' : current); }).finally(() => setAuthChecked(true)); }, [store.hydrated, authChecked]);
  if (!store.hydrated || !authChecked) return <SafeAreaView style={styles.loading} />;
  const goTab = (next: Tab) => { setTab(next); setScreen(next === 'home' ? 'home' : next === 'workout' ? 'routines' : 'profile'); };
  const selectRoutine = (routine: Routine) => { setSelectedRoutineId(routine.id); setScreen('routine-detail'); };
  const start = (routineId?: string) => { store.startWorkout(routineId); setScreen('active-session'); };
  const selectedRoutine = store.routines.find(item => item.id === selectedRoutineId);

  if (screen === 'login') return <LoginScreen onLogin={() => { setScreen('home'); store.syncNow(); }} />;
  if (screen === 'active-session') return <ActiveSessionScreen onCancel={() => goTab('workout')} onFinished={() => setScreen('summary')} />;
  if (screen === 'summary') return <SummaryScreen onDone={() => goTab('home')} />;
  if (screen === 'create-routine') return <SafeAreaView style={styles.page}><CreateRoutineScreen onBack={() => goTab('workout')} onSaved={selectRoutine} /></SafeAreaView>;
  if (screen === 'routine-detail' && selectedRoutine) return <SafeAreaView style={styles.page}><RoutineDetailScreen routine={selectedRoutine} onBack={() => goTab('workout')} onStart={() => start(selectedRoutine.id)} onDeleted={() => goTab('workout')} /></SafeAreaView>;

  return <AppShell tab={tab} onTab={goTab}><View style={styles.body}>
    {screen === 'home' && <HomeScreen onRoutine={selectRoutine} onHistory={() => setScreen('history')} onStart={start} />}
    {screen === 'routines' && <RoutinesScreen onCreate={() => setScreen('create-routine')} onRoutine={selectRoutine} />}
    {screen === 'history' && <HistoryScreen onBack={() => goTab('home')} />}
    {screen === 'profile' && <ProfileScreen onHistory={() => setScreen('history')} />}
  </View></AppShell>;
}

const styles = StyleSheet.create({ loading:{flex:1,backgroundColor:colors.background},page:{flex:1,backgroundColor:colors.background},body:{flex:1} });
