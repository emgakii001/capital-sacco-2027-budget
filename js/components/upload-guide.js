import { openModal } from './modal.js';
import { escapeHtml } from '../core/format.js';

// Builds the Upload Guide body straight from a module's upload spec
// (js/core/upload-config.js), so the guide can never drift out of sync
// with the actual template columns and importer.
export function openUploadGuide(spec) {
  const required = spec.columns.filter((c) => c.required);
  const optional = spec.columns.filter((c) => !c.required);

  const colRows = spec.columns.map((c) => `
    <tr>
      <td><code>${escapeHtml(c.header)}</code></td>
      <td>${c.required ? 'Required' : 'Optional'}</td>
      <td>${escapeHtml(c.note || '')}</td>
      <td>${escapeHtml(String(c.example ?? ''))}</td>
    </tr>`).join('');

  const body = `
    <p>${escapeHtml(spec.purpose)}</p>

    <h4>1. Required columns</h4>
    <p>${required.map((c) => `<code>${escapeHtml(c.header)}</code>`).join(', ') || 'None'}</p>

    <h4>2. Optional columns</h4>
    <p>${optional.map((c) => `<code>${escapeHtml(c.header)}</code>`).join(', ') || 'None'}</p>

    <h4>3. Column reference</h4>
    <table>
      <thead><tr><th>Column</th><th>Required?</th><th>Meaning</th><th>Example</th></tr></thead>
      <tbody>${colRows}</tbody>
    </table>

    <h4>4. Branch codes</h4>
    <p>Use a branch code exactly as it appears in <strong>Setup → Branches</strong> (e.g. 00–15). Leading zeros matter — "1" and "01" are both accepted and treated the same.</p>

    ${spec.columns.some((c) => c.kind === 'account_code') ? `
    <h4>5. Account codes</h4>
    <p>Use an account code exactly as it appears in <strong>Setup → Accounts / COA</strong>. Rows with a code that doesn't exist there will be rejected.</p>` : ''}

    ${spec.columns.some((c) => c.kind === 'month') ? `
    <h4>6. Months</h4>
    <p>Use the full month name (e.g. "January") where possible. Month numbers ("1") and short forms ("Jan") are also accepted.</p>` : ''}

    <h4>7. Amounts</h4>
    <p>Enter plain numbers — no currency symbol, no thousands separators (write <code>250000</code>, not <code>KES 250,000</code>).</p>

    ${spec.calcNote ? `<h4>8. Calculation rule</h4><p>${escapeHtml(spec.calcNote)}</p>` : ''}

    <h4>9. Common upload errors</h4>
    <ul>
      <li>Branch code, account code or month that doesn't match Setup exactly.</li>
      <li>A required column left blank.</li>
      <li>An amount typed with letters, currency symbols or commas.</li>
      <li>Uploading a file for the wrong budget year.</li>
    </ul>

    <h4>10. After upload</h4>
    <p>Every row is checked before anything is saved. Rows that pass are inserted into Supabase; rows with a problem are listed with the reason and are not imported. Nothing is imported silently — you'll see a full summary before the table refreshes.</p>

    <div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Close</button></div>
  `;

  const close = openModal({ title: `${spec.label} — Upload Guide`, bodyHtml: body, wide: true });
  document.querySelector('[data-close]')?.addEventListener('click', close);
}
