<svelte:head>
  <title>Offline | Home Server</title>
</svelte:head>

<div class="offline-page">
  <div class="offline-icon">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  </div>
  <h1 class="offline-title">You're offline</h1>
  <p class="offline-hint">Can't connect to your Home Server. Check your network connection and try again.</p>
  <button class="offline-retry" onclick={() => window.location.reload()}> Retry </button>
</div>

<style>
  .offline-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 70vh;
    text-align: center;
    padding: 24px;
    gap: 12px;
  }

  .offline-icon {
    color: var(--text-faint);
    margin-bottom: 8px;
  }

  .offline-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .offline-hint {
    font-size: 0.88rem;
    color: var(--text-muted);
    max-width: 360px;
    line-height: 1.6;
  }

  .offline-retry {
    margin-top: 16px;
    padding: 8px 24px;
    font-size: 0.85rem;
    font-family: inherit;
    background: var(--accent);
    color: var(--bg-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: filter 0.15s;
  }

  .offline-retry:hover {
    filter: brightness(1.15);
  }
</style>
