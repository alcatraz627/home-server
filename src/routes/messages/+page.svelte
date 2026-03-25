<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { toast } from '$lib/toast';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Loading from '$lib/components/Loading.svelte';

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
      if (!data.available) {
        unavailableReason = data.reason || '';
      }
      conversations = data.conversations || [];
    } catch (e: any) {
      toast.error(e.message || 'Failed to load conversations', { key: 'msg-conv' });
    }
    convLoading = false;
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
        // Scroll to bottom after render
        setTimeout(() => {
          if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 50);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load messages', { key: 'msg-thread' });
    }
    msgLoading = false;
  }

  async function send() {
    if (!selectedHandle || !sendText.trim() || sending) return;
    sending = true;
    const text = sendText.trim();
    sendText = '';
    try {
      const res = await fetchApi('/api/messages/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: selectedHandle, text }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || 'Failed to send');
        sendText = text; // restore
      } else {
        // Optimistic: reload messages after short delay
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
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diff = now.getTime() - ms;
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function initials(conv: Conversation): string {
    const name = conv.displayName || conv.identifier;
    return name
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

{#if available === false}
  <!-- Platform placeholder or no access -->
  <div class="placeholder-wrap">
    <EmptyState
      icon="message-square"
      title={unavailableReason ? 'Messages unavailable' : 'macOS only'}
      hint={unavailableReason || 'iMessage is only available when running on a Mac. This server is running on Linux.'}
    />
  </div>
{:else}
  <div class="messages-app" class:loading={available === null}>
    <!-- Conversation sidebar -->
    <aside class="conv-sidebar">
      <div class="conv-header">
        <h2 class="page-title">Messages</h2>
        <Button size="sm" onclick={loadConversations} loading={convLoading}>Refresh</Button>
      </div>
      <div class="conv-search">
        <SearchInput bind:value={convSearch} placeholder="Search..." size="sm" />
      </div>

      <div class="conv-list">
        {#if convLoading && !conversations.length}
          <Loading />
        {:else if filteredConvs.length === 0}
          <p class="conv-empty">No conversations found.</p>
        {:else}
          {#each filteredConvs as conv}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="conv-item"
              class:active={selectedHandle === conv.identifier}
              onclick={() => selectConversation(conv)}
            >
              <div class="conv-avatar">{initials(conv)}</div>
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
        {/if}
      </div>
    </aside>

    <!-- Message thread -->
    <main class="thread-panel">
      {#if !selectedConv}
        <div class="thread-empty">
          <Icon name="message-square" size={32} />
          <p>Select a conversation</p>
        </div>
      {:else}
        <div class="thread-header">
          <div class="conv-avatar sm">{initials(selectedConv)}</div>
          <div>
            <div class="thread-name">{selectedConv.displayName || selectedConv.identifier}</div>
            {#if selectedConv.displayName}
              <div class="thread-handle">{selectedConv.identifier}</div>
            {/if}
          </div>
          <Button size="xs" onclick={() => loadMessages()} loading={msgLoading} class="ml-auto">Refresh</Button>
        </div>

        <div class="messages-scroll" bind:this={messagesEl}>
          {#if msgLoading && !messages.length}
            <Loading />
          {:else if messages.length === 0}
            <p class="no-messages">No messages yet.</p>
          {:else}
            <!-- Load more -->
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

            <!-- Messages rendered oldest-first (DB returns newest-first, so reverse) -->
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
                      <a class="att-file" href="/api/messages/attachment?id={att.rowid}" target="_blank" rel="noopener">
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
          {/if}
        </div>

        <!-- Input -->
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
          <Button variant="accent" size="sm" onclick={send} disabled={!sendText.trim()} loading={sending}>Send</Button>
        </div>
      {/if}
    </main>
  </div>
{/if}

<style>
  .placeholder-wrap {
    max-width: 480px;
    margin: 60px auto;
  }

  .messages-app {
    display: flex;
    height: calc(100vh - var(--header-height, 56px) - 32px);
    min-height: 400px;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .messages-app.loading {
    opacity: 0.6;
    pointer-events: none;
  }

  /* Conversation sidebar */
  .conv-sidebar {
    width: 280px;
    min-width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
  }

  .conv-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 8px;
  }

  .conv-search {
    padding: 0 10px 8px;
  }

  .conv-list {
    flex: 1;
    overflow-y: auto;
  }

  .conv-empty {
    font-size: 0.78rem;
    color: var(--text-faint);
    text-align: center;
    padding: 24px;
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

  /* Thread panel */
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
    gap: 10px;
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

  .no-messages {
    text-align: center;
    color: var(--text-faint);
    font-size: 0.78rem;
    margin: auto;
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
    position: relative;
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

  /* Input bar */
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

  /* Narrow: sidebar becomes top strip */
  @media (max-width: 640px) {
    .messages-app {
      flex-direction: column;
      height: auto;
      min-height: 90vh;
    }

    .conv-sidebar {
      width: 100%;
      max-height: 220px;
    }
  }
</style>
