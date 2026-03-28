<script lang="ts">
  import type { PageData } from './$types';
  import type { FileInfo } from '$lib/server/files';
  import type { FileMetadata } from '$lib/server/metadata';
  import { hasRenderer, renderDocument, type RenderResult, type SheetData } from '$lib/renderers';
  import DataTable from '$lib/components/DataTable.svelte';
  import MediaPlayer from '$lib/components/MediaPlayer.svelte';
  import Button from '$lib/components/Button.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Collapsible from '$lib/components/Collapsible.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { toast } from '$lib/toast';
  import { stars } from '$lib/stars';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { fetchApi } from '$lib/api';
  import { createTableSort } from '$lib/sort.svelte';
  import { getErrorMessage } from '$lib/errors';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import { SK_FILE_VIEW, SK_FILE_TABS } from '$lib/constants/storage-keys';

  // --- Media file detection ---
  const MEDIA_VIDEO_EXTS = ['.mp4', '.webm', '.mkv', '.avi', '.mov'];
  const MEDIA_AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
  const MEDIA_EXTS = [...MEDIA_VIDEO_EXTS, ...MEDIA_AUDIO_EXTS];

  function getFileExt(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
  }

  function isMediaFile(file: FileInfo): boolean {
    return MEDIA_EXTS.includes(getFileExt(file.name));
  }

  function getMediaType(file: FileInfo): 'video' | 'audio' {
    return MEDIA_VIDEO_EXTS.includes(getFileExt(file.name)) ? 'video' : 'audio';
  }

  function getMediaIcon(file: FileInfo): string {
    const ext = getFileExt(file.name);
    if (MEDIA_VIDEO_EXTS.includes(ext)) return 'film';
    if (MEDIA_AUDIO_EXTS.includes(ext)) return 'music';
    return 'file';
  }

  function streamUrl(filename: string): string {
    const filePath = currentPath ? `${currentPath}/${filename}` : filename;
    return `/api/files/stream/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;
  }

  // --- Media player state ---
  let mediaPlayerOpen = $state(false);
  let mediaPlayerSrc = $state('');
  let mediaPlayerType = $state<'video' | 'audio'>('video');
  let mediaPlayerFilename = $state('');
  let mediaPlaylist = $state<{ src: string; filename: string; type: 'video' | 'audio' }[]>([]);
  let mediaPlaylistIndex = $state(0);

  function openMediaPlayer(file: FileInfo) {
    const url = streamUrl(file.name);
    const mType = getMediaType(file);
    mediaPlayerSrc = url;
    mediaPlayerType = mType;
    mediaPlayerFilename = file.name;
    mediaPlaylist = [{ src: url, filename: file.name, type: mType }];
    mediaPlaylistIndex = 0;
    mediaPlayerOpen = true;
  }

  function playSelected() {
    const mediaFiles = filtered
      .filter((f) => selectedFiles.has(f.name) && isMediaFile(f))
      .map((f) => ({
        src: streamUrl(f.name),
        filename: f.name,
        type: getMediaType(f),
      }));
    if (mediaFiles.length === 0) return;
    mediaPlaylist = mediaFiles;
    mediaPlaylistIndex = 0;
    mediaPlayerSrc = mediaFiles[0].src;
    mediaPlayerType = mediaFiles[0].type;
    mediaPlayerFilename = mediaFiles[0].filename;
    mediaPlayerOpen = true;
  }

  function onChangeTrack(index: number) {
    if (index < 0 || index >= mediaPlaylist.length) return;
    mediaPlaylistIndex = index;
    const item = mediaPlaylist[index];
    mediaPlayerSrc = item.src;
    mediaPlayerType = item.type;
    mediaPlayerFilename = item.filename;
  }

  function closeMediaPlayer() {
    mediaPlayerOpen = false;
  }

  type EnrichedFile = FileInfo & { meta: FileMetadata | null };

  // --- Tab system ---
  interface FileTab {
    id: number;
    path: string;
    label: string;
  }

  let nextTabId = 1;
  let tabs = $state<FileTab[]>([]);
  let activeTabId = $state(0);

  function tabLabel(path: string): string {
    if (!path) return 'Root';
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || 'Root';
  }

  function initTabs(initialPath: string) {
    if (browser) {
      try {
        const saved = localStorage.getItem(SK_FILE_TABS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
            tabs = parsed.tabs;
            activeTabId = parsed.activeTabId ?? parsed.tabs[0].id;
            nextTabId = Math.max(...parsed.tabs.map((t: FileTab) => t.id)) + 1;
            return;
          }
        }
      } catch {}
    }
    const tab: FileTab = { id: nextTabId++, path: initialPath, label: tabLabel(initialPath) };
    tabs = [tab];
    activeTabId = tab.id;
  }

  function saveTabs() {
    if (browser) {
      localStorage.setItem(SK_FILE_TABS, JSON.stringify({ tabs, activeTabId }));
    }
  }

  function addTab(path = '') {
    const tab: FileTab = { id: nextTabId++, path, label: tabLabel(path) };
    tabs = [...tabs, tab];
    activeTabId = tab.id;
    navigateTo(path);
    saveTabs();
  }

  function closeTab(id: number) {
    if (tabs.length <= 1) return; // Keep at least one tab
    const idx = tabs.findIndex((t) => t.id === id);
    tabs = tabs.filter((t) => t.id !== id);
    if (activeTabId === id) {
      // Switch to adjacent tab
      const newIdx = Math.min(idx, tabs.length - 1);
      activeTabId = tabs[newIdx].id;
      navigateTo(tabs[newIdx].path);
    }
    saveTabs();
  }

  function switchTab(id: number) {
    if (id === activeTabId) return;
    // Save current path to the active tab before switching
    const current = tabs.find((t) => t.id === activeTabId);
    if (current) {
      current.path = currentPath;
      current.label = tabLabel(currentPath);
      tabs = [...tabs]; // trigger reactivity
    }
    activeTabId = id;
    const target = tabs.find((t) => t.id === id);
    if (target) navigateTo(target.path);
    saveTabs();
  }

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  const { files: initialFiles, currentPath: initialPath, uploadDir } = data;
  let files = $state<EnrichedFile[]>(initialFiles);
  let currentPath = $state(initialPath || '');

  // Sync URL when path changes
  $effect(() => {
    if (!browser) return;
    const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
    const newUrl = `/files${params}`;
    if ($page.url.pathname + $page.url.search !== newUrl) {
      history.replaceState(null, '', newUrl);
    }
  });

  // Read initial path from URL on mount (for deep links like /files?path=somefile.mp4)
  $effect(() => {
    if (!browser) return;
    const urlPath = $page.url.searchParams.get('path');
    if (urlPath && urlPath !== currentPath && !urlPath.includes('.')) {
      // Only navigate if it looks like a directory path (no extension)
      navigateTo(urlPath);
    }
  });

  let dragOver = $state(false);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let uploadQueue = $state<{ name: string; progress: number; done: boolean }[]>([]);

  // --- View mode (list/grid) ---
  type ViewMode = 'list' | 'grid';
  let viewMode = $state<ViewMode>(browser ? (localStorage.getItem(SK_FILE_VIEW) as ViewMode) || 'list' : 'list');

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    if (browser) localStorage.setItem(SK_FILE_VIEW, mode);
  }

  // --- Starred files (via shared stars store) ---
  // Subscribe to stars store for reactivity
  let starredFiles = $state<string[]>([]);
  stars.subscribe((items) => {
    starredFiles = items['file'] ?? [];
  });

  function toggleStar(filename: string) {
    stars.toggle('file', filename);
  }

  function isFileStarred(name: string): boolean {
    return starredFiles.includes(name);
  }

  // --- Folder size (eager async) ---
  let folderSizes = $state<Map<string, number | 'loading'>>(new Map());

  async function calculateFolderSize(file: FileInfo) {
    const key = currentPath ? `${currentPath}/${file.name}` : file.name;
    if (folderSizes.has(key)) return; // already loading or loaded
    folderSizes = new Map(folderSizes).set(key, 'loading');
    try {
      const params = new URLSearchParams({ name: file.name });
      if (currentPath) params.set('path', currentPath);
      const res = await fetchApi(`/api/files/size?${params}`);
      if (!res.ok) throw new Error('Failed');
      const { bytes } = await res.json();
      folderSizes = new Map(folderSizes).set(key, bytes);
    } catch {
      folderSizes = new Map(folderSizes).set(key, 0);
    }
  }

  function getFolderSizeKey(file: FileInfo): string {
    return currentPath ? `${currentPath}/${file.name}` : file.name;
  }

  // Auto-calculate folder sizes when directory listing changes
  $effect(() => {
    const dirs = files.filter((f) => f.isDirectory);
    // Fire all in parallel — each manages its own loading state
    for (const dir of dirs) {
      calculateFolderSize(dir);
    }
  });

  function copyPath(file: FileInfo) {
    const full = currentPath ? `${currentPath}/${file.name}` : file.name;
    navigator.clipboard.writeText(full).then(() => toast.success('Path copied'));
  }

  // --- Bulk selection ---
  let selectedFiles = $state<Set<string>>(new Set());

  let selectedMediaCount = $derived(
    [...selectedFiles].filter((name) => {
      const file = files.find((f) => f.name === name);
      return file && isMediaFile(file);
    }).length,
  );

  function toggleSelect(filename: string) {
    const next = new Set(selectedFiles);
    if (next.has(filename)) {
      next.delete(filename);
    } else {
      next.add(filename);
    }
    selectedFiles = next;
  }

  function selectAll() {
    selectedFiles = new Set(filtered.filter((f) => !f.isDirectory).map((f) => f.name));
  }

  function clearSelection() {
    selectedFiles = new Set();
  }

  async function deleteSelected() {
    const names = [...selectedFiles];
    if (!names.length) return;
    try {
      for (const name of names) {
        const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
        const res = await fetchApi(`/api/files/${encodeURIComponent(name)}${params}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Failed to delete ${name}`);
      }
      toast.success(`Deleted ${names.length} file${names.length > 1 ? 's' : ''}`);
      selectedFiles = new Set();
      await refreshFiles();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to delete files'), { key: 'delete-file' });
    }
  }

  function zipDownloadUrl(): string {
    const names = [...selectedFiles];
    const filesParam = names.map((n) => encodeURIComponent(n)).join(',');
    const pathParam = currentPath ? `&path=${encodeURIComponent(currentPath)}` : '';
    return `/api/files/zip?files=${filesParam}${pathParam}`;
  }

  // New directory
  let showNewDir = $state(false);
  let newDirName = $state('');

  // Breadcrumbs
  let breadcrumbs = $derived.by(() => {
    if (!currentPath) return [{ name: 'Home', path: '' }];
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', path: '' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += (accumulated ? '/' : '') + part;
      crumbs.push({ name: part, path: accumulated });
    }
    return crumbs;
  });

  // Search, sort, filter
  let search = $state('');
  let searchInputEl = $state<HTMLInputElement | undefined>();
  let searchScope = $state<'folder' | 'all'>('folder');
  let globalResults = $state<{ name: string; path: string; size: number; modified: string }[]>([]);
  let globalSearching = $state(false);
  let showGlobalResults = $state(false);
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;
  let wildcardMode = $state(false);

  function handleSearchInput() {
    if (searchScope !== 'all' || !search.trim()) {
      globalResults = [];
      showGlobalResults = false;
      return;
    }
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      globalSearching = true;
      try {
        const wildcardParam = wildcardMode ? '&wildcard=true' : '';
        const res = await fetchApi(`/api/files/search?q=${encodeURIComponent(search.trim())}${wildcardParam}`);
        const data = await res.json();
        globalResults = data.results;
        showGlobalResults = true;
      } catch {
        globalResults = [];
      } finally {
        globalSearching = false;
      }
    }, 300);
  }

  function navigateToSearchResult(result: { name: string; path: string }) {
    const dir = result.path.includes('/') ? result.path.substring(0, result.path.lastIndexOf('/')) : '';
    showGlobalResults = false;
    search = '';
    navigateTo(dir);
  }

  const sort = createTableSort<'name' | 'size' | 'modified' | 'mime'>('name', 'asc');
  let typeFilter = $state('');

  let uniqueTypes = $derived([...new Set(files.map((f) => f.mime.split('/')[0]))].sort());

  let filtered = $derived.by(() => {
    let result = files;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (typeFilter) {
      result = result.filter((f) => f.mime.startsWith(typeFilter + '/'));
    }
    const sf = sort.key;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => {
      // Starred files always sort to the top
      const aStarred = isFileStarred(a.name) ? 0 : 1;
      const bStarred = isFileStarred(b.name) ? 0 : 1;
      if (aStarred !== bStarred) return aStarred - bStarred;
      if (sf === 'name') return a.name.localeCompare(b.name) * dir;
      if (sf === 'size') return (a.size - b.size) * dir;
      if (sf === 'modified') return (new Date(a.modified).getTime() - new Date(b.modified).getTime()) * dir;
      if (sf === 'mime') return a.mime.localeCompare(b.mime) * dir;
      return 0;
    });
  });

  // --- File size visualization ---
  let maxFileSize = $derived(Math.max(1, ...files.filter((f) => !f.isDirectory).map((f) => f.size)));

  // Preview state
  let previewFile = $state<FileInfo | null>(null);

  // Rename state
  let renamingFile = $state<string | null>(null);
  let renameValue = $state('');

  // Info panel state
  let infoFile = $state<FileInfo | null>(null);

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  function previewUrl(filename: string): string {
    const params = currentPath ? `?path=${encodeURIComponent(currentPath)}&preview=true` : '?preview=true';
    return `/api/files/${encodeURIComponent(filename)}${params}`;
  }

  function downloadUrl(filename: string): string {
    const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
    return `/api/files/${encodeURIComponent(filename)}${params}`;
  }

  type PreviewType = 'media' | 'document' | 'none';

  function isPreviewable(file: FileInfo): boolean {
    return isMediaType(file.mime) || hasRenderer(file.mime, file.name);
  }

  function isMediaType(mime: string): boolean {
    return (
      mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf'
    );
  }

  function previewCategory(file: FileInfo): PreviewType {
    if (isMediaType(file.mime)) return 'media';
    if (hasRenderer(file.mime, file.name)) return 'document';
    return 'none';
  }

  function mediaType(mime: string): 'image' | 'video' | 'audio' | 'pdf' {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'pdf';
  }

  // Document renderer state
  let renderResult = $state<RenderResult | null>(null);
  let renderLoading = $state(false);
  let activeSheet = $state(0);

  function openPreview(file: FileInfo) {
    if (!isPreviewable(file)) return;
    previewFile = file;
    renderResult = null;

    if (previewCategory(file) === 'document') {
      loadAndRender(file);
    }
  }

  async function loadAndRender(file: FileInfo) {
    renderLoading = true;
    try {
      const res = await fetchApi(previewUrl(file.name));
      if (!res.ok) throw new Error('Failed to load file for preview');
      const data = await res.arrayBuffer();
      renderResult = await renderDocument(data, file.mime, file.name);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to preview file'));
    }
    renderLoading = false;
  }

  function closePreview() {
    previewFile = null;
    renderResult = null;
    activeSheet = 0;
  }

  // Rename
  function startRename(file: FileInfo) {
    renamingFile = file.name;
    renameValue = file.name;
  }

  async function submitRename(oldName: string) {
    if (!renameValue || renameValue === oldName) {
      renamingFile = null;
      return;
    }
    try {
      const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
      const res = await fetchApi(`/api/files/${encodeURIComponent(oldName)}${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue }),
      });
      if (!res.ok) throw new Error('Failed to rename file');
      await refreshFiles();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to rename file'), { key: 'delete-file' });
    }
    renamingFile = null;
  }

  function handleRenameKey(e: KeyboardEvent, oldName: string) {
    if (e.key === 'Enter') submitRename(oldName);
    if (e.key === 'Escape') renamingFile = null;
  }

  // Editable path bar state
  let editingPath = $state(false);
  let pathInputValue = $state('');

  function startEditingPath() {
    pathInputValue = currentPath || '/';
    editingPath = true;
  }

  function cancelEditingPath() {
    editingPath = false;
  }

  let browseMode = $state<'uploads' | 'system'>('uploads');

  let absolutePath = $derived(
    browseMode === 'system' ? currentPath : currentPath ? `${uploadDir}/${currentPath}` : uploadDir,
  );

  // Per-segment sibling dropdown
  let openDropdownIdx = $state<number | null>(null);
  let dropdownDirs = $state<Map<string, string[]>>(new Map());
  let dropdownLoading = $state<string | null>(null);

  async function fetchSiblingDirs(parentPath: string): Promise<string[]> {
    if (dropdownDirs.has(parentPath)) return dropdownDirs.get(parentPath)!;
    dropdownLoading = parentPath;
    try {
      if (browseMode === 'system') {
        const res = await fetchApi(`/api/browse?path=${encodeURIComponent(parentPath || '/')}`);
        if (!res.ok) return [];
        const d = await res.json();
        const dirs = (d.entries as { name: string; isDir: boolean }[])
          .filter((e) => e.isDir && e.name !== '..')
          .map((e) => e.name);
        dropdownDirs = new Map(dropdownDirs).set(parentPath, dirs);
        return dirs;
      } else {
        const params = parentPath ? `?path=${encodeURIComponent(parentPath)}` : '';
        const res = await fetchApi(`/api/files${params}`);
        if (!res.ok) return [];
        const entries: { name: string; isDirectory: boolean }[] = await res.json();
        const dirs = entries.filter((e) => e.isDirectory).map((e) => e.name);
        dropdownDirs = new Map(dropdownDirs).set(parentPath, dirs);
        return dirs;
      }
    } catch {
      return [];
    } finally {
      dropdownLoading = null;
    }
  }

  async function toggleDropdown(idx: number, e: MouseEvent) {
    e.stopPropagation();
    if (openDropdownIdx === idx) {
      openDropdownIdx = null;
      return;
    }
    openDropdownIdx = idx;
    const parentPath = idx === 0 ? '' : breadcrumbs[idx - 1].path;
    await fetchSiblingDirs(parentPath);
  }

  function navigateToSibling(parentPath: string, dirName: string) {
    openDropdownIdx = null;
    const target = parentPath ? `${parentPath}/${dirName}` : dirName;
    navigateTo(target);
  }

  $effect(() => {
    if (openDropdownIdx === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as Element).closest('.crumb-item')) openDropdownIdx = null;
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  async function submitPathInput() {
    const raw = pathInputValue.trim();
    editingPath = false;
    dropdownDirs = new Map();
    openDropdownIdx = null;

    // If path starts with / or ~, switch to system browse mode
    if (raw.startsWith('/') || raw.startsWith('~')) {
      browseMode = 'system';
      try {
        const res = await fetchApi(`/api/browse?path=${encodeURIComponent(raw)}`);
        if (!res.ok) throw new Error('Invalid path');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        currentPath = data.current;
        files = data.entries.map((e: any) => ({
          name: e.name,
          size: e.size,
          modified: '',
          created: '',
          isDirectory: e.isDir,
          permissions: '',
          mime: e.isDir ? 'inode/directory' : '',
          meta: null,
        }));
      } catch (e: unknown) {
        toast.error(getErrorMessage(e, 'Invalid path'), { key: 'path-nav' });
      }
      return;
    }

    // Normal upload dir mode
    browseMode = 'uploads';
    const cleaned = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    try {
      const params = cleaned ? `?path=${encodeURIComponent(cleaned)}` : '';
      const res = await fetchApi(`/api/files${params}`);
      if (!res.ok) throw new Error('Invalid path');
      currentPath = cleaned;
      files = await res.json();
    } catch {
      toast.error('Invalid path — directory not found', { key: 'path-nav' });
    }
  }

  function handlePathKey(e: KeyboardEvent) {
    if (e.key === 'Enter') submitPathInput();
    if (e.key === 'Escape') cancelEditingPath();
  }

  // Navigate into directory (validates path first)
  async function navigateTo(navPath: string) {
    dropdownDirs = new Map();
    folderSizes = new Map();
    openDropdownIdx = null;
    if (browseMode === 'system') {
      try {
        const res = await fetchApi(`/api/browse?path=${encodeURIComponent(navPath)}`);
        if (!res.ok) throw new Error('Directory not found');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        currentPath = data.current;
        files = data.entries.map((e: any) => ({
          name: e.name,
          size: e.size,
          modified: '',
          created: '',
          isDirectory: e.isDir,
          permissions: '',
          mime: e.isDir ? 'inode/directory' : '',
          meta: null,
        }));
      } catch {
        toast.error('Invalid path — directory not found', { key: 'path-nav' });
      }
      return;
    }
    try {
      const params = navPath ? `?path=${encodeURIComponent(navPath)}` : '';
      const res = await fetchApi(`/api/files${params}`);
      if (!res.ok) throw new Error('Directory not found');
      currentPath = navPath;
      files = await res.json();
    } catch {
      toast.error('Invalid path — directory not found', { key: 'path-nav' });
    }
    // Sync active tab
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.path = currentPath;
      activeTab.label = tabLabel(currentPath);
      tabs = [...tabs];
      saveTabs();
    }
  }

  // Upload
  async function uploadFile(file: File, relativePath?: string) {
    const entry = { name: relativePath || file.name, progress: 0, done: false };
    uploadQueue = [...uploadQueue, entry];
    uploading = true;

    const formData = new FormData();
    formData.append('file', file);
    if (currentPath) formData.append('path', currentPath);
    if (relativePath) formData.append(`relativePath_0`, relativePath);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        entry.progress = Math.round((e.loaded / e.total) * 100);
        uploadProgress = Math.round(uploadQueue.reduce((s, q) => s + q.progress, 0) / uploadQueue.length);
        uploadQueue = [...uploadQueue];
      }
    };
    await new Promise<void>((resolve, reject) => {
      xhr.onload = () => {
        entry.done = true;
        entry.progress = 100;
        uploadQueue = [...uploadQueue];
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', '/api/files');
      xhr.send(formData);
    });
  }

  let autoClearTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleQueueClear() {
    if (autoClearTimer) clearTimeout(autoClearTimer);
    autoClearTimer = setTimeout(() => (uploadQueue = []), 5000);
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const items = e.dataTransfer?.items;

    if (items) {
      const fileList: { file: File; path: string }[] = [];

      // Try to get directory entries (for folder drops)
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          await collectEntries(entry, '', fileList);
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) fileList.push({ file, path: '' });
        }
      }

      uploadQueue = [];
      for (const { file, path } of fileList) {
        await uploadFile(file, path || undefined);
      }
    }

    uploading = false;
    await refreshFiles();
    scheduleQueueClear();
  }

  async function collectEntries(entry: any, basePath: string, result: { file: File; path: string }[]) {
    if (entry.isFile) {
      const file: File = await new Promise((resolve) => entry.file(resolve));
      result.push({ file, path: basePath ? `${basePath}/${entry.name}` : '' });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries: any[] = await new Promise((resolve) => reader.readEntries(resolve));
      for (const child of entries) {
        await collectEntries(child, basePath ? `${basePath}/${entry.name}` : entry.name, result);
      }
    }
  }

  async function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) {
      uploadQueue = [];
      for (const file of input.files) {
        // For folder upload, webkitRelativePath contains the relative path
        const relPath = (file as any).webkitRelativePath || '';
        await uploadFile(file, relPath || undefined);
      }
      input.value = '';
      uploading = false;
      await refreshFiles();
      scheduleQueueClear();
    }
  }

  async function handleFolderInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) {
      uploadQueue = [];
      for (const file of input.files) {
        const relPath = (file as any).webkitRelativePath || file.name;
        await uploadFile(file, relPath);
      }
      input.value = '';
      uploading = false;
      await refreshFiles();
      scheduleQueueClear();
    }
  }

  // Create directory
  async function createDir() {
    if (!newDirName.trim()) return;
    try {
      const res = await fetchApi('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDirName.trim(), path: currentPath || undefined }),
      });
      if (!res.ok) throw new Error('Failed to create directory');
      newDirName = '';
      showNewDir = false;
      await refreshFiles();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to create directory'));
    }
  }

  async function refreshFiles() {
    dropdownDirs = new Map();
    folderSizes = new Map();
    try {
      const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
      const res = await fetchApi(`/api/files${params}`);
      if (!res.ok) throw new Error('Failed to load files');
      files = await res.json();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to refresh files'));
    }
  }

  // Delete confirmation
  let confirmDeleteTarget = $state<{ name: string; isDir: boolean } | null>(null);
  let showDeleteConfirm = $state(false);

  function requestDelete(name: string, isDir: boolean) {
    confirmDeleteTarget = { name, isDir };
    showDeleteConfirm = true;
  }

  async function confirmDelete() {
    if (!confirmDeleteTarget) return;
    const { name, isDir } = confirmDeleteTarget;
    confirmDeleteTarget = null;
    if (isDir) {
      await doDeleteDir(name);
    } else {
      await doDeleteFile(name);
    }
  }

  async function doDeleteFile(filename: string) {
    try {
      const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
      const res = await fetchApi(`/api/files/${encodeURIComponent(filename)}${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete ${filename}`);
      toast.success(`Deleted ${filename}`);
      await refreshFiles();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to delete file'), { key: 'delete-file' });
    }
  }

  async function doDuplicate(filename: string) {
    try {
      const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
      const res = await fetchApi(`/api/files/${encodeURIComponent(filename)}${params}`, { method: 'POST' });
      if (!res.ok) throw new Error('Duplicate failed');
      const data = await res.json();
      toast.success(`Created ${data.name}`);
      await refreshFiles();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to duplicate file'), { key: 'duplicate-file' });
    }
  }

  async function doDeleteDir(name: string) {
    try {
      const params = currentPath ? `path=${encodeURIComponent(currentPath)}&dir=true` : 'dir=true';
      const res = await fetchApi(`/api/files/${encodeURIComponent(name)}?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete directory ${name}`);
      toast.success(`Deleted folder ${name}`);
      await refreshFiles();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to delete directory'), { key: 'delete-file' });
    }
  }

  function fileTypeIcon(file: FileInfo): string {
    if (file.isDirectory) return 'folder';
    const mime = file.mime;
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'film';
    if (mime.startsWith('audio/')) return 'music';
    if (mime === 'application/pdf') return 'file-text';
    if (mime === 'application/epub+zip') return 'book-open';
    if (mime.startsWith('text/')) return 'file-text';
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('compress')) return 'archive';
    if (mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) return 'code';
    return 'file';
  }

  // --- Inline terminal ---
  let terminalOpen = $state(false);
  let terminalEl = $state<HTMLDivElement | null>(null);
  let terminalInstance: any = null;
  let terminalFitAddon: any = null;
  let terminalWs: WebSocket | null = null;
  let terminalConnected = $state(false);
  let terminalCwd = $state('');
  let terminalSessionId = $state<string | null>(null);
  let terminalResizeObserver: ResizeObserver | null = null;
  let terminalHeight = $state(200);
  let terminalResizing = $state(false);
  let terminalResizeStartY = 0;
  let terminalResizeStartH = 0;

  async function initTerminal() {
    if (!browser || terminalInstance) return;

    const xtermMod = await import('@xterm/xterm');
    const fitMod = await import('@xterm/addon-fit');
    const Terminal = xtermMod.Terminal;
    const FitAddon = fitMod.FitAddon;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e1e4e8',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#d2a8ff',
        cyan: '#76e3ea',
        white: '#e1e4e8',
        brightBlack: '#484f58',
        brightRed: '#f85149',
        brightGreen: '#3fb950',
        brightYellow: '#d29922',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#76e3ea',
        brightWhite: '#f0f6fc',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    terminalInstance = term;
    terminalFitAddon = fit;

    // Wait for element to be available
    await new Promise((r) => setTimeout(r, 0));
    if (terminalEl) {
      term.open(terminalEl);
      fit.fit();
      connectTerminal(term);

      term.onData((data: string) => {
        if (terminalWs?.readyState === WebSocket.OPEN) {
          terminalWs.send(JSON.stringify({ type: 'input', data }));
        }
      });

      terminalResizeObserver = new ResizeObserver(() => {
        fit.fit();
        if (terminalWs?.readyState === WebSocket.OPEN && term) {
          terminalWs.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      });
      terminalResizeObserver.observe(terminalEl);
    }
  }

  function connectTerminal(term: any) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const cols = term?.cols || 80;
    const rows = term?.rows || 24;
    const cwd = currentPath || '';
    const sessionParam = terminalSessionId ? `&session=${terminalSessionId}` : '';
    const cwdParam = cwd ? `&cwd=${encodeURIComponent(cwd)}` : '';
    const url = `${protocol}//${location.host}/ws/terminal?cols=${cols}&rows=${rows}${sessionParam}${cwdParam}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      terminalConnected = true;
      terminalCwd = currentPath || '~';
      term?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          term?.write(msg.data);
        } else if (msg.type === 'session') {
          terminalSessionId = msg.id;
        } else if (msg.type === 'exit') {
          terminalConnected = false;
          term?.write('\r\n\x1b[33m[Shell exited]\x1b[0m\r\n');
        }
      } catch {}
    };

    ws.onclose = () => {
      terminalConnected = false;
    };

    ws.onerror = () => {
      term?.write('\r\n\x1b[31m[WebSocket error]\x1b[0m\r\n');
    };

    terminalWs = ws;
  }

  function destroyTerminal() {
    terminalWs?.close();
    terminalWs = null;
    terminalInstance?.dispose();
    terminalInstance = null;
    terminalFitAddon = null;
    terminalConnected = false;
    terminalSessionId = null;
    terminalResizeObserver?.disconnect();
    terminalResizeObserver = null;
  }

  function toggleTerminal() {
    terminalOpen = !terminalOpen;
    if (terminalOpen && !terminalInstance) {
      // Delay so the element is rendered
      setTimeout(() => initTerminal(), 0);
    }
    if (terminalOpen && terminalInstance && terminalFitAddon) {
      setTimeout(() => {
        terminalFitAddon.fit();
        terminalInstance?.focus();
      }, 50);
    }
  }

  function handleTerminalResizeStart(e: MouseEvent) {
    e.preventDefault();
    terminalResizing = true;
    terminalResizeStartY = e.clientY;
    terminalResizeStartH = terminalHeight;
    window.addEventListener('mousemove', handleTerminalResizeMove);
    window.addEventListener('mouseup', handleTerminalResizeEnd);
  }

  function handleTerminalResizeMove(e: MouseEvent) {
    if (!terminalResizing) return;
    const delta = terminalResizeStartY - e.clientY;
    terminalHeight = Math.max(100, Math.min(600, terminalResizeStartH + delta));
    terminalFitAddon?.fit();
  }

  function handleTerminalResizeEnd() {
    terminalResizing = false;
    window.removeEventListener('mousemove', handleTerminalResizeMove);
    window.removeEventListener('mouseup', handleTerminalResizeEnd);
    terminalFitAddon?.fit();
  }

  onMount(() => {
    initTabs(initialPath || '');
    return useShortcuts([
      { ...SHORTCUT_DEFAULTS.find((d) => d.id === 'files:refresh')!, handler: () => refreshFiles() },
      { ...SHORTCUT_DEFAULTS.find((d) => d.id === 'files:focus-search')!, handler: () => searchInputEl?.focus() },
      { ...SHORTCUT_DEFAULTS.find((d) => d.id === 'files:new-folder')!, handler: () => (showNewDir = true) },
      {
        ...SHORTCUT_DEFAULTS.find((d) => d.id === 'files:go-up')!,
        handler: () => {
          if (breadcrumbs.length > 1) {
            goto(`/files?path=${encodeURIComponent(breadcrumbs[breadcrumbs.length - 2].path)}`);
          }
        },
      },
      {
        ...SHORTCUT_DEFAULTS.find((d) => d.id === 'files:toggle-view')!,
        handler: () => setViewMode(viewMode === 'list' ? 'grid' : 'list'),
      },
    ]);
  });

  onDestroy(() => {
    destroyTerminal();
  });
</script>

<svelte:head>
  <title>Files | Home Server</title>
  <link rel="stylesheet" href="/xterm.css" />
</svelte:head>

<!-- Page header toolbar -->
<div class="page-header">
  <h2 class="page-title">Files</h2>
  <div class="page-actions">
    <Button size="sm" icon="refresh" onclick={refreshFiles}>Refresh</Button>
    <label class="upload-btn-label">
      <Button size="sm" variant="accent" icon="upload">Upload</Button>
      <input type="file" multiple onchange={handleFileInput} class="upload-hidden-input" />
    </label>
    <span class="file-count">{filtered.length} of {files.length} items</span>
  </div>
</div>
<p class="page-desc">Browse, upload, and manage files on your server. Star files for quick dashboard access.</p>

<!-- Tab bar -->
{#if tabs.length > 0}
  <div class="file-tabs">
    {#each tabs as tab (tab.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="file-tab"
        class:active={tab.id === activeTabId}
        role="button"
        tabindex="0"
        onclick={() => switchTab(tab.id)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && switchTab(tab.id)}
        title={tab.path || 'Root'}
      >
        <Icon name={tab.path ? 'folder' : 'home'} size={12} />
        <span class="file-tab-label">{tab.label}</span>
        {#if tabs.length > 1}
          <button
            class="file-tab-close"
            onclick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            title="Close tab"
          >
            <Icon name="close" size={10} />
          </button>
        {/if}
      </div>
    {/each}
    <button class="file-tab file-tab-add" onclick={() => addTab()} title="New tab">
      <Icon name="add" size={12} />
    </button>
  </div>
{/if}

<!-- Upload area -->
<div class="upload-area">
  <div
    class="drop-zone"
    class:active={dragOver}
    ondragover={(e) => {
      e.preventDefault();
      dragOver = true;
    }}
    ondragleave={() => (dragOver = false)}
    ondrop={handleDrop}
    role="region"
    aria-label="File upload area"
  >
    <Icon name="upload" size={18} />
    <span class="drop-hint-text">
      Drop files or folders, or
      <label class="file-label">browse files<input type="file" multiple onchange={handleFileInput} /></label>
      ·
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <label class="file-label">upload folder<input type="file" onchange={handleFolderInput} webkitdirectory /></label>
    </span>
  </div>

  {#if uploadQueue.length > 0}
    {@const doneCount = uploadQueue.filter((q) => q.done).length}
    <div class="upload-queue">
      <div class="upload-queue-header">
        <span class="upload-queue-title">
          {#if uploading}
            Uploading {uploadQueue.length}
            {uploadQueue.length === 1 ? 'file' : 'files'}…
          {:else}
            {doneCount} of {uploadQueue.length} uploaded
          {/if}
        </span>
        {#if uploading}
          <span class="upload-queue-pct">{uploadProgress}%</span>
        {/if}
        <button
          class="upload-queue-close"
          onclick={() => (uploadQueue = [])}
          title="Dismiss"
          aria-label="Dismiss upload queue">×</button
        >
      </div>
      <div class="upload-queue-list">
        {#each uploadQueue as q}
          <div class="upload-q-item" class:done={q.done}>
            <span class="upload-q-name" title={q.name}>{q.name}</span>
            <span class="upload-q-pct">{q.done ? '✓' : `${q.progress}%`}</span>
            <div class="upload-q-bar">
              <div class="upload-q-fill" style="width: {q.progress}%"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Editable path bar (below upload) -->
<nav class="path-bar">
  {#if editingPath}
    <input
      type="text"
      class="path-input"
      bind:value={pathInputValue}
      onkeydown={handlePathKey}
      onblur={cancelEditingPath}
    />
    <button
      class="path-edit-btn"
      onmousedown={(e) => {
        e.preventDefault();
        submitPathInput();
      }}>Go</button
    >
    <button
      class="path-edit-btn"
      onmousedown={(e) => {
        e.preventDefault();
        cancelEditingPath();
      }}>Cancel</button
    >
  {:else}
    <div class="path-segments">
      {#each breadcrumbs as crumb, i}
        {#if i > 0}<span class="crumb-sep">/</span>{/if}
        <div class="crumb-item">
          {#if i === breadcrumbs.length - 1}
            <span class="crumb-current">{crumb.name}</span>
          {:else}
            <button class="crumb-link" onclick={() => navigateTo(crumb.path)}>{crumb.name}</button>
          {/if}
          {#if !(i === 0 && browseMode === 'system')}
            <button
              class="crumb-chevron"
              class:open={openDropdownIdx === i}
              onclick={(e) => toggleDropdown(i, e)}
              title="Browse siblings">›</button
            >
          {/if}
          {#if openDropdownIdx === i}
            {@const parentPath = i === 0 ? '' : breadcrumbs[i - 1].path}
            <div class="crumb-dropdown">
              {#if dropdownLoading === parentPath}
                <div class="crumb-drop-loading">Loading…</div>
              {:else}
                {@const dirs = dropdownDirs.get(parentPath) ?? []}
                {#if dirs.length === 0}
                  <div class="crumb-drop-empty">No folders</div>
                {:else}
                  {#each dirs as dir}
                    <button
                      class="crumb-drop-item"
                      class:active={dir === crumb.name}
                      onclick={() => navigateToSibling(parentPath, dir)}>{dir}</button
                    >
                  {/each}
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <span class="abs-path" title={absolutePath}>{absolutePath}</span>
    <button class="path-edit-btn" onclick={startEditingPath} title="Edit path"><Icon name="edit" size={14} /></button>
  {/if}
</nav>

<!-- Search, filter, and view toggle bar -->
<div class="file-controls">
  <div class="search-wrap">
    <SearchInput
      bind:value={search}
      bind:inputEl={searchInputEl}
      placeholder={searchScope === 'all' ? 'Search all files...' : 'Search this folder...'}
      oninput={() => handleSearchInput()}
    />
    <div class="search-scope-toggle">
      <button
        class="scope-btn"
        class:active={searchScope === 'folder'}
        onclick={() => {
          searchScope = 'folder';
          showGlobalResults = false;
          globalResults = [];
        }}>This folder</button
      >
      <button
        class="scope-btn"
        class:active={searchScope === 'all'}
        onclick={() => {
          searchScope = 'all';
          handleSearchInput();
        }}>All files</button
      >
    </div>
    {#if searchScope === 'all'}
      <button
        class="wildcard-toggle"
        class:active={wildcardMode}
        title="Wildcard search — use * and ? patterns (e.g. *.jpg, report-???.pdf)"
        onclick={() => {
          wildcardMode = !wildcardMode;
          handleSearchInput();
        }}
      >
        <span class="wildcard-icon">*</span>
        {#if wildcardMode}
          <span class="wildcard-label">wildcard</span>
        {/if}
      </button>
    {/if}
    {#if showGlobalResults && searchScope === 'all'}
      <div class="global-results">
        {#if globalSearching}
          <div class="global-result-item global-searching">Searching...</div>
        {:else if globalResults.length === 0}
          <div class="global-result-item global-empty">No files found</div>
        {:else}
          {#each globalResults as result}
            <button class="global-result-item" onclick={() => navigateToSearchResult(result)}>
              <span class="global-result-name">{result.name}</span>
              <span class="global-result-path">{result.path}</span>
              <span class="global-result-size">{formatSize(result.size)}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
  {#if uniqueTypes.length > 1}
    <select class="type-filter" bind:value={typeFilter}>
      <option value="">All types</option>
      {#each uniqueTypes as t}
        <option value={t}>{t}</option>
      {/each}
    </select>
  {/if}
  <div class="view-toggle">
    <button class="view-btn" class:active={viewMode === 'list'} onclick={() => setViewMode('list')} title="List view"
      ><Icon name="list" size={14} /></button
    >
    <button class="view-btn" class:active={viewMode === 'grid'} onclick={() => setViewMode('grid')} title="Grid view"
      ><Icon name="grid" size={14} /></button
    >
  </div>
</div>

<!-- Secondary bar: New Folder + Terminal -->
<div class="secondary-bar">
  {#if showNewDir}
    <div class="new-dir-bar">
      <input
        type="text"
        class="new-dir-input"
        bind:value={newDirName}
        placeholder="Folder name"
        onkeydown={(e) => {
          if (e.key === 'Enter') createDir();
          if (e.key === 'Escape') showNewDir = false;
        }}
      />
      <Button size="sm" onclick={createDir} disabled={!newDirName.trim()}>Create</Button>
      <Button size="sm" onclick={() => (showNewDir = false)}>Cancel</Button>
    </div>
  {:else}
    <Button size="sm" onclick={() => (showNewDir = !showNewDir)}>New Folder</Button>
  {/if}
  <Button size="sm" variant={terminalOpen ? 'accent' : 'default'} onclick={toggleTerminal}
    >{terminalOpen ? 'Hide Terminal' : 'Terminal'}</Button
  >
</div>

<!-- Bulk action bar -->
{#if selectedFiles.size > 0}
  <div class="bulk-bar">
    <span class="bulk-count">{selectedFiles.size} selected</span>
    <div class="bulk-actions">
      <Button size="sm" onclick={clearSelection}>Clear</Button>
      {#if selectedMediaCount > 0}
        <Button size="sm" variant="accent" onclick={playSelected}
          ><Icon name="play" size={14} /> Play {selectedMediaCount} Media</Button
        >
      {/if}
      <a href={zipDownloadUrl()} class="btn btn-sm" download="files.zip">Download Zip</a>
      <Button size="sm" variant="danger" confirm onclick={deleteSelected}>Delete Selected</Button>
    </div>
  </div>
{/if}

<!-- File list -->
{#if files.length === 0}
  <p class="empty">No files yet. Upload something to get started.</p>
{:else if filtered.length === 0}
  <p class="empty">No files match your search.</p>
{:else if viewMode === 'grid'}
  <!-- Grid view -->
  <div class="file-grid">
    {#each filtered as file}
      <div class="grid-card" class:selected={selectedFiles.has(file.name)} class:starred={isFileStarred(file.name)}>
        <div class="grid-card-top">
          {#if !file.isDirectory}
            <input type="checkbox" checked={selectedFiles.has(file.name)} onchange={() => toggleSelect(file.name)} />
          {/if}
          <button
            class="star-btn"
            class:starred={isFileStarred(file.name)}
            title={isFileStarred(file.name) ? 'Unstar' : 'Star'}
            onclick={() => toggleStar(file.name)}>{isFileStarred(file.name) ? '\u2605' : '\u2606'}</button
          >
        </div>
        <button
          class="grid-card-body"
          onclick={() => {
            if (file.isDirectory) {
              navigateTo(currentPath ? `${currentPath}/${file.name}` : file.name);
            } else if (isMediaFile(file)) {
              openMediaPlayer(file);
            } else if (isPreviewable(file)) {
              openPreview(file);
            }
          }}
        >
          <span class="grid-icon"><Icon name={fileTypeIcon(file)} size={24} /></span>
          <span class="grid-name" title={file.name}>{file.name}</span>
          {#if !file.isDirectory}
            <span class="grid-size">{formatSize(file.size)}</span>
          {/if}
        </button>
        <div class="grid-card-actions">
          <button class="action-btn" title="Rename" onclick={() => startRename(file)}>
            <Icon name="edit" size={13} />
          </button>
          <button class="action-btn" title="Copy path" onclick={() => copyPath(file)}>
            <Icon name="copy" size={13} />
          </button>
          {#if !file.isDirectory}
            <button class="action-btn" title="Duplicate" onclick={() => doDuplicate(file.name)}>
              <Icon name="duplicate" size={13} />
            </button>
            <a href={downloadUrl(file.name)} class="action-btn" title="Download" download={file.name}>
              <Icon name="download" size={13} />
            </a>
          {/if}
          <button
            class="action-btn action-btn-danger"
            title={file.isDirectory ? 'Delete folder' : 'Delete file'}
            onclick={() => requestDelete(file.name, file.isDirectory)}
          >
            <Icon name="delete" size={13} />
          </button>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <!-- List view -->
  <div class="file-list">
    <div class="file-header">
      <span class="col-check">
        <input
          type="checkbox"
          title="Select all"
          checked={selectedFiles.size > 0 &&
            filtered.filter((f) => !f.isDirectory).every((f) => selectedFiles.has(f.name))}
          onchange={(e) => ((e.currentTarget as HTMLInputElement).checked ? selectAll() : clearSelection())}
        />
      </span>
      <span class="col-star"></span>
      <button class="col-name sortable" onclick={() => sort.toggle('name')}
        >Name{#if sort.activeDir('name') === 'asc'}
          <Icon name="sort-asc" size={12} />{:else if sort.activeDir('name') === 'desc'}
          <Icon name="sort-desc" size={12} />{/if}</button
      >
      <button class="col-type sortable" onclick={() => sort.toggle('mime')}
        >Type{#if sort.activeDir('mime') === 'asc'}
          <Icon name="sort-asc" size={12} />{:else if sort.activeDir('mime') === 'desc'}
          <Icon name="sort-desc" size={12} />{/if}</button
      >
      <button class="col-size sortable" onclick={() => sort.toggle('size')}
        >Size{#if sort.activeDir('size') === 'asc'}
          <Icon name="sort-asc" size={12} />{:else if sort.activeDir('size') === 'desc'}
          <Icon name="sort-desc" size={12} />{/if}</button
      >
      <button class="col-date sortable" onclick={() => sort.toggle('modified')}
        >Modified{#if sort.activeDir('modified') === 'asc'}
          <Icon name="sort-asc" size={12} />{:else if sort.activeDir('modified') === 'desc'}
          <Icon name="sort-desc" size={12} />{/if}</button
      >
      <span class="col-actions"></span>
    </div>
    {#each filtered as file}
      <div class="file-row" class:selected={selectedFiles.has(file.name)} class:starred={isFileStarred(file.name)}>
        <span class="col-check">
          {#if !file.isDirectory}
            <input type="checkbox" checked={selectedFiles.has(file.name)} onchange={() => toggleSelect(file.name)} />
          {/if}
        </span>
        <span class="col-star">
          <button
            class="star-btn"
            class:starred={isFileStarred(file.name)}
            title={isFileStarred(file.name) ? 'Unstar' : 'Star'}
            onclick={() => toggleStar(file.name)}>{isFileStarred(file.name) ? '\u2605' : '\u2606'}</button
          >
        </span>
        <span class="col-name" title={file.name}>
          {#if renamingFile === file.name}
            <input
              class="rename-input"
              type="text"
              bind:value={renameValue}
              onkeydown={(e) => handleRenameKey(e, file.name)}
              onblur={() => submitRename(file.name)}
            />
          {:else if file.isDirectory}
            <button
              class="name-btn dir-btn"
              onclick={() => navigateTo(currentPath ? `${currentPath}/${file.name}` : file.name)}
            >
              <Icon name={fileTypeIcon(file)} size={14} />
              {file.name}
            </button>
          {:else}
            <span class="name-with-play">
              {#if isMediaFile(file)}
                <button
                  class="play-inline-btn"
                  title="Play media"
                  onclick={(e) => {
                    e.stopPropagation();
                    openMediaPlayer(file);
                  }}><Icon name="play" size={12} /></button
                >
                <span class="media-icon"><Icon name={getMediaIcon(file)} size={14} /></span>
              {/if}
              <button class="name-btn" class:previewable={isPreviewable(file)} onclick={() => openPreview(file)}>
                {file.name}
              </button>
            </span>
          {/if}
        </span>
        <span class="col-type" title={file.mime}>{file.mime.split('/')[1] || file.mime}</span>
        <span class="col-size">
          {#if file.isDirectory}
            {@const sizeKey = getFolderSizeKey(file)}
            {@const sizeVal = folderSizes.get(sizeKey)}
            {#if sizeVal === 'loading'}
              <span class="size-text size-computing"><Icon name="loader" size={11} class="spin" /></span>
            {:else if typeof sizeVal === 'number'}
              <span class="size-text">{formatSize(sizeVal)}</span>
            {:else}
              <span class="size-text size-computing">—</span>
            {/if}
          {:else}
            <span class="size-text">{formatSize(file.size)}</span>
            <span class="size-bar-track" title="{((file.size / maxFileSize) * 100).toFixed(1)}% of largest file">
              <span class="size-bar-fill" style="width: {(file.size / maxFileSize) * 100}%"></span>
            </span>
          {/if}
        </span>
        <span class="col-date">{formatDate(file.modified)}</span>
        <span class="col-actions">
          <button
            class="action-btn"
            title="Info"
            onclick={() => (infoFile = infoFile?.name === file.name ? null : file)}
          >
            <Icon name="info" size={13} />
          </button>
          <button class="action-btn" title="Rename" onclick={() => startRename(file)}>
            <Icon name="edit" size={13} />
          </button>
          <button class="action-btn" title="Copy path" onclick={() => copyPath(file)}>
            <Icon name="copy" size={13} />
          </button>
          {#if !file.isDirectory}
            <button class="action-btn" title="Duplicate" onclick={() => doDuplicate(file.name)}>
              <Icon name="duplicate" size={13} />
            </button>
            <a href={downloadUrl(file.name)} class="action-btn" title="Download" download={file.name}>
              <Icon name="download" size={13} />
            </a>
          {/if}
          <button
            class="action-btn action-btn-danger"
            title={file.isDirectory ? 'Delete folder' : 'Delete file'}
            onclick={() => requestDelete(file.name, file.isDirectory)}
          >
            <Icon name="delete" size={13} />
          </button>
        </span>
      </div>
      {#if infoFile?.name === file.name}
        <div class="info-panel">
          <div class="info-grid">
            <span class="info-label">MIME</span><span>{file.mime}</span>
            <span class="info-label">Size</span><span>{formatSize(file.size)} ({file.size.toLocaleString()} bytes)</span
            >
            <span class="info-label">Created</span><span>{formatDate(file.created)}</span>
            <span class="info-label">Modified</span><span>{formatDate(file.modified)}</span>
            <span class="info-label">Permissions</span><span><code>{file.permissions}</code></span>
            {#if file.meta?.uploadedFrom}
              <span class="info-label">Uploaded from</span><span>{file.meta.uploadedFrom}</span>
            {/if}
            {#if file.meta?.uploadedAt}
              <span class="info-label">Uploaded at</span><span>{formatDate(file.meta.uploadedAt)}</span>
            {/if}
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<!-- Preview Modal -->
{#if previewFile}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closePreview} role="dialog" tabindex="-1" aria-label="File preview">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>{previewFile.name}</h3>
        <div class="modal-actions">
          <a href={downloadUrl(previewFile.name)} class="btn btn-sm">dl</a>
          <button class="btn btn-sm" onclick={closePreview}>close</button>
        </div>
      </div>
      <div class="modal-body">
        {#if previewCategory(previewFile) === 'media'}
          {#if mediaType(previewFile.mime) === 'image'}
            <img src={previewUrl(previewFile.name)} alt={previewFile.name} />
          {:else if mediaType(previewFile.mime) === 'video'}
            <video controls src={previewUrl(previewFile.name)}>
              <track kind="captions" />
            </video>
          {:else if mediaType(previewFile.mime) === 'audio'}
            <audio controls src={previewUrl(previewFile.name)}></audio>
          {:else}
            <iframe src={previewUrl(previewFile.name)} title={previewFile.name}></iframe>
          {/if}
        {:else if previewCategory(previewFile) === 'document'}
          {#if renderLoading}
            <p class="loading">Rendering...</p>
          {:else if renderResult?.type === 'data'}
            {#if renderResult.sheets.length > 1}
              <div class="sheet-tabs">
                {#each renderResult.sheets as sheet, i}
                  <button class="sheet-tab" class:active={activeSheet === i} onclick={() => (activeSheet = i)}
                    >{sheet.name}</button
                  >
                {/each}
              </div>
            {/if}
            {#if renderResult.sheets[activeSheet]}
              <DataTable
                headers={renderResult.sheets[activeSheet].headers}
                rows={renderResult.sheets[activeSheet].rows}
              />
            {/if}
          {:else if renderResult?.type === 'html'}
            <div class="rendered-doc">{@html renderResult.content}</div>
          {:else if renderResult?.type === 'text'}
            <pre>{renderResult.content}</pre>
          {:else}
            <p class="loading">Unable to render this file.</p>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Media Player Modal -->
{#if mediaPlayerOpen}
  <MediaPlayer
    src={mediaPlayerSrc}
    type={mediaPlayerType}
    filename={mediaPlayerFilename}
    onclose={closeMediaPlayer}
    playlist={mediaPlaylist}
    currentIndex={mediaPlaylistIndex}
    onchangetrack={onChangeTrack}
  />
{/if}

<!-- Inline Terminal Panel -->
{#if terminalOpen}
  <div class="inline-terminal-panel">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="terminal-resize-handle" onmousedown={handleTerminalResizeStart}></div>
    <div class="terminal-panel-header">
      <div class="terminal-panel-info">
        <span class="terminal-panel-title">Terminal</span>
        <span class="terminal-panel-dot" class:connected={terminalConnected}></span>
        <span class="terminal-panel-cwd" title={terminalCwd}>cwd: {terminalCwd || '~'}</span>
      </div>
      <div class="terminal-panel-actions">
        <Button
          size="xs"
          onclick={() => {
            destroyTerminal();
            terminalOpen = false;
          }}>Close</Button
        >
      </div>
    </div>
    <div class="terminal-panel-body" style="height: {terminalHeight}px;" bind:this={terminalEl}></div>
  </div>
{/if}

<!-- Delete Confirmation Dialog -->
<ConfirmDialog
  bind:open={showDeleteConfirm}
  title="Delete {confirmDeleteTarget?.isDir ? 'folder' : 'file'}?"
  message={confirmDeleteTarget
    ? `Are you sure you want to delete "${confirmDeleteTarget.name}"?${confirmDeleteTarget.isDir ? ' This will delete all contents inside the folder.' : ''} This action cannot be undone.`
    : ''}
  confirmLabel="Delete"
  confirmVariant="danger"
  confirmIcon="delete"
  onconfirm={confirmDelete}
/>

<style>
  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 1.3rem;
  }

  .page-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .file-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .upload-btn-label {
    position: relative;
    cursor: pointer;
  }

  .upload-hidden-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .page-desc {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 16px;
  }

  /* File tabs */
  .file-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .file-tabs::-webkit-scrollbar {
    display: none;
  }
  .file-tab {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    font-size: 0.78rem;
    font-family: inherit;
    background: none;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    position: relative;
    bottom: -1px;
    transition: all 0.15s;
  }
  .file-tab:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .file-tab.active {
    color: var(--text-primary);
    background: var(--bg-secondary);
    border-color: var(--border);
    border-bottom-color: var(--bg-secondary);
    font-weight: 500;
  }
  .file-tab-label {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file-tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    border-radius: 3px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .file-tab:hover .file-tab-close {
    opacity: 1;
  }
  .file-tab-close:hover {
    background: var(--bg-hover);
    color: var(--danger);
  }
  .file-tab-add {
    padding: 6px 8px;
    color: var(--text-muted);
  }
  .file-tab-add:hover {
    color: var(--accent);
  }

  /* Secondary bar (New Folder + Terminal) */
  .secondary-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  /* Editable path bar */
  .path-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
    font-size: 0.8rem;
    padding: 4px 8px;
    background: transparent;
    border-radius: 0;
    overflow: visible;
    font-family: 'JetBrains Mono', monospace;
  }

  .path-segments {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  .path-input {
    flex: 1;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    padding: 4px 8px;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    outline: none;
  }

  .path-edit-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-family: inherit;
    white-space: nowrap;
  }
  .path-edit-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .crumb-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: inherit;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .crumb-link:hover {
    background: var(--accent-bg);
  }
  .crumb-sep {
    color: var(--text-faint);
  }
  .crumb-current {
    color: var(--text-primary);
    font-weight: 500;
  }

  .crumb-item {
    position: relative;
    display: flex;
    align-items: center;
  }

  .crumb-chevron {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0 2px;
    line-height: 1;
    opacity: 0.5;
    transition: opacity 0.1s;
  }
  .crumb-item:hover .crumb-chevron,
  .crumb-chevron.open {
    opacity: 1;
    color: var(--accent);
  }

  .crumb-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    min-width: 160px;
    max-width: 280px;
    max-height: 240px;
    overflow-y: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    padding: 4px 0;
  }

  .crumb-drop-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    padding: 5px 12px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .crumb-drop-item:hover {
    background: var(--accent-bg);
  }
  .crumb-drop-item.active {
    color: var(--accent);
    font-weight: 600;
  }

  .crumb-drop-loading,
  .crumb-drop-empty {
    padding: 8px 12px;
    font-size: 0.75rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  .abs-path {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
    flex-shrink: 1;
    padding: 0 4px;
    cursor: default;
  }

  /* New folder */
  .new-dir-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    align-items: center;
  }

  .new-dir-input {
    flex: 1;
    max-width: 300px;
    padding: 6px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  .new-dir-input:focus {
    outline: none;
  }

  .dir-btn {
    color: var(--accent) !important;
    cursor: pointer !important;
  }

  .dir-btn:hover {
    text-decoration: underline;
  }

  .file-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }

  .search-wrap {
    flex: 1;
    position: relative;
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .search-scope-toggle {
    display: flex;
    gap: 2px;
  }

  .scope-btn {
    padding: 6px 10px;
    font-size: 0.72rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .scope-btn.active {
    background: var(--accent-bg);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .scope-btn:hover:not(.active) {
    color: var(--text-primary);
  }

  .global-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: 320px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .global-result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    font-size: 0.8rem;
    border: none;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }

  .global-result-item:hover {
    background: var(--bg-secondary);
  }

  .global-result-item.global-searching,
  .global-result-item.global-empty {
    color: var(--text-muted);
    cursor: default;
    justify-content: center;
  }

  .global-result-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .global-result-path {
    flex: 1;
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .global-result-size {
    font-size: 0.7rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .type-filter {
    padding: 7px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
  }

  .sortable:hover {
    color: var(--text-primary);
  }

  /* ── Upload area ───────────────────────────────── */
  .upload-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .drop-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 1.5px dashed var(--border);
    border-radius: 8px;
    padding: 14px 20px;
    color: var(--text-faint);
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
    cursor: default;
  }

  .drop-zone.active {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
  }

  .drop-hint-text {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .file-label {
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
  }
  .file-label:hover {
    color: color-mix(in srgb, var(--accent) 75%, white);
  }

  .file-label input {
    display: none;
  }

  /* Upload queue panel */
  .upload-queue {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .upload-queue-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .upload-queue-title {
    flex: 1;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .upload-queue-pct {
    font-size: 0.75rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  .upload-queue-close {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 1.1rem;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
  }
  .upload-queue-close:hover {
    color: var(--text-primary);
  }

  .upload-queue-list {
    max-height: 192px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .upload-q-item {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto 3px;
    gap: 0 8px;
    padding: 5px 12px 6px;
    align-items: center;
  }

  .upload-q-name {
    font-size: 0.78rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    grid-column: 1;
    grid-row: 1;
  }

  .upload-q-pct {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    grid-column: 2;
    grid-row: 1;
  }

  .upload-q-bar {
    grid-column: 1 / -1;
    grid-row: 2;
    background: var(--border-subtle);
    border-radius: 2px;
    overflow: hidden;
    height: 3px;
    margin-top: 3px;
  }

  .upload-q-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.1s ease;
  }

  .upload-q-item.done .upload-q-fill {
    background: var(--success);
  }

  .upload-q-item.done .upload-q-name {
    color: var(--text-faint);
  }

  .upload-q-item.done .upload-q-pct {
    color: var(--success);
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }

  .file-list {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .file-header,
  .file-row {
    display: grid;
    grid-template-columns: 28px 28px 1fr 90px 120px 160px 130px;
    padding: 10px 16px;
    align-items: center;
    gap: 8px;
  }

  .file-header {
    background: var(--bg-secondary);
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .file-row {
    border-top: 1px solid var(--border-subtle);
    font-size: 0.85rem;
  }

  .file-row:hover {
    background: var(--bg-secondary);
  }

  .col-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: default;
    padding: 0;
    font: inherit;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .name-btn.previewable {
    color: var(--accent);
    cursor: pointer;
  }

  .name-btn.previewable:hover {
    text-decoration: underline;
  }

  .rename-input {
    width: 100%;
    padding: 2px 6px;
    font-size: 0.85rem;
    border-radius: 4px;
    border: 1px solid var(--accent);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  .col-type {
    color: var(--text-muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-date {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .col-actions {
    display: flex;
    gap: 2px;
    justify-content: flex-end;
    align-items: center;
  }

  /* Unified icon action button used in both list and grid views */
  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background 0.1s,
      color 0.1s;
    text-decoration: none;
    flex-shrink: 0;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .action-btn-danger:hover {
    background: color-mix(in srgb, var(--danger, #ef4444) 12%, transparent);
    color: var(--danger, #ef4444);
  }

  .size-computing {
    color: var(--text-faint);
    font-style: italic;
  }

  .size-computing :global(.spin svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .btn {
    padding: 3px 8px;
    font-size: 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    text-decoration: none;
    font-family: monospace;
  }

  .btn:hover {
    border-color: var(--accent);
  }

  /* Info panel */
  .info-panel {
    padding: 10px 16px 10px 32px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-inset);
  }

  .info-grid {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 4px 12px;
    font-size: 0.8rem;
  }

  .info-label {
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
  }

  .info-grid code {
    font-size: 0.8rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    min-width: 320px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h3 {
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .modal-body {
    padding: 16px;
    overflow: auto;
    max-height: 80vh;
  }

  .modal-body img {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 4px;
  }

  .modal-body video {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 4px;
  }

  .modal-body audio {
    width: 100%;
    min-width: 300px;
  }

  .modal-body iframe {
    width: 100%;
    min-width: 600px;
    height: 70vh;
    border: none;
    border-radius: 4px;
    background: white;
  }

  .modal-body pre {
    background: var(--code-bg);
    padding: 16px;
    border-radius: 6px;
    overflow: auto;
    max-height: 70vh;
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .loading {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }

  @keyframes pulse {
    from {
      opacity: 0.7;
    }
    to {
      opacity: 1;
    }
  }

  /* Sheet tabs (Excel multi-sheet) */
  .sheet-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .sheet-tab {
    padding: 5px 14px;
    font-size: 0.75rem;
    border-radius: 6px 6px 0 0;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }

  .sheet-tab:hover {
    color: var(--text-primary);
  }

  .sheet-tab.active {
    background: var(--code-bg);
    color: var(--text-primary);
    border-bottom-color: var(--code-bg);
  }

  /* Rendered document container (all renderer output) */
  .rendered-doc {
    max-height: 70vh;
    overflow: auto;
  }

  /* Markdown */
  .rendered-doc :global(.md-content) {
    line-height: 1.7;
    font-size: 0.9rem;
  }
  .rendered-doc :global(.md-content h1) {
    font-size: 1.5rem;
    margin: 16px 0 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
  }
  .rendered-doc :global(.md-content h2) {
    font-size: 1.3rem;
    margin: 14px 0 6px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 4px;
  }
  .rendered-doc :global(.md-content h3) {
    font-size: 1.1rem;
    margin: 12px 0 6px;
  }
  .rendered-doc :global(.md-content h4),
  .rendered-doc :global(.md-content h5),
  .rendered-doc :global(.md-content h6) {
    font-size: 1rem;
    margin: 10px 0 4px;
  }
  .rendered-doc :global(.md-content p) {
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content ul),
  .rendered-doc :global(.md-content ol) {
    padding-left: 24px;
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content li) {
    margin: 4px 0;
  }
  .rendered-doc :global(.md-content blockquote) {
    border-left: 3px solid var(--border);
    padding-left: 12px;
    color: var(--text-muted);
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 16px 0;
  }
  .rendered-doc :global(.md-content a) {
    color: var(--accent);
  }
  .rendered-doc :global(.md-content code) {
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .rendered-doc :global(.md-content pre) {
    background: var(--code-bg);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content pre code) {
    padding: 0;
    background: none;
  }
  .rendered-doc :global(.md-content strong) {
    color: var(--text-primary);
  }

  /* JSON tree viewer */
  .rendered-doc :global(.json-tree) {
    font-size: 0.8rem;
    line-height: 1.4;
    background: var(--code-bg);
    padding: 16px;
    border-radius: 6px;
    overflow: auto;
  }
  .rendered-doc :global(.jv-toggle) {
    display: none;
  }
  .rendered-doc :global(.jv-collapsible) {
    cursor: pointer;
  }
  .rendered-doc :global(.jv-collapsible:hover) {
    color: var(--accent);
  }
  .rendered-doc :global(.jv-count) {
    display: none;
    color: var(--text-faint);
    font-style: italic;
    font-size: 0.75rem;
  }
  .rendered-doc :global(.jv-toggle:not(:checked) ~ .jv-count) {
    display: inline;
  }
  .rendered-doc :global(.jv-toggle:not(:checked) ~ .jv-content) {
    display: none;
  }
  .rendered-doc :global(.jv-key) {
    color: #79c0ff;
  }
  .rendered-doc :global(.jv-string) {
    color: #a5d6ff;
  }
  .rendered-doc :global(.jv-number) {
    color: var(--purple);
  }
  .rendered-doc :global(.jv-bool) {
    color: #ff7b72;
  }
  .rendered-doc :global(.jv-null) {
    color: var(--text-faint);
    font-style: italic;
  }
  .rendered-doc :global(.jv-bracket) {
    color: var(--text-muted);
  }
  .rendered-doc :global(.jv-colon) {
    color: var(--text-muted);
  }
  .rendered-doc :global(.jv-comma) {
    color: var(--text-muted);
  }

  /* Word */
  .rendered-doc :global(.word-doc) {
    line-height: 1.7;
    font-size: 0.9rem;
  }
  .rendered-doc :global(.word-doc p) {
    margin: 8px 0;
  }
  .rendered-doc :global(.word-doc h1) {
    font-size: 1.5rem;
    margin: 16px 0 8px;
  }
  .rendered-doc :global(.word-doc h2) {
    font-size: 1.3rem;
    margin: 14px 0 6px;
  }
  .rendered-doc :global(.word-doc table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }
  .rendered-doc :global(.word-doc td),
  .rendered-doc :global(.word-doc th) {
    border: 1px solid var(--border);
    padding: 6px 10px;
  }
  .rendered-doc :global(.word-doc img) {
    max-width: 100%;
  }

  /* EPUB reader */
  .rendered-doc :global(.epub-reader) {
    max-width: 720px;
    margin: 0 auto;
    line-height: 1.7;
    font-size: 0.95rem;
  }
  .rendered-doc :global(.epub-title) {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }
  .rendered-doc :global(.epub-author) {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }
  .rendered-doc :global(.epub-chapter) {
    margin-bottom: 1.5rem;
  }
  .rendered-doc :global(.epub-chapter p) {
    margin: 0.5rem 0;
    line-height: 1.7;
  }
  .rendered-doc :global(.epub-chapter h1),
  .rendered-doc :global(.epub-chapter h2),
  .rendered-doc :global(.epub-chapter h3) {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
  .rendered-doc :global(.epub-chapter img) {
    max-width: 100%;
    border-radius: 4px;
  }
  .rendered-doc :global(.epub-separator) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
  }

  /* View toggle */
  .view-toggle {
    display: flex;
    gap: 2px;
  }

  .view-btn {
    padding: 6px 10px;
    font-size: 0.85rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
  }

  .view-btn.active {
    background: var(--accent-bg);
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .view-btn:hover:not(.active) {
    color: var(--text-primary);
  }

  /* Grid view */
  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .grid-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .grid-card:hover {
    border-color: var(--accent);
  }

  .grid-card.selected {
    background: var(--accent-bg);
    border-color: var(--accent);
  }

  .grid-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px 0;
    min-height: 24px;
  }

  .grid-card-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    flex: 1;
  }

  .grid-card-body:hover {
    background: var(--bg-inset);
  }

  .grid-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .grid-name {
    font-size: 0.78rem;
    text-align: center;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
    max-width: 100%;
  }

  .grid-size {
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .grid-card-actions {
    display: flex;
    gap: 4px;
    justify-content: center;
    padding: 6px 8px;
    border-top: 1px solid var(--border-subtle);
  }

  /* Checkbox column */
  .col-check {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Star column */
  .col-star {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .star-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-faint);
    line-height: 1;
    transition:
      color 0.1s,
      transform 0.1s;
  }

  .star-btn:hover {
    color: var(--warning, var(--accent));
    transform: scale(1.2);
  }

  .star-btn.starred {
    color: var(--warning, var(--accent));
  }

  /* Selected row highlight */
  .file-row.selected {
    background: var(--accent-bg);
  }

  /* Starred row subtle indicator */
  .file-row.starred .col-name .name-btn {
    font-weight: 500;
  }

  /* Bulk action bar */
  .bulk-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    margin-bottom: 10px;
    background: var(--accent-bg);
    border: 1px solid var(--accent);
    border-radius: 7px;
    font-size: 0.8rem;
  }

  .bulk-count {
    color: var(--accent);
    font-weight: 600;
    flex: 1;
  }

  .bulk-actions {
    display: flex;
    gap: 6px;
  }

  /* Size bar */
  .col-size {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .size-text {
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1;
  }

  .size-bar-track {
    display: block;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
    width: 100%;
  }

  .size-bar-fill {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    min-width: 2px;
  }

  /* Media play button inline */
  .name-with-play {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .play-inline-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--accent);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    line-height: 1;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .play-inline-btn:hover {
    background: var(--accent-bg);
    border-color: var(--accent);
  }

  .media-icon {
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .file-header,
    .file-row {
      grid-template-columns: 28px 28px 1fr 60px 90px;
    }

    .col-date,
    .col-type {
      display: none;
    }
  }

  /* Wildcard toggle */
  .wildcard-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    font-size: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .wildcard-toggle:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .wildcard-toggle.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .wildcard-icon {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1;
    font-family: 'JetBrains Mono', monospace;
  }

  .wildcard-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Inline terminal panel */
  .inline-terminal-panel {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    border-top: 2px solid var(--border);
    background: #0d1117;
    z-index: 50;
    margin-top: 24px;
  }

  .terminal-resize-handle {
    height: 6px;
    cursor: ns-resize;
    background: transparent;
    position: relative;
    transition: background 0.15s;
  }

  .terminal-resize-handle:hover,
  .terminal-resize-handle:active {
    background: var(--accent-bg);
  }

  .terminal-resize-handle::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 3px;
    border-radius: 2px;
    background: var(--border);
  }

  .terminal-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .terminal-panel-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .terminal-panel-title {
    font-weight: 600;
    color: var(--text-secondary);
  }

  .terminal-panel-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--danger);
    flex-shrink: 0;
  }

  .terminal-panel-dot.connected {
    background: var(--success);
  }

  .terminal-panel-cwd {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
  }

  .terminal-panel-actions {
    display: flex;
    gap: 6px;
  }

  .terminal-panel-body {
    overflow: hidden;
    padding: 4px 8px;
  }

  .terminal-panel-body :global(.xterm) {
    height: 100%;
    max-width: 100%;
  }

  .terminal-panel-body :global(.xterm-viewport) {
    overflow-y: auto !important;
  }

  .terminal-panel-body :global(.xterm-screen) {
    max-width: 100%;
  }
</style>
