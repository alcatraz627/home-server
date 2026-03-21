<script lang="ts">
	import type { PageData } from './$types';
	import type { FileInfo } from '$lib/server/files';
	import type { FileMetadata } from '$lib/server/metadata';
	import { hasRenderer, renderDocument, type RenderResult, type SheetData } from '$lib/renderers';
	import DataTable from '$lib/components/DataTable.svelte';

	type EnrichedFile = FileInfo & { meta: FileMetadata | null };

	let { data } = $props<{ data: PageData }>();
	let files = $state<EnrichedFile[]>(data.files);
	$effect(() => { files = data.files; });
	let dragOver = $state(false);
	let uploading = $state(false);
	let uploadProgress = $state(0);

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
		const params = data.currentPath ? `?path=${encodeURIComponent(data.currentPath)}&preview=true` : '?preview=true';
		return `/api/files/${encodeURIComponent(filename)}${params}`;
	}

	function downloadUrl(filename: string): string {
		const params = data.currentPath ? `?path=${encodeURIComponent(data.currentPath)}` : '';
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
		const params = data.currentPath ? `?path=${encodeURIComponent(data.currentPath)}` : '';
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

	// Upload
	async function uploadFile(file: File) {
		uploading = true;
		uploadProgress = 0;
		const formData = new FormData();
		formData.append('file', file);
		if (data.currentPath) formData.append('path', data.currentPath);
		const xhr = new XMLHttpRequest();
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) uploadProgress = Math.round((e.loaded / e.total) * 100);
		};
		await new Promise<void>((resolve, reject) => {
			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) resolve();
				else reject(new Error(`Upload failed: ${xhr.status}`));
			};
			xhr.onerror = () => reject(new Error('Upload failed'));
			xhr.open('POST', '/api/files');
			xhr.send(formData);
		});
		uploading = false;
		await refreshFiles();
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles?.length) {
			for (const file of droppedFiles) {
				await uploadFile(file);
			}
		}
	}

	async function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			for (const file of input.files) {
				await uploadFile(file);
			}
			input.value = '';
		}
	}

	async function refreshFiles() {
		const params = data.currentPath ? `?path=${encodeURIComponent(data.currentPath)}` : '';
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
		const params = data.currentPath ? `?path=${encodeURIComponent(data.currentPath)}` : '';
		const res = await fetch(`/api/files/${encodeURIComponent(filename)}${params}`, {
			method: 'DELETE'
		});
		if (res.ok) await refreshFiles();
	}
</script>

<svelte:head>
	<title>Files | Home Server</title>
</svelte:head>

<h2>Files</h2>

<!-- Drop zone -->
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
		<div class="progress-bar">
			<div class="progress-fill" style="width: {uploadProgress}%"></div>
		</div>
		<p>Uploading... {uploadProgress}%</p>
	{:else}
		<p>Drop files here or <label class="file-label">browse<input type="file" multiple onchange={handleFileInput} /></label></p>
	{/if}
</div>

