<script lang="ts">
  import { fly } from 'svelte/transition';

  let open = $state(false);
  let messages = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
  let input = $state('');
  let loading = $state(false);
  let inputEl = $state<HTMLTextAreaElement | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    messages = [...messages, { role: 'user', content: text }];
    input = '';
    loading = true;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        messages = [...messages, { role: 'assistant', content: `Error: ${err || res.statusText}` }];
      } else {
        const data = await res.json();
        messages = [...messages, { role: 'assistant', content: data.reply }];
      }
    } catch (e: any) {
      messages = [
        ...messages,
        { role: 'assistant', content: `Connection error: ${e.message}. Make sure ANTHROPIC_API_KEY is set.` },
      ];
    }

    loading = false;
    setTimeout(() => {
      const body = document.querySelector('.ai-messages');
      if (body) body.scrollTop = body.scrollHeight;
    }, 0);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    messages = [];
  }
</script>

<!-- Floating button -->
<button
  class="ai-fab"
  class:open
  onclick={() => {
    open = !open;
    if (open) setTimeout(() => inputEl?.focus(), 100);
  }}
  title="AI Assistant"
>
  {#if open}✕{:else}AI{/if}
</button>

<!-- Chat panel -->
{#if open}
  <div class="ai-panel" transition:fly={{ y: 20, duration: 200 }}>
    <div class="ai-header">
      <span class="ai-title">AI Assistant</span>
      <button class="ai-clear" onclick={clearChat} title="Clear chat">Clear</button>
    </div>

    <div class="ai-messages">
      {#if messages.length === 0}
        <div class="ai-empty">
          <p>Ask me anything about the Home Server codebase.</p>
          <p class="ai-hint">I can explain code, suggest features, or help debug.</p>
        </div>
      {/if}
      {#each messages as msg}
        <div class="ai-msg ai-{msg.role}">
          <span class="ai-role">{msg.role === 'user' ? 'You' : 'Claude'}</span>
          <div class="ai-content">{msg.content}</div>
        </div>
      {/each}
      {#if loading}
        <div class="ai-msg ai-assistant">
          <span class="ai-role">Claude</span>
          <div class="ai-content ai-thinking">Thinking...</div>
        </div>
      {/if}
    </div>

    <div class="ai-input-area">
      <textarea
        class="ai-input"
        bind:value={input}
        bind:this={inputEl}
        onkeydown={handleKeydown}
        placeholder="Ask about the codebase..."
        rows="2"
      ></textarea>
      <button class="ai-send" onclick={send} disabled={loading || !input.trim()}>
        {loading ? '...' : '→'}
      </button>
    </div>
  </div>
{/if}

<style>
  .ai-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 9998;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ai-fab:hover {
    border-color: var(--accent);
    transform: scale(1.08);
  }

  .ai-fab.open {
    background: var(--danger);
    color: white;
    border-color: var(--danger);
  }

  .ai-panel {
    position: fixed;
    bottom: 84px;
    right: 24px;
    width: 380px;
    max-height: 520px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-secondary);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 9998;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ai-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }

  .ai-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ai-clear {
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }

  .ai-clear:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  .ai-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 200px;
    max-height: 360px;
  }

  .ai-empty {
    text-align: center;
    padding: 24px 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .ai-hint {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-top: 4px;
  }

  .ai-msg {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ai-role {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-faint);
  }

  .ai-user .ai-role {
    color: var(--accent);
  }

  .ai-content {
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ai-assistant .ai-content {
    background: var(--bg-inset);
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
  }

  .ai-thinking {
    color: var(--text-muted);
    font-style: italic;
    animation: pulse 1s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      opacity: 0.5;
    }
    to {
      opacity: 1;
    }
  }

  .ai-input-area {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--border);
    align-items: flex-end;
  }

  .ai-input {
    flex: 1;
    padding: 6px 10px;
    font-size: 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
    resize: none;
    line-height: 1.4;
  }

  .ai-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .ai-send {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: white;
    font-size: 1rem;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .ai-send:hover:not(:disabled) {
    filter: brightness(1.15);
  }

  .ai-send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  @media (max-width: 640px) {
    .ai-panel {
      right: 10px;
      left: 10px;
      width: auto;
      bottom: 74px;
    }

    .ai-fab {
      bottom: 16px;
      right: 16px;
    }
  }
</style>
