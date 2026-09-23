import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/format.js';
import { listRows, insertRow, isSupabaseConfigured, resetRefCache } from '../core/db.js';
import { openModal } from '../components/modal.js';

const WARNING = 'Setup controls information used throughout the budgeting and reporting system. Changes may affect budgets, actuals and reports.';

function shell(container, { icoName, title, lead }) {
  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2 style="display:flex;align-items:center;gap:10px">${icon(icoName)}${escapeHtml(title)}</h2><p class="lead">${escapeHtml(lead)}</p></div>
        <div class="ph-status"><span class="pill ${isSupabaseConfigured ? 'pill-ok' : 'pill-warn'}"><span class="dot"></span>${isSupabaseConfigured ? 'Supabase connected' : 'Not yet connected'}</span></div>
      </div>
      <div class="banner banner-warn">${icon('warn')}<div>${WARNING}</div></div>
      <div id="setupBody"><div class="card"><div class="card-body"><div class="state"><div class="state-ico">${icon(icoName)}</div><h3>Loading…</h3></div></div></div></div>
    </div>`;
  return document.getElementById('setupBody');
}

function notConfigured(body) {
  body.innerHTML = `<div class="banner banner-warn">${icon('warn')}<div><strong>Supabase is not yet connected.</strong> Add your project URL and publishable key to <code>config.js</code>.</div></div>`;
}

function addFormModal({ title, fields, onSubmit }) {
  const body = `
    <div id="setupFormError"></div>
    <form id="setupForm"><div class="form-grid">
      ${fields.map((f) => `<div class="field${f.full ? ' full' : ''}">
        <label for="sf_${f.key}">${f.label}${f.required ? ' *' : ''}</label>
        ${f.type === 'select' ? `<select class="select" id="sf_${f.key}"><option value="">Select…</option>${f.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}</select>`
          : `<input class="input" type="${f.type || 'text'}" id="sf_${f.key}" placeholder="${escapeHtml(f.placeholder || '')}">`}
      </div>`).join('')}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-close>Cancel</button>
      <button type="submit" class="btn btn-primary" id="setupSaveBtn">${icon('plus')}Save</button>
    </div></form>`;

  const close = openModal({
    title, bodyHtml: body,
    onMount: (host) => {
      host.querySelector('[data-close]').addEventListener('click', close);
      host.querySelector('#setupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const values = {};
        fields.forEach((f) => { values[f.key] = document.getElementById(`sf_${f.key}`).value.trim(); });
        const missing = fields.filter((f) => f.required && !values[f.key]);
        const errBox = document.getElementById('setupFormError');
        if (missing.length) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>${missing.map((f) => `${escapeHtml(f.label)} is required`).join('<br>')}</div></div>`;
          return;
        }
        const btn = document.getElementById('setupSaveBtn');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Saving…`;
        const { error } = await onSubmit(values);
        if (error) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>Unable to save: ${escapeHtml(error.message)}</div></div>`;
          btn.disabled = false; btn.innerHTML = `${icon('plus')}Save`;
          return;
        }
        close();
      });
    },
  });
}

function disabledBtn(label, icoName) {
  return `<button type="button" class="btn btn-secondary" aria-disabled="true" title="Coming soon">${icon(icoName)}${label}</button>`;
}

