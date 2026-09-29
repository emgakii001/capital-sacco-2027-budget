// Shared financial aggregation helpers, built on top of db.js. Performance,
// Reports, Consolidated Budget and the Dashboard all read through here so the
// consolidation rule is defined exactly once:
//
//   Total Income   = SUM of the COA "Total Income" record across the selected branches/months
//   Total Expenses = SUM of the COA "Total Expenses" record across the selected branches/months
//
// The COA is hierarchical (detail -> sub-total -> total), so detail and
// sub-total rows are never added together. See coa.js for how the total
// accounts are resolved from the live `accounts` table.
import { loadRefData, listRows, safeNum, safeDivide } from './db.js';
import { classKey, resolveCoaTotals, missingTotalsMessage, sumAccount, monthlyAccount } from './coa.js';

// The COA totals resolved by the most recent loadYearData().
let activeTotals = { income: null, expenses: null, surplus: null, missing: ['Total Income', 'Total Expenses'] };
export function getActiveTotals() { return activeTotals; }
function totalAccountFor(cls) {
  const k = classKey(cls);
  return k === 'income' ? activeTotals.income : k === 'expense' ? activeTotals.expenses : null;
}

// Loads operating_budget and actuals for the current year, joined just
// enough to know each row's branch, account, account_class and month.
// Returns null fields (not thrown errors) when a query fails, so pages can
// decide how to degrade.
export async function loadYearData() {
  const ref = await loadRefData();
  if (!ref.year) return { ref, budgetRows: null, actualRows: null, capexRows: null, error: 'Budget year not found' };
  activeTotals = resolveCoaTotals(ref);

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
    ref, totals: activeTotals,
    error: error ? error.message : missingTotalsMessage(activeTotals),
    budgetRows: budgetRes.data || [], actualRows: actualRes.data || [], capexRows: capexRes.data || [],
  };
}

function classOf(row) { return row.accounts?.account_class; }

// Consolidated total for a class ('Income' / 'Expense[s]'): the sum of that
// class's COA total account. Optional filterFn narrows by branch / month.
export function sumByClass(rows, matchClass, filterFn) {
  return sumAccount(rows, totalAccountFor(matchClass), filterFn);
}

export function monthlySeries(rows, matchClass, filterFn) {
  return monthlyAccount(rows, totalAccountFor(matchClass), filterFn);
}

// Per-branch figure for a class (default Income): that branch's own COA total.
export function branchSeries(rows, branches, filterFn, matchClass = 'Income') {
  const acct = totalAccountFor(matchClass);
  const byBranch = {};
  (rows || []).filter((r) => acct && String(r.account_id) === String(acct.id)).filter(filterFn || (() => true))
    .forEach((r) => { byBranch[r.branch_id] = (byBranch[r.branch_id] || 0) + safeNum(r.budget_amount ?? r.actual_amount); });
  return branches.map((b) => ({ code: b.branch_code, name: b.branch_name, value: byBranch[b.id] || 0, hasRows: Object.prototype.hasOwnProperty.call(byBranch, b.id) }));
}

// Account-level Budget vs Actual, with optional branch/month/accountClass
// filters applied to both sides before grouping.
export function accountBudgetVsActual(budgetRows, actualRows, accounts, filters = {}) {
  const matchesFilters = (r) => (!filters.branchId || String(r.branch_id) === String(filters.branchId))
    && (!filters.monthId || String(r.month_id) === String(filters.monthId))
    && (!filters.accountClass || classKey(classOf(r)) === classKey(filters.accountClass))
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
