// Real data loader for the Dashboard.
//
// FIX (see task): branch "actual" figures previously came from
// operating_budget, which is BUDGET data, not actuals. Budget totals per
// branch come from operating_budget; actual totals per branch come from the
// actuals table. They are never the same query.
import { BUDGET_YEAR, loadRefData, listRows, safeNum } from '../core/db.js';
import { isSupabaseConfigured } from '../core/supabase-client.js';

export { MONTHS } from './branches.js';

const empty = () => ({
  totalIncome: null, totalExpense: null, surplus: null, capex: null,
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

    const accountClassById = Object.fromEntries(ref.accounts.map((a) => [a.id, a.account_class]));

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
        select: 'actual_amount, branch_id',
        filters: [['budget_year_id', 'eq', ref.year.id]],
      }),
    ]);
    if (budgetRes.error || capexRes.error) { result.error = (budgetRes.error || capexRes.error).message; return result; }

    const budgetRows = budgetRes.data || [];
    const capexRows = capexRes.data || [];
    const actualRows = actualsRes.data || []; // actuals table may legitimately not exist yet / be empty — that's fine

    const monthlyIncome = Array(12).fill(0);
    const monthlyExpense = Array(12).fill(0);
    let totalIncome = 0, totalExpense = 0;
    const budgetByBranch = {};

    budgetRows.forEach((r) => {
      const idx = (r.months?.month_number || 1) - 1;
      const amt = safeNum(r.budget_amount);
      const cls = accountClassById[r.account_id];
      if (cls === 'Income') { totalIncome += amt; if (idx >= 0 && idx < 12) monthlyIncome[idx] += amt; }
      else if (cls === 'Expense') { totalExpense += amt; if (idx >= 0 && idx < 12) monthlyExpense[idx] += amt; }
      budgetByBranch[r.branch_id] = (budgetByBranch[r.branch_id] || 0) + amt;
    });

    const capex = capexRows.reduce((sum, r) => sum + (r.total_cost != null ? safeNum(r.total_cost) : safeNum(r.quantity) * safeNum(r.unit_cost)), 0);

    const actualByBranch = {};
    actualRows.forEach((r) => { actualByBranch[r.branch_id] = (actualByBranch[r.branch_id] || 0) + safeNum(r.actual_amount); });

    result.totalIncome = totalIncome;
    result.totalExpense = totalExpense;
    result.surplus = totalIncome - totalExpense;
    result.capex = capex;
    result.monthlyIncome = monthlyIncome;
    result.monthlyExpense = monthlyExpense;
    result.hasBudgetRows = budgetRows.length > 0;
    result.hasCapexRows = capexRows.length > 0;
    result.hasActualsRows = actualRows.length > 0;

    result.branches = ref.branches
      .slice()
      .sort((a, b) => String(a.branch_code).localeCompare(String(b.branch_code)))
      .map((b) => ({
        code: b.branch_code,
        name: b.branch_name,
        budget: budgetByBranch[b.id] || 0,
        // null (not 0) when there are genuinely no actuals rows for this branch,
        // so the UI can say "No actual data" rather than implying KES 0 was recorded.
        actual: Object.prototype.hasOwnProperty.call(actualByBranch, b.id) ? actualByBranch[b.id] : null,
      }));

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}
