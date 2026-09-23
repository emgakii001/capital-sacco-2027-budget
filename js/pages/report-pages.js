import { icon } from '../core/icons.js';
import { kes, escapeHtml } from '../core/format.js';
import { isSupabaseConfigured, listRows, safeNum } from '../core/db.js';
import { loadYearData, sumByClass, branchSeries, accountBudgetVsActual, variancePctLabel } from '../core/aggregates.js';
import { renderBarChart } from '../components/charts.js';
import { downloadCsv } from '../core/csv.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pageShell(container, { icoName, title, lead }) {
  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2 style="display:flex;align-items:center;gap:10px">${icon(icoName)}${escapeHtml(title)}</h2><p class="lead">${escapeHtml(lead)}</p></div>
        <div class="ph-status"><span class="pill ${isSupabaseConfigured ? 'pill-ok' : 'pill-warn'}"><span class="dot"></span>${isSupabaseConfigured ? 'Supabase connected' : 'Not yet connected'}</span></div>
      </div>
      <div id="repBody"><div class="card"><div class="card-body"><div class="state"><div class="state-ico">${icon(icoName)}</div><h3>Loading…</h3></div></div></div></div>
    </div>`;
  return document.getElementById('repBody');
}
function notConfigured(body) {
  body.innerHTML = `<div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code>.</div></div>`;
}
function exportBar(id) {
  return `<div class="action-bar"><button type="button" class="btn btn-secondary btn-sm" id="${id}Csv">${icon('download')}Export CSV</button><button type="button" class="btn btn-secondary btn-sm" id="${id}Print">${icon('view')}Print</button></div>`;
}
function wireExport(id, filename, headers, rows) {
  document.getElementById(`${id}Csv`)?.addEventListener('click', () => downloadCsv(filename, headers, rows));
  document.getElementById(`${id}Print`)?.addEventListener('click', () => window.print());
}

// ---------------------------------------------------------------------
export async function renderReportCentre(container) {
  const body = pageShell(container, { icoName: 'reports', title: 'Report Centre', lead: 'Select a report type to filter, view and export it.' });
  const REPORT_LINKS = [
    ['#/reports/annual', 'Annual Reports', 'Total income, expenses, surplus and CAPEX with account-level detail.'],
    ['#/reports/monthly', 'Monthly Reports', 'Account-by-month budget matrix.'],
    ['#/reports/branch', 'Branch Reports', 'Budget vs actual for a single branch.'],
    ['#/reports/capex', 'CAPEX Reports', 'CAPEX requirement by item, branch and funding source.'],
    ['#/reports/funding', 'Funding Reports', 'Funding requirements, financing and gaps.'],
    ['#/reports/management', 'Management Report', 'A combined management-ready summary.'],
  ];
  body.innerHTML = `<div class="area-grid">${REPORT_LINKS.map(([href, title, desc]) => `
    <div class="card area"><div class="area-head"><span class="area-ico">${icon('reports')}</span><div><h3>${title}</h3><p class="desc">${desc}</p></div></div>
    <div class="area-actions"><a class="btn btn-primary btn-sm" href="${href}">${icon('eye')}Open</a></div></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------------
export async function renderAnnualReport(container) {
  const body = pageShell(container, { icoName: 'reports', title: 'Annual Reports', lead: 'Total Income, Total Expenses, Budgeted Surplus and Total CAPEX for the year, with account-level detail.' });
  if (!isSupabaseConfigured) return notConfigured(body);
  const { error, ref, budgetRows, capexRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>${escapeHtml(error)}</div></div>`; return; }

  const byAccount = {};
  (budgetRows || []).forEach((r) => { byAccount[r.account_id] = (byAccount[r.account_id] || 0) + safeNum(r.budget_amount); });
  const income = sumByClass(budgetRows, 'Income');
  const expense = sumByClass(budgetRows, 'Expense');
  const capex = (capexRows || []).reduce((s, r) => s + (r.total_cost != null ? safeNum(r.total_cost) : safeNum(r.quantity) * safeNum(r.unit_cost)), 0);
  const rows = ref.accounts.filter((a) => byAccount[a.id]).map((a) => ({ a, total: byAccount[a.id] }));

  body.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="stat-top">Total Income</div><div class="stat-value num">${kes(income)}</div></div>
      <div class="stat"><div class="stat-top">Total Expenses</div><div class="stat-value num">${kes(expense)}</div></div>
      <div class="stat is-highlight"><div class="stat-top">Budgeted Surplus</div><div class="stat-value num">${kes(income - expense)}</div></div>
      <div class="stat"><div class="stat-top">Total CAPEX</div><div class="stat-value num">${kes(capex)}</div></div>
    </div>
    <div class="card"><div class="card-head"><div><h3>Annual Budget by Account</h3></div>${exportBar('annual')}</div>
      <div class="card-body">${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Account</th><th>Class</th><th>Annual Budget</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.a.account_code)} — ${escapeHtml(r.a.account_name)}</td><td>${escapeHtml(r.a.account_class)}</td><td>${kes(r.total)}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="state"><div class="state-ico">${icon('reports')}</div><h3>No budget data yet</h3></div>`}</div>
    </div>`;
  wireExport('annual', 'capital-sacco-annual-report', ['Account Code', 'Account Name', 'Class', 'Annual Budget'], rows.map((r) => [r.a.account_code, r.a.account_name, r.a.account_class, r.total]));
}