<!-- File list -->
{#if files.length === 0}
	<p class="empty">No files yet. Upload something to get started.</p>
{:else}
	<div class="file-list">
		<div class="file-header">
			<span class="col-name">Name</span>
			<span class="col-type">Type</span>
			<span class="col-size">Size</span>
			<span class="col-date">Modified</span>
			<span class="col-actions"></span>
		</div>
		{#each files as file}
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
						<button class="name-btn" class:previewable={isPreviewable(file)} onclick={() => openPreview(file)}>
							{file.isDirectory ? '/' : ''}{file.name}
						</button>
					{/if}
				</span>
				<span class="col-type" title={file.mime}>{file.mime.split('/')[1] || file.mime}</span>
				<span class="col-size">{file.isDirectory ? '-' : formatSize(file.size)}</span>
				<span class="col-date">{formatDate(file.modified)}</span>
				<span class="col-actions">
					{#if !file.isDirectory}
						<button class="btn btn-sm" title="Info" onclick={() => (infoFile = infoFile?.name === file.name ? null : file)}>i</button>
						<button class="btn btn-sm" title="Rename" onclick={() => startRename(file)}>mv</button>
						<a href={downloadUrl(file.name)} class="btn btn-sm" title="Download">dl</a>
						{#if confirmingDelete === file.name}
							<button class="btn btn-sm btn-confirm" onclick={() => deleteFile(file.name)}>sure?</button>
						{:else}
							<button class="btn btn-sm btn-danger" onclick={() => requestDelete(file.name)}>rm</button>
						{/if}
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
	h2 {
		font-size: 1.3rem;
		margin-bottom: 16px;
	}

	.drop-zone {
		border: 2px dashed #30363d;
		border-radius: 8px;
		padding: 32px;
		text-align: center;
		margin-bottom: 20px;
		transition: border-color 0.15s, background 0.15s;
	}

	.drop-zone.active {
		border-color: #58a6ff;
		background: rgba(88, 166, 255, 0.05);
	}

	.drop-zone p {
		color: #8b949e;
		font-size: 0.9rem;
	}

	.file-label {
		color: #58a6ff;
		cursor: pointer;
		text-decoration: underline;
	}

	.file-label input {
		display: none;
	}

	.progress-bar {
		height: 4px;
		background: #30363d;
		border-radius: 2px;
		margin-bottom: 8px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #58a6ff;
		transition: width 0.2s;
	}

	.empty {
		color: #8b949e;
		text-align: center;
		padding: 40px;
	}

	.file-list {
		border: 1px solid #30363d;
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
		background: #161b22;
		font-size: 0.75rem;
		color: #8b949e;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.file-row {
		border-top: 1px solid #21262d;
		font-size: 0.85rem;
	}

	.file-row:hover {
		background: #161b22;
	}

	.col-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name-btn {
		background: none;
		border: none;
		color: #c9d1d9;
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
		color: #58a6ff;
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
		border: 1px solid #58a6ff;
		background: #0d1117;
		color: #e1e4e8;
		font-family: inherit;
	}

	.col-type {
		color: #8b949e;
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-size,
	.col-date {
		color: #8b949e;
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
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
		text-decoration: none;
		font-family: monospace;
	}

	.btn:hover {
		border-color: #58a6ff;
	}

	.btn-danger:hover {
		border-color: #f85149;
		color: #f85149;
	}

	.btn-confirm {
		border-color: #f85149;
		background: #f8514922;
		color: #f85149;
		animation: pulse 0.6s ease-in-out infinite alternate;
	}

	/* Info panel */
	.info-panel {
		padding: 10px 16px 10px 32px;
		border-top: 1px solid #21262d;
		background: #0d1117;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: 4px 12px;
		font-size: 0.8rem;
	}

	.info-label {
		color: #8b949e;
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
		background: #161b22;
		border: 1px solid #30363d;
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
		border-bottom: 1px solid #30363d;
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
		background: #0d1117;
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
		color: #8b949e;
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
		border: 1px solid #30363d;
		background: #21262d;
		color: #8b949e;
		cursor: pointer;
		font-family: inherit;
	}

	.sheet-tab:hover {
		color: #e1e4e8;
	}

	.sheet-tab.active {
		background: #0d1117;
		color: #e1e4e8;
		border-bottom-color: #0d1117;
	}

	/* Rendered document container (all renderer output) */
	.rendered-doc {
		max-height: 70vh;
		overflow: auto;
	}

	/* Markdown */
	.rendered-doc :global(.md-content) { line-height: 1.7; font-size: 0.9rem; }
	.rendered-doc :global(.md-content h1) { font-size: 1.5rem; margin: 16px 0 8px; border-bottom: 1px solid #30363d; padding-bottom: 6px; }
	.rendered-doc :global(.md-content h2) { font-size: 1.3rem; margin: 14px 0 6px; border-bottom: 1px solid #21262d; padding-bottom: 4px; }
	.rendered-doc :global(.md-content h3) { font-size: 1.1rem; margin: 12px 0 6px; }
	.rendered-doc :global(.md-content h4), .rendered-doc :global(.md-content h5), .rendered-doc :global(.md-content h6) { font-size: 1rem; margin: 10px 0 4px; }
	.rendered-doc :global(.md-content p) { margin: 8px 0; }
	.rendered-doc :global(.md-content ul), .rendered-doc :global(.md-content ol) { padding-left: 24px; margin: 8px 0; }
	.rendered-doc :global(.md-content li) { margin: 4px 0; }
	.rendered-doc :global(.md-content blockquote) { border-left: 3px solid #30363d; padding-left: 12px; color: #8b949e; margin: 8px 0; }
	.rendered-doc :global(.md-content hr) { border: none; border-top: 1px solid #30363d; margin: 16px 0; }
	.rendered-doc :global(.md-content a) { color: #58a6ff; }
	.rendered-doc :global(.md-content code) { background: #0d1117; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }
	.rendered-doc :global(.md-content pre) { background: #0d1117; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
	.rendered-doc :global(.md-content pre code) { padding: 0; background: none; }
	.rendered-doc :global(.md-content strong) { color: #e1e4e8; }

	/* JSON tree viewer */
	.rendered-doc :global(.json-tree) { font-size: 0.8rem; line-height: 1.4; background: #0d1117; padding: 16px; border-radius: 6px; overflow: auto; }
	.rendered-doc :global(.jv-toggle) { display: none; }
	.rendered-doc :global(.jv-collapsible) { cursor: pointer; }
	.rendered-doc :global(.jv-collapsible:hover) { color: #58a6ff; }
	.rendered-doc :global(.jv-count) { display: none; color: #484f58; font-style: italic; font-size: 0.75rem; }
	.rendered-doc :global(.jv-toggle:not(:checked) ~ .jv-count) { display: inline; }
	.rendered-doc :global(.jv-toggle:not(:checked) ~ .jv-content) { display: none; }
	.rendered-doc :global(.jv-key) { color: #79c0ff; }
	.rendered-doc :global(.jv-string) { color: #a5d6ff; }
	.rendered-doc :global(.jv-number) { color: #d2a8ff; }
	.rendered-doc :global(.jv-bool) { color: #ff7b72; }
	.rendered-doc :global(.jv-null) { color: #484f58; font-style: italic; }
	.rendered-doc :global(.jv-bracket) { color: #8b949e; }
	.rendered-doc :global(.jv-colon) { color: #8b949e; }
	.rendered-doc :global(.jv-comma) { color: #8b949e; }

	/* Word */
	.rendered-doc :global(.word-doc) { line-height: 1.7; font-size: 0.9rem; }
	.rendered-doc :global(.word-doc p) { margin: 8px 0; }
	.rendered-doc :global(.word-doc h1) { font-size: 1.5rem; margin: 16px 0 8px; }
	.rendered-doc :global(.word-doc h2) { font-size: 1.3rem; margin: 14px 0 6px; }
	.rendered-doc :global(.word-doc table) { width: 100%; border-collapse: collapse; margin: 12px 0; }
	.rendered-doc :global(.word-doc td), .rendered-doc :global(.word-doc th) { border: 1px solid #30363d; padding: 6px 10px; }
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
