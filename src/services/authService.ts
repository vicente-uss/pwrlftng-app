import { supabase } from '@/src/lib/supabase';

export async function restoreSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase aún no está configurado.');
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
