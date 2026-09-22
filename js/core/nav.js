// Single source of truth for navigation. Sidebar, header title and the router
// are all driven from this tree so the structure only needs to change here.
export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '#/dashboard' },
  {
    id: 'budget', label: 'Budget', icon: 'budget',
    children: [
      { id: 'budget-overview', label: 'Overview', path: '#/budget' },
      { id: 'operating-budget', label: 'Operating Budget', icon: 'budget', path: '#/budget/operating' },
      { id: 'capex', label: 'CAPEX', icon: 'capex', path: '#/budget/capex' },
      { id: 'staff-budget', label: 'Staff Budget', icon: 'staff', path: '#/budget/staff' },
      { id: 'governance', label: 'Governance & Delegates', icon: 'gov', path: '#/budget/governance' },
      { id: 'funding', label: 'Funding & Financing', icon: 'fund', path: '#/budget/funding' },
      { id: 'consolidated', label: 'Consolidated Budget', icon: 'consolidated', path: '#/budget/consolidated' },
    ],
  },
  {
    id: 'actuals-group', label: 'Actuals', icon: 'actuals',
    children: [
      { id: 'monthly-actuals', label: 'Monthly Actuals', path: '#/actuals' },
    ],
  },
  {
    id: 'performance', label: 'Performance', icon: 'performance',
    children: [
      { id: 'perf-overview', label: 'Overview', path: '#/performance' },
      { id: 'budget-vs-actual', label: 'Budget vs Actual', path: '#/performance/budget-vs-actual' },
      { id: 'variance', label: 'Variance Analysis', path: '#/performance/variance' },
      { id: 'monthly-performance', label: 'Monthly Performance', path: '#/performance/monthly' },
      { id: 'branch-performance', label: 'Branch Performance', path: '#/performance/branch' },
    ],
  },
  {
    id: 'reports', label: 'Reports', icon: 'reports',
    children: [
      { id: 'report-centre', label: 'Report Centre', path: '#/reports' },
      { id: 'annual-reports', label: 'Annual Reports', path: '#/reports/annual' },
      { id: 'monthly-reports', label: 'Monthly Reports', path: '#/reports/monthly' },
      { id: 'branch-reports', label: 'Branch Reports', path: '#/reports/branch' },
      { id: 'capex-reports', label: 'CAPEX Reports', path: '#/reports/capex' },
      { id: 'funding-reports', label: 'Funding Reports', path: '#/reports/funding' },
      { id: 'management-report', label: 'Management Report', path: '#/reports/management' },
    ],
  },
  {
    id: 'setup', label: 'Setup', icon: 'setup',
    children: [
      { id: 'setup-accounts', label: 'Accounts / COA', icon: 'accounts', path: '#/setup/accounts' },
      { id: 'setup-branches', label: 'Branches', icon: 'branches', path: '#/setup/branches' },
      { id: 'setup-rules', label: 'Allocation Rules', icon: 'rules', path: '#/setup/allocation-rules' },
      { id: 'setup-assumptions', label: 'Assumptions', icon: 'assumptions', path: '#/setup/assumptions' },
    ],
  },
];

export function findByPath(path) {
  for (const item of NAV) {
    if (item.path === path) return { item, parent: null };
    for (const child of item.children || []) {
      if (child.path === path) return { item: child, parent: item };
    }
  }
  return null;
}

export function flatten() {
  const out = [];
  for (const item of NAV) {
    if (item.path) out.push(item);
    for (const child of item.children || []) out.push(child);
  }
  return out;
}
