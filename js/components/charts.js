import { compactKes } from '../core/format.js';

const COLORS = { teal: '#0F766E', navy: '#12355B', warn: '#D97706', error: '#DC2626' };

export function renderBarChart(canvasId, labels, series) {
  if (!window.Chart) return null;
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new window.Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: series.map((s, i) => ({ label: s.label, data: s.data, backgroundColor: s.color || (i === 0 ? COLORS.teal : COLORS.navy), borderRadius: 4, maxBarThickness: 28 })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'IBM Plex Sans' } } } },
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => compactKes(v).replace('KES ', '') }, grid: { color: '#E8F1F8' } } },
    },
  });
}

export function renderLineChart(canvasId, labels, series) {
  if (!window.Chart) return null;
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new window.Chart(ctx, {
    type: 'line',
    data: { labels, datasets: series.map((s, i) => ({ label: s.label, data: s.data, borderColor: s.color || (i === 0 ? COLORS.teal : COLORS.navy), backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'IBM Plex Sans' } } } },
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => compactKes(v).replace('KES ', '') }, grid: { color: '#E8F1F8' } } },
    },
  });
}
