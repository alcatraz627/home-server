<script lang="ts">
  import { fly } from 'svelte/transition';
  import { browser } from '$app/environment';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
  }

  interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
  }

  let open = $state(false);
  let fullscreen = $state(false);
  let input = $state('');
  let loading = $state(false);
  let inputEl = $state<HTMLTextAreaElement | null>(null);
  let showHistory = $state(false);

  // Conversation management
  let conversations = $state<Conversation[]>(loadConversations());
  let activeConvoId = $state<string | null>(null);

  let activeConvo = $derived(conversations.find((c) => c.id === activeConvoId) ?? null);
  let messages = $derived(activeConvo?.messages ?? []);

  function loadConversations(): Conversation[] {
    if (!browser) return [];
    try {
      return JSON.parse(localStorage.getItem('hs:ai-convos') || '[]');
    } catch {
      return [];
    }
  }

  function saveConversations() {
    if (browser) localStorage.setItem('hs:ai-convos', JSON.stringify(conversations));
  }

  function newConversation() {
    const now = new Date();
    const id = `chat-${Date.now()}`;
    const title = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const convo: Conversation = { id, title, messages: [], createdAt: now.toISOString() };
    conversations = [convo, ...conversations];
    activeConvoId = id;
    showHistory = false;
    saveConversations();
  }

  function switchConvo(id: string) {
    activeConvoId = id;
    showHistory = false;
    setTimeout(() => scrollToBottom(), 50);
  }

  function deleteConvo(id: string) {
    conversations = conversations.filter((c) => c.id !== id);
    if (activeConvoId === id) {
      activeConvoId = conversations[0]?.id ?? null;
    }
    saveConversations();
  }

  // Rename conversation
  let renamingId = $state<string | null>(null);
  let renameInput = $state('');

  function startRename(id: string) {
    renamingId = id;
    renameInput = conversations.find((c) => c.id === id)?.title ?? '';
  }

  function finishRename() {
    if (renamingId && renameInput.trim()) {
      const convo = conversations.find((c) => c.id === renamingId);
      if (convo) {
        convo.title = renameInput.trim();
        conversations = [...conversations];
        saveConversations();
      }
    }
    renamingId = null;
  }

  // Copy message
  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function scrollToBottom() {
    const el = fullscreen ? document.querySelector('.ai-fs-messages') : document.querySelector('.ai-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Ensure we have at least one conversation
  if (conversations.length === 0) {
    newConversation();
  } else {
    activeConvoId = conversations[0].id;
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // Handle /clear command
    if (text === '/clear') {
      if (activeConvo) {
        activeConvo.messages = [];
        conversations = [...conversations];
        saveConversations();
      }
      input = '';
      return;
    }

    if (!activeConvo) newConversation();

    activeConvo!.messages = [...activeConvo!.messages, { role: 'user', content: text }];
    conversations = [...conversations];
    saveConversations();
    input = '';
    loading = true;
    setTimeout(scrollToBottom, 0);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: activeConvo!.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      activeConvo!.messages = [...activeConvo!.messages, { role: 'assistant', content: data.reply }];
    } catch (e: any) {
      activeConvo!.messages = [...activeConvo!.messages, { role: 'assistant', content: `Error: ${e.message}` }];
    }

    conversations = [...conversations];
    saveConversations();
    loading = false;
    setTimeout(scrollToBottom, 0);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<!-- Floating button -->
<button
  class="ai-fab"
  class:open
  onclick={() => {
    if (fullscreen) {
      fullscreen = false;
      open = false;
    } else {
      open = !open;
    }
    if (open) setTimeout(() => inputEl?.focus(), 100);
  }}
  title="AI Assistant"
>
  {#if open || fullscreen}<span class="fab-icon">✕</span>{:else}<span class="fab-icon fab-gradient">AI</span>{/if}
</button>

<!-- Fullscreen modal -->
{#if fullscreen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ai-fs-overlay" onclick={() => (fullscreen = false)}>
    <div class="ai-fs-modal" onclick={(e) => e.stopPropagation()} transition:fly={{ y: 30, duration: 250 }}>
      <div class="ai-fs-sidebar">
        <div class="ai-fs-sidebar-header">
          <span>Conversations</span>
          <button class="ai-btn-sm" onclick={newConversation}>+ New</button>
        </div>
        <div class="ai-fs-convo-list">
          {#each conversations as convo}
            <button
              class="ai-fs-convo-item"
              class:active={activeConvoId === convo.id}
              onclick={() => switchConvo(convo.id)}
              ondblclick={() => startRename(convo.id)}
            >
              {#if renamingId === convo.id}
                <input
                  class="ai-rename-input"
                  type="text"
                  bind:value={renameInput}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') finishRename();
                    if (e.key === 'Escape') renamingId = null;
                  }}
                  onblur={finishRename}
                  onclick={(e) => e.stopPropagation()}
                />
              {:else}
                <span class="ai-fs-convo-title">{convo.title}</span>
                <span class="ai-fs-convo-count">{convo.messages.length} msgs</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="ai-fs-main">
        <div class="ai-fs-header">
          <span class="ai-title">{activeConvo?.title ?? 'AI Chat'}</span>
          <div class="ai-header-actions">
            <button
              class="ai-btn-sm"
              onclick={() => {
                if (activeConvo) {
                  activeConvo.messages = [];
                  conversations = [...conversations];
                  saveConversations();
                }
              }}>Clear</button
            >
            <button class="ai-btn-sm" onclick={() => (fullscreen = false)}>Minimize</button>
          </div>
        </div>

        <div class="ai-fs-messages">
          {#if messages.length === 0}
            <div class="ai-empty">
              <p>Ask me anything about the Home Server codebase.</p>
              <p class="ai-hint">
                I have access to project files and can explain code, suggest features, or help debug.
              </p>
              <p class="ai-hint">Type <code>/clear</code> to clear the conversation.</p>
            </div>
          {/if}
          {#each messages as msg}
            <div class="ai-msg ai-{msg.role}">
              <div class="ai-msg-header">
                <span class="ai-role">{msg.role === 'user' ? 'You' : 'Claude'}</span>
                <button class="ai-copy-btn" onclick={() => copyMessage(msg.content)} title="Copy">&#x2398;</button>
              </div>
              <div class="ai-content">{msg.content}</div>
            </div>
          {/each}
          {#if loading}
            <div class="ai-msg ai-assistant">
              <span class="ai-role">Claude</span>
              <div class="ai-content ai-thinking">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          {/if}
        </div>

        <div class="ai-input-area">
          <textarea
            class="ai-input"
            bind:value={input}
            bind:this={inputEl}
            onkeydown={handleKeydown}
            placeholder="Ask about the codebase... (/clear to reset)"
            rows="2"
          ></textarea>
          <button class="ai-send" onclick={send} disabled={loading || !input.trim()}>
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Floating panel (non-fullscreen) -->
{#if open && !fullscreen}
  <div class="ai-panel" transition:fly={{ y: 20, duration: 200 }}>
    <div class="ai-header">
      <div class="ai-header-left">
        <button class="ai-tab-btn" class:active={!showHistory} onclick={() => (showHistory = false)}>Chat</button>
        <button class="ai-tab-btn" class:active={showHistory} onclick={() => (showHistory = true)}
          >History ({conversations.length})</button
        >
      </div>
      <div class="ai-header-actions">
        <button
          class="ai-btn-sm"
          onclick={() => {
            fullscreen = true;
            open = false;
          }}
          title="Fullscreen">⛶</button
        >
      </div>
    </div>

    {#if showHistory}
      <div class="ai-history">
        <button class="ai-history-new" onclick={newConversation}>+ New Conversation</button>
        {#each conversations as convo}
          <div class="ai-history-item" class:active={activeConvoId === convo.id}>
            {#if renamingId === convo.id}
              <input
                class="ai-rename-input"
                type="text"
                bind:value={renameInput}
                onkeydown={(e) => {
                  if (e.key === 'Enter') finishRename();
                  if (e.key === 'Escape') renamingId = null;
                }}
                onblur={finishRename}
              />
            {:else}
              <button
                class="ai-history-btn"
                onclick={() => switchConvo(convo.id)}
                ondblclick={() => startRename(convo.id)}
              >
                <span class="ai-history-title">{convo.title}</span>
                <span class="ai-history-meta">{convo.messages.length} messages</span>
              </button>
            {/if}
            <button class="ai-history-delete" onclick={() => deleteConvo(convo.id)} title="Delete">✕</button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="ai-messages">
        {#if messages.length === 0}
          <div class="ai-empty">
            <p>Ask me about the codebase.</p>
            <p class="ai-hint">Type <code>/clear</code> to reset.</p>
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
    {/if}
  </div>
{/if}

<style>
  /* ── FAB ───────────────────────────────────────────────── */
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

  .fab-gradient {
    background: linear-gradient(135deg, var(--purple), var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: fabShimmer 3s ease-in-out infinite;
  }

  @keyframes fabShimmer {
    0%,
    100% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.3);
    }
  }

  .fab-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Floating Panel ────────────────────────────────────── */
  .ai-panel {
    position: fixed;
    bottom: 84px;
    right: 24px;
    width: 400px;
    max-height: 560px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-secondary);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 9998;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ────────────────────────────────────────────── */
  .ai-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    gap: 8px;
  }

  .ai-header-left {
    display: flex;
    gap: 2px;
  }
  .ai-header-actions {
    display: flex;
    gap: 4px;
  }

  .ai-tab-btn {
    padding: 4px 10px;
    font-size: 0.7rem;
    border-radius: 6px;
    border: 1px solid transparent;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .ai-tab-btn:hover {
    color: var(--text-primary);
  }
  .ai-tab-btn.active {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border);
  }

  .ai-btn-sm {
    font-size: 0.65rem;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }

  .ai-btn-sm:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .ai-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* ── History ───────────────────────────────────────────── */
  .ai-history {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 200px;
    max-height: 440px;
  }

  .ai-history-new {
    padding: 8px 12px;
    font-size: 0.75rem;
    border-radius: 6px;
    border: 1px dashed var(--border);
    background: none;
    color: var(--accent);
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 4px;
  }

  .ai-history-new:hover {
    background: var(--accent-bg);
  }

  .ai-history-item {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .ai-history-item.active {
    background: var(--bg-hover);
  }

  .ai-history-btn {
    flex: 1;
    text-align: left;
    padding: 8px 10px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: 6px;
    color: var(--text-primary);
  }

  .ai-history-btn:hover {
    background: var(--bg-hover);
  }

  .ai-history-title {
    font-size: 0.78rem;
  }
  .ai-history-meta {
    font-size: 0.6rem;
    color: var(--text-faint);
  }

  .ai-history-delete {
    padding: 4px 6px;
    border: none;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.7rem;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .ai-history-delete:hover {
    color: var(--danger);
    background: var(--danger-bg);
  }

  /* ── Messages ──────────────────────────────────────────── */
  .ai-messages,
  .ai-fs-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 200px;
  }

  .ai-messages {
    max-height: 400px;
  }

  .ai-empty {
    text-align: center;
    padding: 24px 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .ai-empty code {
    font-size: 0.75rem;
    background: var(--code-bg);
    padding: 1px 6px;
    border-radius: 3px;
  }
  .ai-hint {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-top: 4px;
  }

  .ai-msg {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ai-msg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .ai-copy-btn {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 0.7rem;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;
  }

  .ai-msg:hover .ai-copy-btn {
    opacity: 1;
  }

  .ai-copy-btn:hover {
    color: var(--accent);
    background: var(--bg-hover);
  }

  .ai-content {
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ai-user .ai-content {
    background: var(--accent-bg);
    padding: 8px 12px;
    border-radius: 12px 12px 2px 12px;
    border: 1px solid var(--border-subtle);
  }

  .ai-assistant .ai-content {
    background: var(--bg-inset);
    padding: 8px 12px;
    border-radius: 12px 12px 12px 2px;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .ai-thinking {
    color: var(--text-muted);
    display: flex;
    gap: 4px;
    padding: 10px 12px;
  }

  .typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: typingBounce 1.4s ease-in-out infinite;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typingBounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    40% {
      transform: translateY(-6px);
      opacity: 1;
    }
  }

  /* Rename input */
  .ai-rename-input {
    width: 100%;
    font-size: 0.78rem;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--accent);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  /* ── Input ─────────────────────────────────────────────── */
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

  /* ── Fullscreen Modal ──────────────────────────────────── */
  .ai-fs-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .ai-fs-modal {
    width: 100%;
    max-width: 900px;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 14px;
    display: flex;
    overflow: hidden;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
  }

  .ai-fs-sidebar {
    width: 220px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-inset);
  }

  .ai-fs-sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
  }

  .ai-fs-convo-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ai-fs-convo-item {
    text-align: left;
    padding: 8px 10px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: background 0.15s;
  }

  .ai-fs-convo-item:hover {
    background: var(--bg-hover);
  }
  .ai-fs-convo-item.active {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .ai-fs-convo-title {
    font-size: 0.78rem;
  }
  .ai-fs-convo-count {
    font-size: 0.6rem;
    color: var(--text-faint);
  }

  .ai-fs-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .ai-fs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .ai-fs-messages {
    max-height: none;
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
    .ai-fs-modal {
      flex-direction: column;
      height: 95vh;
    }
    .ai-fs-sidebar {
      width: 100%;
      height: 120px;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
    .ai-fs-convo-list {
      flex-direction: row;
      overflow-x: auto;
    }
    .ai-fs-convo-item {
      min-width: 140px;
    }
  }
</style>
