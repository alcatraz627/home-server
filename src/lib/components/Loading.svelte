<script lang="ts">
  let {
    variant = 'skeleton',
    count = 3,
    height = '52px',
    columns = 1,
    text = '',
    class: className = '',
  } = $props<{
    variant?: 'skeleton' | 'spinner' | 'dots';
    count?: number;
    height?: string;
    columns?: number;
    text?: string;
    class?: string;
  }>();
</script>

{#if variant === 'skeleton'}
  <div class="hs-loading-skeleton {className}" style="grid-template-columns: repeat({columns}, 1fr);">
    {#each Array(count) as _, i}
      <div class="skeleton-card card-stagger" style="height: {height}; animation-delay: {i * 60}ms;"></div>
    {/each}
  </div>
{:else if variant === 'spinner'}
  <div class="hs-loading-center {className}">
    <div class="hs-spinner"></div>
    {#if text}
      <span class="hs-loading-text">{text}</span>
    {/if}
  </div>
{:else if variant === 'dots'}
  <div class="hs-loading-center {className}">
    <div class="hs-dots">
      <span class="hs-dot"></span>
      <span class="hs-dot"></span>
      <span class="hs-dot"></span>
    </div>
    {#if text}
      <span class="hs-loading-text">{text}</span>
    {/if}
  </div>
{/if}

<style>
  .hs-loading-skeleton {
    display: grid;
    gap: 8px;
  }

  .hs-loading-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
  }

  .hs-loading-text {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  /* Spinner */
  .hs-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: hspin 0.7s linear infinite;
  }

  @keyframes hspin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Dots */
  .hs-dots {
    display: flex;
    gap: 5px;
  }

  .hs-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: hbounce 1.4s ease-in-out infinite;
  }

  .hs-dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .hs-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes hbounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    40% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }
</style>
