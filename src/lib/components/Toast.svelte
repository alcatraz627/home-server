<script lang="ts">
	import { toast } from '$lib/toast';
	import { fly, fade } from 'svelte/transition';
</script>

{#if $toast.length > 0}
	<div class="toast-container">
		{#each $toast as t (t.id)}
			<div
				class="toast toast-{t.type}"
				role="alert"
				in:fly={{ y: 20, duration: 200 }}
				out:fade={{ duration: 150 }}
			>
				<span class="toast-icon">
					{#if t.type === 'success'}✓
					{:else if t.type === 'error'}✕
					{:else if t.type === 'warning'}⚠
					{:else}ℹ
					{/if}
				</span>
				<span class="toast-message">{t.message}</span>
				<button class="toast-close" onclick={() => toast.dismiss(t.id)}>×</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 380px;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.8rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(8px);
	}

	.toast-success { border-left: 3px solid var(--success); }
	.toast-error { border-left: 3px solid var(--danger); }
	.toast-warning { border-left: 3px solid var(--warning); }
	.toast-info { border-left: 3px solid var(--accent); }

	.toast-icon {
		font-size: 0.9rem;
		flex-shrink: 0;
		width: 18px;
		text-align: center;
	}

	.toast-success .toast-icon { color: var(--success); }
	.toast-error .toast-icon { color: var(--danger); }
	.toast-warning .toast-icon { color: var(--warning); }
	.toast-info .toast-icon { color: var(--accent); }

	.toast-message {
		flex: 1;
		line-height: 1.4;
	}

	.toast-close {
		background: none;
		border: none;
		color: var(--text-faint);
		font-size: 1rem;
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
		flex-shrink: 0;
	}

	.toast-close:hover {
		color: var(--text-primary);
	}

	@media (max-width: 640px) {
		.toast-container {
			bottom: 10px;
			right: 10px;
			left: 10px;
			max-width: none;
		}
	}
</style>