// ---------------------------------------------------------------------
export async function renderMonthlyReport(container) {
  const body = pageShell(container, { icoName: 'reports', title: 'Monthly Reports', lead: 'Operating budget by account, January through December.' });
  if (!isSupabaseConfigured) return notConfigured(body);
  const { error, ref, budgetRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>${escapeHtml(error)}</div></div>`; return; }

  let branchId = '';
  function render() {
    const matches = (r) => !branchId || String(r.branch_id) === branchId;
    const pivot = {};
    (budgetRows || []).filter(matches).forEach((r) => {
      const idx = (r.months?.month_number || 1) - 1;
      if (!pivot[r.account_id]) pivot[r.account_id] = Array(12).fill(0);
      if (idx >= 0 && idx < 12) pivot[r.account_id][idx] += safeNum(r.budget_amount);
    });
    const rows = ref.accounts.filter((a) => pivot[a.id]).map((a) => ({ a, months: pivot[a.id], annual: pivot[a.id].reduce((s, v) => s + v, 0) }));

    body.innerHTML = `
      <div class="card"><div class="card-head"><div><h3>Monthly Budget Report</h3></div>${exportBar('monthly')}</div>
        <div class="card-body">
          <div class="filters"><select class="select" id="mrBranch"><option value="">Branch — All</option>${ref.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('')}</select></div>
          ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Account</th>${MONTH_LABELS.map((m) => `<th>${m}</th>`).join('')}<th>Annual</th></tr></thead>
            <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.a.account_code)}</td>${r.months.map((v) => `<td>${kes(v, { showSymbol: false })}</td>`).join('')}<td><strong>${kes(r.annual, { showSymbol: false })}</strong></td></tr>`).join('')}</tbody></table></div>`
            : `<div class="state"><div class="state-ico">${icon('reports')}</div><h3>No budget data yet</h3></div>`}
        </div></div>`;
    document.getElementById('mrBranch').addEventListener('change', (e) => { branchId = e.target.value; render(); });
    wireExport('monthly', 'capital-sacco-monthly-report', ['Account', ...MONTH_LABELS, 'Annual'], rows.map((r) => [r.a.account_code, ...r.months, r.annual]));
  }
  render();
}

// ---------------------------------------------------------------------
export async function renderBranchReport(container) {
  const body = pageShell(container, { icoName: 'reports', title: 'Branch Reports', lead: 'Budget and actual performance for a single branch.' });
  if (!isSupabaseConfigured) return notConfigured(body);
  const { error, ref, budgetRows, actualRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>${escapeHtml(error)}</div></div>`; return; }

  let branchId = ref.branches[0]?.id ? String(ref.branches[0].id) : '';
  function render() {
    const matches = (r) => String(r.branch_id) === String(branchId);
    const bi = { budget: sumByClass(budgetRows, 'Income', matches), actual: sumByClass(actualRows, 'Income', matches) };
    const be = { budget: sumByClass(budgetRows, 'Expense', matches), actual: sumByClass(actualRows, 'Expense', matches) };
    const rows = accountBudgetVsActual(budgetRows, actualRows, ref.accounts, { branchId });
    body.innerHTML = `
      <div class="card"><div class="card-body">
        <div class="filters"><select class="select" id="brBranch">${ref.branches.map((b) => `<option value="${b.id}" ${String(b.id) === String(branchId) ? 'selected' : ''}>${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('')}</select></div>
      </div></div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-top">Budget Income</div><div class="stat-value num">${kes(bi.budget)}</div></div>
        <div class="stat"><div class="stat-top">Actual Income</div><div class="stat-value num">${kes(bi.actual)}</div></div>
        <div class="stat"><div class="stat-top">Budget Expenses</div><div class="stat-value num">${kes(be.budget)}</div></div>
        <div class="stat"><div class="stat-top">Actual Expenses</div><div class="stat-value num">${kes(be.actual)}</div></div>
        <div class="stat is-highlight"><div class="stat-top">Budget Surplus</div><div class="stat-value num">${kes(bi.budget - be.budget)}</div></div>
        <div class="stat is-highlight"><div class="stat-top">Actual Surplus</div><div class="stat-value num">${kes(bi.actual - be.actual)}</div></div>
      </div>
      <div class="card"><div class="card-head"><div><h3>Account Detail</h3></div>${exportBar('branch')}</div>
        <div class="card-body">${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Account</th><th>Budget</th><th>Actual</th><th>Variance</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.account.account_code)} — ${escapeHtml(r.account.account_name)}</td><td>${kes(r.budget)}</td><td>${kes(r.actual)}</td><td>${kes(r.variance)}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="state"><div class="state-ico">${icon('reports')}</div><h3>No data for this branch</h3></div>`}</div>
      </div>`;
    document.getElementById('brBranch').addEventListener('change', (e) => { branchId = e.target.value; render(); });
    wireExport('branch', 'capital-sacco-branch-report', ['Account', 'Budget', 'Actual', 'Variance'], rows.map((r) => [r.account.account_code, r.budget, r.actual, r.variance]));
  }
  render();
}

