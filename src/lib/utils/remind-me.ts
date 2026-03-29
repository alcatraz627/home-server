import { postJson } from '$lib/api';
import { toast } from '$lib/toast';

/**
 * Create a reminder linked to any productivity item.
 * Shows a toast on success/failure.
 */
export async function remindMe(
  sourceType: 'note' | 'kanban' | 'bookmark' | 'keeper',
  sourceId: string,
  title: string,
  /** ISO datetime string for when to fire. Defaults to tomorrow 9am if not provided. */
  datetime?: string,
): Promise<void> {
  try {
    const when = datetime || new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T09:00';
    const res = await postJson('/api/reminders', {
      title: `Reminder: ${title}`,
      description: `Linked from ${sourceType}: ${title}`,
      datetime: new Date(when).toISOString(),
      channels: ['browser'],
    });
    if (!res.ok) throw new Error();
    const reminder = await res.json();

    // Create link
    await postJson('/api/links', {
      sourceType,
      sourceId,
      targetType: 'reminder',
      targetId: reminder.id,
    });

    toast.success('Reminder set for tomorrow 9am');
  } catch {
    toast.error('Failed to set reminder');
  }
}
