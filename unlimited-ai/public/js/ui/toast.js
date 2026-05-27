// js/ui/toast.js - Toast notification system
import { el } from '../utils/dom.js';

let container = null;

function ensureContainer() {
  if (!container) {
    container = el('div', { id: 'toast-container' });
    document.body.appendChild(container);
  }
}

export function toast(msg, type = 'info', duration = 3000) {
  ensureContainer();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const t = el('div', { className: `toast toast-${type}` }, [
    el('span', { className: 'toast-icon', textContent: icons[type] || '' }),
    el('span', { className: 'toast-msg', textContent: msg }),
  ]);
  container.appendChild(t);
  // Animate in
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  // Auto remove
  setTimeout(() => {
    t.classList.remove('toast-visible');
    setTimeout(() => t.remove(), 300);
  }, duration);
  // Click to dismiss
  t.addEventListener('click', () => {
    t.classList.remove('toast-visible');
    setTimeout(() => t.remove(), 300);
  });
}
