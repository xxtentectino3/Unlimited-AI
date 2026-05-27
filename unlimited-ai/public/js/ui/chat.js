// js/ui/chat.js - Chat display with streaming, swipe, and controls
import { el, $, $$, formatMessage, emit } from '../utils/dom.js';
import { api } from '../api.js';

// Message versions: each message has { role, content, versions: [...], currentVersion }
let messages = [];
let currentModel = '';
let useBuiltinPersona = true;
let customSystemPrompt = '';
let worldBookContext = '';
let currentPreset = null;
let sending = false;
let abortSignal = null;
let activeChatId = null;

const LS_LAST_CHAT = 'ul_last_chat';

export function initChat() {
  // Listen for events
  document.addEventListener('chat:send', (e) => handleSend(e.detail.text));
  document.addEventListener('chat:stop', handleStop);
  document.addEventListener('chat:continue', handleContinue);
  document.addEventListener('chat:regenerate', handleRegenerate);
  document.addEventListener('model:changed', (e) => { currentModel = e.detail.model; });
  document.addEventListener('persona:changed', (e) => {
    useBuiltinPersona = e.detail.useBuiltin;
    customSystemPrompt = e.detail.customPrompt || '';
  });
  document.addEventListener('worldbook:changed', (e) => {
    worldBookContext = e.detail.context || '';
  });
  document.addEventListener('preset:changed', (e) => {
    currentPreset = e.detail.preset;
  });
  document.addEventListener('chat:loaded', (e) => {
    messages = e.detail.messages || [];
    currentModel = e.detail.model || currentModel;
    activeChatId = e.detail.chatId;
    renderAllMessages();
  });

  // Restore last chat if any
  restoreLastSession();
}

function restoreLastSession() {
  const raw = localStorage.getItem(LS_LAST_CHAT);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      messages = data;
      renderAllMessages();
    }
  } catch {}
}

function persistLastSession() {
  try {
    localStorage.setItem(LS_LAST_CHAT, JSON.stringify(messages.slice(-200))); // Keep last 200
  } catch {}
}

// ---- Message rendering ----

function renderAllMessages() {
  const chatEl = $('#chat');
  // Clear existing messages (keep spacer)
  const spacer = $('#bottom-spacer');
  chatEl.innerHTML = '';
  if (spacer) chatEl.appendChild(spacer);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    renderMessage(msg, i);
  }
  scrollToBottom();
}

function renderMessage(msg, index) {
  const chatEl = $('#chat');
  const spacer = $('#bottom-spacer');
  const row = createMessageRow(msg, index);
  chatEl.insertBefore(row, spacer);
}

function updateMessage(msg, index) {
  const existing = $(`.msg-row[data-index="${index}"]`);
  if (!existing) return renderMessage(msg, index);
  const bubble = $('.bubble', existing);
  if (bubble) bubble.innerHTML = formatMessage(msg.content);
  updateSwipeUI(existing, msg);
  updateStats(existing, msg);
}

