<script lang="ts">
  import { onMount } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
  import ToolClipboard from './ToolClipboard.svelte';
  import ToolQR from './ToolQR.svelte';
  import ToolSpeedtest from './ToolSpeedtest.svelte';
  import ToolScreenshots from './ToolScreenshots.svelte';
  import ToolWol from './ToolWol.svelte';
  import ToolPomodoro from './ToolPomodoro.svelte';

  type TabId = 'clipboard' | 'qr' | 'speedtest' | 'screenshots' | 'wol' | 'pomodoro';

  const tabs = [
    { id: 'clipboard', label: 'Clipboard' },
    { id: 'qr', label: 'QR Code' },
    { id: 'speedtest', label: 'Speed Test' },
    { id: 'screenshots', label: 'Screenshots' },
    { id: 'wol', label: 'Wake-on-LAN' },
    { id: 'pomodoro', label: 'Pomodoro' },
  ];

  let activeTab = $state<TabId>('clipboard');
</script>

<div class="page">
  <PageHeader
    title="Tools"
    description="Clipboard sync, QR code, speed test, screenshots, Wake-on-LAN, and Pomodoro timer."
  />

  <Tabs {tabs} bind:active={activeTab} syncHash />

  <ErrorBoundary title="This tab encountered an error" compact>
    {#if activeTab === 'clipboard'}
      <ToolClipboard />
    {:else if activeTab === 'qr'}
      <ToolQR />
    {:else if activeTab === 'speedtest'}
      <ToolSpeedtest />
    {:else if activeTab === 'screenshots'}
      <ToolScreenshots />
    {:else if activeTab === 'wol'}
      <ToolWol />
    {:else if activeTab === 'pomodoro'}
      <ToolPomodoro />
    {/if}
  </ErrorBoundary>
</div>

<style>
</style>
