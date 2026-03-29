<script lang="ts">
  import { theme, THEMES, setTheme, type Theme } from '$lib/theme';
  import { browser } from '$app/environment';
  import Icon from '$lib/components/Icon.svelte';

  let { open = $bindable(false) } = $props<{ open: boolean }>();

  // ── Settings config ──────────────────────────────────────────────────────────
  const SETTINGS_KEY = 'hs:settings';

  interface FontOption {
    id: string;
    name: string;
    css: string;
  }
  interface FontGroup {
    label: string;
    fonts: FontOption[];
  }

  const BODY_FONT_GROUPS: FontGroup[] = [
    {
      label: 'Sans-Serif',
      fonts: [
        { id: 'inter', name: 'Inter', css: "'Inter', sans-serif" },
        { id: 'system', name: 'System UI', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
        { id: 'geist', name: 'Geist', css: "'Geist', 'Inter', sans-serif" },
        { id: 'dm-sans', name: 'DM Sans', css: "'DM Sans', sans-serif" },
        { id: 'ibm-plex', name: 'IBM Plex Sans', css: "'IBM Plex Sans', sans-serif" },
        { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif" },
        { id: 'nunito', name: 'Nunito', css: "'Nunito', sans-serif" },
        { id: 'rubik', name: 'Rubik', css: "'Rubik', sans-serif" },
        { id: 'outfit', name: 'Outfit', css: "'Outfit', sans-serif" },
        { id: 'poppins', name: 'Poppins', css: "'Poppins', sans-serif" },
        { id: 'source-sans-3', name: 'Source Sans 3', css: "'Source Sans 3', sans-serif" },
        { id: 'figtree', name: 'Figtree', css: "'Figtree', sans-serif" },
        { id: 'onest', name: 'Onest', css: "'Onest', sans-serif" },
        { id: 'open-sans', name: 'Open Sans', css: "'Open Sans', sans-serif" },
        { id: 'raleway', name: 'Raleway', css: "'Raleway', sans-serif" },
        { id: 'urbanist', name: 'Urbanist', css: "'Urbanist', sans-serif" },
        { id: 'lexend', name: 'Lexend', css: "'Lexend', sans-serif" },
        { id: 'red-hat-display', name: 'Red Hat Display', css: "'Red Hat Display', sans-serif" },
        { id: 'atkinson', name: 'Atkinson Hyperlegible', css: "'Atkinson Hyperlegible Next', sans-serif" },
      ],
    },
    {
      label: 'Serif',
      fonts: [
        { id: 'playfair', name: 'Playfair Display', css: "'Playfair Display', serif" },
        { id: 'merriweather', name: 'Merriweather', css: "'Merriweather', serif" },
        { id: 'lora', name: 'Lora', css: "'Lora', serif" },
        { id: 'eb-garamond', name: 'EB Garamond', css: "'EB Garamond', serif" },
      ],
    },
    {
      label: 'Monospace',
      fonts: [
        { id: 'mono', name: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
        { id: 'fira-code', name: 'Fira Code', css: "'Fira Code', monospace" },
        { id: 'ibm-plex-mono', name: 'IBM Plex Mono', css: "'IBM Plex Mono', monospace" },
        { id: 'source-code-pro', name: 'Source Code Pro', css: "'Source Code Pro', monospace" },
        { id: 'inconsolata', name: 'Inconsolata', css: "'Inconsolata', monospace" },
        { id: 'commit-mono', name: 'Commit Mono', css: "'Commit Mono', monospace" },
      ],
    },
    {
      label: 'Display',
      fonts: [
        { id: 'space-grotesk', name: 'Space Grotesk', css: "'Space Grotesk', sans-serif" },
        { id: 'syne', name: 'Syne', css: "'Syne', sans-serif" },
        { id: 'josefin-sans', name: 'Josefin Sans', css: "'Josefin Sans', sans-serif" },
        { id: 'bebas-neue', name: 'Bebas Neue', css: "'Bebas Neue', cursive" },
      ],
    },
  ];

  const HEADING_FONT_GROUPS: FontGroup[] = [
    {
      label: 'Display',
      fonts: [
        { id: 'space-grotesk', name: 'Space Grotesk', css: "'Space Grotesk', sans-serif" },
        { id: 'syne', name: 'Syne', css: "'Syne', sans-serif" },
        { id: 'josefin-sans', name: 'Josefin Sans', css: "'Josefin Sans', sans-serif" },
        { id: 'bebas-neue', name: 'Bebas Neue', css: "'Bebas Neue', cursive" },
        { id: 'raleway', name: 'Raleway', css: "'Raleway', sans-serif" },
        { id: 'urbanist', name: 'Urbanist', css: "'Urbanist', sans-serif" },
      ],
    },
    {
      label: 'Sans-Serif',
      fonts: [
        { id: 'inter', name: 'Inter', css: "'Inter', sans-serif" },
        { id: 'system', name: 'System UI', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
        { id: 'geist', name: 'Geist', css: "'Geist', 'Inter', sans-serif" },
        { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif" },
        { id: 'outfit', name: 'Outfit', css: "'Outfit', sans-serif" },
        { id: 'poppins', name: 'Poppins', css: "'Poppins', sans-serif" },
        { id: 'nunito', name: 'Nunito', css: "'Nunito', sans-serif" },
        { id: 'rubik', name: 'Rubik', css: "'Rubik', sans-serif" },
        { id: 'figtree', name: 'Figtree', css: "'Figtree', sans-serif" },
        { id: 'lexend', name: 'Lexend', css: "'Lexend', sans-serif" },
        { id: 'red-hat-display', name: 'Red Hat Display', css: "'Red Hat Display', sans-serif" },
        { id: 'atkinson', name: 'Atkinson Hyperlegible', css: "'Atkinson Hyperlegible Next', sans-serif" },
      ],
    },
    {
      label: 'Serif',
      fonts: [
        { id: 'playfair', name: 'Playfair Display', css: "'Playfair Display', serif" },
        { id: 'merriweather', name: 'Merriweather', css: "'Merriweather', serif" },
        { id: 'lora', name: 'Lora', css: "'Lora', serif" },
        { id: 'eb-garamond', name: 'EB Garamond', css: "'EB Garamond', serif" },
      ],
    },
    {
      label: 'Monospace',
      fonts: [
        { id: 'mono', name: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
        { id: 'fira-code', name: 'Fira Code', css: "'Fira Code', monospace" },
        { id: 'ibm-plex-mono', name: 'IBM Plex Mono', css: "'IBM Plex Mono', monospace" },
        { id: 'commit-mono', name: 'Commit Mono', css: "'Commit Mono', monospace" },
      ],
    },
  ];

  function getFontCss(id: string, groups: FontGroup[]): string {
    for (const g of groups) {
      const f = g.fonts.find((f) => f.id === id);
      if (f) return f.css;
    }
    return "'Inter', sans-serif";
  }

  function getFontName(id: string, groups: FontGroup[]): string {
    for (const g of groups) {
      const f = g.fonts.find((f) => f.id === id);
      if (f) return f.name;
    }
    return id;
  }

  const FONT_SIZES = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22] as const;

  interface SettingsConfig {
    fontSize: number;
    fontFamily: string;
    headerFont: string;
    borderRadius: 'sharp' | 'rounded' | 'pill';
    accentColor: string;
    highContrast: boolean;
    fontWeight: number;
    headingWeight: number;
    lineHeight: number;
    letterSpacing: number;
    customColors: Record<string, string>;
  }

  const DEFAULTS: SettingsConfig = {
    fontSize: 14,
    fontFamily: 'inter',
    headerFont: 'space-grotesk',
    borderRadius: 'rounded',
    accentColor: '',
    highContrast: false,
    fontWeight: 400,
    headingWeight: 600,
    lineHeight: 1.5,
    letterSpacing: 0,
    customColors: {},
  };

  // Dropdown open states
  let bodyFontDropdownOpen = $state(false);
  let headingFontDropdownOpen = $state(false);

  const COLOR_OVERRIDES = [
    { key: '--accent', label: 'Accent', group: 'Brand' },
    { key: '--success', label: 'Success', group: 'Brand' },
    { key: '--danger', label: 'Danger', group: 'Brand' },
    { key: '--warning', label: 'Warning', group: 'Brand' },
    { key: '--purple', label: 'Purple', group: 'Brand' },
    { key: '--cyan', label: 'Cyan', group: 'Brand' },
    { key: '--orange', label: 'Orange', group: 'Brand' },
    { key: '--text-primary', label: 'Text', group: 'Text' },
    { key: '--text-secondary', label: 'Text Secondary', group: 'Text' },
    { key: '--text-muted', label: 'Text Muted', group: 'Text' },
    { key: '--text-faint', label: 'Text Faint', group: 'Text' },
    { key: '--bg-primary', label: 'Background', group: 'Surface' },
    { key: '--bg-secondary', label: 'Surface', group: 'Surface' },
    { key: '--bg-inset', label: 'Inset', group: 'Surface' },
    { key: '--bg-hover', label: 'Hover', group: 'Surface' },
    { key: '--border', label: 'Border', group: 'Surface' },
    { key: '--border-subtle', label: 'Border Subtle', group: 'Surface' },
  ];

  function loadSettings(): SettingsConfig {
    if (!browser) return { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULTS };
  }

  let config = $state<SettingsConfig>(loadSettings());

  function save() {
    if (!browser) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    applySettings();
  }

  function applySettings() {
    if (!browser) return;
    const root = document.documentElement;

    // Font size
    root.style.fontSize = `${config.fontSize}px`;

    // Body font family — resolved from font groups
    root.style.setProperty('--font-body', getFontCss(config.fontFamily, BODY_FONT_GROUPS));

    // Header font
    root.style.setProperty('--font-heading', getFontCss(config.headerFont, HEADING_FONT_GROUPS));

    // Border radius scale
    const radiusMap: Record<string, string> = {
      sharp: '2px',
      rounded: '8px',
      pill: '20px',
    };
    root.style.setProperty('--radius', radiusMap[config.borderRadius] || '8px');

    // Custom accent color
    if (config.accentColor) {
      root.style.setProperty('--accent', config.accentColor);
      root.style.setProperty('--accent-bg', `${config.accentColor}14`);
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-bg');
    }

    // High contrast
    if (config.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Font weight
    root.style.setProperty('--font-weight', String(config.fontWeight));
    root.style.setProperty('--heading-weight', String(config.headingWeight));

    // Line height & letter spacing
    root.style.setProperty('--line-height', String(config.lineHeight));
    root.style.setProperty('--letter-spacing', `${config.letterSpacing}em`);

    // Custom color overrides
    for (const { key } of COLOR_OVERRIDES) {
      const val = config.customColors[key];
      if (val) {
        root.style.setProperty(key, val);
      } else {
        root.style.removeProperty(key);
      }
    }
  }

  // Apply on mount
  $effect(() => {
    applySettings();
  });

  // Accent color presets
  const ACCENT_PRESETS = [
    { color: '', label: 'Default' },
    { color: '#58a6ff', label: 'Blue' },
    { color: '#3fb950', label: 'Green' },
    { color: '#d29922', label: 'Gold' },
    { color: '#f85149', label: 'Red' },
    { color: '#d2a8ff', label: 'Purple' },
    { color: '#f0883e', label: 'Orange' },
    { color: '#76e3ea', label: 'Cyan' },
    { color: '#ff6699', label: 'Pink' },
  ];

  function setAccent(color: string) {
    config.accentColor = color;
    save();
  }

  function setFontSize(size: number) {
    config.fontSize = size;
    save();
  }

  function setFontFamily(id: string) {
    config.fontFamily = id;
    bodyFontDropdownOpen = false;
    save();
  }

  function setHeaderFont(id: string) {
    config.headerFont = id;
    headingFontDropdownOpen = false;
    save();
  }

  function setRadius(r: 'sharp' | 'rounded' | 'pill') {
    config.borderRadius = r;
    save();
  }

  function toggleContrast() {
    config.highContrast = !config.highContrast;
    save();
  }

  function resetAll() {
    config = { ...DEFAULTS };
    save();
    // Also reset inline styles
    const root = document.documentElement;
    root.style.removeProperty('font-size');
    root.style.removeProperty('--font-body');
    root.style.removeProperty('--font-heading');
    root.style.removeProperty('--radius');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-bg');
    root.classList.remove('high-contrast');
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="settings-overlay" onclick={() => (open = false)} role="presentation"></div>
  <div class="settings-panel">
    <div class="settings-header">
      <h3>Settings</h3>
      <button class="close-btn" onclick={() => (open = false)}><Icon name="close" size={14} /></button>
    </div>

    <div class="settings-body">
      <!-- Theme -->
      <div class="setting-group">
        <span class="setting-label">Theme</span>
        <div class="theme-grid">
          {#each THEMES as t}
            <button class="theme-chip" class:active={$theme === t.id} onclick={() => setTheme(t.id)} title={t.label}>
              <span class="theme-dot" class:dark={t.dark}></span>
              <span class="theme-name">{t.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Accent Color -->
      <div class="setting-group">
        <span class="setting-label">Accent Color</span>
        <div class="accent-row">
          {#each ACCENT_PRESETS as preset}
            <button
              class="accent-swatch"
              class:active={config.accentColor === preset.color}
              style="background: {preset.color || 'var(--accent)'}"
              title={preset.label}
              onclick={() => setAccent(preset.color)}
            ></button>
          {/each}
          <input
            type="color"
            class="accent-custom"
            value={config.accentColor || '#58a6ff'}
            oninput={(e) => setAccent((e.currentTarget as HTMLInputElement).value)}
            title="Custom color"
          />
        </div>
      </div>

      <!-- Font Size -->
      <div class="setting-group">
        <span class="setting-label">Font Size <span class="setting-hint">(base px — affects all rem sizes)</span></span>
        <div class="font-size-row">
          {#each FONT_SIZES as size}
            <button class="size-btn" class:active={config.fontSize === size} onclick={() => setFontSize(size)}
              >{size}</button
            >
          {/each}
        </div>
        <span class="size-note">Default 14px · Browser default is 16px</span>
      </div>

      <!-- Body Font -->
      <div class="setting-group">
        <span class="setting-label">Body Font</span>
        <div class="font-dropdown-wrap">
          <button
            class="font-dropdown-trigger"
            onclick={() => {
              bodyFontDropdownOpen = !bodyFontDropdownOpen;
              headingFontDropdownOpen = false;
            }}
            style="font-family: {getFontCss(config.fontFamily, BODY_FONT_GROUPS)}"
          >
            <span>{getFontName(config.fontFamily, BODY_FONT_GROUPS)}</span>
            <span class="font-chevron">{bodyFontDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {#if bodyFontDropdownOpen}
            <div class="font-dropdown-panel">
              {#each BODY_FONT_GROUPS as group}
                <div class="font-group-label">{group.label}</div>
                {#each group.fonts as font}
                  <button
                    class="font-option"
                    class:selected={config.fontFamily === font.id}
                    style="font-family: {font.css}"
                    onclick={() => setFontFamily(font.id)}>{font.name}</button
                  >
                {/each}
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Heading Font -->
      <div class="setting-group">
        <span class="setting-label">Heading Font</span>
        <div class="font-dropdown-wrap">
          <button
            class="font-dropdown-trigger"
            onclick={() => {
              headingFontDropdownOpen = !headingFontDropdownOpen;
              bodyFontDropdownOpen = false;
            }}
            style="font-family: {getFontCss(config.headerFont, HEADING_FONT_GROUPS)}"
          >
            <span>{getFontName(config.headerFont, HEADING_FONT_GROUPS)}</span>
            <span class="font-chevron">{headingFontDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {#if headingFontDropdownOpen}
            <div class="font-dropdown-panel">
              {#each HEADING_FONT_GROUPS as group}
                <div class="font-group-label">{group.label}</div>
                {#each group.fonts as font}
                  <button
                    class="font-option"
                    class:selected={config.headerFont === font.id}
                    style="font-family: {font.css}"
                    onclick={() => setHeaderFont(font.id)}>{font.name}</button
                  >
                {/each}
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Border Radius -->
      <div class="setting-group">
        <span class="setting-label">Corner Style</span>
        <div class="option-row">
          <button class="option-btn" class:active={config.borderRadius === 'sharp'} onclick={() => setRadius('sharp')}>
            <span class="radius-preview" style="border-radius: 2px"></span> Sharp
          </button>
          <button
            class="option-btn"
            class:active={config.borderRadius === 'rounded'}
            onclick={() => setRadius('rounded')}
          >
            <span class="radius-preview" style="border-radius: 8px"></span> Rounded
          </button>
          <button class="option-btn" class:active={config.borderRadius === 'pill'} onclick={() => setRadius('pill')}>
            <span class="radius-preview" style="border-radius: 20px"></span> Pill
          </button>
        </div>
      </div>

      <!-- High Contrast -->
      <div class="setting-group row-toggle">
        <span class="setting-label">High Contrast</span>
        <button
          class="toggle-switch"
          class:on={config.highContrast}
          onclick={toggleContrast}
          aria-label="Toggle high contrast"
          aria-pressed={config.highContrast}
        >
          <span class="toggle-knob"></span>
        </button>
      </div>

      <!-- Font Weight -->
      <div class="setting-group">
        <span class="setting-label">Body Weight</span>
        <div class="slider-row">
          <input
            type="range"
            min="300"
            max="700"
            step="100"
            bind:value={config.fontWeight}
            oninput={save}
            class="setting-slider"
          />
          <span class="slider-val">{config.fontWeight}</span>
        </div>
      </div>

      <div class="setting-group">
        <span class="setting-label">Heading Weight</span>
        <div class="slider-row">
          <input
            type="range"
            min="300"
            max="700"
            step="100"
            bind:value={config.headingWeight}
            oninput={save}
            class="setting-slider"
          />
          <span class="slider-val">{config.headingWeight}</span>
        </div>
      </div>

      <!-- Line Height -->
      <div class="setting-group">
        <span class="setting-label">Line Height</span>
        <div class="option-row">
          {#each [1.2, 1.4, 1.5, 1.6] as lh}
            <button
              class="option-btn"
              class:active={config.lineHeight === lh}
              onclick={() => {
                config.lineHeight = lh;
                save();
              }}>{lh}</button
            >
          {/each}
        </div>
      </div>

      <!-- Letter Spacing -->
      <div class="setting-group">
        <span class="setting-label">Letter Spacing</span>
        <div class="option-row">
          {#each [-0.02, 0, 0.02, 0.04] as ls}
            <button
              class="option-btn"
              class:active={config.letterSpacing === ls}
              onclick={() => {
                config.letterSpacing = ls;
                save();
              }}>{ls === 0 ? 'Normal' : `${ls > 0 ? '+' : ''}${ls}em`}</button
            >
          {/each}
        </div>
      </div>

      <!-- Custom Colors -->
      <div class="setting-group">
        <span class="setting-label">Custom Colors</span>
        {#each ['Brand', 'Text', 'Surface'] as group}
          <span class="color-group-label">{group}</span>
          <div class="color-overrides">
            {#each COLOR_OVERRIDES.filter((c) => c.group === group) as co}
              <div class="color-override-row">
                <span class="color-label">{co.label}</span>
                <input
                  type="color"
                  class="color-picker"
                  value={config.customColors[co.key] || '#888888'}
                  oninput={(e) => {
                    config.customColors[co.key] = (e.currentTarget as HTMLInputElement).value;
                    save();
                  }}
                />
                {#if config.customColors[co.key]}
                  <button
                    class="color-reset"
                    onclick={() => {
                      delete config.customColors[co.key];
                      config.customColors = { ...config.customColors };
                      save();
                    }}>Reset</button
                  >
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Reset -->
      <div class="setting-group">
        <button class="reset-btn" onclick={resetAll}>Reset to defaults</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 199;
    background: rgba(0, 0, 0, 0.4);
  }

  .settings-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 340px;
    max-width: 90vw;
    z-index: 200;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.2s ease-out;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .settings-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-group.row-toggle {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .setting-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }

  /* Theme grid */
  .theme-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .theme-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .theme-chip:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .theme-chip.active {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
  }

  .theme-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .theme-dot.dark {
    background: #333;
    border: 1px solid #555;
  }

  .theme-dot:not(.dark) {
    background: #eee;
    border: 1px solid #ccc;
  }

  /* Accent swatches */
  .accent-row {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .accent-swatch {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
  }

  .accent-swatch:hover {
    transform: scale(1.15);
  }

  .accent-swatch.active {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--bg-secondary);
  }

  .accent-custom {
    width: 26px;
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    overflow: hidden;
  }

  .accent-custom::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .accent-custom::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
  }

  /* Option buttons */
  .option-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .option-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .option-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .option-btn.active {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
  }

  .radius-preview {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
  }

  /* Toggle switch */
  .toggle-switch {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
    padding: 0;
  }

  .toggle-switch.on {
    background: var(--accent);
    border-color: var(--accent);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }

  .toggle-switch.on .toggle-knob {
    transform: translateX(18px);
  }

  /* Slider */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .setting-slider {
    flex: 1;
    accent-color: var(--accent);
  }

  .slider-val {
    font-size: 0.72rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    min-width: 32px;
    text-align: right;
  }

  .color-group-label {
    display: block;
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 8px 0 4px;
  }

  /* Color overrides */
  .color-overrides {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .color-override-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    min-width: 80px;
  }

  .color-picker {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    overflow: hidden;
  }

  .color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color-picker::-webkit-color-swatch {
    border: none;
  }

  .color-reset {
    font-size: 0.65rem;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-faint);
    cursor: pointer;
  }

  .color-reset:hover {
    color: var(--danger);
    border-color: var(--danger);
  }

  /* Reset */
  .reset-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
  }

  .reset-btn:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  /* ── Font size row ── */
  .font-size-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .size-btn {
    padding: 4px 9px;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    transition: all 0.15s;
  }

  .size-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .size-btn.active {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
  }

  .size-note {
    font-size: 0.62rem;
    color: var(--text-faint);
    margin-top: 2px;
  }

  .setting-hint {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    margin-left: 4px;
  }

  /* ── Font grouped dropdown ── */
  .font-dropdown-wrap {
    position: relative;
  }

  .font-dropdown-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-primary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s;
    text-align: left;
  }

  .font-dropdown-trigger:hover {
    border-color: var(--accent);
  }

  .font-chevron {
    font-size: 0.55rem;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .font-dropdown-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    z-index: 300;
    max-height: 280px;
    overflow-y: auto;
    padding: 6px;
  }

  .font-group-label {
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    padding: 6px 8px 3px;
    margin-top: 2px;
  }

  .font-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    border-radius: 5px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.88rem;
    cursor: pointer;
    transition:
      background 0.12s,
      color 0.12s;
  }

  .font-option:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .font-option.selected {
    background: var(--accent-bg);
    color: var(--accent);
  }
</style>
