// Real data loader for the Dashboard — Supabase only, no fallbacks.
//
// Operating Budget is the main consolidated budget:
//   Total Income   = SUM of the COA "Total Income" record across all branches
//   Total Expenses = SUM of the COA "Total Expenses" record across all branches
// Detail and sub-total rows are never added together (that would double-count
// the hierarchical Chart of Accounts). Account ids are resolved from the live
// `accounts` table — see core/coa.js. Branch "actual" figures come from the
// actuals table, never from operating_budget.
import { loadRefData, listRows, safeNum } from '../core/db.js';
import { isSupabaseConfigured } from '../core/supabase-client.js';
import { resolveCoaTotals, missingTotalsMessage, coaHeadline, monthlyAccount, sumAccount } from '../core/coa.js';

export { MONTHS } from './branches.js';

const empty = () => ({
  totalIncome: null, totalExpense: null, surplus: null, surplusNote: null, capex: null,
  status: null, monthlyIncome: null, monthlyExpense: null, branches: null,
  error: null,
});

export async function loadDashboardData() {
  if (!isSupabaseConfigured) return empty();
  const result = empty();

  try {
    const ref = await loadRefData();
    if (!ref.year) { result.status = 'Not found'; return result; }
    result.status = `${ref.year.year} — ${ref.year.status}`;

    const totals = resolveCoaTotals(ref);

    const [budgetRes, capexRes, actualsRes] = await Promise.all([
      listRows('operating_budget', {
        select: 'budget_amount, branch_id, account_id, month_id, months(month_number)',
        filters: [['budget_year_id', 'eq', ref.year.id]],
      }),
      listRows('capex_budget', {
        select: 'quantity, unit_cost, total_cost',
        filters: [['budget_year_id', 'eq', ref.year.id]],
      }),
      listRows('actuals', {
        select: 'actual_amount, branch_id, account_id',
        filters: [['budget_year_id', 'eq', ref.year.id]],
      }),
    ]);
    const queryError = budgetRes.error || capexRes.error || actualsRes.error;
    if (queryError) { result.error = queryError.message; return result; }
    const totalsError = missingTotalsMessage(totals);
    if (totalsError) { result.error = totalsError; return result; }

    const budgetRows = budgetRes.data || [];
    const capexRows = capexRes.data || [];
    const actualRows = actualsRes.data || [];

    const head = coaHeadline(budgetRows, totals);
    result.totalIncome = head.income;
    result.totalExpense = head.expense;
    result.surplus = head.surplus;
    result.surplusNote = head.surplusFromCoa
      ? `COA ${totals.surplus.account_code} — ${totals.surplus.account_name}`
      : 'Total Income − Total Expenses';
    result.monthlyIncome = monthlyAccount(budgetRows, totals.income);
    result.monthlyExpense = monthlyAccount(budgetRows, totals.expenses);
    result.capex = capexRows.reduce((sum, r) => sum + (r.total_cost != null ? safeNum(r.total_cost) : safeNum(r.quantity) * safeNum(r.unit_cost)), 0);
    result.hasBudgetRows = budgetRows.length > 0;
    result.hasCapexRows = capexRows.length > 0;
    result.hasActualsRows = actualRows.length > 0;

    result.branches = ref.branches
      .slice()
      .sort((a, b) => String(a.branch_code).localeCompare(String(b.branch_code)))
      .map((b) => {
        const mine = (r) => String(r.branch_id) === String(b.id);
        const hasActual = actualRows.some((r) => mine(r) && String(r.account_id) === String(totals.income.id));
        return {
          code: b.branch_code,
          name: b.branch_name,
          budget: sumAccount(budgetRows, totals.income, mine),
          // null (not 0) when the branch has no actual income record, so the UI
          // can say "No actual data" rather than implying KES 0 was recorded.
          actual: hasActual ? sumAccount(actualRows, totals.income, mine) : null,
        };
      });

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}
