// js/utils/storage.js - IndexedDB + localStorage abstraction
const DB_NAME = 'unlimited-ai-db';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('characters')) {
        d.createObjectStore('characters', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('chats')) {
        d.createObjectStore('chats', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('worldbooks')) {
        d.createObjectStore('worldbooks', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('presets')) {
        d.createObjectStore('presets', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Generic CRUD ----
export const idb = {
  async get(store, key) { await openDB(); return promisify(tx(store).get(key)); },
  async getAll(store) { await openDB(); return promisify(tx(store).getAll()); },
  async put(store, value) { await openDB(); return promisify(tx(store, 'readwrite').put(value)); },
  async delete(store, key) { await openDB(); return promisify(tx(store, 'readwrite').delete(key)); },
  async clear(store) { await openDB(); return promisify(tx(store, 'readwrite').clear()); },
  async count(store) { await openDB(); return promisify(tx(store).count()); },
};

// ---- localStorage helpers ----
export const ls = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

// ---- Domain-specific helpers ----

// Characters (compatible with SillyTavern card format)
export async function getCharacters() {
  return idb.getAll('characters');
}

export async function saveCharacter(char) {
  if (!char.id) char.id = 'char_' + Date.now();
  char.updatedAt = Date.now();
  return idb.put('characters', char);
}

export async function deleteCharacter(id) {
  return idb.delete('characters', id);
}

// Chats
export async function getChats() {
  return idb.getAll('chats');
}

export async function saveChat(chat) {
  if (!chat.id) chat.id = 'chat_' + Date.now();
  chat.updatedAt = Date.now();
  return idb.put('chats', chat);
}

export async function deleteChat(id) {
  return idb.delete('chats', id);
}

// World books
export async function getWorldBooks() {
  return idb.getAll('worldbooks');
}

export async function saveWorldBook(wb) {
  if (!wb.id) wb.id = 'wb_' + Date.now();
  wb.updatedAt = Date.now();
  return idb.put('worldbooks', wb);
}

export async function deleteWorldBook(id) {
  return idb.delete('worldbooks', id);
}

// Presets
export async function getPresets() {
  return idb.getAll('presets');
}

export async function savePreset(preset) {
  if (!preset.id) preset.id = 'preset_' + Date.now();
  return idb.put('presets', preset);
}

export async function deletePreset(id) {
  return idb.delete('presets', id);
}

// App settings
export async function getSetting(key, fallback = null) {
  const v = await idb.get('settings', key);
  return v !== undefined ? v.value : fallback;
}

export async function setSetting(key, value) {
  return idb.put('settings', { key, value });
}
