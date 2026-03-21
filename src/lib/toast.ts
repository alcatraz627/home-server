import { writable } from 'svelte/store';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
	id: number;
	type: ToastType;
	message: string;
	duration: number;
}

let nextId = 0;

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(type: ToastType, message: string, duration = 4000) {
		const id = nextId++;
		update(toasts => [...toasts, { id, type, message, duration }]);
		if (duration > 0) {
			setTimeout(() => dismiss(id), duration);
		}
	}

	function dismiss(id: number) {
		update(toasts => toasts.filter(t => t.id !== id));
	}

	return {
		subscribe,
		success: (msg: string, duration?: number) => add('success', msg, duration),
		warning: (msg: string, duration?: number) => add('warning', msg, duration),
		error: (msg: string, duration?: number) => add('error', msg, duration),
		info: (msg: string, duration?: number) => add('info', msg, duration),
		dismiss,
	};
}

export const toast = createToastStore();
