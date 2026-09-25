// Single source of truth for "which budget year is the app currently
// working in". Nothing in the app hard-codes a year — every page reads the
// selected year from here, and everything (Dashboard, Budget modules,
// Actuals, Performance, Reports, Add New, Excel uploads) filters and
// inserts using this year's database id.
//
// budget_years.year is stored as text in the schema, so comparisons here
// are string-based; sorting "most recent" parses it as a number just for
// ordering purposes.
import { supabase, isSupabaseConfigured } from './supabase-client.js';

const STORAGE_KEY = 'csb_selected_year';

let years = [];       // [{id, year, status}, ...]
let selected = null;  // the currently selected row, or null
let ready = false;
const listeners = new Set();

function notify() { listeners.forEach((cb) => cb(selected)); }

// Subscribe to year changes. Returns an unsubscribe function.
export function onYearChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getYears() { return years; }
export function getSelectedYear() { return selected; }
export function getSelectedYearLabel() { return selected ? selected.year : null; }
export function isYearContextReady() { return ready; }

function pickDefault(rows) {
  if (!rows.length) return null;
  // 1. Previously selected year, if it still exists.
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    const match = rows.find((r) => String(r.year) === stored);
    if (match) return match;
  }
  // 2. Otherwise the active/open budget year.
  const openRow = rows.find((r) => /^(open|active)$/i.test(String(r.status || '').trim()));
  if (openRow) return openRow;
  // 3. Otherwise the most recently available year.
  return rows.slice().sort((a, b) => Number(b.year) - Number(a.year))[0];
}

async function fetchYears() {
  if (!isSupabaseConfigured) return { rows: [], error: null };
  const { data, error } = await supabase.from('budget_years').select('id, year, status').order('year', { ascending: false });
  return { rows: error ? [] : (data || []), error: error ? error.message : null };
}

// Call once, early in boot, before rendering anything that shows a year.
export async function initYearContext() {
  const { rows, error } = await fetchYears();
  years = rows;
  selected = pickDefault(years);
  ready = true;
  return { years, selected, error };
}

// Re-reads budget_years from Supabase (e.g. after adding a new year) and
// keeps the current selection if it still exists.
export async function refreshYears() {
  const { rows, error } = await fetchYears();
  years = rows;
  if (selected) {
    const stillThere = years.find((y) => y.id === selected.id);
    selected = stillThere || pickDefault(years);
  } else {
    selected = pickDefault(years);
  }
  notify();
  return { years, error };
}

export function setSelectedYear(row) {
  selected = row || null;
  if (row && typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(row.year));
  notify();
}
