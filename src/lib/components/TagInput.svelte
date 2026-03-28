<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import type { Tag } from '$lib/types/productivity';

  let { tags = $bindable([]), placeholder = 'Add tag...' } = $props<{
    tags: string[];
    placeholder?: string;
  }>();

  let inputValue = $state('');
  let suggestions = $state<Tag[]>([]);
  let showSuggestions = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  async function fetchSuggestions(query: string) {
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const all: Tag[] = await res.json();
        // Filter out already-selected tags
        suggestions = all.filter((t) => !tags.includes(t.name));
      }
    } catch {
      suggestions = [];
    }
  }

  function handleInput() {
    if (inputValue.trim()) {
      fetchSuggestions(inputValue.trim());
      showSuggestions = true;
    } else {
      suggestions = [];
      showSuggestions = false;
    }
  }

  function addTag(name: string) {
    const normalized = name.toLowerCase().trim();
    if (!normalized || tags.includes(normalized)) return;
    tags = [...tags, normalized];
    inputValue = '';
    suggestions = [];
    showSuggestions = false;
    inputEl?.focus();
  }

  function removeTag(name: string) {
    tags = tags.filter((t: string) => t !== name);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue.trim());
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
    if (e.key === 'Escape') {
      showSuggestions = false;
    }
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => (showSuggestions = false), 150);
  }

  function handleFocus() {
    if (inputValue.trim()) {
      fetchSuggestions(inputValue.trim());
      showSuggestions = true;
    } else {
      // Show popular tags on focus
      fetchSuggestions('');
      showSuggestions = true;
    }
  }
</script>

<div class="tag-input-wrapper">
  <div class="tag-input-row">
    {#each tags as tag}
      <span class="tag-chip">
        {tag}
        <button class="tag-chip-remove" onclick={() => removeTag(tag)}>
          <Icon name="close" size={9} />
        </button>
      </span>
    {/each}
    <input
      bind:this={inputEl}
      type="text"
      bind:value={inputValue}
      {placeholder}
      class="tag-text-input"
      oninput={handleInput}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      onfocus={handleFocus}
    />
  </div>
  {#if showSuggestions && suggestions.length > 0}
    <div class="tag-suggestions">
      {#each suggestions as suggestion}
        <button class="tag-suggestion" onclick={() => addTag(suggestion.name)}>
          {#if suggestion.color}
            <span class="tag-dot" style="background: {suggestion.color}"></span>
          {/if}
          {suggestion.name}
          <span class="tag-usage">{suggestion.usageCount}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tag-input-wrapper {
    position: relative;
  }

  .tag-input-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg, var(--bg-primary));
    min-height: 32px;
    align-items: center;
    cursor: text;
  }

  .tag-input-row:focus-within {
    border-color: var(--accent);
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--purple, #8b5cf6);
    background: color-mix(in srgb, var(--purple, #8b5cf6) 10%, transparent);
    white-space: nowrap;
  }

  .tag-chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    opacity: 0.6;
    transition: opacity 0.1s;
  }

  .tag-chip-remove:hover {
    opacity: 1;
  }

  .tag-text-input {
    flex: 1;
    min-width: 80px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.78rem;
    font-family: inherit;
    padding: 2px 0;
  }

  .tag-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    z-index: 20;
    box-shadow: var(--shadow);
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .tag-suggestion {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.78rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .tag-suggestion:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .tag-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-usage {
    margin-left: auto;
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }
</style>
