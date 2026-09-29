import { supabase, isSupabaseConfigured } from './supabase-client.js';

// Wraps Supabase Auth. There is no local/demo session: if Supabase is not
// configured, sign-in is refused rather than silently letting anyone in.
export const auth = {
  isLive: isSupabaseConfigured,

  async getSession() {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signIn(email, password) {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add the project URL and publishable key to config.js.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },

  async signOut() {
    if (isSupabaseConfigured) await supabase.auth.signOut();
  },

  onChange(cb) {
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
      return () => data.subscription.unsubscribe();
    }
    return () => {};
  },
};
