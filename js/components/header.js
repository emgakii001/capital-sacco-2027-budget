import { icon } from '../core/icons.js';
import { initials, escapeHtml } from '../core/format.js';
import { getYears, getSelectedYear, refreshYears, setSelectedYear } from '../core/year-context.js';
import { isSupabaseConfigured } from '../core/supabase-client.js';
import { insertRow } from '../core/db.js';
import { openModal } from './modal.js';

// The year selector is the one control that governs the whole app: every
// connected page reads its context from js/core/year-context.js, which this
// dropdown drives. Nothing here assumes any particular year exists.
export function renderHeader({ title, user, isLive }) {
  const name = user?.user_metadata?.full_name || user?.email || 'User';
  const email = user?.email || '';
  const years = getYears();
  const selected = getSelectedYear();

  const yearControl = !isSupabaseConfigured ? `
    <span class="year-badge">${icon('clock')}<span class="yr-label">Budget Year</span> <strong>—</strong></span>` : `
    <div class="year-picker">
      <select class="select year-select" id="yearSelect" aria-label="Budget year" ${years.length ? '' : 'disabled'}>
        ${years.length ? years.map((y) => `<option value="${y.id}" ${selected && selected.id === y.id ? 'selected' : ''}>${escapeHtml(y.year)}${y.status ? ` — ${escapeHtml(y.status)}` : ''}</option>`).join('') : '<option>No budget years yet</option>'}
      </select>
      <button type="button" class="btn btn-secondary btn-sm" id="addYearBtn" title="Add a new budget year">${icon('plus')}<span class="add-year-label">Year</span></button>
    </div>`;

  return `
    <header class="header">
      <div class="header-left">
        <button type="button" class="menu-btn" id="menuBtn" aria-label="Open navigation">${icon('menu')}</button>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div class="header-right">
        <span class="pill conn-pill ${isLive ? 'pill-ok' : 'pill-warn'}">
          <span class="dot"></span>${isLive ? 'Supabase connected' : 'Not yet connected'}
        </span>
        ${yearControl}
        <div class="user">
          <button type="button" class="user-btn" id="userMenuBtn" aria-haspopup="true" aria-expanded="false">
            <span class="avatar">${initials(name)}</span>
            <span class="user-meta"><b>${escapeHtml(name)}</b><span>${escapeHtml(email)}</span></span>
          </button>
          <div class="menu" id="userMenu" hidden role="menu">
            <div class="menu-id"><b>${escapeHtml(name)}</b><span>${escapeHtml(email)}</span></div>
            <button type="button" class="menu-item" id="logoutBtn" role="menuitem">${icon('logout')}Log out</button>
          </div>
        </div>
      </div>
    </header>`;
}

function openAddYearModal(onDone) {
  const body = `
    <div id="addYearError"></div>
    <form id="addYearForm">
      <div class="form-grid">
        <div class="field"><label for="ayYear">Year *</label><input class="input" id="ayYear" type="text" placeholder="e.g. 2028" inputmode="numeric"></div>
        <div class="field"><label for="ayStatus">Status</label><input class="input" id="ayStatus" type="text" placeholder="e.g. Open"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" id="ayySaveBtn">${icon('plus')}Add Year</button>
      </div>
    </form>`;
  const close = openModal({
    title: 'Add Budget Year', bodyHtml: body,
    onMount: (host) => {
      host.querySelector('[data-close]').addEventListener('click', close);
      host.querySelector('#addYearForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const yearVal = document.getElementById('ayYear').value.trim();
        const statusVal = document.getElementById('ayStatus').value.trim();
        const errBox = document.getElementById('addYearError');
        if (!yearVal) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>Year is required.</div></div>`;
          return;
        }
        const btn = document.getElementById('ayySaveBtn');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Saving…`;
        const { data, error } = await insertRow('budget_years', { year: yearVal, status: statusVal || null });
        if (error) {
          errBox.innerHTML = `<div class="banner banner-error" style="margin-bottom:12px">${icon('warn')}<div>Unable to save: ${escapeHtml(error.message)}</div></div>`;
          btn.disabled = false; btn.innerHTML = `${icon('plus')}Add Year`;
          return;
        }
        await refreshYears();
        const newRow = data && data[0];
        if (newRow) setSelectedYear(newRow);
        close();
        onDone();
      });
    },
  });
}

export function wireHeader({ onLogout, onMenuToggle, onYearChange }) {
  const userBtn = document.getElementById('userMenuBtn');
  const menu = document.getElementById('userMenu');
  userBtn.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden') === false;
    if (open) { menu.setAttribute('hidden', ''); userBtn.setAttribute('aria-expanded', 'false'); }
    else { menu.removeAttribute('hidden'); userBtn.setAttribute('aria-expanded', 'true'); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user')) { menu.setAttribute('hidden', ''); userBtn.setAttribute('aria-expanded', 'false'); }
  });
  document.getElementById('logoutBtn').addEventListener('click', onLogout);
  document.getElementById('menuBtn').addEventListener('click', onMenuToggle);

  document.getElementById('yearSelect')?.addEventListener('change', (e) => {
    const id = e.target.value;
    const row = getYears().find((y) => String(y.id) === String(id));
    if (row) { setSelectedYear(row); onYearChange?.(); }
  });
  document.getElementById('addYearBtn')?.addEventListener('click', () => {
    openAddYearModal(() => onYearChange?.());
  });
}
