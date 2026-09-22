import { supabase, isSupabaseConfigured } from './supabase-client.js';

const DEMO_KEY = 'csb_demo_session';

// Wraps Supabase Auth. When Supabase isn't configured yet (config.js still has
// placeholders), auth falls back to a local-only "demo session" so the app
// remains fully navigable for a walkthrough — this never touches real data.
export const auth = {
  isLive: isSupabaseConfigured,

  async getSession() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
    const raw = sessionStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async signIn(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    }
    // Local walkthrough mode — accepts any non-empty credentials.
    if (!email || !password) throw new Error('Enter your email and password.');
    const session = {
      user: { email, user_metadata: { full_name: email.split('@')[0] } },
      _demo: true,
    };
    sessionStorage.setItem(DEMO_KEY, JSON.stringify(session));
    return session;
  },

  async signOut() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      sessionStorage.removeItem(DEMO_KEY);
    }
  },

  onChange(cb) {
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
      return () => data.subscription.unsubscribe();
    }
    return () => {};
  },
};
