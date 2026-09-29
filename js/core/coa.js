// Chart-of-Accounts helpers shared by every calculation in the app.
//
// The COA in Supabase is hierarchical: detail accounts, sub-totals (e.g.
// 101099 Total Interest Income) and grand totals (110999 Total Income,
// 209000 Total Expenses). Summing every row would double-count, so
// consolidated figures are the SUM of the designated COA *total* account
// across the selected branches/months — nothing else is calculated.
//
// Nothing here knows an account id. Total accounts are resolved from the
// live `accounts` table, by code, at run time.
import { safeNum } from './db.js';

// account_class in the database is "Income" / "Expenses". Match on the stem so
// the app is never tied to a singular/plural spelling.
export function classKey(cls) {
  const c = String(cls ?? '').trim().toLowerCase();
  if (c.startsWith('income')) return 'income';
  if (c.startsWith('expense')) return 'expense';
  return c || 'other';
}

// Distinct classes actually present in the accounts table, for filter dropdowns.
export function classOptions(accounts) {
  const seen = new Map();
  (accounts || []).forEach((a) => { const k = classKey(a.account_class); if (!seen.has(k)) seen.set(k, a.account_class); });
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}

function cfgCodes() { return (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.COA_TOTALS) || {}; }

function byCode(accounts, code) {
  if (!code) return null;
  const norm = String(code).trim().toUpperCase();
  return accounts.find((a) => String(a.account_code).trim().toUpperCase() === norm) || null;
}
function byName(accounts, re, cls) {
  return accounts.find((a) => re.test(String(a.account_name).trim()) && (!cls || classKey(a.account_class) === cls)) || null;
}

// Returns { income, expenses, surplus } (each an accounts row or null) and
// `missing`, the list of totals that could not be resolved.
// Codes come from window.APP_CONFIG.COA_TOTALS in config.js; when a code is not
// configured, the total is found by its account name instead.
export function resolveCoaTotals(ref) {
  const accounts = ref.accounts || [];
  const codes = cfgCodes();
  const income = byCode(accounts, codes.income) || byName(accounts, /^total income$/i, 'income');
  const expenses = byCode(accounts, codes.expenses) || byName(accounts, /^total expenses?$/i, 'expense');
  const surplus = byCode(accounts, codes.surplus) || byName(accounts, /(ytd )?profit\s*\/?\s*loss/i);
  const missing = [];
  if (!income) missing.push('Total Income');
  if (!expenses) missing.push('Total Expenses');
  return { income, expenses, surplus, missing };
}

// Sum of one COA account's rows (budget_amount or actual_amount) with an
// optional row filter (branch / month).
export function sumAccount(rows, account, filterFn) {
  if (!account) return 0;
  return (rows || []).filter((r) => String(r.account_id) === String(account.id)).filter(filterFn || (() => true))
    .reduce((s, r) => s + safeNum(r.budget_amount ?? r.actual_amount), 0);
}

export function hasAccountRows(rows, account) {
  return !!account && (rows || []).some((r) => String(r.account_id) === String(account.id));
}

export function monthlyAccount(rows, account, filterFn) {
  const out = Array(12).fill(0);
  if (!account) return out;
  (rows || []).filter((r) => String(r.account_id) === String(account.id)).filter(filterFn || (() => true)).forEach((r) => {
    const idx = (r.months?.month_number || 1) - 1;
    if (idx >= 0 && idx < 12) out[idx] += safeNum(r.budget_amount ?? r.actual_amount);
  });
  return out;
}

// Headline figures for a set of rows: Total Income, Total Expenses, Surplus.
// Surplus is the COA's own profit/loss total when the data holds it,
// otherwise Total Income − Total Expenses (the stated business rule).
export function coaHeadline(rows, totals, filterFn) {
  const income = sumAccount(rows, totals.income, filterFn);
  const expense = sumAccount(rows, totals.expenses, filterFn);
  const surplusFromCoa = hasAccountRows(rows, totals.surplus);
  const surplus = surplusFromCoa ? sumAccount(rows, totals.surplus, filterFn) : income - expense;
  return { income, expense, surplus, surplusFromCoa };
}

export function missingTotalsMessage(totals) {
  return totals.missing.length
    ? `The Chart of Accounts total account(s) for ${totals.missing.join(' and ')} could not be found in the accounts table. Check COA_TOTALS in config.js.`
    : null;
}
