<script lang="ts">
  import { page } from '$app/stores';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
</script>

<div class="error-page">
  <div class="error-card">
    <div class="error-icon">
      <Icon name="alert-triangle" size={48} />
    </div>
    <h1>{$page.status}</h1>
    <p class="error-message">{$page.error?.message || 'Something went wrong'}</p>
    <div class="error-actions">
      <Button onclick={() => window.location.reload()}>Reload Page</Button>
      <Button variant="accent" onclick={() => (window.location.href = '/')}>Go Home</Button>
    </div>
  </div>
</div>

<style>
  .error-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 40px 20px;
  }

  .error-card {
    text-align: center;
    max-width: 400px;
  }

  .error-icon {
    color: var(--danger);
    margin-bottom: 16px;
  }

  h1 {
    font-size: 3rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px;
    font-family: 'JetBrains Mono', monospace;
  }

  .error-message {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin: 0 0 24px;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
</style>
