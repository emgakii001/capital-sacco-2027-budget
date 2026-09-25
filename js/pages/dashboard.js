import { icon } from '../core/icons.js';
import { kes, compactKes, escapeHtml } from '../core/format.js';
import { isSupabaseConfigured } from '../core/supabase-client.js';
import { getSelectedYearLabel } from '../core/year-context.js';
import { MONTHS } from '../data/branches.js';
import { buildDemoDashboard } from '../data/demo.js';
import { loadDashboardData } from '../data/live.js';

const DEMO_KEY = 'csb_demo_toggle';

function statCard({ icoName, label, value, note, tone, lines, demo }) {
  const cls = tone === 'highlight' ? ' is-highlight' : tone === 'secondary' ? ' is-secondary' : '';
  const valueCls = value === null || value === undefined ? ' is-empty' : (typeof value === 'string' ? ' is-text' : '');
  return `
    <div class="card stat${cls}">
      <div class="stat-top">${icoName ? `<span class="stat-ico">${icon(icoName)}</span>` : ''}<span>${label}</span>${demo ? `<span class="demo-tag">Demo data</span>` : ''}</div>
      <div class="stat-value num${valueCls}">${value === null || value === undefined ? 'Not yet connected' : value}</div>
      ${note ? `<div class="stat-note">${note}</div>` : ''}
      ${lines ? `<dl class="stat-lines">${lines.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
    </div>`;
}

function quickAction(icoName, label, href) {
  return `<a class="qa" href="${href}">${icon(icoName)}<span>${label}</span></a>`;
}

export function renderDashboard(container) {
  const demoOn = localStorage.getItem(DEMO_KEY) === '1';
  const yearLabel = getSelectedYearLabel();

  container.innerHTML = `
    <div class="page">
      <section class="hero">
        <div>
          <h2>${yearLabel ? `${yearLabel} Budget Dashboard` : 'Budget Dashboard'}</h2>
          <p>${yearLabel ? `A high-level view of the ${yearLabel} budget.` : 'Select or add a budget year in the header to see figures here.'} Use Budget, Actuals, Performance and Reports in the sidebar for full detail.</p>
        </div>
        <div class="hero-side">
          <label class="switch">
            <input type="checkbox" id="demoToggle" ${demoOn ? 'checked' : ''}>
            <span class="track"></span> Show demo data
          </label>
          <span class="hint">Off by default. Demo figures are for layout review only and are never stored.</span>
        </div>
      </section>

      <div id="dashBody"><div class="dash-skel">
        <div class="skel" style="height:140px;border-radius:12px"></div>
        <div class="skel" style="height:320px;border-radius:12px"></div>
      </div></div>
    </div>`;

  const toggle = document.getElementById('demoToggle');
  toggle.addEventListener('change', () => {
    localStorage.setItem(DEMO_KEY, toggle.checked ? '1' : '0');
    load();
  });

  async function load() {
    const useDemo = document.getElementById('demoToggle').checked;
    const data = useDemo ? buildDemoDashboard() : await loadDashboardData();
    renderBody(data, useDemo);
  }

  function renderBody(d, isDemo) {
    const body = document.getElementById('dashBody');
    const noBudget = !isDemo && isSupabaseConfigured && d.hasBudgetRows === false;

    body.innerHTML = `
      <div class="page">
        ${!isSupabaseConfigured && !isDemo ? `
        <div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code> to see live figures here, or switch on demo data above to preview the layout.</div></div>` : ''}
        ${d.error ? `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load budget data.</strong> ${escapeHtml(d.error)} Please try again.</div></div>` : ''}
        ${noBudget ? `<div class="banner banner-teal">${icon('spark')}<div>No operating budget records have been entered yet for ${yearLabel ?? 'the selected year'}. Cards below will populate once data is added.</div></div>` : ''}
        ${!isDemo && isSupabaseConfigured && !d.error && d.hasActualsRows === false ? `<div class="banner banner-teal">${icon('spark')}<div>No actual data has been entered yet for ${yearLabel ?? 'the selected year'}. Branch "Actual" figures will populate once actuals are recorded.</div></div>` : ''}

        <div class="stat-grid">
          ${statCard({ icoName: 'consolidated', label: 'Total Budgeted Income', value: d.totalIncome != null ? kes(d.totalIncome) : null, demo: isDemo })}
          ${statCard({ icoName: 'budget', label: 'Operating Expenses', value: d.totalExpense != null ? kes(d.totalExpense) : null, demo: isDemo })}
          ${statCard({ icoName: 'performance', label: 'Budgeted Surplus', value: d.surplus != null ? kes(d.surplus) : null, tone: 'highlight', note: 'Total Income − Operating Expenses', demo: isDemo })}
          ${statCard({ icoName: 'capex', label: 'CAPEX', value: d.capex != null ? kes(d.capex) : null, note: 'Quantity × Unit Cost, kept separate from operating expenses', demo: isDemo })}
          ${statCard({ icoName: 'setup', label: 'Budget Status', value: d.status || null, tone: 'secondary' })}
        </div>

        <div class="card">
          <div class="card-head"><h3>Quick actions</h3></div>
          <div class="card-body">
            <div class="qa-grid">
              ${quickAction('plus', 'Add Budget', '#/budget/operating')}
              ${quickAction('upload', 'Upload Budget', '#/budget/operating')}
              ${quickAction('plus', 'Add Actual', '#/actuals')}
              ${quickAction('upload', 'Upload Actuals', '#/actuals')}
              ${quickAction('performance', 'View Performance', '#/performance')}
              ${quickAction('reports', 'Generate Report', '#/reports')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3>Monthly Budget Overview</h3><div class="sub">Income vs operating expenses, January–December${yearLabel ? ` ${yearLabel}` : ''}${isDemo ? ' — demo data' : ''}</div></div>
          </div>
          <div class="card-body">
            ${d.monthlyIncome ? `<div class="chart-box"><canvas id="monthlyChart" role="img" aria-label="Monthly income and expenses chart"></canvas></div>` : `
            <div class="state"><div class="state-ico">${icon('performance')}</div><h3>Not yet connected</h3><p>Monthly figures will appear here once operating budget data is available for ${yearLabel ?? 'the selected year'}.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3>Branch Overview</h3><div class="sub">All 16 branches${isDemo ? ' — demo data' : ''}</div></div>
          </div>
          <div class="card-body">
            ${d.branches ? `<div class="branch-grid">${d.branches.map((b) => `
              <div class="branch">
                <div class="branch-top"><span class="branch-code">${b.code}</span><span class="branch-name">${escapeHtml(b.name)}</span></div>
                <dl>
                  <div><dt>Budget</dt><dd>${compactKes(b.budget)}</dd></div>
                  <div><dt>Actual</dt><dd>${b.actual != null ? compactKes(b.actual) : (isSupabaseConfigured && !isDemo ? 'No actual data' : 'Not connected')}</dd></div>
                </dl>
              </div>`).join('')}</div>` : `
            <div class="state"><div class="state-ico">${icon('branches')}</div><h3>Not yet connected</h3><p>Branch-level budget totals will appear here once data is available.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Recent Activity</h3></div>
          <div class="card-body">
            <div class="activity-grid">
              ${['Recent budget uploads', 'Recent actual uploads', 'Recent changes', 'Recent reports'].map((label) => `
                <div class="activity">
                  <span class="a-ico">${icon('clock')}</span>
                  <div><h4>${label} <span class="pill pill-muted">Not yet connected</span></h4><p>Will appear here once activity tracking is connected to the database.</p></div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;

    if (d.monthlyIncome && window.Chart) {
      const ctx = document.getElementById('monthlyChart');
      new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: MONTHS.map((m) => m.slice(0, 3)),
          datasets: [
            { label: 'Income', data: d.monthlyIncome, backgroundColor: '#0F766E', borderRadius: 4, maxBarThickness: 26 },
            { label: 'Expenses', data: d.monthlyExpense, backgroundColor: '#12355B', borderRadius: 4, maxBarThickness: 26 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'IBM Plex Sans' } } } },
          scales: {
            x: { grid: { display: false } },
            y: { ticks: { callback: (v) => compactKes(v).replace('KES ', '') }, grid: { color: '#E8F1F8' } },
          },
        },
      });
    }
  }

  load();
}
