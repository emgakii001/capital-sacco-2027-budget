/*
 * Capital SACCO — Budget Management System
 * Public client configuration.
 *
 * 1. In Supabase, open Project Settings → API (or the Connect dialog).
 * 2. Copy the Project URL and the PUBLISHABLE (anon) key into the two fields below.
 *
 * NEVER paste a service-role or secret key here. This file is served to every
 * visitor's browser. Security is enforced by Supabase Auth and Row Level Security.
 *
 * There is no year setting here on purpose — the system is not built for any
 * one budget year. Budget years live in the `budget_years` table and are
 * managed from the year selector in the app header (add, switch, and every
 * page follows whichever year is selected).
 */
window.APP_CONFIG = {
  SUPABASE_URL: "https://yyickwchmnxkybrsxopx.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_pW4h0Vd3UVKKPGQGyjWO-g_6vx3TzEv",

  // Which existing Chart-of-Accounts records are the consolidation totals.
  // These are account CODES (never database ids) and are looked up in the
  // `accounts` table at run time. Consolidated figures are the SUM of these
  // total records across branches — detail/sub-total rows are never added
  // together. Leave a value blank to find that total by its account name.
  COA_TOTALS: {
    income: "110999",    // Total Income
    expenses: "209000",  // Total Expenses
    surplus: "209999"    // Ytd Profit/Loss A/C
  }
};
