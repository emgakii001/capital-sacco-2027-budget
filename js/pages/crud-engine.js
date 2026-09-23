import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/format.js';
import { loadRefData, listRows, insertRow, insertRows, isSupabaseConfigured, BUDGET_YEAR } from '../core/db.js';
import { UPLOAD_SPECS, validateBatch } from '../core/upload-config.js';
import { downloadTemplate, parseUploadedFile } from '../core/excel.js';
import { openUploadGuide } from '../components/upload-guide.js';
import { renderImportSummary } from '../components/import-summary.js';
import { openModal } from '../components/modal.js';
import { downloadCsv } from '../core/csv.js';

// Shared engine behind every Supabase-connected budget/actuals module
// (Operating Budget, CAPEX, Staff, Governance, Funding, Actuals). Each page
// file only supplies presentation config (js/pages/budget-page-configs.js);
// this file owns loading, filtering, the Add-New form, Excel upload/
// download/guide, CSV export, and every loading/empty/error state.

function fieldControl(col, ref) {
  const id = `f_${col.key}`;
  if (col.kind === 'year') {
    return `<div class="field"><label for="${id}">Budget Year</label><input class="input" id="${id}" value="${BUDGET_YEAR}" disabled></div>`;
  }
  if (col.kind === 'branch_code') {
    const opts = ref.branches.map((b) => `<option value="${escapeHtml(b.branch_code)}">${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('');
    return `<div class="field"><label for="${id}">Branch${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select branch…</option>${opts}</select></div>`;
  }
  if (col.kind === 'account_code') {
    const opts = ref.accounts.map((a) => `<option value="${escapeHtml(a.account_code)}">${escapeHtml(a.account_code)} — ${escapeHtml(a.account_name)} (${escapeHtml(a.account_class)})</option>`).join('');
    return `<div class="field"><label for="${id}">Account${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select account…</option>${opts}</select></div>`;
  }
  if (col.kind === 'month') {
    const opts = ref.months.map((m) => `<option value="${escapeHtml(m.month_name)}">${escapeHtml(m.month_name)}</option>`).join('');
    return `<div class="field"><label for="${id}">Month${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select month…</option>${opts}</select></div>`;
  }
  if (col.options && col.options.length) {
    const opts = col.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    return `<div class="field"><label for="${id}">${labelFor(col)}${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select…</option>${opts}</select></div>`;
  }
  if (col.kind === 'number' || col.kind === 'amount') {
    return `<div class="field"><label for="${id}">${labelFor(col)}${col.required ? ' *' : ''}</label><input class="input" type="number" step="any" id="${id}" placeholder="${col.note ? escapeHtml(col.note) : ''}"></div>`;
  }
  const isLong = ['notes', 'description', 'purpose'].includes(col.key);
  return `<div class="field${isLong ? ' full' : ''}"><label for="${id}">${labelFor(col)}${col.required ? ' *' : ''}</label><input class="input" type="text" id="${id}" placeholder="${col.note ? escapeHtml(col.note) : ''}"></div>`;
}

function labelFor(col) {
  return col.header.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function openAddForm(cfg, spec, ref, onSaved) {
  const fields = spec.columns.map((c) => fieldControl(c, ref)).join('');
  const body = `
    <div id="addFormError"></div>
    <form id="addForm"><div class="form-grid">${fields}</div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" id="addSaveBtn">${icon('plus')}Save</button>
      </div>
    </form>`;

  const close = openModal({
    title: `Add ${spec.label} record`,
    bodyHtml: body,
    onMount: (host) => {
      host.querySelector('[data-close]').addEventListener('click', close);
      host.querySelector('#addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const raw = {};
        spec.columns.forEach((c) => {
          if (c.kind === 'year') { raw[c.header] = BUDGET_YEAR; return; }
          const el = document.getElementById(`f_${c.key}`);
          raw[c.header] = el ? el.value : '';
        });
        const { payload, errors } = spec.buildPayload(raw, ref);
        const errBox = document.getElementById('addFormError');
        if (errors && errors.length) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>${errors.map(escapeHtml).join('<br>')}</div></div>`;
          return;
        }
        const saveBtn = document.getElementById('addSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner"></span>Saving…`;
        const { error } = await insertRow(spec.key, payload);
        if (error) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>Unable to save: ${escapeHtml(error.message)}</div></div>`;
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${icon('plus')}Save`;
          return;
        }
        close();
        onSaved();
      });
    },
  });
}

