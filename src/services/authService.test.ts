import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut } from '@/src/services/authService';

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({
  supabase: { auth: { signOut: mocks.signOut } },
}));

describe('authService signOut', () => {
  beforeEach(() => mocks.signOut.mockReset());

  it('cierra solo la sesión de este dispositivo', async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('propaga errores para mantener al usuario dentro de la app', async () => {
    mocks.signOut.mockResolvedValue({ error: new Error('Sin conexión') });
    await expect(signOut()).rejects.toThrow('Sin conexión');
  });
});
