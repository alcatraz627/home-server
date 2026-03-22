<script lang="ts">
  import { theme, THEMES, setTheme, type Theme } from '$lib/theme';
  import { browser } from '$app/environment';
  import Icon from '$lib/components/Icon.svelte';

  let { open = $bindable(false) } = $props<{ open: boolean }>();

  // ── Settings config ──────────────────────────────────────────────────────────
  const SETTINGS_KEY = 'hs:settings';

  interface SettingsConfig {
    fontSize: 12 | 14 | 16;
    fontFamily: 'inter' | 'system' | 'mono' | 'geist' | 'dm-sans' | 'ibm-plex';
    headerFont: 'space-grotesk' | 'inter' | 'system' | 'geist' | 'playfair' | 'mono';
    borderRadius: 'sharp' | 'rounded' | 'pill';
    accentColor: string;
    highContrast: boolean;
    // Font fine-tuning
    fontWeight: number;
    headingWeight: number;
    lineHeight: number;
    letterSpacing: number;
    // Custom color overrides
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

    // Body font family
    const fontMap: Record<string, string> = {
      inter: "'Inter', sans-serif",
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', monospace",
      geist: "'Geist', 'Inter', sans-serif",
      'dm-sans': "'DM Sans', 'Inter', sans-serif",
      'ibm-plex': "'IBM Plex Sans', 'Inter', sans-serif",
    };
    root.style.setProperty('--font-body', fontMap[config.fontFamily] || fontMap.inter);

    // Header font
    const headerMap: Record<string, string> = {
      'space-grotesk': "'Space Grotesk', 'Inter', sans-serif",
      inter: "'Inter', sans-serif",
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      geist: "'Geist', 'Inter', sans-serif",
      playfair: "'Playfair Display', serif",
      mono: "'JetBrains Mono', monospace",
    };
    root.style.setProperty('--font-heading', headerMap[config.headerFont] || headerMap['space-grotesk']);

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

  function setFontSize(size: 12 | 14 | 16) {
    config.fontSize = size;
    save();
  }

  function setFontFamily(f: SettingsConfig['fontFamily']) {
    config.fontFamily = f;
    save();
  }

  function setHeaderFont(f: SettingsConfig['headerFont']) {
    config.headerFont = f;
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
        <label class="setting-label">Theme</label>
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
        <label class="setting-label">Accent Color</label>
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
        <label class="setting-label">Font Size</label>
        <div class="option-row">
          {#each [12, 14, 16] as size}
            <button
              class="option-btn"
              class:active={config.fontSize === size}
              onclick={() => setFontSize(size as 12 | 14 | 16)}
            >
              {size}px
            </button>
          {/each}
        </div>
      </div>

      <!-- Body Font -->
      <div class="setting-group">
        <label class="setting-label">Body Font</label>
        <div class="option-row">
          <button
            class="option-btn"
            class:active={config.fontFamily === 'inter'}
            onclick={() => setFontFamily('inter')}
            style="font-family: 'Inter', sans-serif"
          >
            Inter
          </button>
          <button
            class="option-btn"
            class:active={config.fontFamily === 'system'}
            onclick={() => setFontFamily('system')}
            style="font-family: -apple-system, sans-serif"
          >
            System
          </button>
          <button
            class="option-btn"
            class:active={config.fontFamily === 'mono'}
            onclick={() => setFontFamily('mono')}
            style="font-family: 'JetBrains Mono', monospace"
          >
            Mono
          </button>
          <button
            class="option-btn"
            class:active={config.fontFamily === 'geist'}
            onclick={() => setFontFamily('geist')}
          >
            Geist
          </button>
          <button
            class="option-btn"
            class:active={config.fontFamily === 'dm-sans'}
            onclick={() => setFontFamily('dm-sans')}
          >
            DM Sans
          </button>
          <button
            class="option-btn"
            class:active={config.fontFamily === 'ibm-plex'}
            onclick={() => setFontFamily('ibm-plex')}
          >
            IBM Plex
          </button>
        </div>
      </div>

      <!-- Heading Font -->
      <div class="setting-group">
        <label class="setting-label">Heading Font</label>
        <div class="option-row">
          <button
            class="option-btn"
            class:active={config.headerFont === 'space-grotesk'}
            onclick={() => setHeaderFont('space-grotesk')}
            style="font-family: 'Space Grotesk', sans-serif"
          >
            Space Grotesk
          </button>
          <button
            class="option-btn"
            class:active={config.headerFont === 'inter'}
            onclick={() => setHeaderFont('inter')}
            style="font-family: 'Inter', sans-serif"
          >
            Inter
          </button>
          <button
            class="option-btn"
            class:active={config.headerFont === 'system'}
            onclick={() => setHeaderFont('system')}
            style="font-family: -apple-system, sans-serif"
          >
            System
          </button>
          <button
            class="option-btn"
            class:active={config.headerFont === 'geist'}
            onclick={() => setHeaderFont('geist')}
          >
            Geist
          </button>
          <button
            class="option-btn"
            class:active={config.headerFont === 'playfair'}
            onclick={() => setHeaderFont('playfair')}
            style="font-family: serif"
          >
            Playfair
          </button>
          <button
            class="option-btn"
            class:active={config.headerFont === 'mono'}
            onclick={() => setHeaderFont('mono')}
            style="font-family: 'JetBrains Mono', monospace"
          >
            Mono
          </button>
        </div>
      </div>

      <!-- Border Radius -->
      <div class="setting-group">
        <label class="setting-label">Corner Style</label>
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
        <label class="setting-label">High Contrast</label>
        <button class="toggle-switch" class:on={config.highContrast} onclick={toggleContrast}>
          <span class="toggle-knob"></span>
        </button>
      </div>

      <!-- Font Weight -->
      <div class="setting-group">
        <label class="setting-label">Body Weight</label>
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
        <label class="setting-label">Heading Weight</label>
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
        <label class="setting-label">Line Height</label>
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
        <label class="setting-label">Letter Spacing</label>
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
        <label class="setting-label">Custom Colors</label>
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
</style>
