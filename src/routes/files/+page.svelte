<script lang="ts">
	import type { PageData } from './$types';
	import type { FileInfo } from '$lib/server/files';
	import type { FileMetadata } from '$lib/server/metadata';
	import { hasRenderer, renderDocument, type RenderResult, type SheetData } from '$lib/renderers';
	import DataTable from '$lib/components/DataTable.svelte';

	type EnrichedFile = FileInfo & { meta: FileMetadata | null };

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { files: initialFiles, currentPath: initialPath } = data;
	let files = $state<EnrichedFile[]>(initialFiles);
	let currentPath = $state(initialPath || '');
	let dragOver = $state(false);
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let uploadQueue = $state<{ name: string; progress: number; done: boolean }[]>([]);

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
	let sortField = $state<'name' | 'size' | 'modified' | 'mime'>('name');
	let sortAsc = $state(true);
	let typeFilter = $state('');

	let uniqueTypes = $derived([...new Set(files.map(f => f.mime.split('/')[0]))].sort());

	let filtered = $derived.by(() => {
		let result = files;
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(f => f.name.toLowerCase().includes(q));
		}
		if (typeFilter) {
			result = result.filter(f => f.mime.startsWith(typeFilter + '/'));
		}
		const dir = sortAsc ? 1 : -1;
		return [...result].sort((a, b) => {
			if (sortField === 'name') return a.name.localeCompare(b.name) * dir;
			if (sortField === 'size') return (a.size - b.size) * dir;
			if (sortField === 'modified') return (new Date(a.modified).getTime() - new Date(b.modified).getTime()) * dir;
			if (sortField === 'mime') return a.mime.localeCompare(b.mime) * dir;
			return 0;
		});
	});

	function toggleSort(field: typeof sortField) {
		if (sortField === field) sortAsc = !sortAsc;
		else { sortField = field; sortAsc = true; }
	}

	function sortIcon(field: typeof sortField): string {
		if (sortField !== field) return '';
		return sortAsc ? ' ↑' : ' ↓';
	}

	// Preview state
	let previewFile = $state<FileInfo | null>(null);

	// Rename state
	let renamingFile = $state<string | null>(null);
	let renameValue = $state('');

	// Info panel state
	let infoFile = $state<FileInfo | null>(null);

	// Delete confirm state
	let confirmingDelete = $state<string | null>(null);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

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
		return mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf';
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
		const res = await fetch(previewUrl(file.name));
		const data = await res.arrayBuffer();
		renderResult = await renderDocument(data, file.mime, file.name);
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
		const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
		const res = await fetch(`/api/files/${encodeURIComponent(oldName)}${params}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: renameValue })
		});
		if (res.ok) await refreshFiles();
		renamingFile = null;
	}

	function handleRenameKey(e: KeyboardEvent, oldName: string) {
		if (e.key === 'Enter') submitRename(oldName);
		if (e.key === 'Escape') renamingFile = null;
	}

	// Navigate into directory
	async function navigateTo(path: string) {
		currentPath = path;
		await refreshFiles();
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
		uploadQueue = [];
		await refreshFiles();
	}

	async function collectEntries(entry: any, basePath: string, result: { file: File; path: string }[]) {
		if (entry.isFile) {
			const file: File = await new Promise(resolve => entry.file(resolve));
			result.push({ file, path: basePath ? `${basePath}/${entry.name}` : '' });
		} else if (entry.isDirectory) {
			const reader = entry.createReader();
			const entries: any[] = await new Promise(resolve => reader.readEntries(resolve));
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
			uploadQueue = [];
			await refreshFiles();
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
			uploadQueue = [];
			await refreshFiles();
		}
	}

	// Create directory
	async function createDir() {
		if (!newDirName.trim()) return;
		await fetch('/api/files', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newDirName.trim(), path: currentPath || undefined })
		});
		newDirName = '';
		showNewDir = false;
		await refreshFiles();
	}

	async function refreshFiles() {
		const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
		const res = await fetch(`/api/files${params}`);
		files = await res.json();
	}

	function requestDelete(filename: string) {
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmingDelete = filename;
		confirmTimer = setTimeout(() => { confirmingDelete = null; }, 3000);
	}

	async function deleteFile(filename: string) {
		confirmingDelete = null;
		if (confirmTimer) clearTimeout(confirmTimer);
		const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
		const res = await fetch(`/api/files/${encodeURIComponent(filename)}${params}`, { method: 'DELETE' });
		if (res.ok) await refreshFiles();
	}

	async function deleteDir(name: string) {
		confirmingDelete = null;
		if (confirmTimer) clearTimeout(confirmTimer);
		const params = currentPath ? `path=${encodeURIComponent(currentPath)}&dir=true` : 'dir=true';
		const res = await fetch(`/api/files/${encodeURIComponent(name)}?${params}`, { method: 'DELETE' });
		if (res.ok) await refreshFiles();
	}
</script>

<svelte:head>
	<title>Files | Home Server</title>
</svelte:head>

<div class="page-header">
	<h2>Files</h2>
	<div class="page-actions">
		<button class="btn btn-sm" onclick={() => (showNewDir = !showNewDir)}>New Folder</button>
		<span class="file-count">{filtered.length} of {files.length} items</span>
	</div>
</div>

<!-- Breadcrumbs -->
<nav class="breadcrumbs">
	{#each breadcrumbs as crumb, i}
		{#if i > 0}<span class="crumb-sep">/</span>{/if}
		{#if i === breadcrumbs.length - 1}
			<span class="crumb-current">{crumb.name}</span>
		{:else}
			<button class="crumb-link" onclick={() => navigateTo(crumb.path)}>{crumb.name}</button>
		{/if}
	{/each}
</nav>

<!-- New folder input -->
{#if showNewDir}
	<div class="new-dir-bar">
		<input type="text" class="new-dir-input" bind:value={newDirName} placeholder="Folder name" onkeydown={(e) => { if (e.key === 'Enter') createDir(); if (e.key === 'Escape') showNewDir = false; }} />
		<button class="btn btn-sm" onclick={createDir} disabled={!newDirName.trim()}>Create</button>
		<button class="btn btn-sm" onclick={() => (showNewDir = false)}>Cancel</button>
	</div>
{/if}

<!-- Upload zone -->
<div
	class="drop-zone"
	class:active={dragOver}
	class:uploading
	ondragover={(e) => { e.preventDefault(); dragOver = true; }}
	ondragleave={() => (dragOver = false)}
	ondrop={handleDrop}
	role="region"
	aria-label="File upload area"
>
	{#if uploading}
		<div class="upload-progress-section">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {uploadProgress}%"></div>
			</div>
			<p class="progress-text">{uploadQueue.filter(q => q.done).length} / {uploadQueue.length} files — {uploadProgress}%</p>
			{#if uploadQueue.length <= 5}
				{#each uploadQueue as q}
					<div class="upload-item" class:done={q.done}>
						<span class="upload-item-name">{q.name}</span>
						<span class="upload-item-progress">{q.done ? '✓' : `${q.progress}%`}</span>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<div class="upload-content">
			<span class="upload-icon">↑</span>
			<p class="upload-main">
				Drop files or folders here, or
				<label class="file-label">browse files<input type="file" multiple onchange={handleFileInput} /></label>
				or
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<label class="file-label">upload folder<input type="file" onchange={handleFolderInput} webkitdirectory /></label>
			</p>
			<p class="upload-hint">Supports single files, multiple files, and entire folders with directory structure preserved</p>
		</div>
	{/if}
</div>

<!-- Search and filter bar -->
<div class="file-controls">
	<input type="text" class="search-input" placeholder="Search files..." bind:value={search} />
	{#if uniqueTypes.length > 1}
		<select class="type-filter" bind:value={typeFilter}>
			<option value="">All types</option>
			{#each uniqueTypes as t}
				<option value={t}>{t}</option>
			{/each}
		</select>
	{/if}
</div>

<!-- File list -->
{#if files.length === 0}
	<p class="empty">No files yet. Upload something to get started.</p>
{:else if filtered.length === 0}
	<p class="empty">No files match your search.</p>
{:else}
	<div class="file-list">
		<div class="file-header">
			<span class="col-name sortable" onclick={() => toggleSort('name')}>Name{sortIcon('name')}</span>
			<span class="col-type sortable" onclick={() => toggleSort('mime')}>Type{sortIcon('mime')}</span>
			<span class="col-size sortable" onclick={() => toggleSort('size')}>Size{sortIcon('size')}</span>
			<span class="col-date sortable" onclick={() => toggleSort('modified')}>Modified{sortIcon('modified')}</span>
			<span class="col-actions"></span>
		</div>
		{#each filtered as file}
			<div class="file-row">
				<span class="col-name" title={file.name}>
					{#if renamingFile === file.name}
						<input
							class="rename-input"
							type="text"
							bind:value={renameValue}
							onkeydown={(e) => handleRenameKey(e, file.name)}
							onblur={() => submitRename(file.name)}
						/>
					{:else}
						{#if file.isDirectory}
							<button class="name-btn dir-btn" onclick={() => navigateTo(currentPath ? `${currentPath}/${file.name}` : file.name)}>
								📁 {file.name}
							</button>
						{:else}
							<button class="name-btn" class:previewable={isPreviewable(file)} onclick={() => openPreview(file)}>
								{file.name}
							</button>
						{/if}
					{/if}
				</span>
				<span class="col-type" title={file.mime}>{file.mime.split('/')[1] || file.mime}</span>
				<span class="col-size">{file.isDirectory ? '-' : formatSize(file.size)}</span>
				<span class="col-date">{formatDate(file.modified)}</span>
				<span class="col-actions">
					<button class="btn btn-sm" title="Info" onclick={() => (infoFile = infoFile?.name === file.name ? null : file)}>i</button>
					<button class="btn btn-sm" title="Rename" onclick={() => startRename(file)}>mv</button>
					{#if !file.isDirectory}
						<a href={downloadUrl(file.name)} class="btn btn-sm" title="Download">dl</a>
					{/if}
					{#if confirmingDelete === file.name}
						<button class="btn btn-sm btn-confirm" onclick={() => file.isDirectory ? deleteDir(file.name) : deleteFile(file.name)}>sure?</button>
					{:else}
						<button class="btn btn-sm btn-danger" onclick={() => requestDelete(file.name)}>rm</button>
					{/if}
				</span>
			</div>
			{#if infoFile?.name === file.name}
				<div class="info-panel">
					<div class="info-grid">
						<span class="info-label">MIME</span><span>{file.mime}</span>
						<span class="info-label">Size</span><span>{formatSize(file.size)} ({file.size.toLocaleString()} bytes)</span>
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
									<button
										class="sheet-tab"
										class:active={activeSheet === i}
										onclick={() => (activeSheet = i)}
									>{sheet.name}</button>
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

	.page-actions { display: flex; align-items: center; gap: 10px; }

	.file-count {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* Breadcrumbs */
	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 14px;
		font-size: 0.8rem;
		padding: 8px 12px;
		background: var(--bg-secondary);
		border-radius: 6px;
		border: 1px solid var(--border);
		overflow-x: auto;
	}

	.crumb-link {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		padding: 2px 4px;
		border-radius: 3px;
	}

	.crumb-link:hover { background: var(--accent-bg); }
	.crumb-sep { color: var(--text-faint); }
	.crumb-current { color: var(--text-primary); font-weight: 500; }

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

	.new-dir-input:focus { outline: none; }

	.dir-btn {
		color: var(--accent) !important;
		cursor: pointer !important;
	}

	.dir-btn:hover { text-decoration: underline; }

	/* Upload queue */
	.upload-progress-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}

	.progress-text {
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
	}

	.upload-item {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--text-muted);
		padding: 2px 0;
	}

	.upload-item.done { color: var(--success); }

	.upload-item-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 80%;
	}

	.upload-main {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.file-controls {
		display: flex;
		gap: 8px;
		margin-bottom: 14px;
	}

	.search-input {
		flex: 1;
		padding: 7px 12px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--bg-inset);
		color: var(--text-primary);
		font-family: inherit;
	}

	.search-input:focus { outline: none; border-color: var(--accent); }

	.type-filter {
		padding: 7px 12px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: inherit;
	}

	.upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.upload-icon {
		font-size: 1.5rem;
		color: var(--text-faint);
	}

	.upload-hint {
		font-size: 0.75rem;
		color: var(--text-faint);
	}

	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		color: var(--text-primary);
	}

	.drop-zone {
		border: 2px dashed var(--border);
		border-radius: 8px;
		padding: 32px;
		text-align: center;
		margin-bottom: 20px;
		transition: border-color 0.15s, background 0.15s;
	}

	.drop-zone.active {
		border-color: var(--accent);
		background: var(--accent-bg);
	}

	.drop-zone p {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.file-label {
		color: var(--accent);
		cursor: pointer;
		text-decoration: underline;
	}

	.file-label input {
		display: none;
	}

	.progress-bar {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		margin-bottom: 8px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.2s;
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
		grid-template-columns: 1fr 90px 80px 160px 130px;
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

	.col-size,
	.col-date {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.col-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
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

	.btn-danger:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.btn-confirm {
		border-color: var(--danger);
		background: var(--danger-bg);
		color: var(--danger);
		animation: pulse 0.6s ease-in-out infinite alternate;
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
		from { opacity: 0.7; }
		to { opacity: 1; }
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
	.rendered-doc :global(.md-content) { line-height: 1.7; font-size: 0.9rem; }
	.rendered-doc :global(.md-content h1) { font-size: 1.5rem; margin: 16px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
	.rendered-doc :global(.md-content h2) { font-size: 1.3rem; margin: 14px 0 6px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px; }
	.rendered-doc :global(.md-content h3) { font-size: 1.1rem; margin: 12px 0 6px; }
	.rendered-doc :global(.md-content h4), .rendered-doc :global(.md-content h5), .rendered-doc :global(.md-content h6) { font-size: 1rem; margin: 10px 0 4px; }
	.rendered-doc :global(.md-content p) { margin: 8px 0; }
	.rendered-doc :global(.md-content ul), .rendered-doc :global(.md-content ol) { padding-left: 24px; margin: 8px 0; }
	.rendered-doc :global(.md-content li) { margin: 4px 0; }
	.rendered-doc :global(.md-content blockquote) { border-left: 3px solid var(--border); padding-left: 12px; color: var(--text-muted); margin: 8px 0; }
	.rendered-doc :global(.md-content hr) { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
	.rendered-doc :global(.md-content a) { color: var(--accent); }
	.rendered-doc :global(.md-content code) { background: var(--code-bg); padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }
	.rendered-doc :global(.md-content pre) { background: var(--code-bg); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
	.rendered-doc :global(.md-content pre code) { padding: 0; background: none; }
	.rendered-doc :global(.md-content strong) { color: var(--text-primary); }

	/* JSON tree viewer */
	.rendered-doc :global(.json-tree) { font-size: 0.8rem; line-height: 1.4; background: var(--code-bg); padding: 16px; border-radius: 6px; overflow: auto; }
	.rendered-doc :global(.jv-toggle) { display: none; }
	.rendered-doc :global(.jv-collapsible) { cursor: pointer; }
	.rendered-doc :global(.jv-collapsible:hover) { color: var(--accent); }
	.rendered-doc :global(.jv-count) { display: none; color: var(--text-faint); font-style: italic; font-size: 0.75rem; }
	.rendered-doc :global(.jv-toggle:not(:checked) ~ .jv-count) { display: inline; }
	.rendered-doc :global(.jv-toggle:not(:checked) ~ .jv-content) { display: none; }
	.rendered-doc :global(.jv-key) { color: #79c0ff; }
	.rendered-doc :global(.jv-string) { color: #a5d6ff; }
	.rendered-doc :global(.jv-number) { color: var(--purple); }
	.rendered-doc :global(.jv-bool) { color: #ff7b72; }
	.rendered-doc :global(.jv-null) { color: var(--text-faint); font-style: italic; }
	.rendered-doc :global(.jv-bracket) { color: var(--text-muted); }
	.rendered-doc :global(.jv-colon) { color: var(--text-muted); }
	.rendered-doc :global(.jv-comma) { color: var(--text-muted); }

	/* Word */
	.rendered-doc :global(.word-doc) { line-height: 1.7; font-size: 0.9rem; }
	.rendered-doc :global(.word-doc p) { margin: 8px 0; }
	.rendered-doc :global(.word-doc h1) { font-size: 1.5rem; margin: 16px 0 8px; }
	.rendered-doc :global(.word-doc h2) { font-size: 1.3rem; margin: 14px 0 6px; }
	.rendered-doc :global(.word-doc table) { width: 100%; border-collapse: collapse; margin: 12px 0; }
	.rendered-doc :global(.word-doc td), .rendered-doc :global(.word-doc th) { border: 1px solid var(--border); padding: 6px 10px; }
	.rendered-doc :global(.word-doc img) { max-width: 100%; }

	@media (max-width: 640px) {
		.file-header,
		.file-row {
			grid-template-columns: 1fr 60px 90px;
		}

		.col-date,
		.col-type {
			display: none;
		}
	}
</style>
