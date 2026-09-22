// Thin wrapper around the Supabase JS client (loaded from CDN as window.supabase).
// Only the public/publishable key is ever used here — see config.js.
const cfg = window.APP_CONFIG || {};

const isConfigured =
  !!cfg.SUPABASE_URL &&
  !!cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes('YOUR_SUPABASE') &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE');

let client = null;
if (isConfigured && window.supabase?.createClient) {
  client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export const supabase = client;
export const isSupabaseConfigured = isConfigured;
export const BUDGET_YEAR = cfg.BUDGET_YEAR || 2027;
