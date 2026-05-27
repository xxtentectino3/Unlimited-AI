// js/ui/composer.js - Message input area + send controls
import { el, $, on, emit } from '../utils/dom.js';

let state = {
  sending: false,
  canContinue: false,
  lastAssistantText: '',
};

export function initComposer() {
  const inputEl = $('#msg');
  const sendBtn = $('#sendBtn');
  const stopBtn = $('#stopBtn');
  const contBtn = $('#continueBtn');
  const regenBtn = $('#regenBtn');
  const composer = $('#composer');

  // Send message
  async function send() {
    if (state.sending) return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    resizeInput();
    emit('chat:send', { text });
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Stop generation
  stopBtn.addEventListener('click', () => {
    emit('chat:stop');
  });

  // Continue (generate more)
  contBtn.addEventListener('click', () => {
    if (!state.canContinue) return;
    emit('chat:continue');
  });

  // Regenerate
  regenBtn.addEventListener('click', () => {
    emit('chat:regenerate');
  });

  // Auto-resize
  inputEl.addEventListener('input', resizeInput);

  // Listen for state changes
  document.addEventListener('chat:state', (e) => {
    Object.assign(state, e.detail);
    updateButtons();
  });
}

export function setComposerState(s) {
  Object.assign(state, s);
  updateButtons();
}

export function focusComposer() {
  const inputEl = $('#msg');
  if (inputEl) inputEl.focus();
}

function resizeInput() {
  const inputEl = $('#msg');
  if (!inputEl) return;
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
  emit('ui:resize');
}

function updateButtons() {
  const sendBtn = $('#sendBtn');
  const stopBtn = $('#stopBtn');
  const contBtn = $('#continueBtn');
  const regenBtn = $('#regenBtn');

  if (state.sending) {
    if (sendBtn) sendBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = '';
  } else {
    if (sendBtn) sendBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
  }
  if (contBtn) contBtn.style.display = state.canContinue ? '' : 'none';
  if (regenBtn) regenBtn.style.display = state.lastAssistantText ? '' : 'none';
}
