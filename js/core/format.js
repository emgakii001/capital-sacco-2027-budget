// Formatting helpers. Currency is always KES with thousands separators, no decimals on summary cards.
export function kes(value, { decimals = 0, showSymbol = true } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value);
  const formatted = Math.abs(n).toLocaleString('en-KE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = n < 0 ? '-' : '';
  return `${sign}${showSymbol ? 'KES ' : ''}${formatted}`;
}

export function compactKes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}KES ${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}KES ${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}KES ${(abs / 1e3).toFixed(1)}K`;
  return kes(n);
}

export function pct(value, { decimals = 1 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export function num(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('en-KE');
}

export function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
