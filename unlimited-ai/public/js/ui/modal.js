// js/ui/modal.js - Modal dialog system
import { el, $ } from '../utils/dom.js';

let activeModal = null;

export function showModal({ title, body, footer, className = '', onClose, width }) {
  closeModal();

  const mask = el('div', {
    className: 'modal-mask',
    onclick: (e) => { if (e.target === mask) closeModal(); }
  });

  const card = el('div', { className: `modal-card ${className}` });
  if (width) card.style.maxWidth = width;

  const head = el('div', { className: 'modal-head' }, [
    el('h3', { textContent: title }),
    el('button', {
      className: 'modal-close',
      textContent: '✕',
      onclick: closeModal
    })
  ]);

  const bodyEl = el('div', { className: 'modal-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  else if (Array.isArray(body)) body.forEach(c => bodyEl.appendChild(c));

  const footerEl = el('div', { className: 'modal-footer' });
  if (typeof footer === 'string') footerEl.innerHTML = footer;
  else if (footer instanceof Node) footerEl.appendChild(footer);
  else if (Array.isArray(footer)) footer.forEach(c => footerEl.appendChild(c));

  card.appendChild(head);
  card.appendChild(bodyEl);
  if (footer) card.appendChild(footerEl);
  mask.appendChild(card);

  activeModal = { mask, card, onClose };
  document.body.appendChild(mask);
  requestAnimationFrame(() => mask.classList.add('modal-mask-visible'));

  return { mask, bodyEl, footerEl, close: closeModal };
}

export function closeModal() {
  if (!activeModal) return;
  const { mask, onClose } = activeModal;
  mask.classList.remove('modal-mask-visible');
  setTimeout(() => {
    mask.remove();
    onClose?.();
    activeModal = null;
  }, 200);
}

// Convenience: confirm dialog
export function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const { footerEl, close } = showModal({
      title,
      body: el('p', { textContent: message, style: { color: '#bdbdbd', lineHeight: '1.6' } }),
      footer: el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } }, [
        el('button', { className: 'btn btn-secondary', textContent: '取消', onclick: () => { close(); resolve(false); } }),
        el('button', { className: 'btn btn-danger', textContent: '确认', onclick: () => { close(); resolve(true); } }),
      ]),
      width: '420px'
    });
  });
}
