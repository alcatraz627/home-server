<script lang="ts">
  let {
    variant = 'default',
    size = 'sm',
    dot = false,
    pulse = false,
    pill = true,
    children,
  } = $props<{
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'default' | 'accent' | 'purple';
    size?: 'sm' | 'md';
    dot?: boolean;
    pulse?: boolean;
    pill?: boolean;
    children?: any;
  }>();
</script>

<span class="hs-badge hs-badge-{variant} hs-badge-{size}" class:pill class:has-dot={dot}>
  {#if dot}
    <span class="hs-badge-dot" class:pulse></span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</span>

<style>
  .hs-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    vertical-align: middle;
  }

  .pill {
    border-radius: 10px;
  }
  .hs-badge:not(.pill) {
    border-radius: 4px;
  }

  .hs-badge-sm {
    padding: 1px 8px;
    font-size: 0.65rem;
  }
  .hs-badge-md {
    padding: 3px 10px;
    font-size: 0.75rem;
  }

  .hs-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .hs-badge-dot.pulse {
    animation: badgePulse 2s ease-in-out infinite;
  }

  @keyframes badgePulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  /* Variants */
  .hs-badge-success {
    background: var(--success-bg);
    color: var(--success);
  }
  .hs-badge-success .hs-badge-dot {
    background: var(--success);
  }

  .hs-badge-danger {
    background: var(--danger-bg);
    color: var(--danger);
  }
  .hs-badge-danger .hs-badge-dot {
    background: var(--danger);
  }

  .hs-badge-warning {
    background: var(--warning-bg);
    color: var(--warning);
  }
  .hs-badge-warning .hs-badge-dot {
    background: var(--warning);
  }

  .hs-badge-info {
    background: var(--accent-bg);
    color: var(--accent);
  }
  .hs-badge-info .hs-badge-dot {
    background: var(--accent);
  }

  .hs-badge-default {
    background: var(--bg-hover);
    color: var(--text-muted);
  }
  .hs-badge-default .hs-badge-dot {
    background: var(--text-muted);
  }

  .hs-badge-accent {
    background: var(--accent-bg);
    color: var(--accent);
  }
  .hs-badge-accent .hs-badge-dot {
    background: var(--accent);
  }

  .hs-badge-purple {
    background: var(--purple-bg);
    color: var(--purple);
  }
  .hs-badge-purple .hs-badge-dot {
    background: var(--purple);
  }
</style>
