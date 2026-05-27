# Asuka AI UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Asuka AI local chat interface so it matches the approved `B: Velvet Control` direction while preserving all core chat workflows.

**Architecture:** Keep the existing single-page app structure and state model intact. Concentrate the refresh in `public/styles.css`, add only minimal markup in `public/index.html`, and make narrowly scoped behavior changes in `public/app.js` for empty-state rendering and polished control labels.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Express-served frontend, browser-based manual verification

---

## File Structure

- Modify: `public/index.html`
  - Add structure for the new welcome empty state and cleaner header/composer affordances.
- Modify: `public/styles.css`
  - Rework tokens and component styling for sidebar, top bar, messages, composer, password gate, modal, and empty state.
- Modify: `public/app.js`
  - Add empty-state rendering logic and small DOM hooks for the refreshed UI.
- Create: `tests/ui-empty-state.test.mjs`
  - Small frontend behavior regression test for the new-chat empty state.

### Task 1: Add an Empty-State Regression Test

**Files:**
- Create: `tests/ui-empty-state.test.mjs`
- Test: `tests/ui-empty-state.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const html = await fs.readFile(path.join(root, "public", "index.html"), "utf8");
const script = await fs.readFile(path.join(root, "public", "app.js"), "utf8");

function bootstrap({ storedChats } = {}) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost:3000/",
    pretendToBeVisual: true,
  });

  const { window } = dom;
  window.APP_MODELS = [{ id: "deepseek-chat", label: "DeepSeek-V4" }];
  window.confirm = () => true;
  window.fetch = async () => ({ ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }) } });
  window.ResizeObserver = class { observe() {} disconnect() {} };
  window.performance = { now: () => 0 };
  window.navigator.clipboard = { writeText: async () => {} };
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  window.Blob = globalThis.Blob;

  if (storedChats) {
    window.localStorage.setItem("cfw_chats_v2", JSON.stringify(storedChats));
  }

  window.eval(script);
  return window.document;
}

test("shows welcome empty state for a brand new chat", () => {
  const document = bootstrap();
  const empty = document.querySelector("[data-empty-state='true']");
  assert.ok(empty);
  assert.match(empty.textContent, /Asuka AI/i);
});

test("hides welcome empty state when current chat has messages", () => {
  const document = bootstrap({
    storedChats: {
      currentChatId: "chat-1",
      chats: [
        {
          id: "chat-1",
          name: "Existing",
          createdAt: 1,
          messages: [{ role: "user", content: "hello" }],
        },
      ],
    },
  });

  const empty = document.querySelector("[data-empty-state='true']");
  assert.equal(empty, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ui-empty-state.test.mjs`
Expected: FAIL because the welcome empty state markup/behavior does not exist yet, so the first assertion cannot find `[data-empty-state='true']`.

- [ ] **Step 3: Add the minimal test dependency**

```json
{
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "jsdom": "^26.1.0",
    "openai": "^4.67.0"
  }
}
```

- [ ] **Step 4: Install the dependency**

Run: `npm install`
Expected: `jsdom` added to `package.json` and `package-lock.json` with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/ui-empty-state.test.mjs
git commit -m "test: add empty state regression coverage"
```

### Task 2: Implement the Structural UI Refresh

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Test: `tests/ui-empty-state.test.mjs`

- [ ] **Step 1: Add the empty-state markup and cleaner semantic wrappers**

```html
<div id="history">
  <div class="chat" id="chat">
    <section class="welcome-state" id="welcomeState" data-empty-state="true">
      <div class="welcome-badge">Asuka AI</div>
      <h1>Start a new conversation.</h1>
      <p>Ask something, drop in files, or keep it casual. This space is ready when you are.</p>
      <div class="welcome-hints">
        <span>Roleplay</span>
        <span>Writing</span>
        <span>Analysis</span>
        <span>File chat</span>
      </div>
    </section>
    <div id="bottom-spacer"></div>
  </div>
</div>
```

- [ ] **Step 2: Wire empty-state visibility in the existing chat rendering flow**

```js
  const welcomeState = document.getElementById("welcomeState");

  function updateEmptyState() {
    if (!welcomeState) return;
    const chat = getCurrentChat();
    const hasMessages = !!chat?.messages?.length;
    welcomeState.hidden = hasMessages;
  }
