// js/main.js - Application entry point
import { $, on, emit } from './utils/dom.js';
import { initChat } from './ui/chat.js';
import { initComposer, setComposerState, focusComposer } from './ui/composer.js';
import { initSidebar } from './ui/sidebar.js';
import { initSettings, showSettingsModal } from './ui/settings.js';
import { toast } from './ui/toast.js';
import { showModal } from './ui/modal.js';

// Current state
let currentModel = '';
let useBuiltinPersona = true;
let customPrompt = '';

const LS_MODEL = 'ul_model';
const LS_USE_BUILTIN = 'ul_use_builtin';
const LS_PASSWORD = 'ul_password';

async function init() {
  // Check password first
  await checkPassword();

  // Init modules
  initChat();
  initComposer();
  await initSidebar();
  await initSettings();

  // Init toolbar
  initToolbar();

  // Init donate
  initDonate();

  // Init resize handling
  initResizeHandlers();

  // Restore saved model
  currentModel = localStorage.getItem(LS_MODEL) || (window.APP_MODELS?.[0]?.id) || '';
  useBuiltinPersona = (localStorage.getItem(LS_USE_BUILTIN) ?? '1') === '1';
  customPrompt = localStorage.getItem('ul_custom_prompt') || '';

  // Update UI
  updatePersonaButton();
  emit('model:changed', { model: currentModel });
  emit('persona:changed', { useBuiltin: useBuiltinPersona, customPrompt });

  focusComposer();
}

// ---- Password Gate ----
async function checkPassword() {
  const PASSWORD = window.APP_PASSWORD || '123456';
  const saved = localStorage.getItem(LS_PASSWORD);

  if (saved === PASSWORD) return;

  const input = prompt('请输入密码:');
  if (input !== PASSWORD) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#eaeaea;font-size:18px;">密码错误，刷新重试</div>';
    throw new Error('Wrong password');
  }
  localStorage.setItem(LS_PASSWORD, PASSWORD);
}

// ---- Toolbar ----
function initToolbar() {
  // Model selector
  const modelSel = $('#modelSel');
  if (modelSel) {
    const models = window.APP_MODELS || [];
    modelSel.innerHTML = '';
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      modelSel.appendChild(opt);
    }

    const saved = localStorage.getItem(LS_MODEL);
    if (saved) modelSel.value = saved;

    modelSel.addEventListener('change', () => {
      currentModel = modelSel.value;
      localStorage.setItem(LS_MODEL, currentModel);
      emit('model:changed', { model: currentModel });
    });
  }

  // Persona toggle
  const personaBtn = $('#personaToggle');
  if (personaBtn) {
    personaBtn.addEventListener('click', () => {
      useBuiltinPersona = !useBuiltinPersona;
      localStorage.setItem(LS_USE_BUILTIN, useBuiltinPersona ? '1' : '0');
      updatePersonaButton();
      emit('persona:changed', { useBuiltin: useBuiltinPersona, customPrompt });
    });
  }

  // Settings button
  const settingsBtn = $('#settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettingsModal);
  }

  // Toggle sidebar (both sidebar close button and topbar hamburger)
  function toggleSidebarFn() {
    const sidebar = $('#sidebar');
    if (sidebar) sidebar.classList.toggle('sidebar-open');
  }
  const toggleBtn1 = $('#toggleSidebarBtn');
  const toggleBtn2 = $('#toggleSidebarBtn2');
  if (toggleBtn1) toggleBtn1.addEventListener('click', toggleSidebarFn);
  if (toggleBtn2) toggleBtn2.addEventListener('click', toggleSidebarFn);
}

function updatePersonaButton() {
  const btn = $('#personaToggle');
  if (btn) btn.textContent = useBuiltinPersona ? '😈' : '😇';
}

// ---- Donate Modal ----
function initDonate() {
  const donateBtn = $('#donateBtn');
  const donateMask = $('#donateMask');
  const donateClose = $('#donateClose');

  if (!donateBtn || !donateMask) return;

  donateBtn.addEventListener('click', () => {
    donateMask.style.display = 'flex';
  });
  donateClose?.addEventListener('click', () => {
    donateMask.style.display = 'none';
  });
  donateMask.addEventListener('click', (e) => {
    if (e.target === donateMask) donateMask.style.display = 'none';
  });
}

// ---- Resize ----
function initResizeHandlers() {
  const historyWrap = $('#history');

  // Listen for UI resize events from composer
  document.addEventListener('ui:resize', () => {
    updateSpacer();
  });

  // ResizeObserver for composer
  const composer = $('#composer');
  if (composer && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      updateSpacer();
    });
    ro.observe(composer);
  }

  // Visual viewport (mobile keyboard)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateSpacer);
  }
  window.addEventListener('resize', updateSpacer);

  updateSpacer();
}

function updateSpacer() {
  const composer = $('#composer');
  const spacer = $('#bottom-spacer');
  if (!composer || !spacer) return;

  const rect = composer.getBoundingClientRect();
  const rootStyle = getComputedStyle(document.documentElement);
  const gap = parseFloat(rootStyle.getPropertyValue('--composer-gap')) || 12;
  const extra = parseFloat(rootStyle.getPropertyValue('--spacer-extra')) || 28;
  spacer.style.height = Math.ceil(rect.height + gap + extra) + 'px';
}

// ---- Listen for toast events ----
document.addEventListener('toast', (e) => {
  toast(e.detail.msg, e.detail.type);
});

// Bootstrap
init().catch(err => {
  console.error('Init error:', err);
});