function createMessageRow(msg, index) {
  const role = msg.role === 'user' ? 'user' : 'ai';
  const isLastAI = role === 'ai' && index === messages.length - 1;

  const row = el('div', {
    className: `msg-row row-${role}`,
    'data-index': String(index),
  });

  const avatar = el('div', {
    className: `msg-avatar avatar-${role}`,
    textContent: role === 'user' ? 'U' : 'AI',
  });

  const content = el('div', { className: 'msg-content' });

  const meta = el('div', {
    className: 'msg-meta',
    textContent: role === 'user' ? 'User' : (msg.characterName || 'Assistant'),
  });

  const bubble = el('div', {
    className: `bubble bubble-${role}${isLastAI ? ' bubble-streaming' : ''}`,
    innerHTML: formatMessage(msg.content || ''),
  });

  content.appendChild(meta);
  content.appendChild(bubble);

  if (role === 'ai') {
    // Stats
    const stats = el('div', { className: 'msg-stats' });
    if (msg.usage) {
      const c = msg.usage.completion_tokens || 0;
      const p = msg.usage.prompt_tokens || 0;
      const tps = msg.usage.tokensPerSec || 0;
      stats.textContent = `Prompt: ${p} | Completion: ${c}${tps ? ` | ${tps.toFixed(1)} tok/s` : ''}`;
    }
    content.appendChild(stats);

    // Swipe controls (for last AI message with multiple versions)
    if (msg.versions && msg.versions.length > 1) {
      const swipeControls = el('div', { className: 'swipe-controls' }, [
        el('button', {
          className: 'swipe-btn',
          textContent: '◀',
          onclick: () => swipeVersion(index, -1),
        }),
        el('span', {
          className: 'swipe-indicator',
          textContent: `${(msg.currentVersion || 0) + 1}/${msg.versions.length}`,
        }),
        el('button', {
          className: 'swipe-btn',
          textContent: '▶',
          onclick: () => swipeVersion(index, 1),
        }),
      ]);
      content.appendChild(swipeControls);
    }

    // Action buttons (for last AI message, not during streaming)
    if (isLastAI && !sending && msg.content) {
      const actions = el('div', { className: 'msg-actions' });
      const copyBtn = el('button', {
        className: 'action-btn',
        textContent: '📋',
        title: '复制',
        onclick: () => copyMessage(msg.content),
      });
      actions.appendChild(copyBtn);
      content.appendChild(actions);
    }

    row.appendChild(avatar);
    row.appendChild(content);
  } else {
    // User
    row.appendChild(content);
    row.appendChild(avatar);

    // Edit / delete for user messages
    if (!sending) {
      const actions = el('div', { className: 'msg-actions user-actions' }, [
        el('button', {
          className: 'action-btn',
          textContent: '✏️',
          title: '编辑',
          onclick: () => editUserMessage(index),
        }),
        el('button', {
          className: 'action-btn',
          textContent: '🗑️',
          title: '删除',
          onclick: () => deleteMessagePair(index),
        }),
      ]);
      content.appendChild(actions);
    }
  }

  return row;
}

function updateSwipeUI(row, msg) {
  const indicator = $('.swipe-indicator', row);
  const controls = $('.swipe-controls', row);
  if (msg.versions && msg.versions.length > 1) {
    if (controls) {
      if (indicator) indicator.textContent = `${(msg.currentVersion || 0) + 1}/${msg.versions.length}`;
    } else {
      // Re-render swipe controls
      const content = $('.msg-content', row);
      if (content) {
        const old = $('.swipe-controls', content);
        if (old) old.remove();
        const newControls = el('div', { className: 'swipe-controls' }, [
          el('button', { className: 'swipe-btn', textContent: '◀', onclick: () => swipeVersion(msg._index, -1) }),
          el('span', { className: 'swipe-indicator', textContent: `${(msg.currentVersion || 0) + 1}/${msg.versions.length}` }),
          el('button', { className: 'swipe-btn', textContent: '▶', onclick: () => swipeVersion(msg._index, 1) }),
        ]);
        content.appendChild(newControls);
      }
    }
  }
}

function updateStats(row, msg) {
  const stats = $('.msg-stats', row);
  if (stats && msg.usage) {
    const c = msg.usage.completion_tokens || 0;
    const p = msg.usage.prompt_tokens || 0;
    const tps = msg.usage.tokensPerSec || 0;
    stats.textContent = `Prompt: ${p} | Completion: ${c}${tps ? ` | ${tps.toFixed(1)} tok/s` : ''}`;
  }
}

// ---- Actions ----

