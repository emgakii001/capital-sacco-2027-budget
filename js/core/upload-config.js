// Single source of truth for every module's Excel template, Upload Guide
// content, and row-level import validation. Add a module here once and the
// Download Template button, the Upload Guide modal, and the importer all
// stay in sync automatically — nothing about a module's columns is
// duplicated elsewhere.
import { branchIdByCode, accountIdByCode, monthIdByValue, safeNum } from './db.js';
import { getSelectedYearLabel } from './year-context.js';

const CALC_METHODS = ['Meetings × Persons × Rate', 'Days × Persons × Rate', 'Assignments × Persons × Rate', 'Night-outs × Persons × Rate', 'Fixed', 'Other / Custom'];

function col(key, header, required, kind, example, note, options) {
  return { key, header, required, kind, example, note, options };
}

function resolveCommon(kind, raw, ref, colHeader, options) {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (kind === 'text' && options && options.length) {
    if (!value) return { error: `${colHeader} is required` };
    const match = options.find((o) => o.toLowerCase() === String(value).toLowerCase());
    if (!match) return { error: `${colHeader} "${value}" must be one of: ${options.join(', ')}` };
    return { value: match };
  }
  switch (kind) {
    case 'year': {
      // The budget year is never hard-coded — a row is only valid for
      // whichever year is currently selected in the app header.
      if (!ref.year) return { error: 'No budget year is selected. Select or add a budget year first.' };
      if (!value && value !== 0) return { error: `${colHeader} is required` };
      if (String(value).trim() !== String(ref.year.year)) {
        return { error: `${colHeader} "${value}" does not match the currently selected budget year (${ref.year.year}). Switch to that year in the header, or select the year this file is for before uploading.` };
      }
      return { value: ref.year.id };
    }
    case 'branch_code': {
      if (!value && value !== 0) return { error: `${colHeader} is required` };
      const id = branchIdByCode(ref, value);
      if (!id) return { error: `Invalid branch code: ${value}` };
      return { value: id };
    }
    case 'account_code': {
      if (!value && value !== 0) return { error: `${colHeader} is required` };
      const id = accountIdByCode(ref, value);
      if (!id) return { error: `Invalid account code: ${value}` };
      return { value: id };
    }
    case 'month': {
      if (!value) return { error: `${colHeader} is required` };
      const id = monthIdByValue(ref, value);
      if (!id) return { error: `Invalid month: ${value}` };
      return { value: id };
    }
    case 'amount':
    case 'number': {
      if (value === '' || value === null || value === undefined) return kind === 'number' ? { value: null } : { error: `${colHeader} is required` };
      const n = Number(value);
      if (!Number.isFinite(n)) return { error: `${colHeader} must be numeric` };
      return { value: n };
    }
    case 'text':
      return { value: value ? String(value).trim() : '' };
    default:
      return { value };
  }
}

// Generic row parser shared by every module: walks the column spec, resolves
// each value, collects every problem for the row (not just the first), and
// returns a Supabase-ready payload only when the row is fully valid.
function parseRowGeneric(spec, raw, ref) {
  const errors = [];
  const payload = {};
  spec.columns.forEach((c) => {
    const rawVal = raw[c.header];
    if (!c.required && (rawVal === '' || rawVal === undefined || rawVal === null)) {
      payload[c.key] = c.kind === 'amount' || c.kind === 'number' ? null : '';
      return;
    }
    const { value, error } = resolveCommon(c.kind, rawVal, ref, c.header, c.options);
    if (error) errors.push(error);
    else payload[c.field || c.key] = value;
  });
  return { payload, errors };
}

