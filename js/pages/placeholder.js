import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/format.js';

// Generic "not yet connected" page builder shared by every Budget, Actuals,
// Performance, Reports and Setup screen that isn't wired to Supabase yet.
// Nothing here fabricates figures — it lays out the intended fields, columns,
// filters and actions from the brief so the shape of each page is visible
// and ready to connect.

function actionBar(actions = []) {
  if (!actions.length) return '';
  const map = { add: 'plus', upload: 'upload', download: 'download', help: 'help', view: 'eye' };
  return `<div class="action-bar">${actions.map((a) => `
    <button type="button" class="btn ${a.primary ? 'btn-primary' : 'btn-secondary'}" aria-disabled="true" title="Not yet connected to Supabase">
      ${icon(map[a.icon] || 'help')}${a.label}
    </button>`).join('')}</div>`;
}

function filtersBar(filters = []) {
  if (!filters.length) return '';
  return `<div class="filters">${filters.map((f) => `
    <select class="select" disabled aria-label="${escapeHtml(f)}"><option>${escapeHtml(f)}</option></select>`).join('')}</div>`;
}

function tableBlock({ columns = [], note }) {
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
        <tbody><tr><td class="empty-cell" colspan="${columns.length}">
          <div class="state">
            <div class="state-ico">${icon('file')}</div>
            <h3>No records yet</h3>
            <p>${note || 'Records will be listed here once connected to Supabase and data has been entered.'}</p>
          </div>
        </td></tr></tbody>
      </table>
    </div>`;
}

function fieldChips(fields = []) {
  return `<div class="chips">${fields.map((f) => `<span class="chip">${escapeHtml(f)}</span>`).join('')}</div>`;
}

function columnChips(cols = []) {
  return `<div class="chips">${cols.map((f) => `<span class="chip code">${escapeHtml(f)}</span>`).join('')}</div>`;
}

export function renderPlaceholderPage(container, cfg) {
  const {
    title, lead, icoName = 'file', fields, uploadColumns, filters, tableColumns,
    tableNote, formulas, extraCards, statusList, warning, tabs, months,
  } = cfg;

  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div>
          <h2 style="display:flex;align-items:center;gap:10px">${icon(icoName)}${escapeHtml(title)}</h2>
          <p class="lead">${lead}</p>
        </div>
        <div class="ph-status">
          <span class="pill pill-warn">${icon('warn')}Not yet connected</span>
        </div>
      </div>

      ${warning ? `<div class="banner banner-warn">${icon('warn')}<div>${warning}</div></div>` : ''}

      ${(fields || uploadColumns || formulas) ? `
      <div class="ph-grid">
        ${fields ? `
        <div class="card"><div class="card-head"><h3>Fields</h3><div class="sub">Manual entry, once connected</div></div>
          <div class="card-body">${fieldChips(fields)}</div></div>` : ''}
        ${uploadColumns ? `
        <div class="card"><div class="card-head"><h3>Excel upload columns</h3><div class="sub">Exact column names, matching the template</div></div>
          <div class="card-body">${columnChips(uploadColumns)}
            <p class="ph-note">Preview, validation, duplicate detection and an import summary run before anything is saved.</p>
          </div></div>` : ''}
        ${formulas ? `
        <div class="card"><div class="card-head"><h3>Calculation</h3></div>
          <div class="card-body">${formulas.map((f) => `<div class="formula"><b>${escapeHtml(f.label)}</b><span>${escapeHtml(f.value)}</span></div>`).join('')}</div></div>` : ''}
        ${statusList ? `
        <div class="card"><div class="card-head"><h3>Status values</h3><div class="sub">From the database — nothing invented here</div></div>
          <div class="card-body"><ul class="status-list">${statusList.map((s) => `<li><span>${escapeHtml(s.label)}</span><span class="pill ${s.pillClass || 'pill-muted'}">${escapeHtml(s.value)}</span></li>`).join('')}</ul></div></div>` : ''}
      </div>` : ''}

      ${extraCards ? extraCards.join('') : ''}

      ${months ? `
      <div class="card"><div class="card-head"><h3>${cfg.title} — ${cfg.year || ''}</h3></div>
        <div class="card-body">
          <div class="month-grid">${months.map((m) => `
            <div class="month"><b>${escapeHtml(m)}</b><span>Not entered</span></div>`).join('')}</div>
        </div></div>` : ''}

      <div class="card">
        <div class="card-head">
          <div>
            <h3>${cfg.tableTitle || 'Records'}</h3>${cfg.tableSub ? `<div class="sub">${cfg.tableSub}</div>` : ''}
          </div>
          ${actionBar(cfg.actions)}
        </div>
        <div class="card-body">
          ${tabs ? `<div class="tabs" role="tablist" style="margin-bottom:14px">${tabs.map((t, i) => `<span class="tab${i === 0 ? ' is-on' : ''}" role="tab">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          ${filters ? filtersBar(filters) : ''}
          ${tableColumns ? tableBlock({ columns: tableColumns, note: tableNote }) : `
          <div class="state"><div class="state-ico">${icon(icoName)}</div><h3>Not yet connected</h3><p>${tableNote || 'This section will connect to Supabase in a later phase.'}</p></div>`}
        </div>
      </div>
    </div>`;
}
