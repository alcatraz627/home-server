<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import MiniChart from './MiniChart.svelte';

  let {
    label,
    value,
    unit = '',
    icon = '',
    color = '',
    detail = '',
    bar,
    barColor = '',
    sparkline,
    sparklineColor = 'var(--accent)',
    trend,
    size = 'md',
    children,
  }: {
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    color?: string;
    detail?: string;
    bar?: number;
    barColor?: string;
    sparkline?: number[];
    sparklineColor?: string;
    trend?: 'up' | 'down' | 'flat';
    size?: 'sm' | 'md' | 'lg';
    children?: Snippet;
  } = $props();
</script>

<div class="stat-card stat-card-{size}" style={color ? `--stat-color: ${color}` : ''}>
  <div class="stat-header">
    {#if icon}
      <Icon name={icon} size={size === 'sm' ? 12 : 14} />
    {/if}
    <span class="stat-label">{label}</span>
    {#if trend}
      <span class="stat-trend stat-trend-{trend}">
        {#if trend === 'up'}↑{:else if trend === 'down'}↓{:else}→{/if}
      </span>
    {/if}
  </div>

  <div class="stat-value-row">
    <span class="stat-value" style={color ? `color: ${color}` : ''}>{value}</span>
    {#if unit}
      <span class="stat-unit">{unit}</span>
    {/if}
  </div>

  {#if bar !== undefined}
    <ProgressBar value={bar} color={barColor || color} height="4px" />
  {/if}

  {#if sparkline && sparkline.length > 1}
    <MiniChart data={sparkline} color={sparklineColor || color || 'var(--accent)'} height={28} />
  {/if}

  {#if detail}
    <div class="stat-detail">{detail}</div>
  {/if}

  {#if children}
    <div class="stat-extra">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
  }

  .stat-card-sm {
    padding: 6px 10px;
  }

  .stat-card-lg {
    padding: 14px 16px;
    gap: 6px;
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--text-faint);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stat-value-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .stat-value {
    font-size: 1.2rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: var(--stat-color, var(--text-primary));
    line-height: 1;
  }

  .stat-card-sm .stat-value {
    font-size: 0.95rem;
  }

  .stat-card-lg .stat-value {
    font-size: 1.6rem;
  }

  .stat-unit {
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .stat-trend {
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 600;
  }

  .stat-trend-up {
    color: var(--success);
  }

  .stat-trend-down {
    color: var(--danger);
  }

  .stat-trend-flat {
    color: var(--text-muted);
  }

  .stat-detail {
    font-size: 0.68rem;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .stat-extra {
    margin-top: 2px;
  }
</style>
