import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const html = await fs.readFile(path.join(root, "public", "index.html"), "utf8");
const script = await fs.readFile(path.join(root, "public", "app.js"), "utf8");
const styles = await fs.readFile(path.join(root, "public", "styles.css"), "utf8");

function createFetchMock() {
  return async () => ({
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            return { done: true, value: undefined };
          },
        };
      },
    },
    async text() {
      return "";
    },
  });
}

function bootstrap({ storedChats } = {}) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost:3000/",
    pretendToBeVisual: true,
  });

  const { window } = dom;
  window.APP_MODELS = [{ id: "deepseek-chat", label: "DeepSeek-V4" }];
  window.confirm = () => true;
  window.fetch = createFetchMock();
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.performance = { now: () => 0 };
  window.navigator.clipboard = { writeText: async () => {} };
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  window.Blob = globalThis.Blob;

  if (!window.HTMLElement.prototype.scrollTo) {
    window.HTMLElement.prototype.scrollTo = function scrollTo() {};
  }

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
  assert.equal(empty.hidden, false);
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
  assert.ok(empty);
  assert.equal(empty.hidden, true);
});

test("locks the app shell so the conversation pane scrolls independently", () => {
  assert.match(styles, /html,\s*body\s*{[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /#app\s*{[^}]*height:\s*100dvh;/s);
  assert.match(styles, /#sidebar\s*{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*height:\s*100dvh;/s);
  assert.match(styles, /#mainArea\s*{[^}]*min-height:\s*0;/s);
  assert.match(styles, /#history\s*{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
});

test("uses dark control theming for selects instead of bright default surfaces", () => {
  assert.match(styles, /:root\s*{[^}]*color-scheme:\s*dark;/s);
  assert.match(styles, /body\.light\s*{[^}]*color-scheme:\s*light;/s);
  assert.match(styles, /select,\s*\.sort-select|\.sort-select,\s*select/s);
  assert.match(styles, /select\s*option\s*{[^}]*background:/s);
});