async function handleSend(text) {
  if (sending) return;

  // Add user message
  messages.push({ role: 'user', content: text });
  renderMessage(messages[messages.length - 1], messages.length - 1);
  scrollToBottom();
  persistLastSession();

  // Start AI response
  sending = true;
  emit('chat:state', { sending: true, canContinue: false, lastAssistantText: '' });

  // Add empty AI message placeholder
  const aiIndex = messages.length;
  messages.push({ role: 'assistant', content: '', versions: [], currentVersion: 0, _index: aiIndex });
  renderMessage(messages[aiIndex], aiIndex);
  scrollToBottom();

  const signal = api.createSignal();
  abortSignal = signal;

  await api.chat({
    model: currentModel,
    useBuiltinPersona: useBuiltinPersona,
    customSystemPrompt,
    worldBookContext,
    messages: messages.slice(0, aiIndex), // Send history BEFORE the current response
    preset: currentPreset,
    signal,
    onToken: (token, fullText) => {
      messages[aiIndex].content = fullText;
      updateMessage(messages[aiIndex], aiIndex);
      scrollToBottom();
    },
    onDone: (fullText, { usage, elapsed, aborted }) => {
      if (aborted) {
        messages[aiIndex].content = fullText;
      } else {
        // Store this as a version
        const msg = messages[aiIndex];
        if (!msg.versions) msg.versions = [];
        const versionEntry = {
          content: fullText,
          usage,
          timestamp: Date.now(),
        };
        msg.versions.push(versionEntry);
        msg.currentVersion = msg.versions.length - 1;

        // Update usage stats
        if (usage) {
          msg.usage = { ...usage, tokensPerSec: elapsed > 0 ? (usage.completion_tokens || 0) / elapsed : 0 };
        }
      }
      updateMessage(messages[aiIndex], aiIndex);
      sending = false;
      emit('chat:state', { sending: false, canContinue: true, lastAssistantText: fullText });
      persistLastSession();
      scrollToBottom();
    },
    onError: (err) => {
      messages[aiIndex].content = `[Error] ${err}`;
      updateMessage(messages[aiIndex], aiIndex);
      sending = false;
      emit('chat:state', { sending: false, canContinue: false, lastAssistantText: '' });
    }
  });
}

function handleStop() {
  api.abort();
  sending = false;
  emit('chat:state', { sending: false, canContinue: true, lastAssistantText: messages[messages.length - 1]?.content || '' });
}

async function handleContinue() {
  if (sending || messages.length === 0) return;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== 'assistant') return;

  sending = true;
  emit('chat:state', { sending: true, canContinue: false, lastAssistantText: '' });

  // Send "continue" as a system instruction to continue the last response
  const continueText = lastMsg.content;

  const signal = api.createSignal();
  abortSignal = signal;

  const continuationMessages = [...messages];
  continuationMessages.push({ role: 'user', content: '[Continue your previous response from where you left off. Do not repeat anything. Continue naturally.]' });

  await api.chat({
    model: currentModel,
    useBuiltinPersona: false, // Don't re-apply persona for continuation
    customSystemPrompt: '',
    worldBookContext,
    messages: continuationMessages,
    preset: currentPreset,
    signal,
    onToken: (token, fullText) => {
      lastMsg.content = continueText + fullText;
      updateMessage(lastMsg, messages.length - 1);
      scrollToBottom();
    },
    onDone: (fullText, { usage, aborted }) => {
      if (!aborted && fullText) {
        lastMsg.content = continueText + fullText;
        // Add as a new version
        if (!lastMsg.versions) lastMsg.versions = [{ content: continueText }];
        lastMsg.versions.push({ content: lastMsg.content, usage, timestamp: Date.now() });
        lastMsg.currentVersion = lastMsg.versions.length - 1;
      }
      updateMessage(lastMsg, messages.length - 1);
      sending = false;
      emit('chat:state', { sending: false, canContinue: true, lastAssistantText: lastMsg.content });
      persistLastSession();
      scrollToBottom();
    },
    onError: (err) => {
      sending = false;
      emit('chat:state', { sending: false, canContinue: true, lastAssistantText: lastMsg.content });
    }
  });
}

