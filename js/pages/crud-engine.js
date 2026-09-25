import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/format.js';
import { loadRefData, listRows, insertRow, insertRows, updateRow, deleteRow, isSupabaseConfigured } from '../core/db.js';
import { getSelectedYearLabel } from '../core/year-context.js';
import { UPLOAD_SPECS, validateBatch } from '../core/upload-config.js';
import { downloadTemplate, parseUploadedFile } from '../core/excel.js';
import { openUploadGuide } from '../components/upload-guide.js';
import { renderImportSummary } from '../components/import-summary.js';
import { openModal } from '../components/modal.js';
import { downloadCsv } from '../core/csv.js';

// Shared engine behind every Supabase-connected budget/actuals module
// (Operating Budget, CAPEX, Staff, Governance, Funding, Actuals). Each page
// file only supplies presentation config (js/pages/budget-page-configs.js);
// this file owns loading, filtering, Add/Edit/Delete, Excel upload/
// download/guide, CSV export, and every loading/empty/error state.
//
// Records added by Excel upload and records added by the Add New form are
// stored identically (same table, same columns) — so both are editable and
// deletable here in exactly the same way, once they're in Supabase.

function labelFor(col) {
  return col.header.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function fieldControl(col, ref, value) {
  const id = `f_${col.key}`;
  const v = value ?? '';
  if (col.kind === 'year') {
    return `<div class="field"><label for="${id}">Budget Year</label><input class="input" id="${id}" value="${escapeHtml(ref.year ? ref.year.year : '')}" disabled></div>`;
  }
  if (col.kind === 'branch_code') {
    const opts = ref.branches.map((b) => `<option value="${escapeHtml(b.branch_code)}" ${String(v) === String(b.branch_code) ? 'selected' : ''}>${escapeHtml(b.branch_code)} — ${escapeHtml(b.branch_name)}</option>`).join('');
    return `<div class="field"><label for="${id}">Branch${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select branch…</option>${opts}</select></div>`;
  }
  if (col.kind === 'account_code') {
    const opts = ref.accounts.map((a) => `<option value="${escapeHtml(a.account_code)}" ${String(v) === String(a.account_code) ? 'selected' : ''}>${escapeHtml(a.account_code)} — ${escapeHtml(a.account_name)} (${escapeHtml(a.account_class)})</option>`).join('');
    return `<div class="field"><label for="${id}">Account${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select account…</option>${opts}</select></div>`;
  }
  if (col.kind === 'month') {
    const opts = ref.months.map((m) => `<option value="${escapeHtml(m.month_name)}" ${String(v) === String(m.month_name) ? 'selected' : ''}>${escapeHtml(m.month_name)}</option>`).join('');
    return `<div class="field"><label for="${id}">Month${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select month…</option>${opts}</select></div>`;
  }
  if (col.options && col.options.length) {
    const opts = col.options.map((o) => `<option value="${escapeHtml(o)}" ${String(v).toLowerCase() === o.toLowerCase() ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `<div class="field"><label for="${id}">${labelFor(col)}${col.required ? ' *' : ''}</label><select class="select" id="${id}"><option value="">Select…</option>${opts}</select></div>`;
  }
  if (col.kind === 'number' || col.kind === 'amount') {
    return `<div class="field"><label for="${id}">${labelFor(col)}${col.required ? ' *' : ''}</label><input class="input" type="number" step="any" id="${id}" value="${escapeHtml(v)}" placeholder="${col.note ? escapeHtml(col.note) : ''}"></div>`;
  }
  const isLong = ['notes', 'description', 'purpose'].includes(col.key);
  return `<div class="field${isLong ? ' full' : ''}"><label for="${id}">${labelFor(col)}${col.required ? ' *' : ''}</label><input class="input" type="text" id="${id}" value="${escapeHtml(v)}" placeholder="${col.note ? escapeHtml(col.note) : ''}"></div>`;
}

// Builds the raw, Excel-row-shaped object a record's current Supabase values
// correspond to, so the exact same spec.buildPayload() validation used for
// uploads and Add New also powers Edit — one path, not two.
function rawRowToFormValues(rawRow, spec) {
  const out = {};
  spec.columns.forEach((c) => {
    if (c.kind === 'year') { out[c.header] = getSelectedYearLabel(); return; }
    if (c.kind === 'branch_code') { out[c.header] = rawRow.branches?.branch_code ?? ''; return; }
    if (c.kind === 'account_code') { out[c.header] = rawRow.accounts?.account_code ?? ''; return; }
    if (c.kind === 'month') { out[c.header] = rawRow.months?.month_name ?? ''; return; }
    out[c.header] = rawRow[c.key] ?? '';
  });
  return out;
}

function openRecordForm({ spec, ref, existingRaw, onSaved }) {
  const isEdit = !!existingRaw;
  const prefill = isEdit ? rawRowToFormValues(existingRaw, spec) : null;
  const fields = spec.columns.map((c) => fieldControl(c, ref, prefill ? prefill[c.header] : undefined)).join('');
  const body = `
    <div id="recFormError"></div>
    <form id="recForm"><div class="form-grid">${fields}</div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" id="recSaveBtn">${icon(isEdit ? 'edit' : 'plus')}${isEdit ? 'Save Changes' : 'Save'}</button>
      </div>
    </form>`;

  const close = openModal({
    title: isEdit ? `Edit ${spec.label} record` : `Add ${spec.label} record`,
    bodyHtml: body,
    onMount: (host) => {
      host.querySelector('[data-close]').addEventListener('click', close);
      host.querySelector('#recForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const raw = {};
        spec.columns.forEach((c) => {
          if (c.kind === 'year') { raw[c.header] = getSelectedYearLabel(); return; }
          const el = document.getElementById(`f_${c.key}`);
          raw[c.header] = el ? el.value : '';
        });
        const { payload, errors } = spec.buildPayload(raw, ref);
        const errBox = document.getElementById('recFormError');
        if (errors && errors.length) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>${errors.map(escapeHtml).join('<br>')}</div></div>`;
          return;
        }
        const saveBtn = document.getElementById('recSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner"></span>Saving…`;
        const { error } = isEdit ? await updateRow(spec.key, existingRaw.id, payload) : await insertRow(spec.key, payload);
        if (error) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>Unable to save: ${escapeHtml(error.message)}</div></div>`;
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${icon(isEdit ? 'edit' : 'plus')}${isEdit ? 'Save Changes' : 'Save'}`;
          return;
        }
        close();
        onSaved();
      });
    },
  });
}

