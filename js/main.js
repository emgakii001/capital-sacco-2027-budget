import { auth } from './core/auth.js';
import { findByPath } from './core/nav.js';
import { renderSidebar, wireSidebar } from './components/sidebar.js';
import { renderHeader, wireHeader } from './components/header.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderBudgetOverview } from './pages/budget-overview.js';
import { renderPlaceholderPage } from './pages/placeholder.js';
import { ROUTES } from './pages/route-configs.js';

const root = document.getElementById('app');
let currentSession = null;

function pathTitle(path) {
  const found = findByPath(path);
  if (!found) return '2027 Budget Management System';
  return found.parent ? `${found.parent.label} · ${found.item.label}` : found.item.label;
}

function renderRoute(path) {
  const content = document.getElementById('content');
  if (!content) return;
  content.scrollTop = 0;

  if (path === '#/dashboard' || path === '' || path === '#/' || path === '#') {
    renderDashboard(content);
    return;
  }
  if (path === '#/budget') { renderBudgetOverview(content); return; }
  if (ROUTES[path]) { renderPlaceholderPage(content, ROUTES[path]); return; }

  // Unknown hash: send to dashboard.
  window.location.hash = '#/dashboard';
}

function updateActiveNav(path) {
  // Re-render the sidebar so the group containing the active link is open,
  // even when the path changed via a link/redirect rather than a click on
  // the currently-open group (e.g. a quick action, or the address bar).
  const shellEl = document.getElementById('shell');
  const oldSidebar = document.getElementById('sidebar');
  if (shellEl && oldSidebar) {
    oldSidebar.outerHTML = renderSidebar(path);
    wireSidebar(shellEl);
    // Re-apply collapsed state, which wireSidebar's default logic already reads from storage.
  }
  const title = document.querySelector('.header h1');
  if (title) title.textContent = pathTitle(path);
}

function renderShell(session) {
  currentSession = session;
  const path = window.location.hash || '#/dashboard';
  root.innerHTML = `
    <div class="shell" id="shell">
      <div class="scrim"></div>
      ${renderSidebar(path)}
      <div class="main">
        ${renderHeader({ title: pathTitle(path), user: session?.user, isLive: auth.isLive })}
        <main class="content" id="content" tabindex="-1"></main>
      </div>
    </div>`;

  const shellEl = document.getElementById('shell');
  wireSidebar(shellEl);
  wireHeader({
    onLogout: async () => { await auth.signOut(); renderLoginScreen(); },
    onMenuToggle: () => shellEl.classList.toggle('drawer-open'),
  });

  renderRoute(path);

  window.addEventListener('hashchange', () => {
    const p = window.location.hash || '#/dashboard';
    updateActiveNav(p);
    renderRoute(p);
    document.getElementById('content')?.focus();
  });
}

function renderLoginScreen() {
  renderLogin(root, (session) => renderShell(session));
}

async function boot() {
  const session = await auth.getSession();
  if (session) renderShell(session);
  else renderLoginScreen();

  auth.onChange((session) => {
    if (!session && root.querySelector('.shell')) renderLoginScreen();
  });
}

boot();