// ---------------------------------------------------------------------
export async function renderCapexReport(container) {
  const body = pageShell(container, { icoName: 'capex', title: 'CAPEX Reports', lead: 'CAPEX requirement by item, branch and funding source.' });
  if (!isSupabaseConfigured) return notConfigured(body);
  const { data, error } = await listRows('capex_budget', { select: 'item_name, quantity, unit_cost, total_cost, funding_source, branches(branch_code,branch_name)' });
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>${escapeHtml(error.message)}</div></div>`; return; }
  const rows = data || [];
  const byBranch = {}; const bySource = {};
  rows.forEach((r) => {
    const total = r.total_cost != null ? safeNum(r.total_cost) : safeNum(r.quantity) * safeNum(r.unit_cost);
    const bLabel = r.branches ? `${r.branches.branch_code}` : '—';
    byBranch[bLabel] = (byBranch[bLabel] || 0) + total;
    const src = r.funding_source || 'Unspecified';
    bySource[src] = (bySource[src] || 0) + total;
  });
  const totalReq = rows.reduce((s, r) => s + (r.total_cost != null ? safeNum(r.total_cost) : safeNum(r.quantity) * safeNum(r.unit_cost)), 0);

  body.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat"><div class="stat-top">Total CAPEX Requirement</div><div class="stat-value num">${kes(totalReq)}</div></div>
      <div class="stat"><div class="stat-top">Total Funded</div><div class="stat-value is-empty">Not yet connected</div></div>
      <div class="stat"><div class="stat-top">Funding Gap</div><div class="stat-value is-empty">Not yet connected</div></div>
    </div>
    <div class="ph-grid">
      <div class="card"><div class="card-head"><h3>CAPEX by Branch</h3></div><div class="card-body"><div class="chart-box"><canvas id="capexByBranch"></canvas></div></div></div>
      <div class="card"><div class="card-head"><h3>CAPEX by Funding Source</h3></div><div class="card-body"><div class="chart-box"><canvas id="capexBySource"></canvas></div></div></div>
    </div>
    <div class="card"><div class="card-head"><div><h3>CAPEX Detail</h3></div>${exportBar('capex')}</div>
      <div class="card-body">${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>Branch</th><th>Quantity</th><th>Unit Cost</th><th>Total Cost</th><th>Funding Source</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.item_name)}</td><td>${escapeHtml(r.branches?.branch_code ?? '')} — ${escapeHtml(r.branches?.branch_name ?? '')}</td><td>${r.quantity ?? ''}</td><td>${kes(r.unit_cost)}</td><td>${kes(r.total_cost)}</td><td>${escapeHtml(r.funding_source || '')}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="state"><div class="state-ico">${icon('capex')}</div><h3>No CAPEX records yet</h3></div>`}</div>
    </div>`;
  if (rows.length) {
    renderBarChart('capexByBranch', Object.keys(byBranch), [{ label: 'CAPEX', data: Object.values(byBranch), color: '#0F766E' }]);
    renderBarChart('capexBySource', Object.keys(bySource), [{ label: 'CAPEX', data: Object.values(bySource), color: '#12355B' }]);
  }
  wireExport('capex', 'capital-sacco-capex-report', ['Item', 'Branch', 'Quantity', 'Unit Cost', 'Total Cost', 'Funding Source'], rows.map((r) => [r.item_name, r.branches?.branch_code, r.quantity, r.unit_cost, r.total_cost, r.funding_source]));
}

// ---------------------------------------------------------------------
export async function renderFundingReport(container) {
  const body = pageShell(container, { icoName: 'fund', title: 'Funding Reports', lead: 'Funding requirements, how they will be financed, and any gap.' });
  if (!isSupabaseConfigured) return notConfigured(body);
  const { data, error } = await listRows('funding_budget', { select: 'funding_requirement, purpose, financing_type, amount_required, amount_funded, funding_source, status, branches(branch_code,branch_name)' });
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>${escapeHtml(error.message)}</div></div>`; return; }
  const rows = data || [];
  const totalReq = rows.reduce((s, r) => s + safeNum(r.amount_required), 0);
  const totalFunded = rows.reduce((s, r) => s + safeNum(r.amount_funded), 0);

  body.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat"><div class="stat-top">Total Required</div><div class="stat-value num">${kes(totalReq)}</div></div>
      <div class="stat"><div class="stat-top">Total Funded</div><div class="stat-value num">${kes(totalFunded)}</div></div>
      <div class="stat is-highlight"><div class="stat-top">Total Gap</div><div class="stat-value num">${kes(totalReq - totalFunded)}</div></div>
    </div>
    <div class="card"><div class="card-head"><h3>Required vs Funded</h3></div><div class="card-body"><div class="chart-box"><canvas id="fundChart"></canvas></div></div></div>
    <div class="card"><div class="card-head"><div><h3>Funding Detail</h3></div>${exportBar('funding')}</div>
      <div class="card-body">${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Requirement</th><th>Branch</th><th>Financing Type</th><th>Required</th><th>Funded</th><th>Gap</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.funding_requirement)}</td><td>${escapeHtml(r.branches?.branch_code ?? '')}</td><td>${escapeHtml(r.financing_type || '')}</td><td>${kes(r.amount_required)}</td><td>${kes(r.amount_funded)}</td><td>${kes(safeNum(r.amount_required) - safeNum(r.amount_funded))}</td><td>${escapeHtml(r.status || '')}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="state"><div class="state-ico">${icon('fund')}</div><h3>No funding records yet</h3></div>`}</div>
    </div>`;
  if (rows.length) renderBarChart('fundChart', rows.map((r) => r.funding_requirement.slice(0, 14)), [{ label: 'Required', data: rows.map((r) => safeNum(r.amount_required)), color: '#12355B' }, { label: 'Funded', data: rows.map((r) => safeNum(r.amount_funded)), color: '#0F766E' }]);
  wireExport('funding', 'capital-sacco-funding-report', ['Requirement', 'Branch', 'Financing Type', 'Required', 'Funded', 'Gap', 'Status'], rows.map((r) => [r.funding_requirement, r.branches?.branch_code, r.financing_type, r.amount_required, r.amount_funded, safeNum(r.amount_required) - safeNum(r.amount_funded), r.status]));
}

