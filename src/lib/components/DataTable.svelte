<script lang="ts">
	interface Props {
		headers: string[];
		rows: string[][];
		pageSize?: number;
	}

	let { headers, rows, pageSize = 50 }: Props = $props();

	let search = $state('');
	let sortCol = $state(-1);
	let sortAsc = $state(true);
	let page = $state(0);
	let columnFilters = $state<Record<number, string>>({});
	let showFilters = $state(false);

	// Filter by search + column filters
	let filtered = $derived.by(() => {
		let result = rows;

		// Global search
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(row =>
				row.some(cell => cell.toLowerCase().includes(q))
			);
		}

		// Per-column filters
		for (const [colStr, val] of Object.entries(columnFilters)) {
			if (!val) continue;
			const col = parseInt(colStr);
			const q = val.toLowerCase();
			result = result.filter(row => row[col]?.toLowerCase().includes(q));
		}

		return result;
	});

	// Sort
	let sorted = $derived.by(() => {
		if (sortCol < 0) return filtered;
		const col = sortCol;
		const dir = sortAsc ? 1 : -1;

		return [...filtered].sort((a, b) => {
			const va = a[col] ?? '';
			const vb = b[col] ?? '';
			// Try numeric comparison
			const na = parseFloat(va);
			const nb = parseFloat(vb);
			if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
			return va.localeCompare(vb) * dir;
		});
	});

	// Paginate
	let totalPages = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
	let paged = $derived(sorted.slice(page * pageSize, (page + 1) * pageSize));

	// Reset page when filters change
	$effect(() => {
		// Access filtered to track dependency
		filtered.length;
		page = 0;
	});

	function toggleSort(col: number) {
		if (sortCol === col) {
			sortAsc = !sortAsc;
		} else {
			sortCol = col;
			sortAsc = true;
		}
	}

	function sortIndicator(col: number): string {
		if (sortCol !== col) return '';
		return sortAsc ? ' ↑' : ' ↓';
	}

	function setColumnFilter(col: number, value: string) {
		columnFilters = { ...columnFilters, [col]: value };
	}
</script>

<div class="dt-controls">
	<input
		type="text"
		class="dt-search"
		placeholder="Search all columns..."
		bind:value={search}
	/>
	<button class="dt-btn" class:active={showFilters} onclick={() => (showFilters = !showFilters)}>
		Filters {showFilters ? '▲' : '▼'}
	</button>
	<span class="dt-info">
		{filtered.length} of {rows.length} rows
	</span>
</div>

<div class="dt-wrapper">
	<table class="dt-table">
		<thead>
			<tr>
				{#each headers as header, i}
					<th onclick={() => toggleSort(i)}>
						{header}{sortIndicator(i)}
					</th>
				{/each}
			</tr>
			{#if showFilters}
				<tr class="dt-filter-row">
					{#each headers as _, i}
						<th>
							<input
								type="text"
								class="dt-col-filter"
								placeholder="Filter..."
								value={columnFilters[i] || ''}
								oninput={(e) => setColumnFilter(i, (e.target as HTMLInputElement).value)}
							/>
						</th>
					{/each}
				</tr>
			{/if}
		</thead>
		<tbody>
			{#each paged as row}
				<tr>
					{#each row as cell}
						<td title={cell}>{cell}</td>
					{/each}
				</tr>
			{:else}
				<tr>
					<td colspan={headers.length} class="dt-empty">No matching rows</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if totalPages > 1}
	<div class="dt-pagination">
		<button class="dt-btn" disabled={page === 0} onclick={() => (page = 0)}>«</button>
		<button class="dt-btn" disabled={page === 0} onclick={() => (page--)}>‹</button>
		<span class="dt-page-info">
			Page {page + 1} of {totalPages}
		</span>
		<button class="dt-btn" disabled={page >= totalPages - 1} onclick={() => (page++)}>›</button>
		<button class="dt-btn" disabled={page >= totalPages - 1} onclick={() => (page = totalPages - 1)}>»</button>
	</div>
{/if}

<style>
	.dt-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		flex-wrap: wrap;
	}

	.dt-search {
		flex: 1;
		min-width: 180px;
		padding: 6px 12px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid #30363d;
		background: #0d1117;
		color: #e1e4e8;
		font-family: inherit;
	}

	.dt-search:focus {
		outline: none;
		border-color: #58a6ff;
	}

	.dt-btn {
		padding: 5px 12px;
		font-size: 0.75rem;
		border-radius: 6px;
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
	}

	.dt-btn:hover:not(:disabled) {
		border-color: #58a6ff;
	}

	.dt-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.dt-btn.active {
		border-color: #58a6ff;
		color: #58a6ff;
	}

	.dt-info {
		font-size: 0.75rem;
		color: #8b949e;
		white-space: nowrap;
	}

	.dt-wrapper {
		overflow: auto;
		max-height: 60vh;
		border: 1px solid #30363d;
		border-radius: 8px;
	}

	.dt-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.dt-table thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.dt-table th {
		background: #161b22;
		color: #8b949e;
		font-weight: 500;
		padding: 8px 10px;
		text-align: left;
		border-bottom: 1px solid #30363d;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.dt-table th:hover {
		color: #e1e4e8;
	}

	.dt-filter-row th {
		padding: 4px 6px;
		cursor: default;
	}

	.dt-col-filter {
		width: 100%;
		padding: 3px 6px;
		font-size: 0.75rem;
		border-radius: 4px;
		border: 1px solid #30363d;
		background: #0d1117;
		color: #e1e4e8;
		font-family: inherit;
	}

	.dt-col-filter:focus {
		outline: none;
		border-color: #58a6ff;
	}

	.dt-table td {
		padding: 6px 10px;
		border-top: 1px solid #21262d;
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dt-table tbody tr:hover td {
		background: #161b22;
	}

	.dt-empty {
		text-align: center;
		color: #8b949e;
		padding: 24px 10px !important;
	}

	.dt-pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 10px;
	}

	.dt-page-info {
		font-size: 0.75rem;
		color: #8b949e;
		min-width: 100px;
		text-align: center;
	}
</style>
