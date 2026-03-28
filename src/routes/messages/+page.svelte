<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchApi, postJson } from '$lib/api';
  import { toast } from '$lib/toast';
  import { getErrorMessage } from '$lib/errors';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  interface Conversation {
    chatId: number;
    identifier: string;
    displayName: string | null;
    service: string;
    lastMessage: string | null;
    lastDateMs: number;
    lastIsFromMe: boolean;
    participantCount: number;
  }

  interface MessageAttachment {
    rowid: number;
    guid: string;
    filename: string | null;
    mimeType: string | null;
    transferName: string | null;
    totalBytes: number;
  }

  interface Message {
    rowid: number;
    guid: string;
    text: string | null;
    dateMs: number;
    isFromMe: boolean;
    isDelivered: boolean;
    isRead: boolean;
    isSent: boolean;
    senderHandle: string | null;
    attachments: MessageAttachment[];
  }

  interface KnownContact {
    handle: string;
    displayName: string | null;
    lastDateMs: number;
  }

  // Availability
  let available = $state<boolean | null>(null);
  let unavailableReason = $state('');

  // Conversations
  let conversations = $state<Conversation[]>([]);
  let convLoading = $state(true);
  let convSearch = $state('');
  let selectedHandle = $state<string | null>(null);
  let selectedConv = $state<Conversation | null>(null);

  // Messages
  let messages = $state<Message[]>([]);
  let msgLoading = $state(false);
  let sendText = $state('');
  let sending = $state(false);
  let messagesEl = $state<HTMLElement | undefined>();

  // New chat compose
  let composing = $state(false);
  let composeHandle = $state('');
  let contacts = $state<KnownContact[]>([]);
  let composeInputEl = $state<HTMLInputElement | undefined>();

  const filteredConvs = $derived(
    conversations.filter((c) => {
      if (!convSearch) return true;
      const q = convSearch.toLowerCase();
      return (
        (c.displayName || '').toLowerCase().includes(q) ||
        c.identifier.toLowerCase().includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q)
      );
    }),
  );

  const filteredContacts = $derived(
    contacts.filter((c) => {
      if (!composeHandle) return true;
      const q = composeHandle.toLowerCase();
      return (c.displayName || '').toLowerCase().includes(q) || c.handle.toLowerCase().includes(q);
    }),
  );

  const FDA_REASON = 'fda_required';

  onMount(async () => {
    await loadConversations();
  });

  async function loadConversations() {
    convLoading = true;
    try {
      const res = await fetchApi('/api/messages');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      available = data.available;
      unavailableReason = data.reason || '';
      conversations = data.conversations || [];
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load conversations'), { key: 'msg-conv' });
    }
    convLoading = false;
  }

  async function loadContacts() {
    try {
      const res = await fetchApi('/api/messages/contacts');
      if (!res.ok) return;
      const data = await res.json();
      contacts = data.contacts || [];
    } catch {}
  }

  async function openCompose() {
    composing = true;
    composeHandle = '';
    if (!contacts.length) await loadContacts();
    setTimeout(() => composeInputEl?.focus(), 50);
  }

  function closeCompose() {
    composing = false;
    composeHandle = '';
  }

  function startThread(handle: string) {
    const existing = conversations.find((c) => c.identifier === handle);
    if (existing) {
      selectConversation(existing);
    } else {
      // New thread — no existing conversation object
      selectedHandle = handle;
      selectedConv = {
        chatId: -1,
        identifier: handle,
        displayName: contacts.find((c) => c.handle === handle)?.displayName || null,
        service: 'iMessage',
        lastMessage: null,
        lastDateMs: 0,
        lastIsFromMe: false,
        participantCount: 1,
      };
      messages = [];
      msgLoading = false;
    }
    closeCompose();
  }

  async function selectConversation(conv: Conversation) {
    selectedHandle = conv.identifier;
    selectedConv = conv;
    messages = [];
    msgLoading = true;
    await loadMessages();
  }

  async function loadMessages(before?: number) {
    if (!selectedHandle) return;
    msgLoading = true;
    try {
      const params = new URLSearchParams({ handle: selectedHandle, limit: '100' });
      if (before) params.set('before', String(before));
      const res = await fetchApi(`/api/messages/thread?${params}`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      const incoming: Message[] = data.messages || [];
      if (before) {
        messages = [...messages, ...incoming];
      } else {
        messages = incoming;
        setTimeout(() => {
          if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 50);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load messages'), { key: 'msg-thread' });
    }
    msgLoading = false;
  }

  async function send() {
    if (!selectedHandle || !sendText.trim() || sending) return;
    sending = true;
    const text = sendText.trim();
    sendText = '';
    try {
      const res = await postJson('/api/messages/thread', { handle: selectedHandle, text });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || 'Failed to send');
        sendText = text;
      } else {
        setTimeout(() => loadMessages(), 800);
      }
    } catch {
      toast.error('Failed to send message');
      sendText = text;
    }
    sending = false;
  }

  function formatTime(ms: number): string {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (now.getTime() - ms < 7 * 24 * 60 * 60 * 1000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function initials(name: string | null, handle: string): string {
    return (name || handle)
      .split(/[\s@+]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  function attachmentIsImage(att: MessageAttachment): boolean {
    return (att.mimeType || '').startsWith('image/');
  }

  function attachmentName(att: MessageAttachment): string {
    return att.transferName || att.filename?.split('/').pop() || 'Attachment';
  }
</script>

<svelte:head>
  <title>Messages | Home Server</title>
</svelte:head>

{#if available === false && unavailableReason !== FDA_REASON}
  <!-- Fully unavailable: Linux or sqlite3 missing -->
  <div class="placeholder-wrap">
    <EmptyState
      icon="message-square"
      title={unavailableReason === 'linux' ? 'macOS only' : 'Messages unavailable'}
      hint={unavailableReason === 'linux'
        ? 'iMessage is only available when running on a Mac.'
        : 'chat.db or sqlite3 not found on this system.'}
    />
  </div>
{:else}
  <div class="messages-app" class:app-loading={available === null}>
    <!-- FDA banner (shown inside the app so the layout stays usable) -->
    {#if available === false && unavailableReason === FDA_REASON}
      <div class="fda-banner">
        <Icon name="lock" size={16} />
        <div class="fda-text">
          <strong>Full Disk Access required</strong>
          <span
            >Open <em>System Settings → Privacy & Security → Full Disk Access</em> and enable access for the terminal or process
            running this server, then restart it.</span
          >
        </div>
        <Button size="xs" onclick={loadConversations} loading={convLoading}>Retry</Button>
      </div>
    {/if}

    <!-- Sidebar + thread in a flex row -->
    <div class="app-body">
      <!-- Conversation sidebar -->
      <aside class="conv-sidebar">
        <div class="conv-header">
          <h2 class="sidebar-title">Messages</h2>
          <div class="conv-header-actions">
            <button class="icon-btn" onclick={openCompose} title="New message">
              <Icon name="edit" size={16} />
            </button>
            <button class="icon-btn" onclick={loadConversations} title="Refresh">
              <Icon name="rotate-ccw" size={15} />
            </button>
          </div>
        </div>

        <div class="conv-search">
          <SearchInput bind:value={convSearch} placeholder="Search…" size="sm" />
        </div>

        <div class="conv-list">
          <AsyncState
            loading={convLoading && !conversations.length}
            empty={filteredConvs.length === 0 && available !== false}
            emptyTitle="No conversations found"
            emptyIcon="message-square"
          >
            {#each filteredConvs as conv}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="conv-item"
                class:active={selectedHandle === conv.identifier}
                onclick={() => selectConversation(conv)}
              >
                <div class="conv-avatar">
                  {initials(conv.displayName, conv.identifier)}
                </div>
                <div class="conv-info">
                  <div class="conv-name-row">
                    <span class="conv-name">{conv.displayName || conv.identifier}</span>
                    <span class="conv-time">{formatTime(conv.lastDateMs)}</span>
                  </div>
                  <div class="conv-preview">
                    {#if conv.lastIsFromMe}<span class="conv-me">You: </span>{/if}{conv.lastMessage || '(attachment)'}
                  </div>
                </div>
              </div>
            {/each}
          </AsyncState>
        </div>
      </aside>

      <!-- Message thread -->
      <main class="thread-panel">
        {#if !selectedConv}
          <div class="thread-empty">
            <Icon name="message-square" size={32} />
            <p>Select a conversation or start a new one</p>
            <Button size="sm" onclick={openCompose}>New Message</Button>
          </div>
        {:else}
          <div class="thread-header">
            <div class="conv-avatar sm">
              {initials(selectedConv.displayName, selectedConv.identifier)}
            </div>
            <div>
              <div class="thread-name">{selectedConv.displayName || selectedConv.identifier}</div>
              {#if selectedConv.displayName}
                <div class="thread-handle">{selectedConv.identifier}</div>
              {/if}
            </div>
            <Button size="xs" onclick={() => loadMessages()} loading={msgLoading} class="ml-auto">Refresh</Button>
          </div>

          <div class="messages-scroll" bind:this={messagesEl}>
            <AsyncState
              loading={msgLoading && !messages.length}
              empty={messages.length === 0}
              emptyTitle="No messages yet. Say hi!"
              emptyIcon="message-square"
            >
              {#if messages.length >= 100}
                <div class="load-more-row">
                  <Button
                    size="xs"
                    onclick={() => loadMessages(messages[messages.length - 1].rowid)}
                    loading={msgLoading}
                  >
                    Load earlier
                  </Button>
                </div>
              {/if}

              {#each [...messages].reverse() as msg}
                <div class="msg-row" class:from-me={msg.isFromMe}>
                  <div class="bubble" class:me={msg.isFromMe} class:them={!msg.isFromMe}>
                    {#if msg.text}
                      <p class="msg-text">{msg.text}</p>
                    {/if}

                    {#each msg.attachments as att}
                      {#if attachmentIsImage(att)}
                        <img
                          class="att-image"
                          src="/api/messages/attachment?id={att.rowid}"
                          alt={attachmentName(att)}
                          loading="lazy"
                        />
                      {:else}
                        <a
                          class="att-file"
                          href="/api/messages/attachment?id={att.rowid}"
                          target="_blank"
                          rel="noopener"
                        >
                          <Icon name="file-text" size={14} />
                          <span>{attachmentName(att)}</span>
                        </a>
                      {/if}
                    {/each}

                    <span class="msg-time">{formatTime(msg.dateMs)}</span>
                    {#if msg.isFromMe}
                      <span class="msg-status">
                        {msg.isRead ? 'Read' : msg.isDelivered ? 'Delivered' : msg.isSent ? 'Sent' : ''}
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
            </AsyncState>
          </div>

          <div class="input-bar">
            <input
              class="msg-input"
              type="text"
              placeholder="iMessage"
              bind:value={sendText}
              onkeydown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <Button variant="accent" size="sm" onclick={send} disabled={!sendText.trim()} loading={sending}>Send</Button
            >
          </div>
        {/if}
      </main>
    </div>
    <!-- /.app-body -->
  </div>

  <!-- New Message compose modal -->
  {#if composing}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="compose-backdrop" onclick={closeCompose}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="compose-modal" onclick={(e) => e.stopPropagation()}>
        <div class="compose-header">
          <span class="compose-title">New Message</span>
          <button class="icon-btn" onclick={closeCompose}><Icon name="x" size={16} /></button>
        </div>

        <div class="compose-to">
          <span class="compose-to-label">To:</span>
          <input
            class="compose-input"
            type="text"
            placeholder="Phone number or email…"
            bind:value={composeHandle}
            bind:this={composeInputEl}
            onkeydown={(e) => {
              if (e.key === 'Enter' && composeHandle.trim()) startThread(composeHandle.trim());
              if (e.key === 'Escape') closeCompose();
            }}
          />
          {#if composeHandle.trim()}
            <Button size="xs" onclick={() => startThread(composeHandle.trim())}>Open</Button>
          {/if}
        </div>

        <div class="compose-contacts">
          {#if filteredContacts.length === 0 && composeHandle}
            <p class="compose-hint">Press Enter to start a new thread with "{composeHandle}"</p>
          {:else}
            {#each filteredContacts.slice(0, 40) as contact}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="compose-contact" onclick={() => startThread(contact.handle)}>
                <div class="conv-avatar sm">{initials(contact.displayName, contact.handle)}</div>
                <div class="compose-contact-info">
                  {#if contact.displayName}
                    <span class="compose-contact-name">{contact.displayName}</span>
                    <span class="compose-contact-handle">{contact.handle}</span>
                  {:else}
                    <span class="compose-contact-name">{contact.handle}</span>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .placeholder-wrap {
    max-width: 480px;
    margin: 60px auto;
  }

  /* ── FDA banner ─────────────────────────────────────────── */
  .fda-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--warning, #f59e0b) 12%, var(--bg-primary));
    border-bottom: 1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent);
    font-size: 0.78rem;
    color: var(--text-primary);
  }

  .fda-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .fda-text em {
    font-style: normal;
    font-weight: 600;
  }

  /* ── App shell ──────────────────────────────────────────── */
  .messages-app {
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--header-height, 56px) - 32px);
    min-height: 400px;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .messages-app.app-loading {
    opacity: 0.6;
    pointer-events: none;
  }

  /* Inner row: sidebar + thread panel side by side */
  .app-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* ── Conversation sidebar ───────────────────────────────── */
  .conv-sidebar {
    width: 280px;
    min-width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    overflow: hidden;
  }

  .conv-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 6px;
  }

  .sidebar-title {
    font-size: 0.88rem;
    font-weight: 700;
    margin: 0;
  }

  .conv-header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s;
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .conv-search {
    padding: 0 10px 8px;
  }

  .conv-list {
    flex: 1;
    overflow-y: auto;
  }

  .conv-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid var(--border);
  }

  .conv-item:hover {
    background: var(--bg-hover);
  }

  .conv-item.active {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-secondary));
    border-left: 3px solid var(--accent);
  }

  .conv-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .conv-avatar.sm {
    width: 30px;
    height: 30px;
    font-size: 0.62rem;
  }

  .conv-info {
    flex: 1;
    min-width: 0;
  }

  .conv-name-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }

  .conv-name {
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conv-time {
    font-size: 0.62rem;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .conv-preview {
    font-size: 0.72rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .conv-me {
    color: var(--text-faint);
  }

  /* ── Thread panel ───────────────────────────────────────── */
  .thread-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .thread-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .thread-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .thread-name {
    font-size: 0.88rem;
    font-weight: 600;
  }

  .thread-handle {
    font-size: 0.68rem;
    color: var(--text-faint);
  }

  .messages-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .load-more-row {
    display: flex;
    justify-content: center;
    padding-bottom: 12px;
  }

  .msg-row {
    display: flex;
  }

  .msg-row.from-me {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 70%;
    padding: 8px 12px;
    border-radius: 14px;
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .bubble.me {
    background: var(--accent);
    color: white;
    border-bottom-right-radius: 4px;
  }

  .bubble.them {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }

  .msg-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .att-image {
    display: block;
    max-width: 240px;
    max-height: 200px;
    border-radius: 8px;
    margin-top: 4px;
    object-fit: cover;
  }

  .att-file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    margin-top: 4px;
    text-decoration: none;
    color: inherit;
  }

  .att-file:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .msg-time {
    display: block;
    font-size: 0.6rem;
    opacity: 0.65;
    margin-top: 4px;
    text-align: right;
  }

  .msg-status {
    display: block;
    font-size: 0.58rem;
    opacity: 0.6;
    text-align: right;
  }

  .input-bar {
    display: flex;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .msg-input {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 8px 14px;
    font-size: 0.84rem;
    background: var(--input-bg, var(--bg-primary));
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  .msg-input:focus {
    border-color: var(--accent);
  }

  /* ── Compose modal ──────────────────────────────────────── */
  .compose-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 80px;
    z-index: 200;
  }

  .compose-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 400px;
    max-width: 92vw;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .compose-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--border);
  }

  .compose-title {
    font-size: 0.88rem;
    font-weight: 700;
  }

  .compose-to {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }

  .compose-to-label {
    font-size: 0.78rem;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .compose-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.88rem;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
  }

  .compose-contacts {
    flex: 1;
    overflow-y: auto;
  }

  .compose-hint {
    font-size: 0.75rem;
    color: var(--text-faint);
    padding: 16px;
    text-align: center;
  }

  .compose-contact {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .compose-contact:hover {
    background: var(--bg-hover);
  }

  .compose-contact-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .compose-contact-name {
    font-size: 0.82rem;
    font-weight: 600;
  }

  .compose-contact-handle {
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  /* ── Responsive: sidebar becomes top strip on narrow ── */
  @media (max-width: 640px) {
    .messages-app {
      height: auto;
      min-height: 90vh;
    }

    .conv-sidebar {
      width: 100%;
      max-height: 220px;
    }
  }
</style>
