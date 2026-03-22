<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    title = '',
    animated = true,
    header,
    children,
  } = $props<{
    open?: boolean;
    title?: string;
    animated?: boolean;
    header?: any;
    children?: any;
  }>();
</script>

<div class="hs-collapsible">
  <button class="hs-collapsible-trigger" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="hs-collapsible-chevron" class:open>
      <Icon name="chevron-right" size={12} />
    </span>
    {#if header}
      {@render header()}
    {:else}
      <span class="hs-collapsible-title">{title}</span>
    {/if}
  </button>
  {#if open}
    <div class="hs-collapsible-body" class:animated>
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
</div>

<style>
  .hs-collapsible-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 0;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    text-align: left;
    transition: color 0.15s;
  }

  .hs-collapsible-trigger:hover {
    color: var(--text-primary);
  }

  .hs-collapsible-chevron {
    display: flex;
    transition: transform 0.2s ease;
    color: var(--text-faint);
  }

  .hs-collapsible-chevron.open {
    transform: rotate(90deg);
  }

  .hs-collapsible-title {
    font-weight: 500;
  }

  .hs-collapsible-body {
    padding-left: 18px;
  }

  .hs-collapsible-body.animated {
    animation: collapseIn 0.2s ease-out;
  }

  @keyframes collapseIn {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 1000px;
    }
  }
</style>