```

- [ ] **Step 3: Call the empty-state updater at the key state transitions**

```js
  function restoreChatUI(){
    clearUIRows();
    const chat = getCurrentChat();
    updateEmptyState();
    for (const m of chat.messages) {
      const r = makeRow(m.role === "user" ? "user" : "assistant");
      r.bubble.textContent = m.content;
      r.stats.textContent = "";
    }
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
```

- [ ] **Step 4: Run the focused test to verify the new behavior**

Run: `node --test tests/ui-empty-state.test.mjs`
Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js tests/ui-empty-state.test.mjs package.json package-lock.json
git commit -m "feat: add Asuka AI welcome empty state"
```

### Task 3: Apply the Velvet Control Visual Refresh

**Files:**
- Modify: `public/styles.css`
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Refresh root tokens and surface hierarchy**

```css
:root {
  --bg-deep: #090a0f;
  --bg-surface: #11131b;
  --bg-surface-2: rgba(18, 20, 30, 0.78);
  --bg-card: rgba(20, 18, 27, 0.78);
  --accent: #d27c99;
  --accent-strong: #e293a9;
  --accent-dim: rgba(210, 124, 153, 0.14);
  --gold: #c3a56f;
  --text: #f4f1f6;
  --text-muted: #aba5b7;
  --text-dim: #777085;
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(210, 124, 153, 0.24);
  --shadow-lg: 0 24px 70px rgba(0, 0, 0, 0.42);
  --content-max: 860px;
}
```

- [ ] **Step 2: Restyle the sidebar, top bar, and welcome state as one system**

```css
#sidebar {
  background: linear-gradient(180deg, rgba(12, 13, 20, 0.9), rgba(16, 18, 28, 0.78));
  border-right: 1px solid var(--border);
}

.sidebar-item.active {
  background: linear-gradient(135deg, rgba(210, 124, 153, 0.16), rgba(195, 165, 111, 0.08));
  border: 1px solid var(--border-strong);
  box-shadow: inset 3px 0 0 var(--accent);
}

#topbar {
  background: rgba(10, 11, 18, 0.72);
  border-bottom: 1px solid var(--border);
}

.welcome-state {
  margin: 52px auto 0;
  max-width: 680px;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  box-shadow: var(--shadow-lg);
}
```

- [ ] **Step 3: Restyle message rows, composer, modal, and password gate**

```css
.bubble.ai {
  background: rgba(22, 24, 36, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.bubble.user {
  background: linear-gradient(135deg, rgba(210, 124, 153, 0.2), rgba(195, 165, 111, 0.09));
  border: 1px solid rgba(210, 124, 153, 0.18);
}

.input-inner {
  border-radius: 26px;
  background: rgba(15, 16, 24, 0.84);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
}

#settings,
#passwordMask .lock-card {
  background: rgba(18, 18, 27, 0.9);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}
```

- [ ] **Step 4: Normalize the UI copy and control polish in JS where it affects presentation**

```js
  function updateChatTitle() {
    const chat = getCurrentChat();
    if (chatTitle) {
      chatTitle.textContent = chat.name || "New chat";
    }
  }

  personaToggle.textContent = useBuiltin ? "Asuka" : "Custom";
```

- [ ] **Step 5: Run the focused test again**

Run: `node --test tests/ui-empty-state.test.mjs`
Expected: PASS with 2 tests passing after the styling and small JS copy changes.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/styles.css public/app.js
git commit -m "feat: refresh Asuka AI chat interface"
```

### Task 4: Verify the Running App

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Test: `tests/ui-empty-state.test.mjs`

- [ ] **Step 1: Run the focused automated test**

Run: `node --test tests/ui-empty-state.test.mjs`
Expected: PASS with 2 tests passing and exit code 0.

- [ ] **Step 2: Verify the local server still serves the app**

Run: `try { (Invoke-WebRequest -UseBasicParsing http://localhost:3000).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }`
Expected: `200`

- [ ] **Step 3: Reload the in-app browser and visually verify desktop**

Run in browser workflow:
- reload `http://localhost:3000/`
- confirm password gate visual refresh
- enter password
- confirm welcome empty state, sidebar hierarchy, top bar polish, message area spacing, and composer styling

Expected: refreshed UI visible and core layout intact.

- [ ] **Step 4: Verify narrow/mobile viewport in the browser**

Run in browser workflow:
- set a narrow viewport
- reload if needed
- check sidebar drawer, top bar controls, welcome state, and composer fit

Expected: no overlapping controls and no broken primary workflows.

- [ ] **Step 5: Verify key interactions in the browser**

Run in browser workflow:
- create a new chat
- open settings
- send a short message
- verify empty state hides after the first message

Expected: all interactions work and the app remains usable.
