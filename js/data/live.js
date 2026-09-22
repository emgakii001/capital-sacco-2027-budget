// Real data loader. Reads only from the existing Supabase tables/columns —
// never renames, duplicates, or invents relationships that aren't there.
import { supabase, isSupabaseConfigured, BUDGET_YEAR } from '../core/supabase-client.js';
import { MONTHS } from './branches.js';

const empty = () => ({
  totalIncome: null, totalExpense: null, surplus: null, capex: null,
  status: null, monthlyIncome: null, monthlyExpense: null, branches: null,
  error: null,
});

export async function loadDashboardData() {
  if (!isSupabaseConfigured) return empty();
  const result = empty();

  try {
    const { data: yearRow } = await supabase
      .from('budget_years').select('id, year, status').eq('year', BUDGET_YEAR).maybeSingle();

    if (!yearRow) { result.status = 'Not found'; return result; }
    result.status = `${yearRow.year} — ${yearRow.status}`;

    const [{ data: budgetRows, error: bErr }, { data: capexRows, error: cErr }, { data: branchRows }] = await Promise.all([
      supabase.from('operating_budget')
        .select('budget_amount, month_id, months(month_number), accounts(account_class)')
        .eq('budget_year_id', yearRow.id),
      supabase.from('capex_budget').select('quantity, unit_cost, total_cost').eq('budget_year_id', yearRow.id),
      supabase.from('branches').select('id, branch_code, branch_name'),
    ]);
    if (bErr || cErr) { result.error = (bErr || cErr).message; return result; }

    const monthlyIncome = Array(12).fill(0);
    const monthlyExpense = Array(12).fill(0);
    let totalIncome = 0, totalExpense = 0;
    (budgetRows || []).forEach((r) => {
      const idx = (r.months?.month_number || 1) - 1;
      const amt = Number(r.budget_amount) || 0;
      if (r.accounts?.account_class === 'Income') { totalIncome += amt; if (idx >= 0 && idx < 12) monthlyIncome[idx] += amt; }
      else if (r.accounts?.account_class === 'Expense') { totalExpense += amt; if (idx >= 0 && idx < 12) monthlyExpense[idx] += amt; }
    });

    const capex = (capexRows || []).reduce((sum, r) => sum + (r.total_cost != null ? Number(r.total_cost) : (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0)), 0);

    result.totalIncome = totalIncome;
    result.totalExpense = totalExpense;
    result.surplus = totalIncome - totalExpense;
    result.capex = capex;
    result.monthlyIncome = monthlyIncome;
    result.monthlyExpense = monthlyExpense;
    result.hasBudgetRows = (budgetRows || []).length > 0;
    result.hasCapexRows = (capexRows || []).length > 0;

    if (branchRows?.length) {
      const { data: actualRows } = await supabase
        .from('operating_budget')
        .select('budget_amount, branch_id')
        .eq('budget_year_id', yearRow.id);
      const byBranch = {};
      (actualRows || []).forEach((r) => { byBranch[r.branch_id] = (byBranch[r.branch_id] || 0) + (Number(r.budget_amount) || 0); });
      result.branches = branchRows
        .sort((a, b) => a.branch_code.localeCompare(b.branch_code))
        .map((b) => ({ code: b.branch_code, name: b.branch_name, budget: byBranch[b.id] || 0, actual: null }));
    }

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

export { MONTHS };
