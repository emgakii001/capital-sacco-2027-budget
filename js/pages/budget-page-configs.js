// Presentation config for each Supabase-connected budget/actuals module.
// All data-access, form-building, upload/template/guide/export behaviour
// lives in crud-engine.js — this file only says how each table should look.
import { kes } from '../core/format.js';

function distinctOptions(rows, key) {
  const seen = new Map();
  rows.forEach((r) => { const v = r[key]; if (v) seen.set(v, v); });
  return Array.from(seen.values()).sort().map((v) => ({ value: v, label: v }));
}

function branchFilter() {
  return { key: 'branch_id', label: 'Branch', options: (ref) => ref.branches.map((b) => ({ value: b.id, label: `${b.branch_code} — ${b.branch_name}` })) };
}
function accountFilter() {
  return { key: 'account_id', label: 'Account', options: (ref) => ref.accounts.map((a) => ({ value: a.id, label: `${a.account_code} — ${a.account_name}` })) };
}
function monthFilter() {
  return { key: 'month_id', label: 'Month', options: (ref) => ref.months.map((m) => ({ value: m.id, label: m.month_name })) };
}
function accountClassFilter() {
  return { key: 'account_class', label: 'Account Class', options: () => [{ value: 'Income', label: 'Income' }, { value: 'Expense', label: 'Expense' }] };
}

export const OPERATING_BUDGET_CFG = {
  specKey: 'operating_budget', icoName: 'budget', title: 'Operating Budget',
  lead: 'The main monthly income and expenditure budget, entered by branch, account and month.',
  select: 'id, budget_amount, notes, branch_id, account_id, month_id, branches(branch_code,branch_name), accounts(account_code,account_name,account_class), months(month_name,month_number)',
  order: { column: 'id', ascending: false },
  flatten: (r) => ({
    id: r.id, branch_id: r.branch_id, account_id: r.account_id, month_id: r.month_id,
    branch_label: `${r.branches?.branch_code ?? ''} — ${r.branches?.branch_name ?? ''}`,
    account_label: `${r.accounts?.account_code ?? ''} — ${r.accounts?.account_name ?? ''}`,
    account_class: r.accounts?.account_class ?? '', month_name: r.months?.month_name ?? '',
    budget_amount: r.budget_amount, notes: r.notes || '',
  }),
  displayColumns: [
    { header: 'Account', key: 'account_label' },
    { header: 'Branch', key: 'branch_label' },
    { header: 'Month', key: 'month_name' },
    { header: 'Budget Amount', key: 'budget_amount', html: (r) => kes(r.budget_amount), csv: (r) => r.budget_amount },
    { header: 'Notes', key: 'notes' },
  ],
  filters: [branchFilter(), accountFilter(), monthFilter(), accountClassFilter()],
};

