<script lang="ts">
  let {
    value = 0,
    max = 100,
    color = '',
    height = '6px',
    rounded = true,
    animated = false,
    label = '',
    showValue = false,
    colorThresholds,
  }: {
    value: number;
    max?: number;
    color?: string;
    height?: string;
    rounded?: boolean;
    animated?: boolean;
    label?: string;
    showValue?: boolean;
    colorThresholds?: { value: number; color: string }[];
  } = $props();

  const percent = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
  const barColor = $derived(getBarColor(percent));

  function getBarColor(pct: number): string {
    if (color) return color;
    if (!colorThresholds?.length) return 'var(--accent)';
    let matched = colorThresholds[0].color;
    for (const t of colorThresholds) {
      if (pct >= t.value) matched = t.color;
      else break;
    }
    return matched;
  }
</script>

{#if label || showValue}
  <div class="progress-meta">
    {#if label}<span class="progress-label">{label}</span>{/if}
    {#if showValue}<span class="progress-value">{Math.round(percent)}%</span>{/if}
  </div>
{/if}
<div
  class="progress-track"
  class:rounded
  style="height: {height}"
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
>
  <div class="progress-fill" class:animated style="width: {percent}%; background: {barColor}"></div>
</div>

<style>
  .progress-track {
    width: 100%;
    background: var(--bg-hover);
    overflow: hidden;
  }

  .progress-track.rounded {
    border-radius: 999px;
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    transition: width 0.3s ease;
  }

  .progress-fill.animated {
    animation: progress-pulse 1.5s ease-in-out infinite;
  }

  @keyframes progress-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }

  .progress-label {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .progress-value {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary);
    font-family: var(--font-mono, monospace);
  }
</style>
