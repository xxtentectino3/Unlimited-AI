// js/ui/sidebar.js - Left sidebar (characters, chats, world books)
import { el, $, $$, emit } from '../utils/dom.js';
import { getCharacters, saveCharacter, deleteCharacter } from '../utils/storage.js';
import { setMessages, clearChat, exportChat } from './chat.js';
import { showModal, confirmDialog } from './modal.js';
import { toast } from './toast.js';

let characters = [];
let activeCharacter = null;
let chats = [];

export async function initSidebar() {
  characters = await getCharacters();
  if (characters.length === 0) {
    // Create a default character
    const defaultChar = {
      id: 'default',
      name: 'Assistant',
      description: 'Default AI assistant',
      systemPrompt: '',
      avatarUrl: '',
      createdAt: Date.now(),
    };
    await saveCharacter(defaultChar);
    characters = [defaultChar];
  }

  activeCharacter = characters[0];
  renderCharacterList();
  renderChatList();
  bindEvents();
}

function bindEvents() {
  $('#newChatBtn')?.addEventListener('click', newChat);
  $('#importCharBtn')?.addEventListener('click', importCharacter);
  $('#toggleSidebarBtn')?.addEventListener('click', toggleSidebar);
  $('#exportChatBtn')?.addEventListener('click', exportChat);
  $('#clearChatBtn')?.addEventListener('click', async () => {
    const ok = await confirmDialog('清除对话', '确定要清除当前对话记录吗？');
    if (ok) clearChat();
  });
}

// ---- Character List ----

function renderCharacterList() {
  const container = $('#characterList');
  if (!container) return;
  container.innerHTML = '';

  for (const char of characters) {
    const isActive = activeCharacter && char.id === activeCharacter.id;
    const item = el('div', {
      className: `sidebar-item char-item${isActive ? ' active' : ''}`,
      'data-char-id': char.id,
    }, [
      el('div', {
        className: 'char-avatar',
        style: { backgroundImage: char.avatarUrl ? `url(${char.avatarUrl})` : undefined },
        textContent: char.avatarUrl ? '' : (char.name?.[0] || '?'),
      }),
      el('div', { className: 'char-info' }, [
        el('div', { className: 'char-name', textContent: char.name }),
        el('div', { className: 'char-desc', textContent: char.description || '' }),
      ]),
    ]);

    item.addEventListener('click', () => selectCharacter(char));
    container.appendChild(item);
  }
}

function selectCharacter(char) {
  activeCharacter = char;
  renderCharacterList();
  emit('character:changed', {
    name: char.name,
    systemPrompt: char.systemPrompt || '',
    avatarUrl: char.avatarUrl || '',
  });
}

// ---- Chat List ----

function renderChatList() {
  const container = $('#chatList');
  if (!container) return;
  container.innerHTML = '';

  for (const chat of chats) {
    const item = el('div', {
      className: 'sidebar-item chat-item',
      'data-chat-id': chat.id,
    }, [
      el('div', { className: 'chat-item-title', textContent: chat.title || 'Untitled Chat' }),
      el('div', { className: 'chat-item-date', textContent: formatDate(chat.updatedAt) }),
      el('button', {
        className: 'chat-item-del',
        textContent: '×',
        onclick: async (e) => {
          e.stopPropagation();
          const ok = await confirmDialog('删除对话', `确定要删除 "${chat.title || 'Untitled Chat'}" 吗？`);
          if (ok) {
            chats = chats.filter(c => c.id !== chat.id);
            renderChatList();
            if (chats.length === 0) newChat();
          }
        }
      }),
    ]);
    item.addEventListener('click', () => loadChat(chat));
    container.appendChild(item);
  }
}

function newChat() {
  clearChat();
  const chat = {
    id: 'chat_' + Date.now(),
    title: 'New Chat',
    characterId: activeCharacter?.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  chats.unshift(chat);
  renderChatList();
  emit('chat:loaded', { messages: [], chatId: chat.id });
  toast('新对话已创建', 'success');
}

function loadChat(chat) {
  setMessages(chat.messages || []);
  emit('chat:loaded', { messages: chat.messages || [], chatId: chat.id, model: chat.model });
  toast(`已加载: ${chat.title}`, 'info', 2000);
}

async function importCharacter() {
  // Create file input
  const input = el('input', {
    type: 'file',
    accept: '.png,.json,.charx,.card',
    style: { display: 'none' },
  });
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) { input.remove(); return; }

    try {
      if (file.name.endsWith('.png') || file.name.endsWith('.card')) {
        // Parse PNG character card (SillyTavern format)
        const char = await parsePNGCharacterCard(file);
        if (char) {
          await saveCharacter(char);
          characters.push(char);
          activeCharacter = char;
          renderCharacterList();
          renderChatList();
          toast(`角色 "${char.name}" 导入成功`, 'success');
        } else {
          toast('无法解析角色卡', 'error');
        }
      } else if (file.name.endsWith('.json') || file.name.endsWith('.charx')) {
        // Parse JSON character
        const text = await file.text();
        const data = JSON.parse(text);
        const char = {
          id: 'char_' + Date.now(),
          name: data.name || data.data?.name || file.name.replace(/\.(json|charx)$/, ''),
          description: data.description || data.data?.description || '',
          systemPrompt: data.system_prompt || data.data?.system_prompt || data.data?.personality || '',
          avatarUrl: '',
          createdAt: Date.now(),
        };
        await saveCharacter(char);
        characters.push(char);
        activeCharacter = char;
        renderCharacterList();
        renderChatList();
        toast(`角色 "${char.name}" 导入成功`, 'success');
      }
    } catch (err) {
      toast(`导入失败: ${err.message}`, 'error');
    }
    input.remove();
  });

  input.click();
}

async function parsePNGCharacterCard(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Look for tEXt chunk with "chara" keyword
  let pos = 8; // Skip PNG signature
  while (pos < bytes.length) {
    const length = (bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3];
    const type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);

    if (type === 'tEXt') {
      const data = new TextDecoder().decode(bytes.slice(pos+8, pos+8+length));
      const nullIdx = data.indexOf('\0');
      if (nullIdx > 0) {
        const keyword = data.slice(0, nullIdx);
        const value = data.slice(nullIdx + 1);
        if (keyword === 'chara' || keyword === 'ccv3') {
          try {
            const decoded = (keyword === 'ccv3')
              ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0))))
              : JSON.parse(value);
            return {
              id: 'char_' + Date.now(),
              name: decoded.name || decoded.data?.name || 'Unnamed',
              description: decoded.description || decoded.data?.description || '',
              systemPrompt: decoded.system_prompt || decoded.data?.system_prompt || decoded.data?.personality || '',
              avatarUrl: URL.createObjectURL(file),
              createdAt: Date.now(),
            };
          } catch {
            // SillyTavern V1/V2 card with base64 data
            try {
              const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0))));
              return {
                id: 'char_' + Date.now(),
                name: decoded.name || decoded.data?.name || 'Unnamed',
                description: decoded.description || decoded.data?.description || '',
                systemPrompt: decoded.system_prompt || decoded.data?.personality || '',
                avatarUrl: URL.createObjectURL(file),
                createdAt: Date.now(),
              };
            } catch { return null; }
          }
        }
      }
    }

    pos += 12 + length; // chunk header (8) + data (length) + CRC (4)
  }
  return null;
}

// ---- UI helpers ----

function toggleSidebar() {
  const sidebar = $('#sidebar');
  if (sidebar) sidebar.classList.toggle('sidebar-open');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}