// ---------------------------------------------------------------------
export async function renderSetupAccounts(container) {
  const body = shell(container, { icoName: 'accounts', title: 'Accounts / COA', lead: 'The Chart of Accounts used throughout the budgeting and reporting system.' });
  if (!isSupabaseConfigured) return notConfigured(body);

  let rows = [], search = '', classFilter = '';
  async function load() {
    const { data, error } = await listRows('accounts', { select: 'id, account_code, account_name, account_class', order: { column: 'account_code' } });
    if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load accounts.</strong> ${escapeHtml(error.message)}</div></div>`; return; }
    rows = data || []; render();
  }
  function render() {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => (!classFilter || r.account_class === classFilter) && (!q || r.account_code.toLowerCase().includes(q) || r.account_name.toLowerCase().includes(q)));
    body.innerHTML = `
      <div class="card">
        <div class="card-head"><div><h3>Chart of Accounts</h3><div class="sub">${filtered.length} of ${rows.length} account${rows.length === 1 ? '' : 's'}</div></div>
          <div class="action-bar">
            <button type="button" class="btn btn-primary" id="addAccBtn">${icon('plus')}Add Account</button>
            ${disabledBtn('Edit', 'file')}${disabledBtn('Delete', 'file')}
          </div>
        </div>
        <div class="card-body">
          <div class="filters">
            <input class="input" style="width:220px" id="accSearch" placeholder="Search code or name…" value="${escapeHtml(search)}">
            <select class="select" id="accClass"><option value="">Account Class — All</option><option value="Income" ${classFilter === 'Income' ? 'selected' : ''}>Income</option><option value="Expense" ${classFilter === 'Expense' ? 'selected' : ''}>Expense</option></select>
          </div>
          ${filtered.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Code</th><th>Account Name</th><th>Class</th></tr></thead>
            <tbody>${filtered.map((r) => `<tr><td>${escapeHtml(r.account_code)}</td><td>${escapeHtml(r.account_name)}</td><td><span class="pill ${r.account_class === 'Income' ? 'pill-teal' : 'pill-muted'}">${escapeHtml(r.account_class)}</span></td></tr>`).join('')}</tbody></table></div>`
            : `<div class="state"><div class="state-ico">${icon('accounts')}</div><h3>No accounts found</h3><p>${rows.length ? 'No accounts match your search.' : 'No accounts exist yet.'}</p></div>`}
        </div>
      </div>`;
    document.getElementById('accSearch').addEventListener('input', (e) => { search = e.target.value; render(); });
    document.getElementById('accClass').addEventListener('change', (e) => { classFilter = e.target.value; render(); });
    document.getElementById('addAccBtn').addEventListener('click', () => {
      addFormModal({
        title: 'Add Account', fields: [
          { key: 'account_code', label: 'Account Code', required: true },
          { key: 'account_name', label: 'Account Name', required: true },
          { key: 'account_class', label: 'Account Class', required: true, type: 'select', options: ['Income', 'Expense'] },
        ],
        onSubmit: async (v) => {
          const { error } = await insertRow('accounts', v);
          if (!error) { resetRefCache(); await load(); }
          return { error };
        },
      });
    });
  }
  await load();
}

// ---------------------------------------------------------------------
export async function renderSetupBranches(container) {
  const body = shell(container, { icoName: 'branches', title: 'Branches', lead: 'The existing Capital SACCO branches.' });
  if (!isSupabaseConfigured) return notConfigured(body);

  let rows = [], search = '';
  async function load() {
    const { data, error } = await listRows('branches', { select: 'id, branch_code, branch_name', order: { column: 'branch_code' } });
    if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load branches.</strong> ${escapeHtml(error.message)}</div></div>`; return; }
    rows = data || []; render();
  }
  function render() {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => !q || r.branch_code.toLowerCase().includes(q) || r.branch_name.toLowerCase().includes(q));
    body.innerHTML = `
      <div class="card">
        <div class="card-head"><div><h3>Branches</h3><div class="sub">${filtered.length} of ${rows.length} branch${rows.length === 1 ? '' : 'es'}</div></div>
          <div class="action-bar"><button type="button" class="btn btn-primary" id="addBrBtn">${icon('plus')}Add Branch</button>${disabledBtn('Edit', 'file')}${disabledBtn('Delete', 'file')}</div>
        </div>
        <div class="card-body">
          <div class="filters"><input class="input" style="width:220px" id="brSearch" placeholder="Search code or name…" value="${escapeHtml(search)}"></div>
          ${filtered.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Branch Code</th><th>Branch Name</th></tr></thead>
            <tbody>${filtered.map((r) => `<tr><td>${escapeHtml(r.branch_code)}</td><td>${escapeHtml(r.branch_name)}</td></tr>`).join('')}</tbody></table></div>`
            : `<div class="state"><div class="state-ico">${icon('branches')}</div><h3>No branches found</h3><p>${rows.length ? 'No branches match your search.' : 'No branches exist yet.'}</p></div>`}
        </div>
      </div>`;
    document.getElementById('brSearch').addEventListener('input', (e) => { search = e.target.value; render(); });
    document.getElementById('addBrBtn').addEventListener('click', () => {
      addFormModal({
        title: 'Add Branch', fields: [
          { key: 'branch_code', label: 'Branch Code', required: true, placeholder: 'e.g. 16' },
          { key: 'branch_name', label: 'Branch Name', required: true },
        ],
        onSubmit: async (v) => {
          const { error } = await insertRow('branches', v);
          if (!error) { resetRefCache(); await load(); }
          return { error };
        },
      });
    });
  }
  await load();
}

// ---------------------------------------------------------------------
function simpleEmptyListPage({ table, icoName, title, lead, columns, fields, label }) {
  return async function render(container) {
    const body = shell(container, { icoName, title, lead });
    if (!isSupabaseConfigured) return notConfigured(body);
    let rows = [];
    async function load() {
      const { data, error } = await listRows(table, { select: '*', order: { column: 'id' } });
      if (error) { body.innerHTML = `<div class="banner banner-error">${icon('warn')}<div><strong>Unable to load ${escapeHtml(title)}.</strong> ${escapeHtml(error.message)}</div></div>`; return; }
      rows = data || []; draw();
    }
    function draw() {
      body.innerHTML = `
        <div class="card">
          <div class="card-head"><div><h3>${escapeHtml(title)}</h3><div class="sub">${rows.length} record${rows.length === 1 ? '' : 's'}</div></div>
            <div class="action-bar"><button type="button" class="btn btn-primary" id="addBtn">${icon('plus')}${label}</button></div>
          </div>
          <div class="card-body">
            ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr>${columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
              <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
              : `<div class="state"><div class="state-ico">${icon(icoName)}</div><h3>No ${escapeHtml(title.toLowerCase())} have been added yet</h3><p>Nothing is invented here — add the first record when it's ready.</p></div>`}
          </div>
        </div>`;
      document.getElementById('addBtn').addEventListener('click', () => {
        addFormModal({
          title: `${label}`, fields,
          onSubmit: async (v) => {
            const { error } = await insertRow(table, v);
            if (!error) await load();
            return { error };
          },
        });
      });
    }
    await load();
  };
}

export const renderSetupAllocationRules = simpleEmptyListPage({
  table: 'allocation_rules', icoName: 'rules', title: 'Allocation Rules',
  lead: 'No allocation rules have been added yet.', label: 'Add Rule',
  columns: [{ header: 'Rule Name', key: 'rule_name' }, { header: 'Allocation Method', key: 'allocation_method' }, { header: 'Description', key: 'description' }],
  fields: [
    { key: 'rule_name', label: 'Rule Name', required: true },
    { key: 'allocation_method', label: 'Allocation Method', required: true },
    { key: 'description', label: 'Description', full: true },
  ],
});

export const renderSetupAssumptions = simpleEmptyListPage({
  table: 'assumptions', icoName: 'assumptions', title: 'Assumptions',
  lead: 'No budget assumptions have been added yet.', label: 'Add Assumption',
  columns: [{ header: 'Assumption Name', key: 'assumption_name' }, { header: 'Value', key: 'assumption_value' }, { header: 'Unit', key: 'unit' }, { header: 'Description', key: 'description' }],
  fields: [
    { key: 'assumption_name', label: 'Assumption Name', required: true },
    { key: 'assumption_value', label: 'Assumption Value', required: true, type: 'number' },
    { key: 'unit', label: 'Unit' },
    { key: 'description', label: 'Description', full: true },
  ],
});
