// Content for routes that remain a descriptive "not yet connected" page.
// Every other route now has a real Supabase-backed implementation — see
// main.js's CONNECTED_ROUTES map.
export const ROUTES = {
  '#/performance/variance': {
    title: 'Variance Analysis', icoName: 'variance',
    lead: 'Variance is shown as a figure, not labelled favourable or unfavourable until that is explicitly defined. Use Performance → Budget vs Actual for the connected version of this view, filtered to a single account or branch.',
    filters: ['Year', 'Branch', 'Account', 'Month'],
    tableColumns: ['Account', 'Budget', 'Actual', 'Variance', 'Variance %'],
    tableTitle: 'Variance detail',
  },
};
