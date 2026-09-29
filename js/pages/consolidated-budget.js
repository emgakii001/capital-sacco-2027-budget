import { icon } from '../core/icons.js';
import { kes, escapeHtml } from '../core/format.js';
import { isSupabaseConfigured } from '../core/db.js';
import { loadYearData } from '../core/aggregates.js';
import { coaHeadline } from '../core/coa.js';

export async function renderConsolidatedBudget(container) {
  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2 style="display:flex;align-items:center;gap:10px">${icon('consolidated')}Consolidated Budget</h2>
        <p class="lead">The Operating Budget consolidated across branches from the Chart of Accounts totals. CAPEX, Staff, Governance and Funding are separate schedules.</p></div>
        <div class="ph-status"><span class="pill ${isSupabaseConfigured ? 'pill-ok' : 'pill-warn'}"><span class="dot"></span>${isSupabaseConfigured ? 'Supabase connected' : 'Not yet connected'}</span></div>
      </div>
      <div id="cbBody"><div class="card"><div class="card-body"><div class="state"><div class="state-ico">${icon('consolidated')}</div><h3>Loading…</h3></div></div></div></div>
    </div>`;
  const body = document.getElementById('cbBody');
  if (!isSupabaseConfigured) {
    body.innerHTML = `<div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code>.</div></div>`;
    return;
  }

  let ref, budgetRows, capexRows, totals;
  let branchFilter = '', monthFilter = '';

  async function load() {
    const yd = await loadYearData();
    ref = yd.ref; budgetRows = yd.budgetRows; capexRows = yd.capexRows; totals = yd.totals;
    if (yd.error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load data.</strong> ${escapeHtml(yd.error)}</div></div>`; return; }
    render();
  }

  function matches(r) {
    return (!branchFilter || String(r.branch_id) === branchFilter) && (!monthFilter || String(r.month_id) === monthFilter);
  }

  function render() {
    // Operating Budget consolidation = SUM of the COA total records across the
    // selected branches/months (never a sum of detail + sub-total + total rows).
    const { income, expense, surplus, surplusFromCoa } = coaHeadline(budgetRows, totals, matches);
    const scope = `${branchFilter ? 'Selected branch' : 'All branches'} · ${monthFilter ? (ref.months.find((m) => String(m.id) === monthFilter)?.month_name || 'Selected month') : 'All months (annual)'}`;
    const capexTotal = (capexRows || [])
      .filter((r) => !branchFilter || String(r.branch_id) === branchFilter)
      .reduce((s, r) => s + (r.total_cost != null ? Number(r.total_cost) : (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0)), 0);

    body.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="filters">
            <select class="select" id="cbBranch"><option value="">Branch — All</option>${ref.branches.map((b) => `<option value="${b.id}" ${branchFilter === String(b.id) ? 'selected' : ''}>${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('')}</select>
            <select class="select" id="cbMonth"><option value="">Month — All</option>${ref.months.map((m) => `<option value="${m.id}" ${monthFilter === String(m.id) ? 'selected' : ''}>${escapeHtml(m.month_name)}</option>`).join('')}</select>
          </div>
        </div>
      </div>

      <div class="banner banner-teal">${icon('spark')}<div>Operating Budget consolidation — ${escapeHtml(scope)}. ${(budgetRows || []).length ? '' : 'No operating budget records exist for this year yet.'}</div></div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-top">Total Income</div><div class="stat-value num">${kes(income)}</div></div>
        <div class="stat"><div class="stat-top">Total Operating Expenses</div><div class="stat-value num">${kes(expense)}</div></div>
        <div class="stat is-highlight"><div class="stat-top">Budgeted Surplus</div><div class="stat-value num">${kes(surplus)}</div><div class="stat-note">${surplusFromCoa ? `COA ${escapeHtml(totals.surplus.account_code)} — ${escapeHtml(totals.surplus.account_name)}` : 'Total Income − Total Expenses'}</div></div>
        <div class="stat"><div class="stat-top">CAPEX</div><div class="stat-value num">${kes(capexTotal)}</div><div class="stat-note">Kept separate from operating expenses</div></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Supporting schedules</h3><div class="sub">Shown separately — not added into the totals above, to avoid double-counting against Operating Budget</div></div>
        <div class="card-body">
          <div class="status-list">
            <li><span>Staff Budget</span><a class="pill pill-muted" href="#/budget/staff">View schedule</a></li>
            <li><span>Governance & Delegates</span><a class="pill pill-muted" href="#/budget/governance">View schedule</a></li>
            <li><span>Funding & Financing</span><a class="pill pill-muted" href="#/budget/funding">View schedule</a></li>
          </div>
        </div>
      </div>

      <div class="banner banner-warn">${icon('warn')}<div><code>budget_categories</code> has no link to <code>accounts</code> yet, so category-level totals (Operating / CAPEX / Staff / Governance / Funding as a single categorized breakdown) are not shown here — see each schedule individually instead of an invented mapping.</div></div>
    `;

    document.getElementById('cbBranch').addEventListener('change', (e) => { branchFilter = e.target.value; render(); });
    document.getElementById('cbMonth').addEventListener('change', (e) => { monthFilter = e.target.value; render(); });
  }

  await load();
}
