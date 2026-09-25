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
// isSupabaseConfigured reflects whether a client was actually created, not
// just whether config.js has values in it. Guards against a real crash: if
// the Supabase JS library fails to load from its CDN for any reason (slow
// network, ad-blocker, CDN outage) while config.js is filled in correctly,
// `client` stays null — every page must treat that as "not connected" and
// show its normal not-connected state, rather than calling methods on null.
export const isSupabaseConfigured = !!client;
// No BUDGET_YEAR constant here by design — the operative budget year is
// never hard-coded. See js/core/year-context.js, which loads every year
// that exists in budget_years and lets the user pick or add one.