export const CAPEX_CFG = {
  specKey: 'capex_budget', icoName: 'capex', title: 'CAPEX',
  lead: 'Capital expenditure items, kept separate from operating expenses.',
  select: 'id, branch_id, item_name, description, quantity, unit_cost, total_cost, funding_source, notes, branches(branch_code,branch_name)',
  order: { column: 'id', ascending: false },
  flatten: (r) => ({
    id: r.id, branch_id: r.branch_id, branch_label: `${r.branches?.branch_code ?? ''} — ${r.branches?.branch_name ?? ''}`,
    item_name: r.item_name, description: r.description || '', quantity: r.quantity, unit_cost: r.unit_cost,
    total_cost: r.total_cost, funding_source: r.funding_source || '', notes: r.notes || '',
  }),
  displayColumns: [
    { header: 'Item Name', key: 'item_name' },
    { header: 'Branch', key: 'branch_label' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Unit Cost', key: 'unit_cost', html: (r) => kes(r.unit_cost), csv: (r) => r.unit_cost },
    { header: 'Total Cost', key: 'total_cost', html: (r) => kes(r.total_cost), csv: (r) => r.total_cost },
    { header: 'Funding Source', key: 'funding_source' },
  ],
  filters: [branchFilter(), { key: 'funding_source', label: 'Funding Source', options: (ref, rows) => distinctOptions(rows, 'funding_source') }],
  summary: (rows) => {
    const total = rows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
    return `
      <div class="card"><div class="card-head"><h3>CAPEX Summary</h3></div>
      <div class="card-body ph-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat"><div class="stat-top">Total CAPEX Requirement</div><div class="stat-value num">${kes(total)}</div></div>
        <div class="stat"><div class="stat-top">Total Funded</div><div class="stat-value is-empty">Funding data not yet connected</div></div>
        <div class="stat"><div class="stat-top">Funding Gap</div><div class="stat-value is-empty">Funding data not yet connected</div></div>
      </div></div>
      <div class="banner banner-warn">CAPEX funding cannot yet be reliably identified in the database (<code>funding_budget</code> is not linked to individual CAPEX items), so Total Funded and Funding Gap are shown separately as not yet connected rather than estimated.</div>`;
  },
};

export const STAFF_CFG = {
  specKey: 'staff_budget', icoName: 'staff', title: 'Staff Budget',
  lead: 'A supporting schedule for staff costs. Not added into Operating Budget totals — see the note on Consolidated Budget.',
  select: 'id, branch_id, account_id, budget_item, number_of_staff, monthly_amount, months, annual_amount, notes, branches(branch_code,branch_name), accounts(account_code,account_name)',
  order: { column: 'id', ascending: false },
  flatten: (r) => ({
    id: r.id, branch_id: r.branch_id, account_id: r.account_id,
    branch_label: `${r.branches?.branch_code ?? ''} — ${r.branches?.branch_name ?? ''}`,
    account_label: `${r.accounts?.account_code ?? ''} — ${r.accounts?.account_name ?? ''}`,
    budget_item: r.budget_item, number_of_staff: r.number_of_staff, monthly_amount: r.monthly_amount,
    months: r.months, annual_amount: r.annual_amount, notes: r.notes || '',
  }),
  displayColumns: [
    { header: 'Budget Item', key: 'budget_item' },
    { header: 'Branch', key: 'branch_label' },
    { header: 'Number of Staff', key: 'number_of_staff' },
    { header: 'Monthly Amount', key: 'monthly_amount', html: (r) => kes(r.monthly_amount), csv: (r) => r.monthly_amount },
    { header: 'Months', key: 'months' },
    { header: 'Annual Amount', key: 'annual_amount', html: (r) => kes(r.annual_amount), csv: (r) => r.annual_amount },
  ],
  filters: [branchFilter(), { key: 'budget_item', label: 'Budget Item', options: (ref, rows) => distinctOptions(rows, 'budget_item') }],
};

export const GOVERNANCE_CFG = {
  specKey: 'governance_budget', icoName: 'gov', title: 'Governance & Delegates',
  lead: 'A flexible schedule for governance costs. The calculation method chosen determines which fields apply.',
  select: 'id, branch_id, account_id, budget_item, calculation_method, quantity, persons, rate, meetings_or_days, annual_amount, tax_provision, notes, branches(branch_code,branch_name), accounts(account_code,account_name)',
  order: { column: 'id', ascending: false },
  flatten: (r) => ({
    id: r.id, branch_id: r.branch_id, account_id: r.account_id,
    branch_label: `${r.branches?.branch_code ?? ''} — ${r.branches?.branch_name ?? ''}`,
    account_label: `${r.accounts?.account_code ?? ''} — ${r.accounts?.account_name ?? ''}`,
    budget_item: r.budget_item, calculation_method: r.calculation_method, annual_amount: r.annual_amount,
    tax_provision: r.tax_provision, notes: r.notes || '',
  }),
  displayColumns: [
    { header: 'Budget Item', key: 'budget_item' },
    { header: 'Branch', key: 'branch_label' },
    { header: 'Calculation Method', key: 'calculation_method' },
    { header: 'Annual Amount', key: 'annual_amount', html: (r) => kes(r.annual_amount), csv: (r) => r.annual_amount },
    { header: 'Tax Provision', key: 'tax_provision', html: (r) => kes(r.tax_provision), csv: (r) => r.tax_provision },
  ],
  filters: [branchFilter(), { key: 'calculation_method', label: 'Calculation Method', options: (ref, rows) => distinctOptions(rows, 'calculation_method') }],
};

export const FUNDING_CFG = {
  specKey: 'funding_budget', icoName: 'fund', title: 'Funding & Financing',
  lead: 'What needs funding, how it will be financed, and where the money will come from.',
  select: 'id, branch_id, funding_requirement, purpose, financing_type, amount_required, amount_funded, funding_source, status, notes, branches(branch_code,branch_name)',
  order: { column: 'id', ascending: false },
  flatten: (r) => ({
    id: r.id, branch_id: r.branch_id, branch_label: `${r.branches?.branch_code ?? ''} — ${r.branches?.branch_name ?? ''}`,
    funding_requirement: r.funding_requirement, financing_type: r.financing_type || '', amount_required: r.amount_required,
    amount_funded: r.amount_funded, funding_gap: (Number(r.amount_required) || 0) - (Number(r.amount_funded) || 0),
    funding_source: r.funding_source || '', status: r.status || '',
  }),
  displayColumns: [
    { header: 'Funding Requirement', key: 'funding_requirement' },
    { header: 'Branch', key: 'branch_label' },
    { header: 'Financing Type', key: 'financing_type' },
    { header: 'Amount Required', key: 'amount_required', html: (r) => kes(r.amount_required), csv: (r) => r.amount_required },
    { header: 'Amount Funded', key: 'amount_funded', html: (r) => kes(r.amount_funded), csv: (r) => r.amount_funded },
    { header: 'Funding Gap', key: 'funding_gap', html: (r) => kes(r.funding_gap), csv: (r) => r.funding_gap },
    { header: 'Status', key: 'status' },
  ],
  filters: [
    branchFilter(),
    { key: 'financing_type', label: 'Financing Type', options: (ref, rows) => distinctOptions(rows, 'financing_type') },
    { key: 'status', label: 'Status', options: (ref, rows) => distinctOptions(rows, 'status') },
  ],
  summary: (rows) => {
    const req = rows.reduce((s, r) => s + (Number(r.amount_required) || 0), 0);
    const funded = rows.reduce((s, r) => s + (Number(r.amount_funded) || 0), 0);
    return `
      <div class="card"><div class="card-head"><h3>Funding Summary</h3></div>
      <div class="card-body ph-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat"><div class="stat-top">Total Required</div><div class="stat-value num">${kes(req)}</div></div>
        <div class="stat"><div class="stat-top">Total Funded</div><div class="stat-value num">${kes(funded)}</div></div>
        <div class="stat"><div class="stat-top">Total Gap</div><div class="stat-value num">${kes(req - funded)}</div></div>
      </div></div>`;
  },
};

export const ACTUALS_CFG = {
  specKey: 'actuals', icoName: 'actuals', title: 'Actuals',
  lead: 'Monthly actual transactions. Multiple rows can share the same branch, account and month.',
  select: 'id, branch_id, account_id, month_id, actual_amount, reference, description, notes, branches(branch_code,branch_name), accounts(account_code,account_name,account_class), months(month_name,month_number)',
  order: { column: 'id', ascending: false },
  flatten: (r) => ({
    id: r.id, branch_id: r.branch_id, account_id: r.account_id, month_id: r.month_id,
    branch_label: `${r.branches?.branch_code ?? ''} — ${r.branches?.branch_name ?? ''}`,
    account_label: `${r.accounts?.account_code ?? ''} — ${r.accounts?.account_name ?? ''}`,
    account_class: r.accounts?.account_class ?? '', month_name: r.months?.month_name ?? '',
    actual_amount: r.actual_amount, reference: r.reference || '', description: r.description || '',
  }),
  displayColumns: [
    { header: 'Branch', key: 'branch_label' },
    { header: 'Account', key: 'account_label' },
    { header: 'Month', key: 'month_name' },
    { header: 'Actual Amount', key: 'actual_amount', html: (r) => kes(r.actual_amount), csv: (r) => r.actual_amount },
    { header: 'Reference', key: 'reference' },
    { header: 'Description', key: 'description' },
  ],
  filters: [branchFilter(), accountFilter(), accountClassFilter(), monthFilter()],
  emptyNote: 'No actual data has been entered yet for this year.',
};