// ---------------------------------------------------------------------
export async function renderManagementReport(container) {
  const body = pageShell(container, { icoName: 'reports', title: 'Management Report', lead: 'A combined summary for management review.' });
  if (!isSupabaseConfigured) return notConfigured(body);
  const { error, ref, budgetRows, actualRows, capexRows } = await loadYearData();
  if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>${escapeHtml(error)}</div></div>`; return; }
  const { data: fundingRows } = await listRows('funding_budget', { select: 'amount_required, amount_funded' });

  const income = { budget: sumByClass(budgetRows, 'Income'), actual: sumByClass(actualRows, 'Income') };
  const expense = { budget: sumByClass(budgetRows, 'Expense'), actual: sumByClass(actualRows, 'Expense') };
  const capex = (capexRows || []).reduce((s, r) => s + (r.total_cost != null ? safeNum(r.total_cost) : safeNum(r.quantity) * safeNum(r.unit_cost)), 0);
  const noActuals = (actualRows || []).length === 0;
  const rows = accountBudgetVsActual(budgetRows, actualRows, ref.accounts, {});
  const branches = branchSeries(budgetRows, ref.branches);
  const fundingTotals = (fundingRows || []).reduce((acc, r) => ({ req: acc.req + safeNum(r.amount_required), funded: acc.funded + safeNum(r.amount_funded) }), { req: 0, funded: 0 });

  body.innerHTML = `
    <div class="card"><div class="card-head"><h3>Executive Summary</h3></div>
      <div class="card-body">
        <div class="stat-grid">
          <div class="stat"><div class="stat-top">Budgeted Income</div><div class="stat-value num">${kes(income.budget)}</div></div>
          <div class="stat"><div class="stat-top">Budgeted Expenses</div><div class="stat-value num">${kes(expense.budget)}</div></div>
          <div class="stat is-highlight"><div class="stat-top">Budgeted Surplus</div><div class="stat-value num">${kes(income.budget - expense.budget)}</div></div>
          <div class="stat"><div class="stat-top">CAPEX</div><div class="stat-value num">${kes(capex)}</div></div>
        </div>
      </div></div>
    ${noActuals ? `<div class="banner banner-teal">${icon('spark')}<div>Actual data not yet entered.</div></div>` : `
    <div class="card"><div class="card-head"><h3>Actual Performance</h3></div><div class="card-body">
      <div class="stat-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="stat"><div class="stat-top">Actual Income</div><div class="stat-value num">${kes(income.actual)}</div></div>
        <div class="stat"><div class="stat-top">Actual Expenses</div><div class="stat-value num">${kes(expense.actual)}</div></div>
      </div></div></div>`}
    <div class="card"><div class="card-head"><h3>Variance Analysis</h3></div><div class="card-body">
      ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Account</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Variance %</th></tr></thead>
        <tbody>${rows.slice(0, 25).map((r) => `<tr><td>${escapeHtml(r.account.account_code)}</td><td>${kes(r.budget)}</td><td>${kes(r.actual)}</td><td>${kes(r.variance)}</td><td>${variancePctLabel(r.variancePct)}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="state"><div class="state-ico">${icon('variance')}</div><h3>No variance data yet</h3></div>`}
    </div></div>
    <div class="card"><div class="card-head"><h3>CAPEX Summary</h3></div><div class="card-body">
      <div class="status-list"><li><span>Total CAPEX Requirement</span><span class="pill pill-muted">${kes(capex)}</span></li><li><span>Total Funded</span><span class="pill pill-muted">Not yet connected</span></li></div>
    </div></div>
    <div class="card"><div class="card-head"><h3>Funding Summary</h3></div><div class="card-body">
      <div class="status-list"><li><span>Total Required</span><span class="pill pill-muted">${kes(fundingTotals.req)}</span></li><li><span>Total Funded</span><span class="pill pill-muted">${kes(fundingTotals.funded)}</span></li><li><span>Total Gap</span><span class="pill pill-muted">${kes(fundingTotals.req - fundingTotals.funded)}</span></li></div>
    </div></div>
    <div class="card"><div class="card-head"><div><h3>Branch Performance (Budget)</h3></div>${exportBar('mgmt')}</div><div class="card-body"><div class="chart-box"><canvas id="mgmtBranchChart"></canvas></div></div></div>
  `;
  renderBarChart('mgmtBranchChart', branches.map((b) => b.code), [{ label: 'Budget', data: branches.map((b) => b.value), color: '#0F766E' }]);
  wireExport('mgmt', 'capital-sacco-management-report', ['Account', 'Budget', 'Actual', 'Variance'], rows.map((r) => [r.account.account_code, r.budget, r.actual, r.variance]));
}
