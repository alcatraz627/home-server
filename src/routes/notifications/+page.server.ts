import { getNotifications, getUnreadCount } from '$lib/server/notifications';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const notifications = await getNotifications();
  const unreadCount = await getUnreadCount();
  return { notifications, unreadCount };
};
