<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
  import InfraServices from './InfraServices.svelte';
  import InfraDocker from './InfraDocker.svelte';
  import InfraDatabases from './InfraDatabases.svelte';
  import InfraBenchmarks from './InfraBenchmarks.svelte';

  type TabId = 'services' | 'docker' | 'databases' | 'benchmarks';
  const tabs: { id: TabId; label: string }[] = [
    { id: 'services', label: 'Services' },
    { id: 'docker', label: 'Docker' },
    { id: 'databases', label: 'Databases' },
    { id: 'benchmarks', label: 'Benchmarks' },
  ];
  let activeTab = $state<TabId>('services');
</script>

<svelte:head>
  <title>Infrastructure | Home Server</title>
</svelte:head>

<div class="page">
  <PageHeader title="Infrastructure" description="Service health, containers, databases, and system benchmarks." />
  <Tabs {tabs} bind:active={activeTab} syncHash />

  <ErrorBoundary title="This tab encountered an error" compact>
    {#if activeTab === 'services'}
      <InfraServices />
    {:else if activeTab === 'docker'}
      <InfraDocker />
    {:else if activeTab === 'databases'}
      <InfraDatabases />
    {:else if activeTab === 'benchmarks'}
      <InfraBenchmarks />
    {/if}
  </ErrorBoundary>
</div>
