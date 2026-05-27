// js/ui/settings.js - Settings panel (persona, presets, TTS, world books, etc.)
import { el, $, $$, emit } from '../utils/dom.js';
import { showModal } from './modal.js';
import { toast } from './toast.js';
import { getPresets, savePreset, deletePreset, getWorldBooks, saveWorldBook, deleteWorldBook } from '../utils/storage.js';
import { clearChat, exportChat, getMessages } from './chat.js';

let presets = [];
let worldBooks = [];
let activePreset = null;
let activeWorldBook = null;

const LS_MODEL = 'ul_model';
const LS_USE_BUILTIN = 'ul_use_builtin';
const LS_CUSTOM_PROMPT = 'ul_custom_prompt';

export async function initSettings() {
  presets = await getPresets();
  worldBooks = await getWorldBooks();
}

export function showSettingsModal() {
  const useBuiltin = (localStorage.getItem(LS_USE_BUILTIN) ?? '1') === '1';
  const customPrompt = localStorage.getItem(LS_CUSTOM_PROMPT) || '';
  const savedModel = localStorage.getItem(LS_MODEL) || '';

  const body = el('div', { className: 'settings-body' });

  // ---- Model Section ----
  body.appendChild(el('h4', { textContent: '模型设置' }));
  const modelSection = el('div', { className: 'settings-section' });

  const models = window.APP_MODELS || [];
  const modelSel = el('select', { id: 'settingsModelSel' },
    models.map(m => el('option', { value: m.id, textContent: m.label }))
  );
  if (savedModel) modelSel.value = savedModel;
  modelSel.addEventListener('change', () => {
    localStorage.setItem(LS_MODEL, modelSel.value);
    emit('model:changed', { model: modelSel.value });
  });

  modelSection.appendChild(el('label', { textContent: '模型:' }));
  modelSection.appendChild(modelSel);
  body.appendChild(modelSection);

  // ---- Persona Section ----
  body.appendChild(el('h4', { textContent: '角色设定' }));
  const personaSection = el('div', { className: 'settings-section' });

  const personaToggle = el('label', { className: 'toggle-label' }, [
    el('input', {
      type: 'checkbox',
      id: 'settingsPersonaToggle',
      checked: useBuiltin,
      onchange: (e) => {
        localStorage.setItem(LS_USE_BUILTIN, e.target.checked ? '1' : '0');
        emit('persona:changed', { useBuiltin: e.target.checked, customPrompt: $('#settingsCustomPrompt')?.value || '' });
      }
    }),
    el('span', { textContent: ' 使用内置角色 (😈)' }),
  ]);
  personaSection.appendChild(personaToggle);
  personaSection.appendChild(el('br'));

  personaSection.appendChild(el('label', { textContent: '自定义 System Prompt (仅😇时生效):' }));
  const customPromptEl = el('textarea', {
    id: 'settingsCustomPrompt',
    placeholder: '输入自定义 system prompt...',
    textContent: customPrompt,
    className: 'settings-textarea',
  });
  personaSection.appendChild(customPromptEl);

  personaSection.appendChild(el('div', { className: 'btn-row' }, [
    el('button', {
      className: 'btn btn-primary',
      textContent: '保存自定义 Prompt',
      onclick: () => {
        const val = customPromptEl.value;
        localStorage.setItem(LS_CUSTOM_PROMPT, val);
        emit('persona:changed', { useBuiltin: !$('#settingsPersonaToggle')?.checked, customPrompt: val });
        toast('已保存', 'success');
      }
    }),
  ]));

  body.appendChild(personaSection);

  // ---- Presets Section ----
  body.appendChild(el('h4', { textContent: '参数预设' }));
  const presetSection = el('div', { className: 'settings-section' });

  if (presets.length === 0) {
    presetSection.appendChild(el('p', { textContent: '暂无预设。创建预设来保存 temperature、top_p 等参数配置。', style: { color: '#7f7f7f' } }));
  }

  const presetList = el('div', { className: 'preset-list' });
  for (const preset of presets) {
    presetList.appendChild(renderPresetItem(preset));
  }
  presetSection.appendChild(presetList);

  // New preset button
  presetSection.appendChild(el('button', {
    className: 'btn btn-secondary',
    textContent: '+ 新建预设',
    onclick: () => showPresetEditor(null),
  }));

  body.appendChild(presetSection);

  // ---- World Books Section ----
  body.appendChild(el('h4', { textContent: '世界书 (World Books)' }));
  const wbSection = el('div', { className: 'settings-section' });

  if (worldBooks.length === 0) {
    wbSection.appendChild(el('p', { textContent: '暂无世界书。世界书可在对话中按关键词触发插入背景设定。', style: { color: '#7f7f7f' } }));
  }

  const wbList = el('div', { className: 'preset-list' });
  for (const wb of worldBooks) {
    wbList.appendChild(renderWorldBookItem(wb));
  }
  wbSection.appendChild(wbList);

  wbSection.appendChild(el('button', {
    className: 'btn btn-secondary',
    textContent: '+ 新建世界书',
    onclick: () => showWorldBookEditor(null),
  }));

  body.appendChild(wbSection);

  // ---- Danger Zone ----
  body.appendChild(el('h4', { textContent: '数据管理', style: { color: '#e74c3c' } }));
  const dangerSection = el('div', { className: 'settings-section' }, [
    el('button', { className: 'btn btn-danger', textContent: '清除所有对话', onclick: () => { clearChat(); toast('对话已清除', 'info'); } }),
    el('button', { className: 'btn btn-primary', textContent: '导出当前对话', onclick: exportChat, style: { marginLeft: '10px' } }),
  ]);
  body.appendChild(dangerSection);

  showModal({
    title: '设置',
    body,
    width: '640px',
    className: 'settings-modal',
  });
}