function openDeleteConfirm({ spec, existingRaw, onDeleted }) {
  const body = `
    <div id="delFormError"></div>
    <p>Delete this ${escapeHtml(spec.label)} record? This cannot be undone.</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" id="confirmDeleteBtn" style="background:var(--error);border-color:var(--error)">${icon('trash')}Delete</button>
    </div>`;
  const close = openModal({
    title: 'Confirm delete', bodyHtml: body,
    onMount: (host) => {
      host.querySelector('[data-close]').addEventListener('click', close);
      host.querySelector('#confirmDeleteBtn').addEventListener('click', async () => {
        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Deleting…`;
        const { error } = await deleteRow(spec.key, existingRaw.id);
        if (error) {
          document.getElementById('delFormError').innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>Unable to delete: ${escapeHtml(error.message)}</div></div>`;
          btn.disabled = false; btn.innerHTML = `${icon('trash')}Delete`;
          return;
        }
        close();
        onDeleted();
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

  let ref, rowsFlat = [], rawById = new Map(), activeFilters = {}, lastImportSummaryHtml = '';

  // Loads (or reloads) everything from Supabase exactly once per call, and
  // renders exactly once when it's done — Add, Edit, Delete and Upload all
  // funnel through this single function rather than patching the DOM
  // piecemeal, so the table never shows a stale or duplicated view.
  async function loadAll() {
    try {
      ref = await loadRefData();
    } catch (err) {
      body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load reference data.</strong> ${escapeHtml(err.message)} Please try again.</div></div>`;
      return;
    }
    if (!ref.year) {
      body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div>No budget year is selected. Add or select a budget year from the header first.</div></div>`;
      return;
    }
    const { data, error } = await listRows(cfg.specKey, {
      select: cfg.select, filters: [['budget_year_id', 'eq', ref.year.id]], order: cfg.order,
    });
    if (error) {
      body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load ${escapeHtml(cfg.title)} data.</strong> ${escapeHtml(error.message)} Please try again.</div></div>`;
      return;
    }
    rawById = new Map((data || []).map((r) => [r.id, r]));
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
        <thead><tr>${cfg.displayColumns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}<th>Actions</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>${cfg.displayColumns.map((c) => `<td>${c.html ? c.html(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('')}<td class="row-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-edit="${r.id}" title="Edit">${icon('edit')}</button>
          <button type="button" class="btn btn-secondary btn-sm" data-delete="${r.id}" title="Delete">${icon('trash')}</button>
        </td></tr>`).join('')}</tbody>
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
    document.getElementById('addBtn').addEventListener('click', () => openRecordForm({
      spec, ref, onSaved: () => { lastImportSummaryHtml = ''; loadAll(); },
    }));
    document.getElementById('templateBtn').addEventListener('click', () => downloadTemplate(spec));
    document.getElementById('guideBtn').addEventListener('click', () => openUploadGuide(spec));
    document.getElementById('exportBtn').addEventListener('click', () => {
      downloadCsv(`${spec.fileBaseName}-export`, cfg.displayColumns.map((c) => c.header), rows.map((r) => cfg.displayColumns.map((c) => c.csv ? c.csv(r) : (r[c.key] ?? ''))));
    });
    body.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rawRow = rawById.get(Number(btn.dataset.edit) || btn.dataset.edit);
        if (!rawRow) return;
        openRecordForm({ spec, ref, existingRaw: rawRow, onSaved: () => { lastImportSummaryHtml = ''; loadAll(); } });
      });
    });
    body.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rawRow = rawById.get(Number(btn.dataset.delete) || btn.dataset.delete);
        if (!rawRow) return;
        openDeleteConfirm({ spec, existingRaw: rawRow, onDeleted: () => { lastImportSummaryHtml = ''; loadAll(); } });
      });
    });
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      lastImportSummaryHtml = `<div class="banner banner-teal" style="margin-bottom:16px">${icon('spark')}<div>Validating <strong>${escapeHtml(file.name)}</strong>…</div></div>`;
      render();
      let uploadRows;
      try {
        uploadRows = await parseUploadedFile(file);
      } catch (err) {
        lastImportSummaryHtml = `<div class="banner banner-error">${icon('warn')}<div>Could not read that file: ${escapeHtml(err.message)}</div></div>`;
        render();
        return;
      }
      const { validPayloads, errorRows, duplicateRowNumbers, totalRows } = validateBatch(cfg.specKey, uploadRows, ref);
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
