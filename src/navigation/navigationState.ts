import { Screen, Tab } from '@/src/domain/types';

export function screenForTab(tab: Tab): Screen {
  return tab;
}

export function tabForScreen(screen: Screen): Tab {
  if (screen === 'history' || screen === 'session-detail') return 'history';
  if (screen === 'profile' || screen === 'exercise-library' || screen === 'exercise-detail') return 'profile';
  return 'training';
}

export function pushScreen(stack: Screen[], screen: Screen) {
  return stack.at(-1) === screen ? stack : [...stack, screen];
}

export function replaceScreen(stack: Screen[], screen: Screen) {
  return [...stack.slice(0, -1), screen];
}

export function popScreen(stack: Screen[]) {
  return stack.length > 1 ? stack.slice(0, -1) : stack;
}

export function resetScreen(screen: Screen): Screen[] {
  return [screen];
}
