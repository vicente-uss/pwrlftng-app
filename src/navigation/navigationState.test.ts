import { describe, expect, it } from 'vitest';
import { popScreen, pushScreen, replaceScreen, screenForTab, tabForScreen } from '@/src/navigation/navigationState';

describe('navigation state', () => {
  it('mantiene Entreno como raíz de sus pantallas secundarias', () => {
    expect(tabForScreen('create-routine')).toBe('training');
    expect(screenForTab('history')).toBe('history');
  });

  it('regresa a la pantalla anterior sin cerrar desde una secundaria', () => {
    const stack = pushScreen(['training'], 'routine-detail');
    expect(popScreen(stack)).toEqual(['training']);
  });

  it('sustituye la sesión activa por el resumen al finalizar', () => {
    expect(replaceScreen(['training', 'active-session'], 'summary')).toEqual(['training', 'summary']);
  });
});
