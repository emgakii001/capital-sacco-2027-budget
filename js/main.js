import { auth } from './core/auth.js';
import { findByPath } from './core/nav.js';
import { initYearContext } from './core/year-context.js';
import { renderSidebar, wireSidebar } from './components/sidebar.js';
import { renderHeader, wireHeader } from './components/header.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderBudgetOverview } from './pages/budget-overview.js';
import { renderPlaceholderPage } from './pages/placeholder.js';
import { ROUTES } from './pages/route-configs.js';
import { renderCrudModule } from './pages/crud-engine.js';
import { OPERATING_BUDGET_CFG, CAPEX_CFG, STAFF_CFG, GOVERNANCE_CFG, FUNDING_CFG } from './pages/budget-page-configs.js';
import { renderActualsPage } from './pages/actuals-page.js';
import { renderConsolidatedBudget } from './pages/consolidated-budget.js';
import { renderSetupAccounts, renderSetupBranches, renderSetupAllocationRules, renderSetupAssumptions } from './pages/setup-pages.js';
import { renderPerformanceOverview, renderBudgetVsActual, renderMonthlyPerformance, renderBranchPerformance } from './pages/performance-pages.js';
import { renderReportCentre, renderAnnualReport, renderMonthlyReport, renderBranchReport, renderCapexReport, renderFundingReport, renderManagementReport } from './pages/report-pages.js';

// Routes that are fully wired to Supabase. Anything not listed here still
// falls back to the descriptive placeholder page (see route-configs.js).
const CONNECTED_ROUTES = {
  '#/budget/operating': (el) => renderCrudModule(el, OPERATING_BUDGET_CFG),
  '#/budget/capex': (el) => renderCrudModule(el, CAPEX_CFG),
  '#/budget/staff': (el) => renderCrudModule(el, STAFF_CFG),
  '#/budget/governance': (el) => renderCrudModule(el, GOVERNANCE_CFG),
  '#/budget/funding': (el) => renderCrudModule(el, FUNDING_CFG),
  '#/budget/consolidated': (el) => renderConsolidatedBudget(el),
  '#/actuals': (el) => renderActualsPage(el),
  '#/setup/accounts': (el) => renderSetupAccounts(el),
  '#/setup/branches': (el) => renderSetupBranches(el),
  '#/setup/allocation-rules': (el) => renderSetupAllocationRules(el),
  '#/setup/assumptions': (el) => renderSetupAssumptions(el),
  '#/performance': (el) => renderPerformanceOverview(el),
  '#/performance/budget-vs-actual': (el) => renderBudgetVsActual(el),
  '#/performance/monthly': (el) => renderMonthlyPerformance(el),
  '#/performance/branch': (el) => renderBranchPerformance(el),
  '#/reports': (el) => renderReportCentre(el),
  '#/reports/annual': (el) => renderAnnualReport(el),
  '#/reports/monthly': (el) => renderMonthlyReport(el),
  '#/reports/branch': (el) => renderBranchReport(el),
  '#/reports/capex': (el) => renderCapexReport(el),
  '#/reports/funding': (el) => renderFundingReport(el),
  '#/reports/management': (el) => renderManagementReport(el),
};

const root = document.getElementById('app');
let currentSession = null;

function pathTitle(path) {
  const found = findByPath(path);
  if (!found) return 'Budget Management System';
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
  if (CONNECTED_ROUTES[path]) { CONNECTED_ROUTES[path](content); return; }
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

function updateHeader() {
  const header = document.querySelector('.header');
  const path = window.location.hash || '#/dashboard';
  if (header) {
    header.outerHTML = renderHeader({ title: pathTitle(path), user: currentSession?.user, isLive: auth.isLive });
    wireHeader({
      onLogout: async () => { await auth.signOut(); renderLoginScreen(); },
      onMenuToggle: () => document.getElementById('shell')?.classList.toggle('drawer-open'),
      onYearChange: () => { updateHeader(); renderRoute(window.location.hash || '#/dashboard'); },
    });
  }
}

async function renderShell(session) {
  currentSession = session;
  await initYearContext();
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
    onYearChange: () => { updateHeader(); renderRoute(window.location.hash || '#/dashboard'); },
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
