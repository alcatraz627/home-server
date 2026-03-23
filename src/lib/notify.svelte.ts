import { browser } from '$app/environment';

/**
 * Browser system notification wrapper.
 * Requests permission on first use, then sends native notifications.
 */

let permissionGranted = $state(browser ? Notification.permission === 'granted' : false);

export function isNotificationSupported(): boolean {
  return browser && 'Notification' in window;
}

export function isNotificationEnabled(): boolean {
  return permissionGranted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function sendNotification(title: string, options?: { body?: string; icon?: string; tag?: string }): void {
  if (!permissionGranted || !isNotificationSupported()) return;
  try {
    const n = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.svg',
      tag: options?.tag,
      silent: false,
    });
    // Auto-close after 8 seconds
    setTimeout(() => n.close(), 8000);
    // Focus window on click
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Notification may fail in some contexts (e.g., service worker required on Android)
  }
}
