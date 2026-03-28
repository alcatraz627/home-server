<script lang="ts">
  import Button from './Button.svelte';
  import Tooltip from './Tooltip.svelte';

  interface Action {
    icon: string;
    label: string;
    onclick: () => void;
    variant?: 'default' | 'danger' | 'ghost';
    confirm?: boolean;
    disabled?: boolean;
    loading?: boolean;
    href?: string;
  }

  let {
    actions,
    size = 'xs',
  }: {
    actions: Action[];
    size?: 'xs' | 'sm';
  } = $props();
</script>

<div class="action-group">
  {#each actions as action}
    <Tooltip text={action.label}>
      {#if action.href}
        <a href={action.href} class="action-link" download>
          <Button variant={action.variant ?? 'ghost'} {size} icon={action.icon} iconOnly disabled={action.disabled} />
        </a>
      {:else}
        <Button
          variant={action.variant ?? 'ghost'}
          {size}
          icon={action.icon}
          iconOnly
          confirm={action.confirm}
          disabled={action.disabled}
          loading={action.loading}
          onclick={action.onclick}
        />
      {/if}
    </Tooltip>
  {/each}
</div>

<style>
  .action-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .action-link {
    display: inline-flex;
    text-decoration: none;
  }
</style>
