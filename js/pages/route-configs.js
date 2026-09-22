// Per-route content for every screen that isn't fully built yet. Fields,
// upload columns and calculations are taken verbatim from the brief and the
// confirmed schema — nothing here is invented.
import { MONTHS } from '../data/branches.js';
import { BUDGET_YEAR } from '../core/supabase-client.js';

const uploadActions = [
  { label: 'Add New', icon: 'add', primary: true },
  { label: 'Upload Excel', icon: 'upload' },
  { label: 'Download Template', icon: 'download' },
  { label: 'Upload Guide', icon: 'help' },
];

export const ROUTES = {
  '#/budget/operating': {
    title: 'Operating Budget', icoName: 'budget',
    lead: 'The main monthly income and expenditure budget, entered by branch, account and month.',
    fields: ['Budget Year', 'Branch', 'Account', 'Month', 'Budget Amount', 'Notes'],
    uploadColumns: ['budget_year', 'branch_code', 'account_code', 'month', 'budget_amount', 'notes'],
    filters: ['Branch', 'Account', 'Month', 'Account class', 'Year'],
    tableColumns: ['Account', 'Branch', 'Month', 'Budget Amount', 'Notes'],
    tableTitle: 'Operating budget records', actions: uploadActions,
  },
  '#/budget/capex': {
    title: 'CAPEX', icoName: 'capex',
    lead: 'Capital expenditure items, kept separate from operating expenses.',
    fields: ['Budget Year', 'Branch', 'Item Name', 'Description', 'Quantity', 'Unit Cost', 'Total Cost', 'Funding Source', 'Notes'],
    formulas: [{ label: 'Total Cost', value: 'Quantity × Unit Cost' }],
    filters: ['Branch', 'Funding Source', 'Year'],
    tableColumns: ['Item Name', 'Branch', 'Quantity', 'Unit Cost', 'Total Cost', 'Funding Source'],
    tableTitle: 'CAPEX records', actions: uploadActions,
    extraCards: [`
      <div class="card"><div class="card-head"><h3>CAPEX Summary</h3></div>
      <div class="card-body ph-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat"><div class="stat-top">Total CAPEX Requirement</div><div class="stat-value is-empty">Not yet connected</div></div>
        <div class="stat"><div class="stat-top">Total Funded</div><div class="stat-value is-empty">Funding data not yet connected</div></div>
        <div class="stat"><div class="stat-top">Funding Gap</div><div class="stat-value is-empty">Funding data not yet connected</div></div>
      </div></div>`],
    warning: 'CAPEX funding cannot yet be reliably identified in the database (<code>funding_budget</code> is not linked to individual CAPEX items), so Total Funded and Funding Gap are shown separately as not yet connected rather than estimated.',
  },
  '#/budget/staff': {
    title: 'Staff Budget', icoName: 'staff',
    lead: 'A supporting schedule for staff costs — number of staff, monthly amount per person, and the months it applies to.',
    fields: ['Budget Year', 'Branch', 'Account', 'Budget Item', 'Number of Staff', 'Monthly Amount (per staff member)', 'Months', 'Annual Amount', 'Notes'],
    formulas: [{ label: 'Annual Amount', value: 'Number of Staff × Monthly Amount × Months' }],
    filters: ['Branch', 'Budget Item', 'Year'],
    tableColumns: ['Budget Item', 'Branch', 'Number of Staff', 'Monthly Amount', 'Months', 'Annual Amount'],
    tableTitle: 'Staff budget records', actions: uploadActions,
    tableNote: 'Staff Budget supports the Operating Budget rather than creating a duplicate expense total.',
  },
  '#/budget/governance': {
    title: 'Governance & Delegates', icoName: 'gov',
    lead: 'A flexible schedule for governance costs. The calculation method chosen determines which fields apply.',
    fields: ['Budget Year', 'Branch', 'Account', 'Budget Item', 'Calculation Method', 'Quantity', 'Persons', 'Rate', 'Meetings or Days', 'Annual Amount', 'Tax Provision (KES)', 'Notes'],
    statusList: [
      { label: 'Meetings × Persons × Rate', value: 'Method' }, { label: 'Days × Persons × Rate', value: 'Method' },
      { label: 'Assignments × Persons × Rate', value: 'Method' }, { label: 'Night-outs × Persons × Rate', value: 'Method' },
      { label: 'Fixed', value: 'Method' }, { label: 'Other / Custom', value: 'Method' },
    ],
    filters: ['Branch', 'Calculation Method', 'Year'],
    tableColumns: ['Budget Item', 'Branch', 'Calculation Method', 'Annual Amount', 'Tax Provision'],
    tableTitle: 'Governance budget records', actions: uploadActions,
    warning: 'Tax Provision is stored as a KES amount, not a rate. No tax rate is assumed — whether it is included in or added to the Annual Amount is set per entry.',
  },
  '#/budget/funding': {
    title: 'Funding & Financing', icoName: 'fund',
    lead: 'What needs funding, how it will be financed, and where the money will come from — kept as three separate concepts.',
    fields: ['Budget Year', 'Branch', 'Funding Requirement', 'Purpose', 'Financing Type', 'Amount Required', 'Amount Funded', 'Funding Source', 'Status', 'Notes'],
    formulas: [{ label: 'Funding Gap', value: 'Amount Required − Amount Funded' }],
    filters: ['Branch', 'Financing Type', 'Status', 'Year'],
    tableColumns: ['Funding Requirement', 'Branch', 'Financing Type', 'Amount Required', 'Amount Funded', 'Funding Gap', 'Status'],
    tableTitle: 'Funding & financing records', actions: uploadActions,
    tableNote: 'Status is a free-form field until Capital SACCO defines its own standard status list.',
  },
  '#/budget/consolidated': {
    title: 'Consolidated Budget', icoName: 'consolidated',
    lead: 'A reporting view combining Income, Operating Expenses, CAPEX, Staff, Governance and Funding — without duplicating source data.',
    filters: ['Budget Year', 'Branch', 'Month', 'Account', 'Account Class'],
    tableColumns: ['Category', 'Annual Total', 'Notes'],
    tableTitle: 'Consolidated view', actions: [{ label: 'Export Excel', icon: 'download' }, { label: 'Export PDF', icon: 'download' }, { label: 'Export CSV', icon: 'download' }],
    tableNote: 'Category filtering is limited to what the schema supports today — see the note above.',
    warning: '<code>budget_categories</code> has no link to <code>accounts</code> yet, so category-level totals show as Not yet connected rather than an invented mapping.',
  },

  '#/actuals': {
    title: 'Actuals', icoName: 'actuals',
    lead: 'Monthly actuals entry, plus Year-to-Date and Full Year views.',
    fields: ['Year', 'Month', 'Branch', 'Account', 'Actual Amount', 'Reference', 'Description', 'Notes'],
    uploadColumns: ['budget_year', 'branch_code', 'account_code', 'month', 'actual_amount', 'reference', 'description', 'notes'],
    filters: ['Branch', 'Account', 'Account class', 'Month'],
    tableColumns: ['Branch', 'Account', 'Actual Amount', 'Reference', 'Description'],
    tableTitle: 'Monthly Actuals', actions: uploadActions,
    tabs: ['Monthly', 'Year-to-Date', 'Full Year'],
    tableNote: 'If a month already contains data, uploads will offer to view, replace, add missing records, or cancel — nothing is overwritten silently.',
    months: MONTHS, year: BUDGET_YEAR,
  },

  '#/performance': {
    title: 'Performance Overview', icoName: 'performance',
    lead: 'How the SACCO is performing against what was budgeted.',
    filters: ['Year', 'Period', 'Branch', 'Category', 'Account'],
    extraCards: [`
      <div class="ph-grid">
        ${['Income', 'Expenses', 'Surplus', 'CAPEX'].map((label) => `
        <div class="card"><div class="card-head"><h3>${label}</h3></div><div class="card-body">
          <div class="status-list">
            <li><span>Budget</span><span class="pill pill-muted">Not yet connected</span></li>
            <li><span>Actual</span><span class="pill pill-muted">Not yet connected</span></li>
            <li><span>Variance</span><span class="pill pill-muted">Not yet connected</span></li>
          </div></div></div>`).join('')}
      </div>`],
    tableColumns: [], tableTitle: 'Performance detail',
  },
  '#/performance/budget-vs-actual': {
    title: 'Budget vs Actual', icoName: 'performance',
    lead: 'Drill down from Total SACCO to Branch, Account Class, Account and Month.',
    formulas: [{ label: 'Variance', value: 'Actual − Budget' }, { label: 'Variance %', value: '(Actual − Budget) / Budget × 100' }],
    filters: ['Year', 'Branch', 'Account Class', 'Account', 'Month'],
    tableColumns: ['Account', 'Budget', 'Actual', 'Variance', 'Variance %'],
    tableTitle: 'Budget vs Actual', tableNote: 'Zero-budget rows are handled safely rather than dividing by zero.',
  },
  '#/performance/variance': {
    title: 'Variance Analysis', icoName: 'variance',
    lead: 'Variance is shown as a figure, not labelled favourable or unfavourable until that is explicitly defined.',
    filters: ['Year', 'Branch', 'Account', 'Month'],
    tableColumns: ['Account', 'Budget', 'Actual', 'Variance', 'Variance %'],
    tableTitle: 'Variance detail',
  },
  '#/performance/monthly': {
    title: 'Monthly Performance', icoName: 'performance',
    lead: 'A line chart of Income and Expenses across January–December, filterable by branch, category and account.',
    filters: ['Branch', 'Category', 'Account'],
    tableColumns: [], tableTitle: 'Monthly performance chart',
  },
  '#/performance/branch': {
    title: 'Branch Performance', icoName: 'branchperf',
    lead: 'A column chart comparing Budget and Actual across all 16 branches.',
    filters: ['Period', 'Category', 'Account'],
    tableColumns: [], tableTitle: 'Branch performance chart',
  },

  '#/reports': {
    title: 'Report Centre', icoName: 'reports',
    lead: 'Select a report type, filter it, generate, view and export.',
    filters: ['Report Type', 'Year', 'Period', 'Branch', 'Account Category', 'Account'],
    tableColumns: [], tableTitle: 'Report output',
    actions: [{ label: 'Generate Report', icon: 'view', primary: true }, { label: 'Export Excel', icon: 'download' }, { label: 'Export PDF', icon: 'download' }, { label: 'Export CSV', icon: 'download' }, { label: 'Print', icon: 'view' }],
  },
  '#/reports/annual': { title: 'Annual Reports', icoName: 'reports', lead: 'Total Income, Total Expenses, Budgeted Surplus and Total CAPEX, with income and expense detail by account.', tableColumns: ['Account', 'Annual Budget'], tableTitle: 'Annual Budget Report' },
  '#/reports/monthly': { title: 'Monthly Reports', icoName: 'reports', lead: 'Monthly budget and monthly actuals reports, by account.', filters: ['Month', 'Branch', 'Account'], tableColumns: ['Account', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Annual'], tableTitle: 'Monthly Budget Report' },
  '#/reports/branch': { title: 'Branch Reports', icoName: 'reports', lead: 'Budget and actual income, expenses, surplus and variance for a selected branch.', filters: ['Branch', 'Year'], tableColumns: ['Metric', 'Budget', 'Actual', 'Variance'], tableTitle: 'Branch Report' },
  '#/reports/capex': { title: 'CAPEX Reports', icoName: 'capex', lead: 'CAPEX requirement, funding and funding gap, by item.', tableColumns: ['Item', 'Branch', 'Quantity', 'Unit Cost', 'Total Cost', 'Funding Source'], tableTitle: 'CAPEX Report', warning: 'Total Funded and Funding Gap remain not yet connected — see the CAPEX Budget page for why.' },
  '#/reports/funding': { title: 'Funding Reports', icoName: 'fund', lead: 'Requirement, purpose, financing type, source, amounts and status.', tableColumns: ['Requirement', 'Purpose', 'Financing Type', 'Funding Source', 'Amount Required', 'Amount Funded', 'Funding Gap', 'Status'], tableTitle: 'Funding Report' },
  '#/reports/management': {
    title: 'Management Report', icoName: 'reports',
    lead: 'A management-ready report: Executive Summary, Income Performance, Expense Performance, Monthly Performance, Branch Performance, Variance Analysis, CAPEX Summary and Funding Summary.',
    tableColumns: [], tableTitle: 'Management Report',
  },

  '#/setup/accounts': {
    title: 'Accounts / COA', icoName: 'accounts',
    lead: 'The Chart of Accounts used throughout the budgeting and reporting system.',
    filters: ['Search'],
    tableColumns: ['Code', 'Account Name', 'Class'],
    tableTitle: 'Chart of Accounts', actions: [{ label: 'Add Account', icon: 'add', primary: true }],
    tableNote: 'Accounts already referenced by budget or actual records cannot be casually deleted.',
    warning: 'Setup controls information used throughout the budgeting and reporting system. Changes may affect budgets, actuals and reports.',
  },
  '#/setup/branches': {
    title: 'Branches', icoName: 'branches',
    lead: 'The 16 existing Capital SACCO branches.',
    filters: ['Search'],
    tableColumns: ['Branch Code', 'Branch Name'],
    tableTitle: 'Branches', actions: [{ label: 'Add Branch', icon: 'add', primary: true }],
    warning: 'Setup controls information used throughout the budgeting and reporting system. Changes may affect budgets, actuals and reports.',
  },
  '#/setup/allocation-rules': {
    title: 'Allocation Rules', icoName: 'rules',
    lead: 'No allocation rules have been added yet.',
    fields: ['Rule Name', 'Allocation Method', 'Description'],
    tableColumns: ['Rule Name', 'Allocation Method', 'Description'],
    tableTitle: 'Allocation Rules', actions: [{ label: 'Add Rule', icon: 'add', primary: true }],
    warning: 'Setup controls information used throughout the budgeting and reporting system. Changes may affect budgets, actuals and reports.',
  },
  '#/setup/assumptions': {
    title: 'Assumptions', icoName: 'assumptions',
    lead: 'No budget assumptions have been added yet.',
    fields: ['Assumption Name', 'Assumption Value', 'Unit', 'Description'],
    tableColumns: ['Assumption Name', 'Value', 'Unit', 'Description'],
    tableTitle: 'Assumptions', actions: [{ label: 'Add Assumption', icon: 'add', primary: true }],
    warning: 'Setup controls information used throughout the budgeting and reporting system. Changes may affect budgets, actuals and reports.',
  },
};
