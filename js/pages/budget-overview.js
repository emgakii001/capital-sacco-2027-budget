import { icon } from '../core/icons.js';

const AREAS = [
  { icoName: 'budget', title: 'Operating Budget', desc: 'Monthly income and expenditure by branch and account.', href: '#/budget/operating' },
  { icoName: 'capex', title: 'CAPEX', desc: 'Capital expenditure items, kept separate from operating expenses.', href: '#/budget/capex' },
  { icoName: 'staff', title: 'Staff Budget', desc: 'Supporting schedule for staff costs.', href: '#/budget/staff' },
  { icoName: 'gov', title: 'Governance & Delegates', desc: 'Flexible governance budgeting with configurable calculation methods.', href: '#/budget/governance' },
  { icoName: 'fund', title: 'Funding & Financing', desc: 'What needs funding, how, and from where.', href: '#/budget/funding' },
];

export function renderBudgetOverview(container) {
  container.innerHTML = `
    <div class="page">
      <div class="card ph-intro">
        <div><h2>Budget</h2><p class="lead">Five budgeting areas feed the Consolidated Budget view below. Each area supports manual entry and Excel bulk upload.</p></div>
      </div>

      <div class="area-grid">
        ${AREAS.map((a) => `
        <div class="card area">
          <div class="area-head">
            <span class="area-ico">${icon(a.icoName)}</span>
            <div><h3>${a.title}</h3><p class="desc">${a.desc}</p></div>
          </div>
          <div class="area-actions">
            <a class="btn btn-primary btn-sm" href="${a.href}">${icon('eye')}View</a>
            <a class="btn btn-secondary btn-sm" href="${a.href}">${icon('plus')}Add New</a>
            <a class="btn btn-secondary btn-sm" href="${a.href}">${icon('upload')}Upload</a>
          </div>
        </div>`).join('')}

        <div class="card area is-wide">
          <div class="area-head">
            <span class="area-ico">${icon('consolidated')}</span>
            <div><h3>Consolidated Budget</h3><p class="desc">A reporting view combining Income, Operating Expenses, Budgeted Surplus, CAPEX, Staff, Governance and Funding — without duplicating source data.</p></div>
          </div>
          <div class="area-actions">
            <a class="btn btn-primary btn-sm" href="#/budget/consolidated">${icon('eye')}Open Consolidated Budget</a>
          </div>
        </div>
      </div>
    </div>`;
}
