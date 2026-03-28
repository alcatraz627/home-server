<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
  import DiagStatus from './DiagStatus.svelte';
  import DiagLogs from './DiagLogs.svelte';
  import DiagNotifications from './DiagNotifications.svelte';

  type TabId = 'status' | 'logs' | 'notifications';

  const tabs = [
    { id: 'status', label: 'Status' },
    { id: 'logs', label: 'Logs' },
    { id: 'notifications', label: 'Notifications' },
  ];

  let activeTab = $state<TabId>('status');
</script>

<div class="page">
  <PageHeader title="Diagnostics" description="Server health, application logs, and notifications." />

  <Tabs {tabs} bind:active={activeTab} syncHash />

  <ErrorBoundary title="This tab encountered an error" compact>
    {#if activeTab === 'status'}
      <DiagStatus />
    {:else if activeTab === 'logs'}
      <DiagLogs />
    {:else if activeTab === 'notifications'}
      <DiagNotifications />
    {/if}
  </ErrorBoundary>
</div>

<style>
</style>