export async function renderCrudModule(container, cfg) {
  const spec = UPLOAD_SPECS[cfg.specKey];

  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2 style="display:flex;align-items:center;gap:10px">${icon(cfg.icoName)}${escapeHtml(cfg.title)}</h2><p class="lead">${cfg.lead}</p></div>
        <div class="ph-status"><span class="pill ${isSupabaseConfigured ? 'pill-ok' : 'pill-warn'}"><span class="dot"></span>${isSupabaseConfigured ? 'Supabase connected' : 'Not yet connected'}</span></div>
      </div>
      <div id="crudBody"><div class="card"><div class="card-body"><div class="state"><div class="state-ico">${icon(cfg.icoName)}</div><h3>Loading…</h3><p>Fetching records from Supabase.</p></div></div></div></div>
    </div>`;

  const body = document.getElementById('crudBody');
  if (!isSupabaseConfigured) {
    body.innerHTML = `<div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code> to use this page.</div></div>`;
    return;
  }

  let ref, rowsFlat = [], activeFilters = {}, lastImportSummaryHtml = '';

  async function loadAll() {
    try {
      ref = await loadRefData();
    } catch (err) {
      body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load reference data.</strong> ${escapeHtml(err.message)} Please try again.</div></div>`;
      return;
    }
    if (!ref.year) {
      body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>Budget year ${BUDGET_YEAR} was not found in <code>budget_years</code>.</div></div>`;
      return;
    }
    const { data, error } = await listRows(cfg.specKey, {
      select: cfg.select, filters: [['budget_year_id', 'eq', ref.year.id]], order: cfg.order,
    });
    if (error) {
      body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load ${escapeHtml(cfg.title)} data.</strong> ${escapeHtml(error.message)} Please try again.</div></div>`;
      return;
    }
    rowsFlat = (data || []).map((r) => cfg.flatten(r, ref));
    render();
  }

  function filteredRows() {
    return rowsFlat.filter((r) => cfg.filters.every((f) => {
      const val = activeFilters[f.key];
      return !val || String(r[f.key]) === String(val);
    }));
  }

  function render() {
    const rows = filteredRows();
    const filterBar = cfg.filters.length ? `<div class="filters">${cfg.filters.map((f) => `
      <select class="select" data-filter="${f.key}">
        <option value="">${escapeHtml(f.label)} — All</option>
        ${f.options(ref, rowsFlat).map((o) => `<option value="${escapeHtml(String(o.value))}" ${String(activeFilters[f.key]) === String(o.value) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
      </select>`).join('')}
      <button type="button" class="btn btn-secondary btn-sm" id="resetFiltersBtn">Reset filters</button>
    </div>` : '';

    const tableHtml = rows.length ? `
      <div class="table-wrap"><table class="data">
        <thead><tr>${cfg.displayColumns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${cfg.displayColumns.map((c) => `<td>${c.html ? c.html(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>` : `
      <div class="state"><div class="state-ico">${icon('file')}</div><h3>No records found</h3><p>${rowsFlat.length ? 'No records match the selected filters.' : (cfg.emptyNote || 'No records have been entered yet.')}</p></div>`;

    body.innerHTML = `
      ${lastImportSummaryHtml}
      ${cfg.summary ? cfg.summary(rowsFlat) : ''}
      <div class="card">
        <div class="card-head">
          <div><h3>${escapeHtml(cfg.title)} records</h3><div class="sub">${rows.length} of ${rowsFlat.length} record${rowsFlat.length === 1 ? '' : 's'} shown</div></div>
          <div class="action-bar">
            <button type="button" class="btn btn-primary" id="addBtn">${icon('plus')}Add New</button>
            <button type="button" class="btn btn-secondary" id="uploadBtn">${icon('upload')}Upload Excel</button>
            <button type="button" class="btn btn-secondary" id="templateBtn">${icon('download')}Download Template</button>
            <button type="button" class="btn btn-secondary" id="guideBtn">${icon('help')}Upload Guide</button>
            <button type="button" class="btn btn-secondary" id="exportBtn">${icon('download')}Export CSV</button>
            <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" hidden>
          </div>
        </div>
        <div class="card-body">${filterBar}${tableHtml}</div>
      </div>`;

    cfg.filters.forEach((f) => {
      body.querySelector(`[data-filter="${f.key}"]`)?.addEventListener('change', (e) => { activeFilters[f.key] = e.target.value; render(); });
    });
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => { activeFilters = {}; render(); });
    document.getElementById('addBtn').addEventListener('click', () => openAddForm(cfg, spec, ref, () => { lastImportSummaryHtml = ''; loadAll(); }));
    document.getElementById('templateBtn').addEventListener('click', () => downloadTemplate(spec));
    document.getElementById('guideBtn').addEventListener('click', () => openUploadGuide(spec));
    document.getElementById('exportBtn').addEventListener('click', () => {
      downloadCsv(`${spec.fileBaseName}-export`, cfg.displayColumns.map((c) => c.header), rows.map((r) => cfg.displayColumns.map((c) => c.csv ? c.csv(r) : (r[c.key] ?? ''))));
    });
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      lastImportSummaryHtml = `<div class="banner banner-teal" style="margin-bottom:16px">${icon('spark')}<div>Validating <strong>${escapeHtml(file.name)}</strong>…</div></div>`;
      render();
      let rawRows;
      try {
        rawRows = await parseUploadedFile(file);
      } catch (err) {
        lastImportSummaryHtml = `<div class="banner banner-error">${icon('warn')}<div>Could not read that file: ${escapeHtml(err.message)}</div></div>`;
        render();
        return;
      }
      const { validPayloads, errorRows, duplicateRowNumbers, totalRows } = validateBatch(cfg.specKey, rawRows, ref);
      let importedCount = 0, saveError = null;
      if (validPayloads.length) {
        const { data, error } = await insertRows(cfg.specKey, validPayloads.map((p) => p.payload));
        if (error) saveError = error.message;
        else importedCount = data?.length || 0;
      }
      lastImportSummaryHtml = renderImportSummary({ fileName: file.name, totalRows, importedCount, errorRows, duplicateRowNumbers, saveError });
      await loadAll();
    });
  }

  await loadAll();
}
