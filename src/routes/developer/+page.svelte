<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
  import DevShortcuts from './DevShortcuts.svelte';
  import DevInternals from './DevInternals.svelte';
  import DevDocs from './DevDocs.svelte';
  import DevShowcase from './DevShowcase.svelte';

  type TabId = 'shortcuts' | 'internals' | 'docs' | 'showcase';

  const tabs: { id: TabId; label: string }[] = [
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'internals', label: 'Internals' },
    { id: 'docs', label: 'Docs' },
    { id: 'showcase', label: 'Showcase' },
  ];

  let activeTab = $state<TabId>('shortcuts');
</script>

<svelte:head>
  <title>Developer | Home Server</title>
</svelte:head>

<div class="page">
  <PageHeader
    title="Developer"
    description="Keyboard shortcuts, app internals, documentation, and design system showcase."
  />

  <Tabs {tabs} bind:active={activeTab} syncHash />

  <ErrorBoundary title="This tab encountered an error" compact>
    {#if activeTab === 'shortcuts'}
      <DevShortcuts />
    {:else if activeTab === 'internals'}
      <DevInternals />
    {:else if activeTab === 'docs'}
      <DevDocs />
    {:else if activeTab === 'showcase'}
      <DevShowcase />
    {/if}
  </ErrorBoundary>
</div>
