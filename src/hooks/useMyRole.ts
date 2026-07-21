import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { MyRoleInfo, getMyRole } from '@/src/services/coachService';

export function useMyRole() {
  const [role, setRole] = useState<MyRoleInfo | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    try {
      setRole(await getMyRole());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cargar tu información de coach.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return { role, loading, error, refresh };
}
