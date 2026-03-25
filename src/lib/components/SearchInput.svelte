<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    value = $bindable(''),
    inputEl = $bindable<HTMLInputElement | undefined>(),
    placeholder = 'Search...',
    debounce = 0,
    icon = true,
    clearable = true,
    size = 'md',
    class: className = '',
    oninput,
  } = $props<{
    value: string;
    inputEl?: HTMLInputElement;
    placeholder?: string;
    debounce?: number;
    icon?: boolean;
    clearable?: boolean;
    size?: 'sm' | 'md';
    class?: string;
    oninput?: (value: string) => void;
  }>();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    value = v;
    if (oninput) {
      if (debounce > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => oninput(v), debounce);
      } else {
        oninput(v);
      }
    }
  }

  function clear() {
    value = '';
    oninput?.('');
  }
</script>

<div class="hs-search hs-search-{size} {className}">
  {#if icon}
    <span class="hs-search-icon"><Icon name="search" size={size === 'sm' ? 12 : 14} /></span>
  {/if}
  <input bind:this={inputEl} type="text" class="hs-search-input" {placeholder} {value} oninput={handleInput} />
  {#if clearable && value}
    <button class="hs-search-clear" onclick={clear} type="button">
      <Icon name="close" size={12} />
    </button>
  {/if}
</div>

<style>
  .hs-search {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius, 6px);
    background: var(--input-bg);
    padding: 0 10px;
    transition: border-color 0.15s;
  }

  .hs-search:focus-within {
    border-color: var(--accent);
  }

  .hs-search-sm {
    padding: 0 8px;
  }
  .hs-search-sm .hs-search-input {
    font-size: 0.72rem;
    padding: 4px 0;
  }

  .hs-search-md .hs-search-input {
    font-size: 0.82rem;
    padding: 6px 0;
  }

  .hs-search-icon {
    color: var(--text-faint);
    display: flex;
    flex-shrink: 0;
  }

  .hs-search-input {
    flex: 1;
    border: none;
    background: none;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    min-width: 0;
  }

  .hs-search-input::placeholder {
    color: var(--text-faint);
  }

  .hs-search-clear {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    padding: 2px;
    display: flex;
    border-radius: 3px;
  }

  .hs-search-clear:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
</style>
