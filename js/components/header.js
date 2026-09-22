import { icon } from '../core/icons.js';
import { initials, escapeHtml } from '../core/format.js';
import { BUDGET_YEAR } from '../core/supabase-client.js';

export function renderHeader({ title, user, isLive }) {
  const name = user?.user_metadata?.full_name || user?.email || 'User';
  const email = user?.email || '';
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
        <span class="year-badge">${icon('clock')}<span class="yr-label">Budget Year</span> <strong>${BUDGET_YEAR}</strong></span>
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

export function wireHeader({ onLogout, onMenuToggle }) {
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
}
