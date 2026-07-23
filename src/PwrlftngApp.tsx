import { useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from '@/src/components/ui';
import { ActivationEditorScreen, ActivationViewerScreen } from '@/src/screens/ActivationScreens';
import { Exercise, Routine, Screen, Tab, WorkoutHistory } from '@/src/domain/types';
import { CoachBlockEditorScreen } from '@/src/screens/CoachBlockEditorScreen';
import { CoachDashboardScreen } from '@/src/screens/CoachDashboardScreen';
import {
  CoachExcelImportScreen,
  CoachMacrocycleEditorScreen,
  CoachProgramAssignScreen,
  CoachProgramUpdateScreen,
} from '@/src/screens/CoachProgramFlowScreens';
import { CoachAthleteDetailScreen, CoachAthletesScreen } from '@/src/screens/CoachScreens';
import { ExerciseDetailScreen, ExerciseLibraryScreen } from '@/src/screens/ExerciseLibraryScreen';
import { HistoryScreen, ProfileScreen, SessionDetailScreen } from '@/src/screens/HistoryProfileScreens';
import { AccountTypeScreen, LoginScreen, TrainingScreen } from '@/src/screens/HomeScreens';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { popScreen, pushScreen, replaceScreen, resetScreen, screenForTab, tabForScreen } from '@/src/navigation/navigationState';
import { CreateRoutineScreen, RoutineDetailScreen } from '@/src/screens/RoutineScreens';
import { ActiveSessionScreen, SummaryScreen } from '@/src/screens/WorkoutScreens';
import { restoreSession, signOut } from '@/src/services/authService';
import { getLatestRoutine } from '@/src/services/athleteBlockService';
import {
  CoachProgramKind,
  beginAssignedProgramSession,
  finishAssignedProgramSession,
} from '@/src/services/coachProgramService';
import { BlockDraftInfo, BlockDraftWeek } from '@/src/services/coachService';
import { ActivationResource } from '@/src/services/activationService';
import { useAppStore } from '@/src/store/AppStore';
import { colors } from '@/src/theme';

type AuthMode = 'account' | 'demo' | null;

export function PwrlftngApp() {
  const store = useAppStore();
  const [routes, setRoutes] = useState<Screen[]>(['login']);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedProgramKind, setSelectedProgramKind] = useState<CoachProgramKind>('mesocycle');
  const [selectedMacrocycleId, setSelectedMacrocycleId] = useState<string | null>(null);
  const [selectedActivationProgramId, setSelectedActivationProgramId] = useState<string | null>(null);
  const [selectedActivationBlockId, setSelectedActivationBlockId] = useState<string | null>(null);
  const [importedProgramDraft, setImportedProgramDraft] = useState<{ info: BlockDraftInfo; weeks: BlockDraftWeek[]; activation: ActivationResource | null } | null>(null);
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
    if ((screen === 'routine-detail' || screen === 'edit-routine') && !store.routines.some(routine => routine.id === selectedRoutineId)) {
      setRoutes(resetScreen('training'));
    }
  }, [screen, selectedRoutineId, store.routines]);

  useEffect(() => {
    if (screen === 'exercise-detail' && !store.exercises.some(exercise => exercise.id === selectedExerciseId)) {
      setRoutes(resetScreen('profile'));
    }
  }, [screen, selectedExerciseId, store.exercises]);

  useEffect(() => {
    if (screen === 'session-detail' && !store.history.some(session => session.id === selectedSessionId)) {
      setRoutes(resetScreen('history'));
    }
  }, [screen, selectedSessionId, store.history]);

  useEffect(() => {
    if ((screen === 'coach-athlete-detail' || screen === 'coach-block-editor') && !selectedAthleteId) {
      setRoutes(resetScreen('profile'));
    }
  }, [screen, selectedAthleteId]);

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
  const start = async (routineId?: string, context?: { blockId?: string | null; blockWeekId?: string | null }) => {
    let sessionId: string | null = null;
    if (routineId && context?.blockWeekId && authMode === 'account') {
      try {
        const latest = await getLatestRoutine(routineId);
        sessionId = store.startWorkoutFromRoutine(latest, context).id;
      } catch {
        sessionId = store.startWorkout(routineId).id;
      }
    } else {
      sessionId = store.startWorkout(routineId).id;
    }
    if (sessionId && routineId && context?.blockWeekId && authMode === 'account') {
      beginAssignedProgramSession(sessionId, routineId).catch(() => undefined);
    }
    navigate('active-session');
  };
  const selectedRoutine = store.routines.find(item => item.id === selectedRoutineId);
  const selectExercise = (exercise: Exercise) => {
    setSelectedExerciseId(exercise.id);
    navigate('exercise-detail');
  };
  const selectedExercise = store.exercises.find(item => item.id === selectedExerciseId);
  const selectExerciseById = (exerciseId: string) => {
    const exercise = store.exercises.find(item => item.id === exerciseId);
    if (exercise) selectExercise(exercise);
  };
  const selectSession = (session: WorkoutHistory) => {
    setSelectedSessionId(session.id);
    navigate('session-detail');
  };
  const selectedSession = store.history.find(item => item.id === selectedSessionId);
  const selectAthlete = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    navigate('coach-athlete-detail');
  };

  const handleSignOut = async () => {
    if (authMode === 'account') {
      await store.syncNow();
      await signOut();
    }
    store.resetAfterSignOut();
    setSelectedRoutineId(null);
    setSelectedExerciseId(null);
    setSelectedSessionId(null);
    setSelectedAthleteId(null);
    setSelectedBlockId(null);
    setSelectedProgramId(null);
    setSelectedMacrocycleId(null);
    setSelectedActivationProgramId(null);
    setSelectedActivationBlockId(null);
    setImportedProgramDraft(null);
    setAuthMode(null);
    reset('login');
  };

  if (screen === 'login') return <LoginScreen onLogin={async () => {
    await initializeCloudSync();
    setAuthMode('account');
    reset(activeSession ? 'active-session' : 'training');
  }} onSignedUp={async () => {
    await initializeCloudSync();
    setAuthMode('account');
    reset('account-type');
  }} onDemo={() => {
    setAuthMode('demo');
    reset(activeSession ? 'active-session' : 'training');
  }} />;

  if (screen === 'account-type') return <AccountTypeScreen onDone={() => reset('training')} />;
  if (screen === 'active-session') return <ActiveSessionScreen onCancel={() => {
    if (activeSession?.id && authMode === 'account') finishAssignedProgramSession(activeSession.id).catch(() => undefined);
    reset('training');
  }} onFinished={() => {
    if (activeSession?.id && authMode === 'account') finishAssignedProgramSession(activeSession.id).catch(() => undefined);
    replace('summary');
  }} />;
  if (screen === 'summary') return <SummaryScreen onDone={() => reset('training')} />;
  if (screen === 'create-routine') return <SafeAreaView style={styles.page}><CreateRoutineScreen onBack={goBack} onSaved={routine => {
    setSelectedRoutineId(routine.id);
    replace('routine-detail');
  }} /></SafeAreaView>;
  if (screen === 'edit-routine' && selectedRoutine) return <SafeAreaView style={styles.page}><CreateRoutineScreen editingRoutine={selectedRoutine} onBack={goBack} onSaved={routine => {
    setSelectedRoutineId(routine.id);
    replace('routine-detail');
  }} /></SafeAreaView>;
  if (screen === 'routine-detail' && selectedRoutine) return <SafeAreaView style={styles.page}><RoutineDetailScreen routine={selectedRoutine} onBack={goBack} onStart={() => start(selectedRoutine.id)} onDeleted={() => reset('training')} onEdit={() => navigate('edit-routine')} /></SafeAreaView>;
  if (screen === 'exercise-library') return <SafeAreaView style={styles.page}><ExerciseLibraryScreen onBack={goBack} onExercise={selectExercise} /></SafeAreaView>;
  if (screen === 'exercise-detail' && selectedExercise) return <SafeAreaView style={styles.page}><ExerciseDetailScreen exercise={selectedExercise} onBack={goBack} /></SafeAreaView>;
  if (screen === 'session-detail' && selectedSession) return <SafeAreaView style={styles.page}><SessionDetailScreen session={selectedSession} onBack={goBack} onExercise={selectExerciseById} /></SafeAreaView>;
  if (screen === 'coach-athletes') return <SafeAreaView style={styles.page}><CoachAthletesScreen onBack={goBack} onAthlete={selectAthlete} /></SafeAreaView>;
  if (screen === 'coach-dashboard') return <SafeAreaView style={styles.page}><CoachDashboardScreen
    onBack={goBack}
    onAthlete={selectAthlete}
    onCreateProgram={kind => {
      setSelectedProgramId(null);
      setSelectedProgramKind(kind);
      setImportedProgramDraft(null);
      navigate('coach-program-editor');
    }}
    onImport={() => {
      setImportedProgramDraft(null);
      navigate('coach-program-import');
    }}
    onEditProgram={(programId, kind) => {
      setSelectedProgramId(programId);
      setSelectedProgramKind(kind);
      setImportedProgramDraft(null);
      navigate('coach-program-editor');
    }}
    onAssign={programId => {
      setSelectedProgramId(programId);
      navigate('coach-program-assign');
    }}
    onUpdate={programId => {
      setSelectedProgramId(programId);
      navigate('coach-program-update');
    }}
    onActivation={programId => {
      setSelectedActivationProgramId(programId);
      setSelectedActivationBlockId(null);
      navigate('coach-activation-editor');
    }}
    onMacrocycle={macrocycleId => {
      setSelectedMacrocycleId(macrocycleId ?? null);
      navigate('coach-macrocycle-editor');
    }}
  /></SafeAreaView>;
  if (screen === 'coach-athlete-detail' && selectedAthleteId) return <SafeAreaView style={styles.page}><CoachAthleteDetailScreen athleteId={selectedAthleteId} onBack={goBack} onNewBlock={() => { setSelectedBlockId(null); navigate('coach-block-editor'); }} onEditBlock={blockId => { setSelectedBlockId(blockId); navigate('coach-block-editor'); }} onActivation={blockId => { setSelectedActivationProgramId(null); setSelectedActivationBlockId(blockId); navigate('coach-activation-editor'); }} /></SafeAreaView>;
  if (screen === 'coach-block-editor' && selectedAthleteId) return <SafeAreaView style={styles.page}><CoachBlockEditorScreen athleteId={selectedAthleteId} blockId={selectedBlockId} onBack={goBack} onSaved={() => replace('coach-athlete-detail')} /></SafeAreaView>;
  if (screen === 'coach-program-import') return <SafeAreaView style={styles.page}><CoachExcelImportScreen onBack={goBack} onUseDraft={draft => {
    setImportedProgramDraft(draft);
    setSelectedProgramId(null);
    setSelectedProgramKind('mesocycle');
    replace('coach-program-editor');
  }} /></SafeAreaView>;
  if (screen === 'coach-program-editor') return <SafeAreaView style={styles.page}><CoachBlockEditorScreen
    programId={selectedProgramId}
    programKind={selectedProgramKind}
    initialDraft={importedProgramDraft ? { info: importedProgramDraft.info, weeks: importedProgramDraft.weeks } : null}
    initialActivation={importedProgramDraft?.activation ?? null}
    onBack={goBack}
    onSaved={() => {
      setImportedProgramDraft(null);
      goBack();
    }}
  /></SafeAreaView>;
  if (screen === 'coach-program-assign' && selectedProgramId) return <SafeAreaView style={styles.page}><CoachProgramAssignScreen programId={selectedProgramId} onBack={goBack} onDone={goBack} /></SafeAreaView>;
  if (screen === 'coach-program-update' && selectedProgramId) return <SafeAreaView style={styles.page}><CoachProgramUpdateScreen programId={selectedProgramId} onBack={goBack} onDone={goBack} /></SafeAreaView>;
  if (screen === 'coach-macrocycle-editor') return <SafeAreaView style={styles.page}><CoachMacrocycleEditorScreen macrocycleId={selectedMacrocycleId} onBack={goBack} onSaved={goBack} /></SafeAreaView>;
  if (screen === 'coach-activation-editor' && (selectedActivationProgramId || selectedActivationBlockId)) return <SafeAreaView style={styles.page}><ActivationEditorScreen programId={selectedActivationProgramId ?? undefined} blockId={selectedActivationBlockId ?? undefined} onBack={goBack} /></SafeAreaView>;
  if (screen === 'activation-viewer' && selectedActivationBlockId) return <SafeAreaView style={styles.page}><ActivationViewerScreen blockId={selectedActivationBlockId} onBack={goBack} /></SafeAreaView>;

  const tab = tabForScreen(screen);
  return <AppShell tab={tab} onTab={goTab}><View style={styles.body}>
    {screen === 'training' ? <TrainingScreen onCreate={() => navigate('create-routine')} onRoutine={selectRoutine} onHistory={() => goTab('history')} onStart={start} onActivation={blockId => { setSelectedActivationBlockId(blockId); setSelectedActivationProgramId(null); navigate('activation-viewer'); }} /> : null}
    {screen === 'history' ? <HistoryScreen onSession={selectSession} onExercise={selectExerciseById} onActivation={blockId => { setSelectedActivationBlockId(blockId); setSelectedActivationProgramId(null); navigate('activation-viewer'); }} /> : null}
    {screen === 'profile' ? <ProfileScreen onSignOut={handleSignOut} onExercises={() => navigate('exercise-library')} onAthletes={() => navigate('coach-dashboard')} onAccountType={() => reset('account-type')} /> : null}
  </View></AppShell>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
});
