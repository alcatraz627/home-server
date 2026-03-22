<script lang="ts">
  import { toast } from '$lib/toast';
  import Icon from '$lib/components/Icon.svelte';

  interface PlaylistItem {
    src: string;
    filename: string;
    type: 'video' | 'audio';
  }

  let {
    src,
    type,
    filename,
    onclose,
    playlist = [],
    currentIndex = 0,
    onchangetrack,
  }: {
    src: string;
    type: 'video' | 'audio';
    filename: string;
    onclose: () => void;
    playlist?: PlaylistItem[];
    currentIndex?: number;
    onchangetrack?: (index: number) => void;
  } = $props();

  // Playback state
  let mediaEl = $state<HTMLVideoElement | HTMLAudioElement | null>(null);
  let playing = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(1);
  let muted = $state(false);
  let playbackRate = $state(1);
  let showVlcInfo = $state(false);
  let showPlaylist = $state(playlist.length > 1);
  let seeking = $state(false);

  const speeds = [0.5, 1, 1.25, 1.5, 2];

  // Derived helpers
  let hasPlaylist = $derived(playlist.length > 1);
  let canPrev = $derived(currentIndex > 0);
  let canNext = $derived(currentIndex < playlist.length - 1);

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    if (!mediaEl) return;
    if (mediaEl.paused) {
      mediaEl.play();
    } else {
      mediaEl.pause();
    }
  }

  function seek(e: Event) {
    const input = e.target as HTMLInputElement;
    if (mediaEl) {
      mediaEl.currentTime = parseFloat(input.value);
    }
    seeking = false;
  }

  function onSeekInput(e: Event) {
    seeking = true;
    const input = e.target as HTMLInputElement;
    currentTime = parseFloat(input.value);
  }

  function setVolume(e: Event) {
    const input = e.target as HTMLInputElement;
    volume = parseFloat(input.value);
    if (mediaEl) mediaEl.volume = volume;
    muted = volume === 0;
  }

  function toggleMute() {
    if (!mediaEl) return;
    muted = !muted;
    mediaEl.muted = muted;
  }

  function cycleSpeed() {
    const idx = speeds.indexOf(playbackRate);
    playbackRate = speeds[(idx + 1) % speeds.length];
    if (mediaEl) mediaEl.playbackRate = playbackRate;
  }

  function requestFullscreen() {
    if (!mediaEl) return;
    if (mediaEl.requestFullscreen) {
      mediaEl.requestFullscreen();
    }
  }

  function handleEnded() {
    playing = false;
    if (canNext) {
      goToTrack(currentIndex + 1);
    }
  }

  function goToTrack(index: number) {
    if (index < 0 || index >= playlist.length) return;
    if (onchangetrack) {
      onchangetrack(index);
    }
  }

  function prevTrack() {
    if (canPrev) goToTrack(currentIndex - 1);
  }

  function nextTrack() {
    if (canNext) goToTrack(currentIndex + 1);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === 'ArrowLeft' && mediaEl) {
      e.preventDefault();
      mediaEl.currentTime = Math.max(0, mediaEl.currentTime - 5);
    }
    if (e.key === 'ArrowRight' && mediaEl) {
      e.preventDefault();
      mediaEl.currentTime = Math.min(duration, mediaEl.currentTime + 5);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      volume = Math.min(1, volume + 0.1);
      if (mediaEl) mediaEl.volume = volume;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      volume = Math.max(0, volume - 0.1);
      if (mediaEl) mediaEl.volume = volume;
    }
    if (e.key === 'f' && type === 'video') {
      e.preventDefault();
      requestFullscreen();
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      nextTrack();
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      prevTrack();
    }
  }

  function getStreamUrl(): string {
    // Build absolute URL for VLC
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${src}`;
    }
    return src;
  }

  async function copyStreamUrl() {
    const url = getStreamUrl();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('Stream URL copied');
    } catch {
      toast.error('Failed to copy URL');
    }
  }

  function openVlc() {
    const streamUrl = getStreamUrl();
    // Show URL for manual copy since vlc:// protocol may not be registered
    showVlcInfo = true;
    try {
      window.open(`vlc://${streamUrl}`, '_self');
    } catch {
      // Protocol handler not available — that's fine, URL is shown below
    }
  }

  let seekPercent = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
  let volumePercent = $derived(volume * 100);
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="media-overlay" onclick={onclose} role="dialog" tabindex="-1" aria-label="Media player">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="media-modal" class:with-playlist={showPlaylist && hasPlaylist} onclick={(e) => e.stopPropagation()}>
    <!-- Header -->
    <div class="media-header">
      <div class="media-title">
        <span class="media-type-badge">{type === 'video' ? 'VIDEO' : 'AUDIO'}</span>
        <h3 title={filename}>{filename}</h3>
      </div>
      <div class="media-header-actions">
        {#if hasPlaylist}
          <button
            class="ctrl-btn"
            class:active={showPlaylist}
            title="Toggle playlist"
            onclick={() => (showPlaylist = !showPlaylist)}
          >
            <Icon name="menu" size={14} />
          </button>
        {/if}
        <button class="ctrl-btn" title="Open in VLC" onclick={openVlc}>VLC</button>
        <button class="ctrl-btn" title="Copy stream URL" onclick={copyStreamUrl}>URL</button>
        <button class="ctrl-btn close-btn" title="Close (Esc)" onclick={onclose}><Icon name="close" size={16} /></button
        >
      </div>
    </div>

    <div class="media-content">
      <!-- Player area -->
      <div class="player-area">
        {#if type === 'video'}
          <div class="video-container">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              bind:this={mediaEl}
              {src}
              onplay={() => (playing = true)}
              onpause={() => (playing = false)}
              ontimeupdate={() => {
                if (!seeking && mediaEl) currentTime = mediaEl.currentTime;
              }}
              onloadedmetadata={() => {
                if (mediaEl) {
                  duration = mediaEl.duration;
                  mediaEl.playbackRate = playbackRate;
                  mediaEl.volume = volume;
                  mediaEl.play();
                }
              }}
              onended={handleEnded}
              playsinline
            >
            </video>
          </div>
        {:else}
          <div class="audio-visual">
            <div class="audio-icon" class:playing>
              <div class="audio-bar"></div>
              <div class="audio-bar"></div>
              <div class="audio-bar"></div>
              <div class="audio-bar"></div>
              <div class="audio-bar"></div>
            </div>
            <div class="audio-filename">{filename}</div>
          </div>
          <!-- svelte-ignore a11y_media_has_caption -->
          <audio
            bind:this={mediaEl}
            {src}
            onplay={() => (playing = true)}
            onpause={() => (playing = false)}
            ontimeupdate={() => {
              if (!seeking && mediaEl) currentTime = mediaEl.currentTime;
            }}
            onloadedmetadata={() => {
              if (mediaEl) {
                duration = mediaEl.duration;
                mediaEl.playbackRate = playbackRate;
                mediaEl.volume = volume;
                mediaEl.play();
              }
            }}
            onended={handleEnded}
          >
          </audio>
        {/if}

        <!-- Controls -->
        <div class="controls">
          <!-- Seek bar -->
          <div class="seek-row">
            <span class="time-label">{formatTime(currentTime)}</span>
            <div class="seek-track">
              <input
                type="range"
                class="seek-slider"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                oninput={onSeekInput}
                onchange={seek}
                style="--progress: {seekPercent}%"
              />
            </div>
            <span class="time-label">{formatTime(duration)}</span>
          </div>

          <!-- Button row -->
          <div class="controls-row">
            <div class="controls-left">
              {#if hasPlaylist}
                <button class="ctrl-btn" disabled={!canPrev} title="Previous (P)" onclick={prevTrack}
                  ><Icon name="arrow-left" size={14} /></button
                >
              {/if}
              <button class="ctrl-btn play-btn" title="Play/Pause (Space)" onclick={togglePlay}>
                {#if playing}<Icon name="pause" size={18} />{:else}<Icon name="play" size={18} />{/if}
              </button>
              {#if hasPlaylist}
                <button class="ctrl-btn" disabled={!canNext} title="Next (N)" onclick={nextTrack}
                  ><Icon name="arrow-right" size={14} /></button
                >
              {/if}
            </div>

            <div class="controls-center">
              <button class="ctrl-btn speed-btn" title="Playback speed" onclick={cycleSpeed}>
                {playbackRate}x
              </button>
            </div>

            <div class="controls-right">
              <button class="ctrl-btn vol-btn" title={muted ? 'Unmute' : 'Mute'} onclick={toggleMute}>
                {#if muted || volume === 0}
                  <Icon name="volume-off" size={14} />
                {:else if volume < 0.5}
                  <Icon name="volume-low" size={14} />
                {:else}
                  <Icon name="volume-high" size={14} />
                {/if}
              </button>
              <div class="volume-track">
                <input
                  type="range"
                  class="volume-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  oninput={setVolume}
                  style="--progress: {muted ? 0 : volumePercent}%"
                />
              </div>
              {#if type === 'video'}
                <button class="ctrl-btn" title="Fullscreen (F)" onclick={requestFullscreen}>&#x26F6;</button>
              {/if}
            </div>
          </div>
        </div>

        <!-- VLC info panel -->
        {#if showVlcInfo}
          <div class="vlc-info">
            <p class="vlc-hint">If VLC didn't open, copy the URL below and open it manually:</p>
            <div class="vlc-url-row">
              <code class="vlc-url">{getStreamUrl()}</code>
              <button class="ctrl-btn" onclick={copyStreamUrl}>Copy</button>
            </div>
            <button class="ctrl-btn vlc-dismiss" onclick={() => (showVlcInfo = false)}>Dismiss</button>
          </div>
        {/if}
      </div>

      <!-- Playlist sidebar -->
      {#if showPlaylist && hasPlaylist}
        <div class="playlist-panel">
          <div class="playlist-header">
            <span class="playlist-title">Playlist ({playlist.length})</span>
          </div>
          <div class="playlist-items">
            {#each playlist as item, i}
              <button
                class="playlist-item"
                class:active={i === currentIndex}
                class:played={i < currentIndex}
                onclick={() => goToTrack(i)}
              >
                <span class="playlist-num">{i + 1}</span>
                <span class="playlist-name" title={item.filename}>{item.filename}</span>
                <span class="playlist-type-icon">{item.type === 'video' ? '▶' : '♫'}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .media-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .media-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .media-modal.with-playlist {
    max-width: 1200px;
  }

  /* Header */
  .media-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    gap: 12px;
  }

  .media-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .media-title h3 {
    font-size: 0.85rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  }

  .media-type-badge {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--accent-bg);
    color: var(--accent);
    flex-shrink: 0;
  }

  .media-header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Content layout */
  .media-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .player-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Video */
  .video-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    min-height: 200px;
  }

  .video-container video {
    max-width: 100%;
    max-height: 65vh;
    display: block;
  }

  /* Audio visualization */
  .audio-visual {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    gap: 20px;
    min-height: 180px;
    background: var(--bg-secondary);
  }

  .audio-icon {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 48px;
  }

  .audio-bar {
    width: 6px;
    background: var(--accent);
    border-radius: 3px;
    transition: height 0.2s;
  }

  .audio-bar:nth-child(1) {
    height: 20px;
  }
  .audio-bar:nth-child(2) {
    height: 32px;
  }
  .audio-bar:nth-child(3) {
    height: 48px;
  }
  .audio-bar:nth-child(4) {
    height: 28px;
  }
  .audio-bar:nth-child(5) {
    height: 16px;
  }

  .audio-icon.playing .audio-bar {
    animation: audioWave 0.8s ease-in-out infinite alternate;
  }
  .audio-icon.playing .audio-bar:nth-child(1) {
    animation-delay: 0s;
  }
  .audio-icon.playing .audio-bar:nth-child(2) {
    animation-delay: 0.15s;
  }
  .audio-icon.playing .audio-bar:nth-child(3) {
    animation-delay: 0.3s;
  }
  .audio-icon.playing .audio-bar:nth-child(4) {
    animation-delay: 0.45s;
  }
  .audio-icon.playing .audio-bar:nth-child(5) {
    animation-delay: 0.6s;
  }

  @keyframes audioWave {
    from {
      height: 12px;
    }
    to {
      height: 48px;
    }
  }

  .audio-filename {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    word-break: break-all;
    max-width: 90%;
  }

  /* Controls */
  .controls {
    padding: 10px 16px 14px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
  }

  .seek-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .time-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: monospace;
    min-width: 40px;
    text-align: center;
  }

  .seek-track,
  .volume-track {
    flex: 1;
    position: relative;
  }

  .seek-slider,
  .volume-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    background: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--progress, 0%),
      var(--border) var(--progress, 0%),
      var(--border) 100%
    );
  }

  .seek-slider::-webkit-slider-thumb,
  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: none;
  }

  .seek-slider::-moz-range-thumb,
  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: none;
  }

  .controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .controls-left,
  .controls-center,
  .controls-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .volume-track {
    width: 80px;
  }

  /* Control buttons */
  .ctrl-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    font-family: inherit;
    line-height: 1.2;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .ctrl-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: default;
    border-color: var(--border);
    color: var(--text-muted);
  }

  .ctrl-btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  .play-btn {
    font-size: 1rem;
    padding: 4px 14px;
  }

  .close-btn {
    font-size: 1.1rem;
    padding: 2px 8px;
    font-weight: bold;
  }

  .speed-btn {
    font-family: monospace;
    font-size: 0.7rem;
    min-width: 36px;
    text-align: center;
  }

  /* VLC info */
  .vlc-info {
    padding: 10px 16px;
    background: var(--bg-inset);
    border-top: 1px solid var(--border);
    font-size: 0.8rem;
  }

  .vlc-hint {
    color: var(--text-muted);
    margin: 0 0 6px;
  }

  .vlc-url-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .vlc-url {
    flex: 1;
    font-size: 0.7rem;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
    user-select: all;
  }

  .vlc-dismiss {
    margin-top: 6px;
    font-size: 0.7rem;
  }

  /* Playlist panel */
  .playlist-panel {
    width: 260px;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    flex-shrink: 0;
  }

  .playlist-header {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }

  .playlist-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .playlist-items {
    flex: 1;
    overflow-y: auto;
  }

  .playlist-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 14px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    border-bottom: 1px solid var(--border-subtle, var(--border));
    transition: background 0.1s;
  }

  .playlist-item:hover {
    background: var(--bg-primary);
  }

  .playlist-item.active {
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 500;
  }

  .playlist-item.played {
    color: var(--text-muted);
  }

  .playlist-num {
    font-size: 0.7rem;
    color: var(--text-faint);
    min-width: 18px;
    text-align: right;
    font-family: monospace;
  }

  .playlist-item.active .playlist-num {
    color: var(--accent);
  }

  .playlist-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .playlist-type-icon {
    font-size: 0.7rem;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .media-modal.with-playlist {
      max-width: 100%;
    }

    .playlist-panel {
      display: none;
    }

    .volume-track {
      display: none;
    }

    .controls-row {
      flex-wrap: wrap;
      gap: 6px;
    }
  }
</style>
