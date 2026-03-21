<script lang="ts">
	import type { Widget } from '$lib/types';

	const widgets: Widget[] = [
		{
			id: 'files',
			title: 'File Transfer',
			href: '/files',
			description: 'Send and receive files between devices',
			status: 'active'
		},
		{
			id: 'lights',
			title: 'Smart Lights',
			href: '/lights',
			description: 'Control Wiz bulbs',
			status: 'active'
		},
		{
			id: 'processes',
			title: 'Process Manager',
			href: '/processes',
			description: 'View and manage running processes',
			status: 'active'
		},
		{
			id: 'tailscale',
			title: 'Tailscale',
			href: '/tailscale',
			description: 'View connected devices on tailnet',
			status: 'active'
		},
		{
			id: 'terminal',
			title: 'Terminal',
			href: '/terminal',
			description: 'Web-based shell access',
			status: 'active'
		},
		{
			id: 'backups',
			title: 'Backups',
			href: '/backups',
			description: 'Phone backup status and controls',
			status: 'active'
		}
	];
</script>

<svelte:head>
	<title>Dashboard | Home Server</title>
</svelte:head>

<h2>Dashboard</h2>
<div class="grid">
	{#each widgets as widget}
		<a
			href={widget.href}
			class="card"
			class:disabled={widget.status === 'coming-soon'}
		>
			<h3>{widget.title}</h3>
			<p>{widget.description}</p>
			{#if widget.status === 'coming-soon'}
				<span class="badge">Coming Soon</span>
			{/if}
		</a>
	{/each}
</div>

<style>
	h2 {
		font-size: 1.3rem;
		margin-bottom: 20px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 16px;
	}

	.card {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 8px;
		padding: 20px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
		position: relative;
	}

	.card:hover:not(.disabled) {
		border-color: #58a6ff;
	}

	.card.disabled {
		opacity: 0.5;
		cursor: default;
	}

	.card h3 {
		font-size: 1rem;
		margin-bottom: 6px;
	}

	.card p {
		font-size: 0.85rem;
		color: #8b949e;
	}

	.badge {
		display: inline-block;
		margin-top: 10px;
		font-size: 0.7rem;
		padding: 3px 8px;
		border-radius: 12px;
		background: #30363d;
		color: #8b949e;
	}
</style>
