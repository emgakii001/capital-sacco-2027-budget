import { icon } from '../core/icons.js';
import { kes, escapeHtml } from '../core/format.js';
import { loadRefData, listRows, isSupabaseConfigured, BUDGET_YEAR, safeNum } from '../core/db.js';
import { renderCrudModule } from './crud-engine.js';
import { ACTUALS_CFG } from './budget-page-configs.js';

const MONTHS_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function renderActualsPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2 style="display:flex;align-items:center;gap:10px">${icon('actuals')}Actuals</h2><p class="lead">Monthly actuals entry, plus Year-to-Date and Full Year views.</p></div>
        <div class="ph-status"><span class="pill ${isSupabaseConfigured ? 'pill-ok' : 'pill-warn'}"><span class="dot"></span>${isSupabaseConfigured ? 'Supabase connected' : 'Not yet connected'}</span></div>
      </div>
      <div id="actualsSummary"></div>
      <div id="actualsTable"></div>
    </div>`;

  const summaryEl = document.getElementById('actualsSummary');
  const tableEl = document.getElementById('actualsTable');

  if (!isSupabaseConfigured) {
    summaryEl.innerHTML = `<div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code> to use this page.</div></div>`;
    return;
  }

  async function loadSummary() {
    summaryEl.innerHTML = `<div class="card"><div class="card-body"><div class="state"><div class="state-ico">${icon('actuals')}</div><h3>Loading…</h3></div></div></div>`;
    let ref;
    try { ref = await loadRefData(); } catch (err) {
      summaryEl.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>Unable to load reference data: ${escapeHtml(err.message)}</div></div>`;
      return;
    }
    if (!ref.year) { summaryEl.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>Budget year ${BUDGET_YEAR} not found.</div></div>`; return; }

    const { data, error } = await listRows('actuals', {
      select: 'actual_amount, month_id, account_id, months(month_number), accounts(account_class)',
      filters: [['budget_year_id', 'eq', ref.year.id]],
    });
    if (error) { summaryEl.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>Unable to load actuals: ${escapeHtml(error.message)}</div></div>`; return; }

    const rows = data || [];
    const perMonth = Array.from({ length: 12 }, () => ({ count: 0, income: 0, expense: 0 }));
    rows.forEach((r) => {
      const idx = (r.months?.month_number || 1) - 1;
      if (idx < 0 || idx > 11) return;
      perMonth[idx].count += 1;
      const amt = safeNum(r.actual_amount);
      if (r.accounts?.account_class === 'Income') perMonth[idx].income += amt;
      else if (r.accounts?.account_class === 'Expense') perMonth[idx].expense += amt;
    });

    const lastEnteredIdx = perMonth.reduce((last, m, i) => (m.count > 0 ? i : last), -1);
    const ytd = perMonth.slice(0, lastEnteredIdx + 1).reduce((acc, m) => ({ income: acc.income + m.income, expense: acc.expense + m.expense }), { income: 0, expense: 0 });
    const fullYear = perMonth.reduce((acc, m) => ({ income: acc.income + m.income, expense: acc.expense + m.expense }), { income: 0, expense: 0 });

    summaryEl.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>Actuals — ${BUDGET_YEAR}</h3></div>
        <div class="card-body">
          <div class="month-grid">
            ${MONTHS_ORDER.map((name, i) => {
              const m = perMonth[i];
              return `<div class="month"><b>${name}</b><span>${m.count ? `${m.count} record${m.count === 1 ? '' : 's'}` : 'Not entered'}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><h3>Monthly Actuals</h3><div class="sub">Tabs mirror the brief's Monthly / Year-to-Date / Full Year views</div></div>
        </div>
        <div class="card-body">
          <div class="tabs" role="tablist" id="actualsTabs">
            <span class="tab is-on" data-tab="monthly" role="tab">Monthly</span>
            <span class="tab" data-tab="ytd" role="tab">Year-to-Date</span>
            <span class="tab" data-tab="full" role="tab">Full Year</span>
          </div>
          <div id="tabPanels" style="margin-top:16px">
            <div data-panel="monthly">
              <p class="ph-note">Use the table below to enter, upload and browse individual transactions for any month.</p>
            </div>
            <div data-panel="ytd" hidden>
              ${lastEnteredIdx < 0 ? `<div class="state"><div class="state-ico">${icon('actuals')}</div><h3>No actual data has been entered yet</h3><p>Year-to-Date figures will appear once at least one month has actuals recorded.</p></div>` : `
              <p class="ph-note">January – ${MONTHS_ORDER[lastEnteredIdx]} ${BUDGET_YEAR} (the latest month with recorded actuals).</p>
              <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                <div class="stat"><div class="stat-top">Income</div><div class="stat-value num">${kes(ytd.income)}</div></div>
                <div class="stat"><div class="stat-top">Expenses</div><div class="stat-value num">${kes(ytd.expense)}</div></div>
                <div class="stat" style="background:var(--teal-50)"><div class="stat-top">Surplus</div><div class="stat-value num">${kes(ytd.income - ytd.expense)}</div></div>
              </div>`}
            </div>
            <div data-panel="full" hidden>
              ${fullYear.income === 0 && fullYear.expense === 0 ? `<div class="state"><div class="state-ico">${icon('actuals')}</div><h3>No actual data has been entered yet</h3></div>` : `
              <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                <div class="stat"><div class="stat-top">Income (Jan–Dec)</div><div class="stat-value num">${kes(fullYear.income)}</div></div>
                <div class="stat"><div class="stat-top">Expenses (Jan–Dec)</div><div class="stat-value num">${kes(fullYear.expense)}</div></div>
                <div class="stat" style="background:var(--teal-50)"><div class="stat-top">Surplus</div><div class="stat-value num">${kes(fullYear.income - fullYear.expense)}</div></div>
              </div>`}
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('actualsTabs').querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#actualsTabs .tab').forEach((t) => t.classList.remove('is-on'));
        tab.classList.add('is-on');
        document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      });
    });
  }

  await loadSummary();
  await renderCrudModule(tableEl, ACTUALS_CFG);
}
