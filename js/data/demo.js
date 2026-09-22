// Illustrative numbers only — clearly labelled DEMO DATA wherever shown, and
// never written to Supabase. Used purely so the UI can be reviewed before
// real budget figures exist in the database.
import { BRANCHES, MONTHS } from './branches.js';
import { BUDGET_YEAR } from '../core/supabase-client.js';

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function buildDemoDashboard() {
  const rand = seeded(42);
  const monthlyIncome = MONTHS.map((_, i) => Math.round(9_000_000 + rand() * 3_000_000 + i * 120_000));
  const monthlyExpense = MONTHS.map((_, i) => Math.round(6_500_000 + rand() * 2_200_000 + i * 90_000));
  const totalIncome = monthlyIncome.reduce((a, b) => a + b, 0);
  const totalExpense = monthlyExpense.reduce((a, b) => a + b, 0);
  const capex = 42_500_000;

  const branches = BRANCHES.map((b, i) => {
    const budget = Math.round(3_000_000 + rand() * 6_000_000 + (b.code === '00' ? 12_000_000 : 0));
    const actual = Math.round(budget * (0.72 + rand() * 0.34));
    return { ...b, budget, actual };
  });

  return {
    totalIncome, totalExpense, surplus: totalIncome - totalExpense, capex,
    status: `${BUDGET_YEAR} — Open`,
    monthlyIncome, monthlyExpense,
    branches,
  };
}