// ---- Preset ----

function renderPresetItem(preset) {
  return el('div', { className: 'preset-item' }, [
    el('span', { textContent: preset.name || 'Untitled' }),
    el('div', { className: 'btn-row' }, [
      el('button', { className: 'btn btn-small', textContent: '使用', onclick: () => {
        activePreset = preset;
        emit('preset:changed', { preset });
        toast(`已应用预设: ${preset.name}`, 'success');
      }}),
      el('button', { className: 'btn btn-small', textContent: '编辑', onclick: () => showPresetEditor(preset) }),
      el('button', { className: 'btn btn-small btn-danger', textContent: '删除', onclick: async () => {
        await deletePreset(preset.id);
        presets = presets.filter(p => p.id !== preset.id);
        toast('预设已删除', 'info');
      }}),
    ]),
  ]);
}

function showPresetEditor(preset) {
  const isNew = !preset;
  const p = preset || { name: '', temperature: 0.7, top_p: 0.9, max_tokens: 4096, frequency_penalty: 0, presence_penalty: 0 };

  const body = el('div', { className: 'preset-editor' }, [
    el('label', { textContent: '名称:' }),
    el('input', { id: 'presetName', value: p.name || '', className: 'settings-input' }),
    el('label', { textContent: 'Temperature:' }),
    el('input', { id: 'presetTemp', type: 'number', value: String(p.temperature ?? 0.7), step: '0.1', min: '0', max: '2', className: 'settings-input' }),
    el('label', { textContent: 'Top P:' }),
    el('input', { id: 'presetTopP', type: 'number', value: String(p.top_p ?? 0.9), step: '0.05', min: '0', max: '1', className: 'settings-input' }),
    el('label', { textContent: 'Max Tokens:' }),
    el('input', { id: 'presetMaxTokens', type: 'number', value: String(p.max_tokens ?? 4096), step: '256', min: '1', max: '32768', className: 'settings-input' }),
    el('label', { textContent: 'Frequency Penalty:' }),
    el('input', { id: 'presetFreqPen', type: 'number', value: String(p.frequency_penalty ?? 0), step: '0.1', min: '-2', max: '2', className: 'settings-input' }),
    el('label', { textContent: 'Presence Penalty:' }),
    el('input', { id: 'presetPresPen', type: 'number', value: String(p.presence_penalty ?? 0), step: '0.1', min: '-2', max: '2', className: 'settings-input' }),
  ]);

  const footer = el('div', { className: 'btn-row', style: { justifyContent: 'flex-end', gap: '10px' } }, [
    el('button', { className: 'btn btn-primary', textContent: '保存', onclick: async () => {
      const newPreset = {
        id: isNew ? undefined : p.id,
        name: $('#presetName')?.value || 'Untitled',
        temperature: parseFloat($('#presetTemp')?.value || '0.7'),
        top_p: parseFloat($('#presetTopP')?.value || '0.9'),
        max_tokens: parseInt($('#presetMaxTokens')?.value || '4096'),
        frequency_penalty: parseFloat($('#presetFreqPen')?.value || '0'),
        presence_penalty: parseFloat($('#presetPresPen')?.value || '0'),
      };
      await savePreset(newPreset);
      presets = await getPresets();
      toast('预设已保存', 'success');
    }}),
  ]);

  showModal({
    title: isNew ? '新建预设' : '编辑预设',
    body,
    footer,
    width: '480px',
  });
}

