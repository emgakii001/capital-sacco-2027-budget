import { NAV } from '../core/nav.js';
import { icon } from '../core/icons.js';

const COLLAPSE_KEY = 'csb_sidebar_collapsed';

function isChildActive(item, path) {
  return (item.children || []).some((c) => c.path === path);
}

export function renderSidebar(activePath) {
  const groups = NAV.map((item) => {
    if (!item.children) {
      const active = item.path === activePath;
      return `
        <a class="sb-link${active ? ' is-active' : ''}" href="${item.path}" ${active ? 'aria-current="page"' : ''}>
          ${icon(item.icon)}<span class="label">${item.label}</span>
        </a>`;
    }
    const active = isChildActive(item, activePath);
    return `
      <div class="sb-group${active ? ' has-active is-open' : ''}" data-group="${item.id}">
        <button type="button" class="sb-group-btn" aria-expanded="${active}">
          ${icon(item.icon)}<span class="label">${item.label}</span>
          <span class="chev">${icon('chevron')}</span>
        </button>
        <div class="sb-sub" ${active ? '' : 'hidden'}>
          ${item.children.map((c) => `
            <a class="sb-link${c.path === activePath ? ' is-active' : ''}" href="${c.path}" ${c.path === activePath ? 'aria-current="page"' : ''}>
              ${c.icon ? icon(c.icon) : ''}<span class="label">${c.label}</span>
            </a>`).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
      <div class="sb-brand">
        <div class="sb-logo">
          <img class="logo-full" src="assets/logo.jpg" alt="Capital SACCO Ltd. — Base for Growth">
          <img class="logo-mark" src="assets/logo-emblem.png" alt="Capital SACCO">
        </div>
      </div>
      <nav class="sb-nav">${groups}</nav>
      <div class="sb-foot">
        <button type="button" class="sb-collapse" id="sidebarCollapseBtn" aria-pressed="false">
          <span class="ico-collapse">${icon('collapse')}</span>
          <span class="ico-expand">${icon('expand')}</span>
          <span class="label">Collapse</span>
        </button>
      </div>
    </aside>`;
}

export function wireSidebar(shellEl) {
  shellEl.querySelectorAll('[data-group]').forEach((group) => {
    const btn = group.querySelector('.sb-group-btn');
    const sub = group.querySelector('.sb-sub');
    btn.addEventListener('click', () => {
      const open = !sub.hasAttribute('hidden');
      if (open) { sub.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); group.classList.remove('is-open'); }
      else { sub.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); group.classList.add('is-open'); }
    });
  });

  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const applyCollapsed = (on) => {
    shellEl.classList.toggle('is-collapsed', on);
    collapseBtn.setAttribute('aria-pressed', String(on));
    collapseBtn.querySelector('.label').textContent = on ? 'Expand' : 'Collapse';
  };
  const stored = window.matchMedia('(min-width: 961px)').matches && localStorage.getItem(COLLAPSE_KEY) === '1';
  applyCollapsed(stored);
  collapseBtn.addEventListener('click', () => {
    const next = !shellEl.classList.contains('is-collapsed');
    applyCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  });

  // Mobile drawer
  const scrim = shellEl.querySelector('.scrim');
  const closeDrawer = () => shellEl.classList.remove('drawer-open');
  scrim?.addEventListener('click', closeDrawer);
  shellEl.querySelectorAll('.sb-link').forEach((a) => a.addEventListener('click', closeDrawer));
}
