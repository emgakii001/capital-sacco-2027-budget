import { icon } from '../core/icons.js';
import { kes, escapeHtml } from '../core/format.js';
import { isSupabaseConfigured } from '../core/db.js';
import { loadYearData, sumByClass, monthlySeries, branchSeries, accountBudgetVsActual, variancePctLabel } from '../core/aggregates.js';
import { renderBarChart, renderLineChart } from '../components/charts.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pageShell(container, { icoName, title, lead }) {
  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2 style="display:flex;align-items:center;gap:10px">${icon(icoName)}${escapeHtml(title)}</h2><p class="lead">${escapeHtml(lead)}</p></div>
        <div class="ph-status"><span class="pill ${isSupabaseConfigured ? 'pill-ok' : 'pill-warn'}"><span class="dot"></span>${isSupabaseConfigured ? 'Supabase connected' : 'Not yet connected'}</span></div>
      </div>
      <div id="perfBody"><div class="card"><div class="card-body"><div class="state"><div class="state-ico">${icon(icoName)}</div><h3>Loading…</h3></div></div></div></div>
    </div>`;
  return document.getElementById('perfBody');
}

function notConfigured(body) {
  body.innerHTML = `<div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code>.</div></div>`;
}

// ---------------------------------------------------------------------
export async function renderPerformanceOverview(container) {
  const body = pageShell(container, { icoName: 'performance', title: 'Performance Overview', lead: 'How the SACCO is performing against what was budgeted.' });
  if (!isSupabaseConfigured) return notConfigured(body);

  const { error, budgetRows, actualRows, capexRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load data.</strong> ${escapeHtml(error)}</div></div>`; return; }

  const noBudget = (budgetRows || []).length === 0;
  const noActual = (actualRows || []).length === 0;

  function block(label, budget, actual, pctLabel) {
    const variance = actual - budget;
    const pct = budget ? (variance / budget) * 100 : null;
    return `
      <div class="card"><div class="card-head"><h3>${label}</h3></div><div class="card-body">
        <div class="status-list">
          <li><span>Budget</span><span class="pill pill-muted">${kes(budget)}</span></li>
          <li><span>Actual</span><span class="pill ${noActual ? 'pill-muted' : 'pill-teal'}">${noActual ? 'No actual data' : kes(actual)}</span></li>
          <li><span>Variance</span><span class="pill ${noActual ? 'pill-muted' : 'pill-muted'}">${noActual ? '—' : kes(variance)}</span></li>
          ${pctLabel ? `<li><span>${pctLabel}</span><span class="pill pill-muted">${noActual || !budget ? '—' : pct.toFixed(1) + '%'}</span></li>` : ''}
        </div>
      </div></div>`;
  }

  const income = { budget: sumByClass(budgetRows, 'Income'), actual: sumByClass(actualRows, 'Income') };
  const expense = { budget: sumByClass(budgetRows, 'Expense'), actual: sumByClass(actualRows, 'Expense') };
  const capexBudget = (capexRows || []).reduce((s, r) => s + (r.total_cost != null ? Number(r.total_cost) : (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0)), 0);

  body.innerHTML = `
    ${noBudget ? `<div class="banner banner-teal">${icon('spark')}<div>No operating budget has been entered yet — figures below will populate once it is.</div></div>` : ''}
    ${noActual ? `<div class="banner banner-teal">${icon('spark')}<div>No actual data has been entered yet — Actual and Variance will populate once actuals are recorded.</div></div>` : ''}
    <div class="ph-grid">
      ${block('Income', income.budget, income.actual, 'Achievement %')}
      ${block('Expenses', expense.budget, expense.actual, 'Utilization %')}
      ${block('Surplus', income.budget - expense.budget, income.actual - expense.actual, null)}
      <div class="card"><div class="card-head"><h3>CAPEX</h3></div><div class="card-body">
        <div class="status-list">
          <li><span>Budget</span><span class="pill pill-muted">${kes(capexBudget)}</span></li>
          <li><span>Actual</span><span class="pill pill-muted">Not yet connected</span></li>
          <li><span>Utilization</span><span class="pill pill-muted">Not yet connected</span></li>
        </div>
      </div></div>
    </div>
    <p class="ph-note">Variance is shown as a figure only — it is not labelled favourable or unfavourable, since that depends on definitions Capital SACCO hasn't set yet.</p>`;
}

