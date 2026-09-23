import { escapeHtml } from '../core/format.js';

// Renders the "Import Summary" panel after an upload attempt: file name,
// rows processed/imported/rejected, per-row rejection reasons, and any
// possible-duplicate rows (informational only — never auto-rejected).
export function renderImportSummary({ fileName, totalRows, importedCount, errorRows, duplicateRowNumbers, saveError }) {
  const rejected = errorRows.length;
  return `
    <div class="import-summary">
      <div class="is-head">
        <div class="is-stat"><span>File</span><b style="font-size:13px;font-weight:600">${escapeHtml(fileName)}</b></div>
        <div class="is-stat"><span>Rows detected</span><b>${totalRows}</b></div>
        <div class="is-stat"><span>Imported</span><b style="color:var(--success-ink)">${importedCount}</b></div>
        <div class="is-stat"><span>Rejected</span><b style="color:${rejected ? 'var(--error-ink)' : 'var(--text)'}">${rejected}</b></div>
      </div>
      ${saveError ? `<div class="is-errors"><div>Import failed while saving to Supabase: ${escapeHtml(saveError)}</div></div>` : ''}
      ${errorRows.length ? `<div class="is-errors">${errorRows.map((r) => r.reasons.map((reason) => `<div>Row ${r.rowNumber} — ${escapeHtml(reason)}</div>`).join('')).join('')}</div>` : ''}
      ${duplicateRowNumbers?.length ? `<div class="is-dupes">Possible duplicate of another row in this file (same branch, account, month, reference and amount) — still imported: row ${duplicateRowNumbers.join(', ')}.</div>` : ''}
    </div>`;
}