export const UPLOAD_SPECS = {
  operating_budget: {
    key: 'operating_budget', label: 'Operating Budget',
    fileBaseName: 'capital-sacco-operating-budget-template',
    purpose: 'Bulk-upload monthly operating budget amounts by branch, account and month.',
    calcNote: 'None — each row is a direct monthly budget amount.',
    columns: [
      col('budget_year', 'budget_year', true, 'year', '(current year)', 'Must match the currently selected budget year, shown in the app header.'),
      col('branch_code', 'branch_code', true, 'branch_code', '01', 'A branch code from Setup → Branches (00–15).'),
      col('account_code', 'account_code', true, 'account_code', '<a code from Setup → Accounts / COA>', 'A valid account code from the Chart of Accounts.'),
      col('month', 'month', true, 'month', 'January', 'Full month name preferred (January–December). "1" or "Jan" are also accepted.'),
      col('budget_amount', 'budget_amount', true, 'amount', 250000, 'Numeric KES amount — no currency symbol or thousands separator.'),
      col('notes', 'notes', false, 'text', '', 'Optional free text.'),
    ],
    sampleRow: { budget_year: '', branch_code: '01', account_code: '<use a real code from your COA>', month: 'January', budget_amount: 250000, notes: 'Example row — replace with your own data' },
    fkMap: { budget_year: 'budget_year_id', branch_code: 'branch_id', account_code: 'account_id', month: 'month_id' },
    buildPayload(raw, ref) {
      const { payload, errors } = parseRowGeneric(this, raw, ref);
      return {
        errors,
        payload: errors.length ? null : {
          budget_year_id: payload.budget_year, branch_id: payload.branch_code, account_id: payload.account_code,
          month_id: payload.month, budget_amount: payload.budget_amount, notes: payload.notes || null,
        },
      };
    },
  },

  capex_budget: {
    key: 'capex_budget', label: 'CAPEX',
    fileBaseName: 'capital-sacco-capex-template',
    purpose: 'Bulk-upload capital expenditure items by branch.',
    calcNote: 'total_cost = quantity × unit_cost. Leave total_cost blank and it will be calculated automatically; if you fill it in, your value is used as given.',
    columns: [
      col('budget_year', 'budget_year', true, 'year', '(current year)', 'Must match the currently selected budget year, shown in the app header.'),
      col('branch_code', 'branch_code', true, 'branch_code', '00', 'A branch code from Setup → Branches.'),
      col('item_name', 'item_name', true, 'text', 'Toyota Hiace', 'Short name of the CAPEX item.'),
      col('description', 'description', false, 'text', '', 'Optional detail.'),
      col('quantity', 'quantity', true, 'number', 1, 'Numeric quantity.'),
      col('unit_cost', 'unit_cost', true, 'number', 3500000, 'Numeric KES unit cost.'),
      col('total_cost', 'total_cost', false, 'number', '', 'Optional — calculated as quantity × unit_cost if left blank.'),
      col('funding_source', 'funding_source', false, 'text', '', 'Optional free text, e.g. Reserves, Commercial Bank.'),
      col('notes', 'notes', false, 'text', '', 'Optional.'),
    ],
    sampleRow: { budget_year: '', branch_code: '00', item_name: 'Example item — replace', description: '', quantity: 1, unit_cost: 100000, total_cost: '', funding_source: '', notes: 'Example row — replace with your own data' },
    buildPayload(raw, ref) {
      const { payload, errors } = parseRowGeneric(this, raw, ref);
      if (errors.length) return { errors, payload: null };
      const total = payload.total_cost != null && payload.total_cost !== '' ? safeNum(payload.total_cost) : safeNum(payload.quantity) * safeNum(payload.unit_cost);
      return {
        errors: [],
        payload: {
          budget_year_id: payload.budget_year, branch_id: payload.branch_code, item_name: payload.item_name,
          description: payload.description || null, quantity: payload.quantity, unit_cost: payload.unit_cost,
          total_cost: total, funding_source: payload.funding_source || null, notes: payload.notes || null,
        },
      };
    },
  },

  staff_budget: {
    key: 'staff_budget', label: 'Staff Budget',
    fileBaseName: 'capital-sacco-staff-budget-template',
    purpose: 'Bulk-upload staff cost schedule items by branch.',
    calcNote: 'annual_amount = number_of_staff × monthly_amount × months. monthly_amount is per staff member. Leave annual_amount blank to have it calculated, or provide your own figure.',
    columns: [
      col('budget_year', 'budget_year', true, 'year', '(current year)', 'Must match the currently selected budget year, shown in the app header.'),
      col('branch_code', 'branch_code', true, 'branch_code', '00', 'A branch code from Setup → Branches.'),
      col('account_code', 'account_code', true, 'account_code', '<a code from Setup → Accounts / COA>', 'A valid account code, typically a staff-cost account.'),
      col('budget_item', 'budget_item', true, 'text', 'Salaries', 'e.g. Salaries, Training, Staff Travel.'),
      col('number_of_staff', 'number_of_staff', true, 'number', 5, 'Numeric count of staff.'),
      col('monthly_amount', 'monthly_amount', true, 'number', 45000, 'Numeric KES amount per staff member, per month.'),
      col('months', 'months', true, 'number', 12, 'Number of months this applies to (usually 12).'),
      col('annual_amount', 'annual_amount', false, 'number', '', 'Optional — calculated if left blank.'),
      col('notes', 'notes', false, 'text', '', 'Optional.'),
    ],
    sampleRow: { budget_year: '', branch_code: '00', account_code: '<use a real code from your COA>', budget_item: 'Example item — replace', number_of_staff: 1, monthly_amount: 0, months: 12, annual_amount: '', notes: 'Example row — replace with your own data' },
    buildPayload(raw, ref) {
      const { payload, errors } = parseRowGeneric(this, raw, ref);
      if (errors.length) return { errors, payload: null };
      const annual = payload.annual_amount != null && payload.annual_amount !== '' ? safeNum(payload.annual_amount) : safeNum(payload.number_of_staff) * safeNum(payload.monthly_amount) * safeNum(payload.months);
      return {
        errors: [],
        payload: {
          budget_year_id: payload.budget_year, branch_id: payload.branch_code, account_id: payload.account_code,
          budget_item: payload.budget_item, number_of_staff: payload.number_of_staff, monthly_amount: payload.monthly_amount,
          months: payload.months, annual_amount: annual, notes: payload.notes || null,
        },
      };
    },
  },

  governance_budget: {
    key: 'governance_budget', label: 'Governance & Delegates',
    fileBaseName: 'capital-sacco-governance-template',
    purpose: 'Bulk-upload governance and delegates cost items by branch.',
    calcNote: `For Meetings/Days/Assignments/Night-outs methods: annual_amount = Persons × Rate × (meetings_or_days, or quantity if that's blank) when left blank. For "Fixed" or "Other / Custom", annual_amount must be provided — it cannot be derived automatically. Supported methods: ${CALC_METHODS.join(', ')}. tax_provision is a KES amount, not a percentage — no tax rate is assumed.`,
    columns: [
      col('budget_year', 'budget_year', true, 'year', '(current year)', 'Must match the currently selected budget year, shown in the app header.'),
      col('branch_code', 'branch_code', true, 'branch_code', '00', 'A branch code from Setup → Branches.'),
      col('account_code', 'account_code', true, 'account_code', '<a code from Setup → Accounts / COA>', 'A valid governance-related account code.'),
      col('budget_item', 'budget_item', true, 'text', 'AGM', 'e.g. AGM, Board Meetings, Delegates Conference.'),
      col('calculation_method', 'calculation_method', true, 'text', 'Meetings × Persons × Rate', `One of: ${CALC_METHODS.join(' | ')}`, CALC_METHODS),
      col('quantity', 'quantity', false, 'number', '', 'Optional, method-dependent.'),
      col('persons', 'persons', false, 'number', '', 'Number of persons, where relevant.'),
      col('rate', 'rate', false, 'number', '', 'Rate per meeting/day/assignment/night-out, where relevant.'),
      col('meetings_or_days', 'meetings_or_days', false, 'number', '', 'Count of meetings or days, where relevant.'),
      col('annual_amount', 'annual_amount', false, 'number', '', 'Optional for calculable methods; required for Fixed / Other-Custom.'),
      col('tax_provision', 'tax_provision', false, 'number', 0, 'KES amount, not a percentage. Leave 0 if not applicable.'),
      col('notes', 'notes', false, 'text', '', 'Optional.'),
    ],
    sampleRow: { budget_year: '', branch_code: '00', account_code: '<use a real code from your COA>', budget_item: 'Example item — replace', calculation_method: 'Meetings × Persons × Rate', quantity: '', persons: 5, rate: 5000, meetings_or_days: 4, annual_amount: '', tax_provision: 0, notes: 'Example row — replace with your own data' },
    buildPayload(raw, ref) {
      const { payload, errors } = parseRowGeneric(this, raw, ref);
      if (errors.length) return { errors, payload: null };
      const method = String(payload.calculation_method || '').trim();
      const isFixedOrCustom = /^fixed$/i.test(method) || /other|custom/i.test(method);
      let annual = payload.annual_amount != null && payload.annual_amount !== '' ? safeNum(payload.annual_amount) : null;
      if (annual == null) {
        if (isFixedOrCustom) {
          return { errors: [`annual_amount is required when calculation_method is "${method}"`], payload: null };
        }
        const count = payload.meetings_or_days != null && payload.meetings_or_days !== '' ? safeNum(payload.meetings_or_days) : safeNum(payload.quantity);
        annual = safeNum(payload.persons) * safeNum(payload.rate) * count;
      }
      return {
        errors: [],
        payload: {
          budget_year_id: payload.budget_year, branch_id: payload.branch_code, account_id: payload.account_code,
          budget_item: payload.budget_item, calculation_method: method, quantity: payload.quantity,
          persons: payload.persons, rate: payload.rate, meetings_or_days: payload.meetings_or_days,
          annual_amount: annual, tax_provision: payload.tax_provision != null ? safeNum(payload.tax_provision) : 0,
          notes: payload.notes || null,
        },
      };
    },
  },

  funding_budget: {
    key: 'funding_budget', label: 'Funding & Financing',
    fileBaseName: 'capital-sacco-funding-template',
    purpose: 'Bulk-upload funding requirements and how they will be financed.',
    calcNote: 'funding_gap = amount_required − amount_funded. This is calculated by the system and is not an upload column.',
    columns: [
      col('budget_year', 'budget_year', true, 'year', '(current year)', 'Must match the currently selected budget year, shown in the app header.'),
      col('branch_code', 'branch_code', true, 'branch_code', '00', 'A branch code from Setup → Branches.'),
      col('funding_requirement', 'funding_requirement', true, 'text', 'Branch expansion', 'What needs funding, e.g. Purchase Toyota Hiace.'),
      col('purpose', 'purpose', false, 'text', '', 'Optional additional detail.'),
      col('financing_type', 'financing_type', false, 'text', '', 'Broad method, e.g. Internal Financing, External Borrowing. Not a fixed list.'),
      col('amount_required', 'amount_required', true, 'number', 1000000, 'Numeric KES amount.'),
      col('amount_funded', 'amount_funded', false, 'number', 0, 'Numeric KES amount already funded. Leave 0 if none yet.'),
      col('funding_source', 'funding_source', false, 'text', '', 'Actual provider, e.g. Reserves, Commercial Bank.'),
      col('status', 'status', false, 'text', '', 'Free text — Capital SACCO defines its own status values.'),
      col('notes', 'notes', false, 'text', '', 'Optional.'),
    ],
    sampleRow: { budget_year: '', branch_code: '00', funding_requirement: 'Example requirement — replace', purpose: '', financing_type: '', amount_required: 0, amount_funded: 0, funding_source: '', status: '', notes: 'Example row — replace with your own data' },
    buildPayload(raw, ref) {
      const { payload, errors } = parseRowGeneric(this, raw, ref);
      if (errors.length) return { errors, payload: null };
      return {
        errors: [],
        payload: {
          budget_year_id: payload.budget_year, branch_id: payload.branch_code, funding_requirement: payload.funding_requirement,
          purpose: payload.purpose || null, financing_type: payload.financing_type || null, amount_required: payload.amount_required,
          amount_funded: payload.amount_funded != null ? safeNum(payload.amount_funded) : 0, funding_source: payload.funding_source || null,
          status: payload.status || null, notes: payload.notes || null,
        },
      };
    },
  },

  actuals: {
    key: 'actuals', label: 'Actuals',
    fileBaseName: 'capital-sacco-actuals-template',
    purpose: 'Bulk-upload monthly actual transactions by branch, account and month.',
    calcNote: 'Multiple rows can share the same branch, account and month — they represent different transactions. Rows are only flagged as possible duplicates when branch, account, month, reference and amount all match exactly; they are still imported, not rejected.',
    columns: [
      col('budget_year', 'budget_year', true, 'year', '(current year)', 'Must match the currently selected budget year, shown in the app header.'),
      col('branch_code', 'branch_code', true, 'branch_code', '01', 'A branch code from Setup → Branches.'),
      col('account_code', 'account_code', true, 'account_code', '<a code from Setup → Accounts / COA>', 'A valid account code.'),
      col('month', 'month', true, 'month', 'January', 'Full month name preferred.'),
      col('actual_amount', 'actual_amount', true, 'amount', 250000, 'Numeric KES amount.'),
      col('reference', 'reference', false, 'text', '', 'Optional transaction reference/receipt number.'),
      col('description', 'description', false, 'text', '', 'Optional description.'),
      col('notes', 'notes', false, 'text', '', 'Optional.'),
    ],
    sampleRow: { budget_year: '', branch_code: '01', account_code: '<use a real code from your COA>', month: 'January', actual_amount: 250000, reference: '', description: '', notes: 'Example row — replace with your own data' },
    buildPayload(raw, ref) {
      const { payload, errors } = parseRowGeneric(this, raw, ref);
      return {
        errors,
        payload: errors.length ? null : {
          budget_year_id: payload.budget_year, branch_id: payload.branch_code, account_id: payload.account_code,
          month_id: payload.month, actual_amount: payload.actual_amount, reference: payload.reference || null,
          description: payload.description || null, notes: payload.notes || null,
        },
        dupKey: errors.length ? null : `${payload.branch_code}|${payload.account_code}|${payload.month}|${payload.reference || ''}|${payload.actual_amount}`,
      };
    },
  },
};

// Validates every parsed row against a module spec and returns a clean
// summary: valid Supabase payloads, per-row errors, and (for modules that
// declare a dupKey) which rows look like duplicates of another row in the
// same file. Nothing is inserted here — this only prepares the batch.
export function validateBatch(specKey, rawRows, ref) {
  const spec = UPLOAD_SPECS[specKey];
  const validPayloads = [];
  const errorRows = [];
  const seen = new Map();
  const duplicateRowNumbers = [];

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 2; // account for header row
    const { payload, errors, dupKey } = spec.buildPayload(raw, ref);
    if (errors && errors.length) {
      errorRows.push({ rowNumber, reasons: errors });
      return;
    }
    if (dupKey) {
      if (seen.has(dupKey)) duplicateRowNumbers.push(rowNumber);
      seen.set(dupKey, rowNumber);
    }
    validPayloads.push({ rowNumber, payload });
  });

  return { spec, validPayloads, errorRows, duplicateRowNumbers, totalRows: rawRows.length };
}