// ---- World Book ----

function renderWorldBookItem(wb) {
  return el('div', { className: 'preset-item' }, [
    el('span', { textContent: wb.name || 'Untitled World Book' }),
    el('div', { className: 'btn-row' }, [
      el('button', { className: 'btn btn-small', textContent: '启用', onclick: () => {
        activeWorldBook = wb;
        const context = buildWorldBookContext(wb);
        emit('worldbook:changed', { context, worldBook: wb });
        toast(`已启用世界书: ${wb.name}`, 'success');
      }}),
      el('button', { className: 'btn btn-small', textContent: '编辑', onclick: () => showWorldBookEditor(wb) }),
      el('button', { className: 'btn btn-small btn-danger', textContent: '删除', onclick: async () => {
        await deleteWorldBook(wb.id);
        worldBooks = worldBooks.filter(w => w.id !== wb.id);
        if (activeWorldBook?.id === wb.id) {
          activeWorldBook = null;
          emit('worldbook:changed', { context: '', worldBook: null });
        }
        toast('世界书已删除', 'info');
      }}),
    ]),
  ]);
}

function showWorldBookEditor(wb) {
  const isNew = !wb;
  const entries = wb?.entries || [{ key: '', content: '', secondaryKeys: '' }];

  const entriesContainer = el('div', { className: 'wb-entries' });

  function renderEntries() {
    entriesContainer.innerHTML = '';
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryEl = el('div', { className: 'wb-entry' }, [
        el('label', { textContent: `条目 ${i + 1} - 触发词 (逗号分隔):` }),
        el('input', {
          value: entry.key || '',
          className: 'settings-input',
          oninput: (e) => { entry.key = e.target.value; },
        }),
        el('label', { textContent: '次要触发词:' }),
        el('input', {
          value: entry.secondaryKeys || '',
          className: 'settings-input',
          oninput: (e) => { entry.secondaryKeys = e.target.value; },
        }),
        el('label', { textContent: '内容:' }),
        el('textarea', {
          value: entry.content || '',
          className: 'settings-textarea',
          style: 'min-height:80px;',
          oninput: (e) => { entry.content = e.target.value; },
        }),
        el('button', {
          className: 'btn btn-small btn-danger',
          textContent: '删除条目',
          onclick: () => {
            entries.splice(i, 1);
            renderEntries();
          }
        }),
      ]);
      entriesContainer.appendChild(entryEl);
    }
  }
  renderEntries();

  const titleInput = el('input', {
    id: 'wbName',
    value: wb?.name || '',
    className: 'settings-input',
    placeholder: '世界书名称',
  });

  const body = el('div', { className: 'worldbook-editor' }, [
    el('label', { textContent: '名称:' }),
    titleInput,
    el('br'),
    entriesContainer,
    el('button', {
      className: 'btn btn-secondary',
      textContent: '+ 添加条目',
      style: 'margin-top:10px;',
      onclick: () => {
        entries.push({ key: '', content: '', secondaryKeys: '' });
        renderEntries();
      }
    }),
  ]);

  const footer = el('div', { className: 'btn-row', style: { justifyContent: 'flex-end', gap: '10px' } }, [
    el('button', { className: 'btn btn-primary', textContent: '保存', onclick: async () => {
      const newWb = {
        id: isNew ? undefined : wb.id,
        name: titleInput.value || 'Untitled',
        entries,
        createdAt: Date.now(),
      };
      await saveWorldBook(newWb);
      worldBooks = await getWorldBooks();
      toast('世界书已保存', 'success');
    }}),
  ]);

  showModal({
    title: isNew ? '新建世界书' : '编辑世界书',
    body,
    footer,
    width: '580px',
  });
}

function buildWorldBookContext(wb) {
  if (!wb || !wb.entries) return '';
  // Return formatted context for injection into system prompt
  const entries = wb.entries.filter(e => e.key && e.content);
  if (entries.length === 0) return '';
  return entries.map(e =>
    `[${e.key}]: ${e.content}`
  ).join('\n');
}
