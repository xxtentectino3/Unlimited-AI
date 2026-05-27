// js/api.js - API calls + SSE streaming
import { emit } from './utils/dom.js';

export const api = {
  /**
   * Send a chat message and stream the response.
   * @param {Object} params
   * @param {string} params.model
   * @param {boolean} params.useBuiltinPersona
   * @param {string} params.customSystemPrompt
   * @param {Array} params.messages - Full message history
   * @param {string} params.worldBookContext - Injected world book entries
   * @param {Object} params.preset - { temperature, top_p, max_tokens, etc }
   * @param {AbortSignal} [params.signal]
   * @param {function} onToken - Called with each token string
   * @param {function} onDone - Called with full response text and usage
   * @param {function} onError - Called with error
   */
  async chat({ model, useBuiltinPersona, customSystemPrompt, messages, worldBookContext, preset, signal, onToken, onDone, onError }) {
    const payload = {
      model,
      use_builtin_persona: useBuiltinPersona,
      custom_system_prompt: customSystemPrompt || '',
      world_book_context: worldBookContext || '',
      messages,
      temperature: preset?.temperature,
      top_p: preset?.top_p,
      max_tokens: preset?.max_tokens,
      frequency_penalty: preset?.frequency_penalty,
      presence_penalty: preset?.presence_penalty,
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        onError?.(`Request failed (${res.status}): ${t}`);
        emit('api:error', { status: res.status, message: t });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let usage = null;
      let startTime = performance.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.usage) usage = parsed.usage;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onToken?.(delta, fullText);
            }
          } catch {}
        }
      }

      const elapsed = (performance.now() - startTime) / 1000;
      onDone?.(fullText, { usage, elapsed });
      emit('api:done', { text: fullText, usage, elapsed });
      return fullText;
    } catch (err) {
      if (err.name === 'AbortError') {
        onDone?.(fullText || '', { aborted: true });
        emit('api:aborted', { text: fullText || '' });
        return fullText || '';
      }
      onError?.(err.message);
      emit('api:error', { message: err.message });
    }
  },

  /** Abort the current streaming request */
  abortController: null,

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  },

  createSignal() {
    this.abortController = new AbortController();
    return this.abortController.signal;
  }
};
