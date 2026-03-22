<script lang="ts">
  let {
    data = [],
    color = 'var(--accent)',
    height = 40,
    width = 120,
    label = '',
    unit = '',
    maxValue,
    showAxis = false,
    showTooltip = true,
    class: className = '',
  }: {
    data: number[];
    color?: string;
    height?: number;
    width?: number;
    label?: string;
    unit?: string;
    maxValue?: number;
    showAxis?: boolean;
    showTooltip?: boolean;
    class?: string;
  } = $props();

  let hoveredIndex = $state(-1);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  const max = $derived(maxValue ?? Math.max(...data, 1));
  const points = $derived.by(() => {
    if (data.length === 0) return '';
    const stepX = width / Math.max(data.length - 1, 1);
    return data.map((v, i) => `${i * stepX},${height - (v / max) * height}`).join(' ');
  });
  const areaPoints = $derived.by(() => {
    if (data.length === 0) return '';
    const stepX = width / Math.max(data.length - 1, 1);
    const linePoints = data.map((v, i) => `${i * stepX},${height - (v / max) * height}`).join(' ');
    return `0,${height} ${linePoints} ${(data.length - 1) * stepX},${height}`;
  });

  function formatValue(v: number): string {
    if (unit === '%') return `${Math.round(v)}%`;
    if (unit === 'ms') return `${Math.round(v)}ms`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(1);
  }

  function handleMouseMove(e: MouseEvent) {
    const svg = (e.currentTarget as SVGElement).getBoundingClientRect();
    const relX = e.clientX - svg.left;
    const stepX = width / Math.max(data.length - 1, 1);
    const idx = Math.round(relX / stepX);
    hoveredIndex = Math.max(0, Math.min(idx, data.length - 1));
    tooltipX = idx * stepX;
    tooltipY = height - (data[hoveredIndex] / max) * height;
  }

  function handleMouseLeave() {
    hoveredIndex = -1;
  }
</script>

<div class="mini-chart {className}">
  {#if label}
    <div class="mini-chart-header">
      <span class="mini-chart-label">{label}</span>
      {#if data.length > 0}
        <span class="mini-chart-current">{formatValue(data[data.length - 1])}{unit ? '' : ''}</span>
      {/if}
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="none"
    class="mini-chart-svg"
    style="height: {height}px;"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
    {#if showAxis}
      <line x1="0" y1={height} x2={width} y2={height} stroke="var(--border)" stroke-width="0.5" />
      <line
        x1="0"
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="var(--border)"
        stroke-width="0.3"
        stroke-dasharray="3,3"
      />
      <line x1="0" y1="0" x2={width} y2="0" stroke="var(--border)" stroke-width="0.3" stroke-dasharray="3,3" />
    {/if}

    {#if data.length > 1}
      <polygon points={areaPoints} fill={color} opacity="0.1" />
      <polyline {points} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    {/if}

    {#if showTooltip && hoveredIndex >= 0}
      <circle cx={tooltipX} cy={tooltipY} r="3" fill={color} />
      <line x1={tooltipX} y1="0" x2={tooltipX} y2={height} stroke={color} stroke-width="0.5" opacity="0.4" />
    {/if}
  </svg>

  {#if showTooltip && hoveredIndex >= 0}
    <div class="mini-chart-tooltip" style="left: {tooltipX}px;">
      {formatValue(data[hoveredIndex])}{unit}
    </div>
  {/if}

  {#if showAxis}
    <div class="mini-chart-axis-labels">
      <span>{formatValue(max)}</span>
      <span>0</span>
    </div>
  {/if}
</div>

<style>
  .mini-chart {
    position: relative;
  }

  .mini-chart-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .mini-chart-label {
    font-size: 0.68rem;
    color: var(--text-faint);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .mini-chart-current {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }

  .mini-chart-svg {
    width: 100%;
    cursor: crosshair;
  }

  .mini-chart-tooltip {
    position: absolute;
    bottom: 100%;
    transform: translateX(-50%);
    font-size: 0.65rem;
    font-family: 'JetBrains Mono', monospace;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
  }

  .mini-chart-axis-labels {
    position: absolute;
    right: -4px;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 0.55rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    pointer-events: none;
    padding: 0 0 0 4px;
  }
</style>
