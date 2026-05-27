// public/app.js
(() => {
  const historyWrap = document.getElementById("history");
  const chatEl = document.getElementById("chat");
  const inputEl = document.getElementById("msg");
  const composerEl = document.getElementById("composer");
  const spacerEl = document.getElementById("bottom-spacer");
  const welcomeState = document.getElementById("welcomeState");

  const modelSel = document.getElementById("modelSel");
  const themeToggle = document.getElementById("themeToggle");
  const personaToggle = document.getElementById("personaToggle");
  const settingsBtn = document.getElementById("settingsBtn");
  const sendBtn = document.getElementById("sendBtn");

  const settingsMask = document.getElementById("settingsMask");
  const customPromptEl = document.getElementById("customPrompt");
  const savePromptBtn = document.getElementById("savePrompt");
  const clearPromptBtn = document.getElementById("clearPrompt");
  const closeSettingsBtn = document.getElementById("closeSettings");
  const historyKeepEl = document.getElementById("historyKeep");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const promptKeepEl = document.getElementById("promptKeep");

  // 侧栏元素
  const sidebarEl = document.getElementById("sidebar");
  const sidebarList = document.getElementById("sidebarList");
  const newChatBtn = document.getElementById("newChatBtn");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const menuBtn = document.getElementById("menuBtn");
  const chatTitle = document.getElementById("chatTitle");
  const sortBySel = document.getElementById("sortBy");
  const chatCountEl = document.getElementById("chatCount");
  const storageSizeEl = document.getElementById("storageSize");
  const contextMenu = document.getElementById("contextMenu");

  // 文件上传
  const fileInput = document.getElementById("fileInput");
  const attachBtn = document.getElementById("attachBtn");
  const attachPreview = document.getElementById("attachPreview");
  let attachedFiles = []; // { name, content }

  const MODELS = (window.APP_MODELS || [
    { id: "deepseek-chat", label: "DeepSeek-V4" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  ]);

  // ====== 密码 ======
  let chatPassword = "";
  const passwordMask = document.getElementById("passwordMask");
  const passwordInput = document.getElementById("passwordInput");
  const passwordSubmit = document.getElementById("passwordSubmit");
  const passwordError = document.getElementById("passwordError");

  async function verifyPassword(pwd) {
    const res = await fetch("/api/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (!res.ok) throw new Error("密码错误");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "密码错误");
  }

  passwordSubmit.addEventListener("click", async () => {
    const pwd = passwordInput.value.trim();
    if (!pwd) return;
    try {
      await verifyPassword(pwd);
      chatPassword = pwd;
      passwordMask.style.display = "none";
    } catch {
      passwordError.textContent = "密码错误，请重试";
      passwordError.style.display = "block";
    }
  });

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") passwordSubmit.click();
  });

  // ====== 多会话管理 ======
  const LS_CHATS = "cfw_chats_v2";
  let chatsData = { currentChatId: null, chats: [] };

  function loadChats() {
    try {
      const raw = localStorage.getItem(LS_CHATS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.chats)) {
          chatsData = parsed;
        }
      }
    } catch {}
    // 确保至少有一个对话
    if (!chatsData.chats.length) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      chatsData.chats.push({ id, name: "新对话", createdAt: Date.now(), messages: [] });
      chatsData.currentChatId = id;
      saveChats();
    }
    if (!chatsData.currentChatId || !chatsData.chats.find(c => c.id === chatsData.currentChatId)) {
      chatsData.currentChatId = chatsData.chats[0].id;
      saveChats();
    }
  }

  function saveChats() {
    try { localStorage.setItem(LS_CHATS, JSON.stringify(chatsData)); } catch {}
  }

  function formatStorageSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function getCurrentChat() {
    return chatsData.chats.find(c => c.id === chatsData.currentChatId) || chatsData.chats[0];
  }

  function updateEmptyState() {
    if (!welcomeState) return;
    const chat = getCurrentChat();
    const hasMessages = !!chat?.messages?.length;
    welcomeState.hidden = hasMessages;
  }

  function autoName(chat) {
    const userMsg = chat.messages.find(m => m.role === "user");
    if (userMsg) {
      chat.name = userMsg.content.slice(0, 30).replace(/\n/g, " ");
    }
  }

  function renderSidebar() {
    sidebarList.innerHTML = "";
    for (const chat of chatsData.chats) {
      const item = document.createElement("div");
      item.className = "sidebar-item" + (chat.id === chatsData.currentChatId ? " active" : "");
      item.setAttribute("data-chat-id", chat.id);
      item.title = chat.name;

      const icon = document.createElement("span");
      icon.className = "chat-icon";
      icon.textContent = "💬";

      const name = document.createElement("span");
      name.className = "chat-name";
      name.textContent = chat.name;

      const rename = document.createElement("button");
      rename.className = "chat-rename";
      rename.textContent = "✎";
      rename.title = "重命名";
      rename.addEventListener("click", (e) => {
        e.stopPropagation();
        startRename(chat.id);
      });

      const del = document.createElement("button");
      del.className = "chat-del";
      del.textContent = "×";
      del.title = "删除此对话";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(rename);
      item.appendChild(del);
      item.addEventListener("click", () => switchChat(chat.id));
      sidebarList.appendChild(item);
    }
    updateSidebarFooter();
  }

  function startRename(chatId) {
    const item = sidebarList.querySelector(`.sidebar-item[data-chat-id="${chatId}"]`);
    if (!item) return;
    const nameEl = item.querySelector(".chat-name");
    const renameBtn = item.querySelector(".chat-rename");
    const delBtn = item.querySelector(".chat-del");
    if (!nameEl) return;

    // Hide name and buttons, show input
    nameEl.style.display = "none";
    if (renameBtn) renameBtn.style.display = "none";
    if (delBtn) delBtn.style.display = "none";

    const input = document.createElement("input");
    input.className = "chat-rename-input";
    input.value = nameEl.textContent;
    input.setAttribute("data-chat-id", chatId);
    nameEl.after(input);

    const finish = () => finishRename(chatId, input, nameEl, renameBtn, delBtn);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(); }
      if (e.key === "Escape") { cancelRename(input, nameEl, renameBtn, delBtn); }
    });
    input.addEventListener("blur", () => {
      // Small delay to allow Enter/Esc to fire first
      setTimeout(() => {
        if (input.isConnected) finish();
      }, 120);
    });

    input.focus();
    input.select();
  }

  function finishRename(chatId, input, nameEl, renameBtn, delBtn) {
    const newName = input.value.trim();
    input.remove();
    nameEl.style.display = "";
    if (renameBtn) renameBtn.style.display = "";
    if (delBtn) delBtn.style.display = "";

    if (newName && newName !== nameEl.textContent) {
      const chat = chatsData.chats.find(c => c.id === chatId);
      if (chat) {
        chat.name = newName;
        saveChats();
        renderSidebar();
        updateChatTitle();
      }
    }
  }

  function cancelRename(input, nameEl, renameBtn, delBtn) {
    input.remove();
    nameEl.style.display = "";
    if (renameBtn) renameBtn.style.display = "";
    if (delBtn) delBtn.style.display = "";
  }

  function updateChatTitle() {
    const chat = getCurrentChat();
    if (chatTitle) {
      chatTitle.textContent = chat.name || "新对话";
    }
  }

  function updateSidebarFooter() {
    if (chatCountEl) {
      const n = chatsData.chats.length;
      chatCountEl.textContent = n + " 个对话";
    }
    if (storageSizeEl) {
      let bytes = 0;
      try { bytes = new Blob([localStorage.getItem(LS_CHATS) || ""]).size; } catch {}
      if (bytes < 1024) storageSizeEl.textContent = "≈ " + bytes + " B";
      else if (bytes < 1048576) storageSizeEl.textContent = "≈ " + (bytes / 1024).toFixed(1) + " KB";
      else storageSizeEl.textContent = "≈ " + (bytes / 1048576).toFixed(1) + " MB";
    }
  }

  function sortChats(by) {
    if (by === "newest") {
      chatsData.chats.sort((a, b) => b.createdAt - a.createdAt);
    } else if (by === "oldest") {
      chatsData.chats.sort((a, b) => a.createdAt - b.createdAt);
    } else if (by === "name") {
      chatsData.chats.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    }
    saveChats();
    renderSidebar();
  }

  // Theme
  const LS_THEME = "cfw_theme";
  function initTheme() {
    if (localStorage.getItem(LS_THEME) === "light") {
      document.body.classList.add("light");
      if (themeToggle) themeToggle.textContent = "☀️";
    }
  }
  function toggleTheme() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem(LS_THEME, isLight ? "light" : "dark");
    if (themeToggle) themeToggle.textContent = isLight ? "☀️" : "🌓";
  }

  // Export chat
  function exportChat(chatId) {
    const chat = chatsData.chats.find(c => c.id === chatId);
    if (!chat) return;
    const blob = new Blob([JSON.stringify(chat, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (chat.name || "对话") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function switchChat(id) {
    if (id === chatsData.currentChatId) return;
    chatsData.currentChatId = id;
    saveChats();
    restoreChatUI();
    renderSidebar();
    updateChatTitle();
    updateSpacer();
    scrollToBottom();
  }

  function newChat() {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    chatsData.chats.unshift({ id, name: "新对话", createdAt: Date.now(), messages: [] });
    chatsData.currentChatId = id;
    saveChats();
    renderSidebar();
    updateChatTitle();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
    inputEl.focus();
  }

  function deleteChat(id) {
    if (chatsData.chats.length <= 1) return;
    const ok = confirm("确定删除这个对话？");
    if (!ok) return;
    chatsData.chats = chatsData.chats.filter(c => c.id !== id);
    if (chatsData.currentChatId === id) {
      chatsData.currentChatId = chatsData.chats[0].id;
    }
    saveChats();
    renderSidebar();
    updateChatTitle();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
  }

  // ====== 令牌统计（当前会话） ======
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalInEstimate = 0;
  let totalOutEstimate = 0;

  // ====== 本地存储 Key ======
  const LS_MODEL = "cfw_model";
  const LS_USE_BUILTIN = "cfw_use_builtin";
  const LS_HISTORY_ENABLED = "cfw_history_enabled";
  const LS_PROMPT_ENABLED = "cfw_prompt_enabled";
  const LS_CUSTOM_PROMPT = "cfw_custom_prompt_v1";

  let useBuiltin = (localStorage.getItem(LS_USE_BUILTIN) ?? "1") === "1";

  let historyEnabled = (localStorage.getItem(LS_HISTORY_ENABLED) ?? "0") === "1";
  let promptEnabled  = (localStorage.getItem(LS_PROMPT_ENABLED) ?? "1") === "1";
  historyKeepEl.checked = historyEnabled;
  promptKeepEl.checked = promptEnabled;

  function estimateTokens(text){
    if (!text) return 0;
    let cjk = 0, ascii = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") continue;
      const isCJK =
        (code >= 0x4E00 && code <= 0x9FFF) ||
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0x3040 && code <= 0x30FF) ||
        (code >= 0xAC00 && code <= 0xD7AF) ||
        (code >= 0xFF00 && code <= 0xFFEF);
      if (isCJK) cjk++; else ascii++;
    }
    return cjk + Math.ceil(ascii / 4);
  }

  function updateSpacer(){
    if (!composerEl || !spacerEl) return;
    const rect = composerEl.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const gap = parseFloat(rootStyle.getPropertyValue("--composer-gap")) || 18;
    const extra = parseFloat(rootStyle.getPropertyValue("--spacer-extra")) || 28;
    const h = Math.ceil(rect.height + gap + extra);
    spacerEl.style.height = h + "px";
    historyWrap.style.scrollPaddingBottom = h + "px";
  }

  function isNearBottom(){
    const threshold = 120;
    return (historyWrap.scrollHeight - historyWrap.scrollTop - historyWrap.clientHeight) < threshold;
  }
  function scrollToBottom(){
    historyWrap.scrollTo({ top: historyWrap.scrollHeight, behavior: "auto" });
  }

  function makeRow(role){
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "ai");

    const avatar = document.createElement("div");
    avatar.className = "avatar " + (role === "user" ? "human" : "bot");
    avatar.textContent = (role === "user" ? "U" : "B");

    const content = document.createElement("div");
    content.className = "content";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (role === "user" ? "User" : "Bot");

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (role === "user" ? "user" : "ai");

    const stats = document.createElement("div");
    stats.className = "stats";

    content.appendChild(meta);
    content.appendChild(bubble);

    // AI message action buttons
    let actions = null;
    if (role !== "user") {
      actions = document.createElement("div");
      actions.className = "msg-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "action-btn";
      copyBtn.textContent = "📋";
      copyBtn.title = "复制";
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = bubble.textContent || "";
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "✓";
          setTimeout(() => { copyBtn.textContent = "📋"; }, 1200);
        }).catch(() => {});
      });

      const regenBtn = document.createElement("button");
      regenBtn.className = "action-btn";
      regenBtn.textContent = "🔄";
      regenBtn.title = "重新生成";
      regenBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        regenerate();
      });

      actions.appendChild(copyBtn);
      actions.appendChild(regenBtn);
      content.appendChild(actions);
    }

    content.appendChild(stats);

    if (role === "user") {
      row.appendChild(content);
      row.appendChild(avatar);
    } else {
      row.appendChild(avatar);
      row.appendChild(content);
    }

    chatEl.insertBefore(row, spacerEl);
    if (isNearBottom()) scrollToBottom();

    return { bubble, stats, row };
  }

  function clearUIRows(){
    const nodes = Array.from(chatEl.children);
    for (const n of nodes) {
      if (n === spacerEl) continue;
      chatEl.removeChild(n);
    }
  }

  function restoreChatUI(){
    clearUIRows();
    const chat = getCurrentChat();
    for (const m of chat.messages) {
      const r = makeRow(m.role === "user" ? "user" : "assistant");
      r.bubble.textContent = m.content;
      r.stats.textContent = "";
    }
    // 重置统计
    totalPromptTokens = 0;
    totalCompletionTokens = 0;
    totalInEstimate = 0;
    totalOutEstimate = 0;
  }

  function persistCurrentChat(){
    if (!historyEnabled) return;
    // 自动命名
    const chat = getCurrentChat();
    if (chat.name === "新对话" || !chat.name) {
      autoName(chat);
    }
    saveChats();
    renderSidebar();
  }

  function initModels(){
    modelSel.innerHTML = "";
    for (const m of MODELS) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      modelSel.appendChild(opt);
    }
    const saved = localStorage.getItem(LS_MODEL);
    modelSel.value = saved || MODELS[0].id;
    modelSel.addEventListener("change", () => {
      localStorage.setItem(LS_MODEL, modelSel.value);
    });
  }

  // persona mode
  personaToggle.addEventListener("click", () => {
    useBuiltin = !useBuiltin;
    localStorage.setItem(LS_USE_BUILTIN, useBuiltin ? "1" : "0");
    syncPersonaToggle();
  });

  // Settings
  settingsBtn.addEventListener("click", () => {
    settingsMask.style.display = "flex";
    historyKeepEl.checked = historyEnabled;
    promptKeepEl.checked = promptEnabled;
    customPromptEl.value = (localStorage.getItem(LS_CUSTOM_PROMPT) || "");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsMask.style.display = "none";
  });
  settingsMask.addEventListener("click", (e) => {
    if (e.target === settingsMask) settingsMask.style.display = "none";
  });

  // history
  historyKeepEl.addEventListener("change", () => {
    historyEnabled = !!historyKeepEl.checked;
    localStorage.setItem(LS_HISTORY_ENABLED, historyEnabled ? "1" : "0");
    if (historyEnabled) saveChats();
    else localStorage.removeItem(LS_CHATS);
  });
  clearHistoryBtn.addEventListener("click", () => {
    const ok = confirm("Clear all local chat history?");
    if (!ok) return;
    localStorage.removeItem(LS_CHATS);
    chatsData = { currentChatId: null, chats: [] };
    loadChats();
    renderSidebar();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
  });

  // custom prompt
  promptKeepEl.addEventListener("change", () => {
    promptEnabled = !!promptKeepEl.checked;
    localStorage.setItem(LS_PROMPT_ENABLED, promptEnabled ? "1" : "0");
    if (!promptEnabled) localStorage.removeItem(LS_CUSTOM_PROMPT);
  });
  savePromptBtn.addEventListener("click", () => {
    const val = customPromptEl.value || "";
    if (promptEnabled) localStorage.setItem(LS_CUSTOM_PROMPT, val);
    else localStorage.removeItem(LS_CUSTOM_PROMPT);
    settingsMask.style.display = "none";
  });
  clearPromptBtn.addEventListener("click", () => {
    const ok = confirm("Clear the saved custom prompt?");
    if (!ok) return;
    localStorage.removeItem(LS_CUSTOM_PROMPT);
    customPromptEl.value = "";
  });

  // 侧栏操作
  newChatBtn.addEventListener("click", newChat);

  // 排序
  if (sortBySel) {
    sortBySel.addEventListener("change", () => {
      sortChats(sortBySel.value);
    });
  }

  // 主题
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  function openSidebar() {
    sidebarEl.classList.remove("collapsed");
  }
  function closeSidebar() {
    sidebarEl.classList.add("collapsed");
  }
  function toggleSidebar() {
    sidebarEl.classList.toggle("collapsed");
  }

  toggleSidebarBtn.addEventListener("click", closeSidebar);
  menuBtn.addEventListener("click", toggleSidebar);

  // 文件上传
  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    for (const file of fileInput.files) {
      if (attachedFiles.find(f => f.name === file.name)) continue;
      try {
        const content = await file.text();
        attachedFiles.push({ name: file.name, content });
      } catch {
        // binary files silently skipped
      }
    }
    fileInput.value = "";
    renderAttachPreview();
  });

  function renderAttachPreview() {
    attachPreview.innerHTML = "";
    for (let i = 0; i < attachedFiles.length; i++) {
      const f = attachedFiles[i];
      const tag = document.createElement("div");
      tag.className = "attach-tag";

      const icon = document.createElement("span");
      icon.textContent = "📄";

      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = f.name;

      const rm = document.createElement("button");
      rm.className = "file-remove";
      rm.textContent = "×";
      rm.title = "移除";
      rm.addEventListener("click", () => {
        attachedFiles.splice(i, 1);
        renderAttachPreview();
      });

      tag.appendChild(icon);
      tag.appendChild(name);
      tag.appendChild(rm);
      attachPreview.appendChild(tag);
    }
  }

  // 点击侧栏外部关闭（移动端）
  document.addEventListener("click", (e) => {
    if (window.innerWidth > 768) return;
    // Don't close if clicking context menu
    if (contextMenu && contextMenu.contains(e.target)) return;
    if (!sidebarEl.classList.contains("collapsed") &&
        !sidebarEl.contains(e.target) &&
        e.target !== menuBtn &&
        !menuBtn.contains(e.target)) {
      closeSidebar();
    }
    // Close context menu on outside click
    if (contextMenu && !contextMenu.contains(e.target)) {
      contextMenu.style.display = "none";
    }
  });

  // 移动端滑动手势
  (function setupSwipe() {
    const mainArea = document.getElementById("mainArea");
    if (!mainArea) return;
    let touchStartX = 0;
    let touchStartY = 0;
    mainArea.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });
    mainArea.addEventListener("touchend", (e) => {
      if (window.innerWidth > 768) return;
      const dx = (e.changedTouches[0]?.clientX || touchStartX) - touchStartX;
      const dy = Math.abs((e.changedTouches[0]?.clientY || touchStartY) - touchStartY);
      // Only horizontal swipes
      if (Math.abs(dx) < 60 || dy > Math.abs(dx) * 0.7) return;
      if (dx > 0 && touchStartX < 40) {
        openSidebar();
      } else if (dx < 0 && !sidebarEl.classList.contains("collapsed")) {
        closeSidebar();
      }
    });
  })();

  // 侧栏右键菜单
  if (sidebarList && contextMenu) {
    let contextChatId = null;
    sidebarList.addEventListener("contextmenu", (e) => {
      const item = e.target.closest(".sidebar-item");
      if (!item) return;
      e.preventDefault();
      contextChatId = item.getAttribute("data-chat-id");
      contextMenu.style.display = "block";
      contextMenu.style.left = e.clientX + "px";
      contextMenu.style.top = e.clientY + "px";
      // Keep menu within viewport
      const rect = contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) contextMenu.style.left = (e.clientX - rect.width) + "px";
      if (rect.bottom > window.innerHeight) contextMenu.style.top = (e.clientY - rect.height) + "px";
    });
    contextMenu.addEventListener("click", (e) => {
      const action = e.target.closest(".context-item")?.getAttribute("data-action");
      if (!action || !contextChatId) return;
      contextMenu.style.display = "none";
      if (action === "rename") {
        startRename(contextChatId);
      } else if (action === "delete") {
        deleteChat(contextChatId);
      } else if (action === "export") {
        exportChat(contextChatId);
      }
    });
  }

  // composer
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = inputEl.scrollHeight + "px";
    const stick = isNearBottom();
    updateSpacer();
    if (stick) scrollToBottom();
  });

  function setupResizeObserver(){
    if (!composerEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const stick = isNearBottom();
      updateSpacer();
      if (stick) scrollToBottom();
    });
    ro.observe(composerEl);
  }
  function setupViewportListener(){
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener("resize", () => {
      const stick = isNearBottom();
      updateSpacer();
      if (stick) scrollToBottom();
    });
  }
  window.addEventListener("resize", () => {
    const stick = isNearBottom();
    updateSpacer();
    if (stick) scrollToBottom();
  });

  async function send(){
    updateSpacer();
    const text = inputEl.value.trim();
    const hasFiles = attachedFiles.length > 0;
    if (!text && !hasFiles) return;

    const chat = getCurrentChat();
    const isFirstMsg = chat.messages.length === 0;

    // Build the full submitted message, including inline file contents.
    let fullText = text;
    if (hasFiles) {
      const fileParts = attachedFiles.map(f => `\n--- 文件: ${f.name} ---\n${f.content}\n--- 文件结束 ---`);
      const prompt = text || "Please review the attached files.";
      fullText = prompt + fileParts.join("");
    }

    const displayText = hasFiles
      ? (text || "Please review the attached files.") + "\n" + attachedFiles.map(f => "+ " + f.name).join("\n")
      : text;

    const userRow = makeRow("user");
    userRow.bubble.textContent = displayText;

    const inEst = estimateTokens(fullText);
    totalInEstimate += inEst;
    userRow.stats.textContent = `Input est. ${inEst} | Total in ${totalInEstimate}`;

    chat.messages.push({ role: "user", content: fullText });
    attachedFiles = [];
    renderAttachPreview();
    if (isFirstMsg) autoName(chat);
    saveChats();
    if (isFirstMsg) renderSidebar();

    inputEl.value = "";
    inputEl.style.height = "auto";
    updateSpacer();
    scrollToBottom();

    const aiRow = makeRow("assistant");
    let outStartMs = 0;
    let outEndMs = 0;
    let full = "";
    let exactUsage = null;

    let customPrompt = "";
    if (!useBuiltin) {
      if (promptEnabled) customPrompt = localStorage.getItem(LS_CUSTOM_PROMPT) || "";
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelSel.value,
        use_builtin_persona: useBuiltin,
        custom_system_prompt: customPrompt,
        password: chatPassword,
        messages: chat.messages
      })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      aiRow.bubble.textContent = `Request failed (${res.status}):\n${t}`;
      aiRow.stats.textContent = "";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.replace("data: ", "").trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.usage) exactUsage = parsed.usage;

          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            if (!outStartMs) outStartMs = performance.now();
            full += delta;
            aiRow.bubble.textContent = full;
            if (isNearBottom()) scrollToBottom();
          }
        } catch {}
      }
    }

    outEndMs = performance.now();
    chat.messages.push({ role: "assistant", content: full });
    saveChats();

    const seconds = Math.max(0.001, (outEndMs - (outStartMs || outEndMs)) / 1000);

    if (exactUsage && typeof exactUsage.completion_tokens === "number") {
      const p = exactUsage.prompt_tokens || 0;
      const c = exactUsage.completion_tokens || 0;
      const t = exactUsage.total_tokens || (p + c);

      totalPromptTokens += p;
      totalCompletionTokens += c;

      const tps = c / seconds;

      aiRow.stats.textContent =
        `Prompt: ${p} | Completion: ${c} | Total: ${t} | Speed: ${tps.toFixed(2)} tok/s | CumPrompt: ${totalPromptTokens} | CumCompletion: ${totalCompletionTokens}`;
    } else {
      const outEst = estimateTokens(full);
      totalOutEstimate += outEst;
      const tps = outEst / seconds;

      aiRow.stats.textContent =
        `Output est. ${outEst} | Total out ${totalOutEstimate} | Speed est. ${tps.toFixed(2)} tok/s`;
    }

    updateSpacer();
    scrollToBottom();
  }

  async function regenerate(){
    const chat = getCurrentChat();
    if (chat.messages.length === 0) return;
    // Remove last AI message if present
    if (chat.messages[chat.messages.length - 1].role === "assistant") {
      chat.messages.pop();
    } else return;
    saveChats();

    // Remove last AI row from UI
    const rows = Array.from(chatEl.querySelectorAll(".row.ai"));
    if (rows.length > 0) {
      rows[rows.length - 1].remove();
    }

    const aiRow = makeRow("assistant");
    let outStartMs = 0;
    let outEndMs = 0;
    let full = "";
    let exactUsage = null;

    let customPrompt = "";
    if (!useBuiltin) {
      if (promptEnabled) customPrompt = localStorage.getItem(LS_CUSTOM_PROMPT) || "";
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelSel.value,
        use_builtin_persona: useBuiltin,
        custom_system_prompt: customPrompt,
        password: chatPassword,
        messages: chat.messages
      })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      aiRow.bubble.textContent = `Request failed (${res.status}):\n${t}`;
      aiRow.stats.textContent = "";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.replace("data: ", "").trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.usage) exactUsage = parsed.usage;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            if (!outStartMs) outStartMs = performance.now();
            full += delta;
            aiRow.bubble.textContent = full;
            if (isNearBottom()) scrollToBottom();
          }
        } catch {}
      }
    }

    outEndMs = performance.now();
    chat.messages.push({ role: "assistant", content: full });
    saveChats();

    const seconds = Math.max(0.001, (outEndMs - (outStartMs || outEndMs)) / 1000);
    if (exactUsage && typeof exactUsage.completion_tokens === "number") {
      const p = exactUsage.prompt_tokens || 0;
      const c = exactUsage.completion_tokens || 0;
      totalPromptTokens += p;
      totalCompletionTokens += c;
      aiRow.stats.textContent =
        `Prompt: ${p} | Completion: ${c} | Total: ${exactUsage.total_tokens || (p + c)} | Speed: ${(c / seconds).toFixed(2)} tok/s | CumPrompt: ${totalPromptTokens} | CumCompletion: ${totalCompletionTokens}`;
    } else {
      const outEst = estimateTokens(full);
      totalOutEstimate += outEst;
      aiRow.stats.textContent =
        `Output est. ${outEst} | Total out ${totalOutEstimate} | Speed est. ${(outEst / seconds).toFixed(2)} tok/s`;
    }

    updateSpacer();
    scrollToBottom();
  }

  function syncPersonaToggle() {
    if (!personaToggle) return;
    personaToggle.textContent = useBuiltin ? "A" : "C";
    personaToggle.classList.toggle("is-custom", !useBuiltin);
    personaToggle.setAttribute("title", useBuiltin ? "Built-in persona" : "Custom prompt mode");
    personaToggle.setAttribute("aria-label", useBuiltin ? "Built-in persona" : "Custom prompt mode");
  }

  // Override a few legacy labels from earlier UI revisions so the refreshed
  // interface uses one consistent copy system without rewriting unrelated logic.
  updateChatTitle = function updateChatTitleRefreshed() {
    const chat = getCurrentChat();
    if (chatTitle) {
      chatTitle.textContent = chat.name || "New chat";
    }
  };

  updateSidebarFooter = function updateSidebarFooterRefreshed() {
    if (chatCountEl) {
      const n = chatsData.chats.length;
      chatCountEl.textContent = n + (n === 1 ? " chat" : " chats");
    }
    if (storageSizeEl) {
      let bytes = 0;
      try { bytes = new Blob([localStorage.getItem(LS_CHATS) || ""]).size; } catch {}
      storageSizeEl.textContent = formatStorageSize(bytes);
    }
  };

  loadChats = function loadChatsRefreshed() {
    try {
      const raw = localStorage.getItem(LS_CHATS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.chats)) {
          chatsData = parsed;
        }
      }
    } catch {}

    if (!chatsData.chats.length) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      chatsData.chats.push({ id, name: "New chat", createdAt: Date.now(), messages: [] });
      chatsData.currentChatId = id;
      saveChats();
    }

    if (!chatsData.currentChatId || !chatsData.chats.find((c) => c.id === chatsData.currentChatId)) {
      chatsData.currentChatId = chatsData.chats[0].id;
      saveChats();
    }
  };

  renderSidebar = function renderSidebarRefreshed() {
    sidebarList.innerHTML = "";
    for (const chat of chatsData.chats) {
      const item = document.createElement("div");
      item.className = "sidebar-item" + (chat.id === chatsData.currentChatId ? " active" : "");
      item.setAttribute("data-chat-id", chat.id);
      item.title = chat.name;

      const icon = document.createElement("span");
      icon.className = "chat-icon";
      icon.textContent = "•";

      const name = document.createElement("span");
      name.className = "chat-name";
      name.textContent = chat.name;

      const rename = document.createElement("button");
      rename.className = "chat-rename";
      rename.textContent = "Edit";
      rename.title = "Rename";
      rename.addEventListener("click", (e) => {
        e.stopPropagation();
        startRename(chat.id);
      });

      const del = document.createElement("button");
      del.className = "chat-del";
      del.textContent = "×";
      del.title = "Delete";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(rename);
      item.appendChild(del);
      item.addEventListener("click", () => switchChat(chat.id));
      sidebarList.appendChild(item);
    }
    updateSidebarFooter();
  };

  newChat = function newChatRefreshed() {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    chatsData.chats.unshift({ id, name: "New chat", createdAt: Date.now(), messages: [] });
    chatsData.currentChatId = id;
    saveChats();
    renderSidebar();
    updateChatTitle();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
    inputEl.focus();
  };

  deleteChat = function deleteChatRefreshed(id) {
    if (chatsData.chats.length <= 1) return;
    const ok = confirm("Delete this chat?");
    if (!ok) return;
    chatsData.chats = chatsData.chats.filter((c) => c.id !== id);
    if (chatsData.currentChatId === id) {
      chatsData.currentChatId = chatsData.chats[0].id;
    }
    saveChats();
    renderSidebar();
    updateChatTitle();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
  };

  function loadChats() {
    try {
      const raw = localStorage.getItem(LS_CHATS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.chats)) {
          chatsData = parsed;
        }
      }
    } catch {}

    if (!chatsData.chats.length) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      chatsData.chats.push({ id, name: "New chat", createdAt: Date.now(), messages: [] });
      chatsData.currentChatId = id;
      saveChats();
    }

    if (!chatsData.currentChatId || !chatsData.chats.find((c) => c.id === chatsData.currentChatId)) {
      chatsData.currentChatId = chatsData.chats[0].id;
      saveChats();
    }
  }

  function renderSidebar() {
    sidebarList.innerHTML = "";
    for (const chat of chatsData.chats) {
      const item = document.createElement("div");
      item.className = "sidebar-item" + (chat.id === chatsData.currentChatId ? " active" : "");
      item.setAttribute("data-chat-id", chat.id);
      item.title = chat.name;

      const icon = document.createElement("span");
      icon.className = "chat-icon";
      icon.textContent = "•";

      const name = document.createElement("span");
      name.className = "chat-name";
      name.textContent = chat.name;

      const rename = document.createElement("button");
      rename.className = "chat-rename";
      rename.textContent = "Edit";
      rename.title = "Rename";
      rename.addEventListener("click", (e) => {
        e.stopPropagation();
        startRename(chat.id);
      });

      const del = document.createElement("button");
      del.className = "chat-del";
      del.textContent = "×";
      del.title = "Delete";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(rename);
      item.appendChild(del);
      item.addEventListener("click", () => switchChat(chat.id));
      sidebarList.appendChild(item);
    }
    updateSidebarFooter();
  }

  function updateChatTitle() {
    const chat = getCurrentChat();
    if (chatTitle) {
      chatTitle.textContent = chat.name || "New chat";
    }
  }

  function updateSidebarFooter() {
    if (chatCountEl) {
      const n = chatsData.chats.length;
      chatCountEl.textContent = n + (n === 1 ? " chat" : " chats");
    }
    if (storageSizeEl) {
      let bytes = 0;
      try { bytes = new Blob([localStorage.getItem(LS_CHATS) || ""]).size; } catch {}
      storageSizeEl.textContent = formatStorageSize(bytes);
    }
  }

  function initTheme() {
    if (localStorage.getItem(LS_THEME) === "light") {
      document.body.classList.add("light");
      if (themeToggle) themeToggle.textContent = "◑";
    } else if (themeToggle) {
      themeToggle.textContent = "◐";
    }
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem(LS_THEME, isLight ? "light" : "dark");
    if (themeToggle) themeToggle.textContent = isLight ? "◑" : "◐";
  }

  function clearUIRows() {
    const nodes = Array.from(chatEl.children);
    for (const n of nodes) {
      if (n === spacerEl || n === welcomeState) continue;
      chatEl.removeChild(n);
    }
  }

  function makeRow(role) {
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "ai");

    const avatar = document.createElement("div");
    avatar.className = "avatar " + (role === "user" ? "human" : "bot");
    avatar.textContent = role === "user" ? "You" : "Asuka";

    const content = document.createElement("div");
    content.className = "content";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = role === "user" ? "You" : "Asuka";

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (role === "user" ? "user" : "ai");

    const stats = document.createElement("div");
    stats.className = "stats";

    content.appendChild(meta);
    content.appendChild(bubble);

    if (role !== "user") {
      const actions = document.createElement("div");
      actions.className = "msg-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "action-btn";
      copyBtn.textContent = "Copy";
      copyBtn.title = "Copy";
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = bubble.textContent || "";
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "Done";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
        }).catch(() => {});
      });

      const regenBtn = document.createElement("button");
      regenBtn.className = "action-btn";
      regenBtn.textContent = "Redo";
      regenBtn.title = "Regenerate";
      regenBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        regenerate();
      });

      actions.appendChild(copyBtn);
      actions.appendChild(regenBtn);
      content.appendChild(actions);
    }

    content.appendChild(stats);

    if (role === "user") {
      row.appendChild(content);
      row.appendChild(avatar);
    } else {
      row.appendChild(avatar);
      row.appendChild(content);
    }

    chatEl.insertBefore(row, spacerEl);
    if (isNearBottom()) scrollToBottom();

    return { bubble, stats, row };
  }

  function restoreChatUI() {
    clearUIRows();
    const chat = getCurrentChat();
    updateEmptyState();
    for (const m of chat.messages) {
      const r = makeRow(m.role === "user" ? "user" : "assistant");
      r.bubble.textContent = m.content;
      r.stats.textContent = "";
    }
    totalPromptTokens = 0;
    totalCompletionTokens = 0;
    totalInEstimate = 0;
    totalOutEstimate = 0;
  }

  function persistCurrentChat() {
    if (!historyEnabled) return;
    const chat = getCurrentChat();
    if (chat.name === "New chat" || !chat.name) {
      autoName(chat);
    }
    saveChats();
    renderSidebar();
  }

  function newChat() {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    chatsData.chats.unshift({ id, name: "New chat", createdAt: Date.now(), messages: [] });
    chatsData.currentChatId = id;
    saveChats();
    renderSidebar();
    updateChatTitle();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
    inputEl.focus();
  }

  function deleteChat(id) {
    if (chatsData.chats.length <= 1) return;
    const ok = confirm("Delete this chat?");
    if (!ok) return;
    chatsData.chats = chatsData.chats.filter((c) => c.id !== id);
    if (chatsData.currentChatId === id) {
      chatsData.currentChatId = chatsData.chats[0].id;
    }
    saveChats();
    renderSidebar();
    updateChatTitle();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
  }

  function renderAttachPreview() {
    attachPreview.innerHTML = "";
    for (let i = 0; i < attachedFiles.length; i++) {
      const f = attachedFiles[i];
      const tag = document.createElement("div");
      tag.className = "attach-tag";

      const icon = document.createElement("span");
      icon.textContent = "File";

      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = f.name;

      const rm = document.createElement("button");
      rm.className = "file-remove";
      rm.textContent = "×";
      rm.title = "Remove";
      rm.addEventListener("click", () => {
        attachedFiles.splice(i, 1);
        renderAttachPreview();
      });

      tag.appendChild(icon);
      tag.appendChild(name);
      tag.appendChild(rm);
      attachPreview.appendChild(tag);
    }
  }

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  function init(){
    initTheme();
    loadChats();
    renderSidebar();
    updateChatTitle();
    syncPersonaToggle();
    initModels();
    setupResizeObserver();
    setupViewportListener();
    restoreChatUI();
    updateSpacer();
    scrollToBottom();
  }

  init();
})();
