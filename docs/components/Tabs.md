# Tabs Component

## Problem

13 pages implement tab bars with inline HTML + per-page CSS. The structure is always the same (`<div class="tabs"><button class:active>`) but each page re-styles it. No animation, no keyboard navigation, no ARIA.

## Spec

### File

`src/lib/components/Tabs.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `{ id: string; label: string; count?: number }[]` | required | Tab definitions |
| `active` | `string` (bindable) | first tab id | Currently active tab id |
| `size` | `'sm' \| 'md'` | `'md'` | Tab size |
| `class` | `string` | `''` | Additional CSS |

### Features

- Active tab indicator (bottom border or background highlight)
- Keyboard: arrow left/right to switch tabs
- ARIA: `role="tablist"`, `role="tab"`, `aria-selected`
- Optional count badge: `Tab Name (3)`
- Smooth underline transition on tab change
- Scrollable on overflow (mobile)

### Usage

```svelte
<script>
  let activeTab = $state('wifi');
</script>

<Tabs
  tabs={[
    { id: 'wifi', label: 'WiFi', count: wifi.length },
    { id: 'bluetooth', label: 'Bluetooth', count: bluetooth.length },
    { id: 'usb', label: 'USB', count: usb.length },
  ]}
  bind:active={activeTab}
/>

{#if activeTab === 'wifi'}
  <!-- wifi content -->
{/if}
```

### Migration

Pages to update: peripherals, network, terminal, processes, benchmarks, qr, speedtest, docs, AiChat, MediaPlayer (13 total)
