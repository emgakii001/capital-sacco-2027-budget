// Shared Supabase data-access helpers. Every connected page goes through
// here rather than talking to `supabase` directly, so query shape, error
// handling and reference-data caching stay in one place.
//
// This module never renames columns, never invents a relationship that
// isn't in the schema, and never falls back to writing fake/demo rows.

import { supabase, isSupabaseConfigured, BUDGET_YEAR } from './supabase-client.js';

export { isSupabaseConfigured, BUDGET_YEAR };

export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase is not yet connected. Add your project URL and publishable key to config.js.');
    this.name = 'NotConfiguredError';
  }
}

function client() {
  if (!isSupabaseConfigured || !supabase) throw new NotConfiguredError();
  return supabase;
}

// ---------------------------------------------------------------------
// Reference data (branches, accounts, months, the current budget year row)
// Cached per page load — call resetRefCache() after Setup adds a new
// branch/account so the next read picks it up.
// ---------------------------------------------------------------------
let refCache = null;
let refCachePromise = null;

export function resetRefCache() {
  refCache = null;
  refCachePromise = null;
}

export async function loadRefData() {
  if (refCache) return refCache;
  if (refCachePromise) return refCachePromise;

  refCachePromise = (async () => {
    const db = client();
    const [{ data: branches, error: bErr }, { data: accounts, error: aErr }, { data: months, error: mErr }, { data: yearRow, error: yErr }] = await Promise.all([
      db.from('branches').select('id, branch_code, branch_name').order('branch_code'),
      db.from('accounts').select('id, account_code, account_name, account_class').order('account_code'),
      db.from('months').select('id, month_number, month_name, year').order('month_number'),
      db.from('budget_years').select('id, year, status').eq('year', BUDGET_YEAR).maybeSingle(),
    ]);
    const err = bErr || aErr || mErr || yErr;
    if (err) throw err;

    refCache = {
      branches: branches || [],
      accounts: accounts || [],
      months: (months || []).filter((m) => !m.year || m.year === BUDGET_YEAR),
      year: yearRow || null,
    };
    return refCache;
  })();

  try {
    return await refCachePromise;
  } finally {
    refCachePromise = null;
  }
}

export async function loadAllYears() {
  const db = client();
  const { data, error } = await db.from('budget_years').select('id, year, status').order('year', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------
// Foreign-key resolution helpers. Each returns null (not a fabricated id)
// when the value can't be resolved, so callers can reject the row instead
// of inserting a wrong reference.
// ---------------------------------------------------------------------
export function branchIdByCode(ref, code) {
  const norm = String(code ?? '').trim().padStart(2, '0');
  const row = ref.branches.find((b) => String(b.branch_code).trim().padStart(2, '0') === norm);
  return row ? row.id : null;
}

export function accountIdByCode(ref, code) {
  const norm = String(code ?? '').trim().toUpperCase();
  const row = ref.accounts.find((a) => String(a.account_code).trim().toUpperCase() === norm);
  return row ? row.id : null;
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function monthIdByValue(ref, value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  let num = null;
  if (/^\d+$/.test(raw)) num = parseInt(raw, 10);
  else {
    const idx = MONTH_NAMES.findIndex((m) => m === raw || m.startsWith(raw.slice(0, 3)));
    if (idx >= 0) num = idx + 1;
  }
  if (!num || num < 1 || num > 12) return null;
  const row = ref.months.find((m) => m.month_number === num);
  return row ? row.id : null;
}

// ---------------------------------------------------------------------
// Generic list / insert wrappers. Errors are returned, not thrown, so
// pages can render a proper error state instead of a blank screen.
// ---------------------------------------------------------------------
export async function listRows(table, { select = '*', filters = [], order = null, limit = null } = {}) {
  try {
    const db = client();
    let q = db.from(table).select(select);
    filters.forEach(([col, op, val]) => { q = q[op](col, val); });
    if (order) q = q.order(order.column, { ascending: order.ascending !== false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function insertRow(table, payload) {
  try {
    const db = client();
    const { data, error } = await db.from(table).insert(payload).select();
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function insertRows(table, payloads) {
  try {
    const db = client();
    const { data, error } = await db.from(table).insert(payloads).select();
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function deleteRow(table, id) {
  try {
    const db = client();
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) return { error };
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

// ---------------------------------------------------------------------
// Number safety. Never let a bad value become NaN/Infinity in the UI.
// ---------------------------------------------------------------------
export function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function safeDivide(numerator, denominator) {
  const n = safeNum(numerator, null);
  const d = safeNum(denominator, null);
  if (n === null || d === null || d === 0) return null;
  return n / d;
}
