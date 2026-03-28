import type { PageServerLoad } from './$types';
import { readReminders } from '$lib/server/reminders';

export const load: PageServerLoad = async () => {
  return { reminders: readReminders() };
};