// ---------------------------------------------------------------------
export async function renderBudgetVsActual(container) {
  const body = pageShell(container, { icoName: 'performance', title: 'Budget vs Actual', lead: 'Drill down from Total SACCO to Branch, Account Class, Account and Month.' });
  if (!isSupabaseConfigured) return notConfigured(body);

  const { error, ref, budgetRows, actualRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load data.</strong> ${escapeHtml(error)}</div></div>`; return; }

  let filters = { branchId: '', monthId: '', accountClass: '' };
  function render() {
    const rows = accountBudgetVsActual(budgetRows, actualRows, ref.accounts, filters);
    body.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h3>Budget vs Actual</h3><div class="sub">${rows.length} account${rows.length === 1 ? '' : 's'} with budget and/or actual activity</div></div>
        </div>
        <div class="card-body">
          <div class="filters">
            <select class="select" id="bvaBranch"><option value="">Branch — All</option>${ref.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('')}</select>
            <select class="select" id="bvaClass"><option value="">Account Class — All</option><option value="Income">Income</option><option value="Expense">Expense</option></select>
            <select class="select" id="bvaMonth"><option value="">Month — All</option>${ref.months.map((m) => `<option value="${m.id}">${escapeHtml(m.month_name)}</option>`).join('')}</select>
          </div>
          ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Account</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Variance %</th></tr></thead>
            <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.account.account_code)} — ${escapeHtml(r.account.account_name)}</td><td>${kes(r.budget)}</td><td>${kes(r.actual)}</td><td>${kes(r.variance)}</td><td>${variancePctLabel(r.variancePct)}</td></tr>`).join('')}</tbody></table></div>`
            : `<div class="state"><div class="state-ico">${icon('performance')}</div><h3>No matching records</h3><p>No budget or actual activity for the selected filters.</p></div>`}
        </div>
      </div>`;
    document.getElementById('bvaBranch').addEventListener('change', (e) => { filters = { ...filters, branchId: e.target.value }; render(); });
    document.getElementById('bvaClass').addEventListener('change', (e) => { filters = { ...filters, accountClass: e.target.value }; render(); });
    document.getElementById('bvaMonth').addEventListener('change', (e) => { filters = { ...filters, monthId: e.target.value }; render(); });
  }
  render();
}

// ---------------------------------------------------------------------
export async function renderMonthlyPerformance(container) {
  const body = pageShell(container, { icoName: 'performance', title: 'Monthly Performance', lead: 'Income and Expenses, budget vs actual, January–December.' });
  if (!isSupabaseConfigured) return notConfigured(body);

  const { error, ref, budgetRows, actualRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load data.</strong> ${escapeHtml(error)}</div></div>`; return; }

  let branchId = '';
  const matches = (r) => !branchId || String(r.branch_id) === branchId;

  function render() {
    body.innerHTML = `
      <div class="card">
        <div class="card-head"><div><h3>Monthly Performance</h3></div></div>
        <div class="card-body">
          <div class="filters"><select class="select" id="mpBranch"><option value="">Branch — All</option>${ref.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('')}</select></div>
          <div class="chart-box tall"><canvas id="mpChart"></canvas></div>
        </div>
      </div>`;
    document.getElementById('mpBranch').addEventListener('change', (e) => { branchId = e.target.value; render(); });
    const incomeBudget = monthlySeries(budgetRows, 'Income', matches);
    const expenseBudget = monthlySeries(budgetRows, 'Expense', matches);
    const incomeActual = monthlySeries(actualRows, 'Income', matches);
    const expenseActual = monthlySeries(actualRows, 'Expense', matches);
    renderLineChart('mpChart', MONTH_LABELS, [
      { label: 'Income (Budget)', data: incomeBudget, color: '#0F766E' },
      { label: 'Income (Actual)', data: incomeActual, color: '#6EE7DB' },
      { label: 'Expenses (Budget)', data: expenseBudget, color: '#12355B' },
      { label: 'Expenses (Actual)', data: expenseActual, color: '#94A3B8' },
    ]);
  }
  render();
}

// ---------------------------------------------------------------------
export async function renderBranchPerformance(container) {
  const body = pageShell(container, { icoName: 'branchperf', title: 'Branch Performance', lead: 'Budget vs Actual across all branches.' });
  if (!isSupabaseConfigured) return notConfigured(body);

  const { error, ref, budgetRows, actualRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load data.</strong> ${escapeHtml(error)}</div></div>`; return; }

  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Branch Performance</h3><div class="sub">All ${ref.branches.length} branches</div></div>
      <div class="card-body"><div class="chart-box tall"><canvas id="bpChart"></canvas></div></div>
    </div>`;
  const budget = branchSeries(budgetRows, ref.branches);
  const actual = branchSeries(actualRows, ref.branches);
  renderBarChart('bpChart', budget.map((b) => b.code), [
    { label: 'Budget', data: budget.map((b) => b.value), color: '#0F766E' },
    { label: 'Actual', data: actual.map((b) => b.value), color: '#12355B' },
  ]);
}
