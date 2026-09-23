import { icon } from '../core/icons.js';

// Minimal accessible modal shell reused by the Upload Guide and every
// module's "Add New" form. Only one modal is expected open at a time.
let host = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'modalHost';
  document.body.appendChild(host);
  return host;
}

export function openModal({ title, bodyHtml, wide = false, onMount, onClose }) {
  const h = ensureHost();
  h.innerHTML = `
    <div class="modal-scrim" id="modalScrim">
      <div class="modal-box${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head">
          <h3 id="modalTitle">${title}</h3>
          <button type="button" class="modal-x" id="modalCloseBtn" aria-label="Close">${icon('menu') /* placeholder replaced below */}</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    </div>`;
  // Use a proper close (×) icon rather than the menu icon above.
  h.querySelector('#modalCloseBtn').innerHTML = '&times;';

  function close() {
    h.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  h.querySelector('#modalScrim').addEventListener('click', (e) => { if (e.target.id === 'modalScrim') close(); });
  h.querySelector('#modalCloseBtn').addEventListener('click', close);

  if (onMount) onMount(h, close);
  return close;
}