async function handleRegenerate() {
  if (sending || messages.length === 0) return;

  // Remove last AI message
  const lastAI = messages.pop();
  // Regenerate with same context
  sending = true;
  emit('chat:state', { sending: true, canContinue: false, lastAssistantText: '' });

  const aiIndex = messages.length;
  messages.push({ role: 'assistant', content: '', versions: lastAI.versions || [], currentVersion: 0, _index: aiIndex });
  renderMessage(messages[aiIndex], aiIndex);
  scrollToBottom();

  const signal = api.createSignal();
  abortSignal = signal;

  await api.chat({
    model: currentModel,
    useBuiltinPersona,
    customSystemPrompt,
    worldBookContext,
    messages: messages.slice(0, aiIndex),
    preset: currentPreset,
    signal,
    onToken: (token, fullText) => {
      messages[aiIndex].content = fullText;
      updateMessage(messages[aiIndex], aiIndex);
      scrollToBottom();
    },
    onDone: (fullText, { usage, elapsed, aborted }) => {
      const msg = messages[aiIndex];
      if (!aborted) {
        if (!msg.versions) msg.versions = [];
        const versionEntry = { content: fullText, usage, timestamp: Date.now() };
        msg.versions.push(versionEntry);
        msg.currentVersion = msg.versions.length - 1;
        if (usage) msg.usage = { ...usage, tokensPerSec: elapsed > 0 ? (usage.completion_tokens || 0) / elapsed : 0 };
      }
      updateMessage(msg, aiIndex);
      sending = false;
      emit('chat:state', { sending: false, canContinue: true, lastAssistantText: fullText });
      persistLastSession();
      scrollToBottom();
    },
    onError: (err) => {
      messages[aiIndex].content = `[Error] ${err}`;
      updateMessage(messages[aiIndex], aiIndex);
      sending = false;
      emit('chat:state', { sending: false, canContinue: false, lastAssistantText: '' });
    }
  });
}

function swipeVersion(index, direction) {
  const msg = messages[index];
  if (!msg.versions || msg.versions.length === 0) return;

  let newVer = (msg.currentVersion || 0) + direction;
  if (newVer < 0) newVer = 0;
  if (newVer >= msg.versions.length) newVer = msg.versions.length - 1;
  msg.currentVersion = newVer;
  msg.content = msg.versions[newVer].content;
  msg.usage = msg.versions[newVer].usage;

  updateMessage(msg, index);
  persistLastSession();
}

function copyMessage(text) {
  navigator.clipboard.writeText(text).then(() => {
    emit('toast', { msg: '已复制到剪贴板', type: 'success' });
  }).catch(() => {});
}

function editUserMessage(index) {
  const msg = messages[index];
  if (!msg || msg.role !== 'user') return;
  const newText = prompt('编辑消息:', msg.content);
  if (newText !== null && newText.trim()) {
    msg.content = newText.trim();
    // Remove all subsequent messages (will need re-generation)
    messages = messages.slice(0, index + 1);
    renderAllMessages();
    persistLastSession();
  }
}

function deleteMessagePair(index) {
  const msg = messages[index];
  if (!msg || msg.role !== 'user') return;
  // Delete user message and the following AI response
  if (index + 1 < messages.length && messages[index + 1].role === 'assistant') {
    messages.splice(index, 2);
  } else {
    messages.splice(index, 1);
  }
  renderAllMessages();
  persistLastSession();
  emit('chat:state', { sending: false, canContinue: false, lastAssistantText: '' });
}

// ---- Helpers ----

function scrollToBottom() {
  const historyWrap = $('#history');
  if (!historyWrap) return;
  historyWrap.scrollTo({ top: historyWrap.scrollHeight, behavior: 'auto' });
}

export function getMessages() { return messages; }
export function setMessages(msgs) { messages = msgs; renderAllMessages(); }
export function clearChat() {
  messages = [];
  renderAllMessages();
  localStorage.removeItem(LS_LAST_CHAT);
  emit('chat:state', { sending: false, canContinue: false, lastAssistantText: '' });
}
export function exportChat() {
  const data = {
    messages,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `chat-${Date.now()}.json` });
  a.click();
  URL.revokeObjectURL(url);
}
