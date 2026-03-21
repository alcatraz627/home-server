<script lang="ts">
	import type { LayoutData } from './$types';
	import { APP } from '$lib/constants/app';

	let { data, children } = $props<{ data: LayoutData; children: any }>();
	let sidebarOpen = $state(false);

	const nav = [
		{ href: '/', label: 'Dashboard', icon: '⌂' },
		{ href: '/files', label: 'Files', icon: '⇄' },
		{ href: '/lights', label: 'Lights', icon: '◉' },
		{ href: '/processes', label: 'Processes', icon: '⊞' },
		{ href: '/tailscale', label: 'Tailscale', icon: '⊶' }
	];
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

<div class="app">
	<header>
		<button class="menu-toggle" onclick={() => (sidebarOpen = !sidebarOpen)}>☰</button>
		<h1>Home Server</h1>
		<span class="device-info">{data.device.hostname}</span>
	</header>

	<div class="body">
		<nav class:open={sidebarOpen}>
			{#each nav as item}
				<a href={item.href} onclick={() => (sidebarOpen = false)}>
					<span class="nav-icon">{item.icon}</span>
					{item.label}
				</a>
			{/each}
			<span class="version-tag">{APP.version}</span>
		</nav>

		<main>
			{@render children()}
		</main>
	</div>
</div>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		background: #0f1117;
		color: #e1e4e8;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		background: #161b22;
		border-bottom: 1px solid #30363d;
	}

	header h1 {
		font-size: 1.1rem;
		font-weight: 600;
		flex: 1;
	}

	.device-info {
		font-size: 0.8rem;
		color: #8b949e;
		font-family: monospace;
	}

	.menu-toggle {
		display: none;
		background: none;
		border: none;
		color: #e1e4e8;
		font-size: 1.3rem;
		cursor: pointer;
	}

	.body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	nav {
		width: 200px;
		background: #161b22;
		border-right: 1px solid #30363d;
		padding: 12px 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 20px;
		color: #c9d1d9;
		text-decoration: none;
		font-size: 0.9rem;
		transition: background 0.15s;
	}

	nav a:hover {
		background: #1f2937;
	}

	.version-tag {
		margin-top: auto;
		padding: 8px 20px;
		font-size: 0.65rem;
		color: #484f58;
		font-family: monospace;
		letter-spacing: 0.03em;
	}

	.nav-icon {
		font-size: 1.1rem;
		width: 20px;
		text-align: center;
	}

	main {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}

	@media (max-width: 640px) {
		.menu-toggle {
			display: block;
		}

		nav {
			position: fixed;
			top: 49px;
			left: 0;
			bottom: 0;
			z-index: 10;
			transform: translateX(-100%);
			transition: transform 0.2s ease;
		}

		nav.open {
			transform: translateX(0);
		}
	}
</style>
