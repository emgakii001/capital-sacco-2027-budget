// Shared financial aggregation helpers, built on top of db.js. Performance,
// Reports, Consolidated Budget and the Dashboard all read through here so
// "Income = SUM operating_budget where account_class = Income" (etc.) is
// defined exactly once.
import { loadRefData, listRows, safeNum, safeDivide } from './db.js';

// Loads operating_budget and actuals for the current year, joined just
// enough to know each row's branch, account, account_class and month.
// Returns null fields (not thrown errors) when a query fails, so pages can
// decide how to degrade.
export async function loadYearData() {
  const ref = await loadRefData();
  if (!ref.year) return { ref, budgetRows: null, actualRows: null, capexRows: null, error: 'Budget year not found' };

  const [budgetRes, actualRes, capexRes] = await Promise.all([
    listRows('operating_budget', {
      select: 'budget_amount, branch_id, account_id, month_id, months(month_number), accounts(account_class)',
      filters: [['budget_year_id', 'eq', ref.year.id]],
    }),
    listRows('actuals', {
      select: 'actual_amount, branch_id, account_id, month_id, months(month_number), accounts(account_class)',
      filters: [['budget_year_id', 'eq', ref.year.id]],
    }),
    listRows('capex_budget', {
      select: 'quantity, unit_cost, total_cost, branch_id, funding_source',
      filters: [['budget_year_id', 'eq', ref.year.id]],
    }),
  ]);
  const error = budgetRes.error || actualRes.error || capexRes.error;
  return {
    ref, error: error ? error.message : null,
    budgetRows: budgetRes.data || [], actualRows: actualRes.data || [], capexRows: capexRes.data || [],
  };
}

function classOf(row) { return row.accounts?.account_class; }
function monthNumOf(row) { return row.months?.month_number; }

export function sumByClass(rows, matchClass, filterFn) {
  return (rows || []).filter((r) => classOf(r) === matchClass).filter(filterFn || (() => true))
    .reduce((s, r) => s + safeNum(r.budget_amount ?? r.actual_amount), 0);
}

export function monthlySeries(rows, matchClass, filterFn) {
  const out = Array(12).fill(0);
  (rows || []).filter((r) => classOf(r) === matchClass).filter(filterFn || (() => true)).forEach((r) => {
    const idx = (monthNumOf(r) || 1) - 1;
    if (idx >= 0 && idx < 12) out[idx] += safeNum(r.budget_amount ?? r.actual_amount);
  });
  return out;
}

export function branchSeries(rows, branches, filterFn) {
  const byBranch = {};
  (rows || []).filter(filterFn || (() => true)).forEach((r) => { byBranch[r.branch_id] = (byBranch[r.branch_id] || 0) + safeNum(r.budget_amount ?? r.actual_amount); });
  return branches.map((b) => ({ code: b.branch_code, name: b.branch_name, value: byBranch[b.id] || 0, hasRows: Object.prototype.hasOwnProperty.call(byBranch, b.id) }));
}

// Account-level Budget vs Actual, with optional branch/month/accountClass
// filters applied to both sides before grouping.
export function accountBudgetVsActual(budgetRows, actualRows, accounts, filters = {}) {
  const matchesFilters = (r) => (!filters.branchId || String(r.branch_id) === String(filters.branchId))
    && (!filters.monthId || String(r.month_id) === String(filters.monthId))
    && (!filters.accountClass || classOf(r) === filters.accountClass)
    && (!filters.accountId || String(r.account_id) === String(filters.accountId));

  const budgetByAccount = {};
  (budgetRows || []).filter(matchesFilters).forEach((r) => { budgetByAccount[r.account_id] = (budgetByAccount[r.account_id] || 0) + safeNum(r.budget_amount); });
  const actualByAccount = {};
  (actualRows || []).filter(matchesFilters).forEach((r) => { actualByAccount[r.account_id] = (actualByAccount[r.account_id] || 0) + safeNum(r.actual_amount); });

  const ids = new Set([...Object.keys(budgetByAccount), ...Object.keys(actualByAccount)]);
  return accounts.filter((a) => ids.has(String(a.id))).map((a) => {
    const budget = budgetByAccount[a.id] || 0;
    const actual = actualByAccount[a.id] || 0;
    const variance = actual - budget;
    const variancePct = safeDivide(variance, budget);
    return { account: a, budget, actual, variance, variancePct };
  });
}

export function variancePctLabel(pct) {
  return pct === null ? '—' : `${(pct * 100).toFixed(1)}%`;
}
